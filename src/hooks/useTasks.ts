import { useState, useEffect, useCallback, useRef } from 'react';
import { Task, TaskStatus, TaskGroup, loadTasks, saveTasks, loadGroups, saveGroups, getToday, generateId } from '@/lib/storage';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [groups, setGroups] = useState<TaskGroup[]>(() => loadGroups());
  const [selectedDate, setSelectedDate] = useState(getToday());

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    saveGroups(groups);
  }, [groups]);

  const addGroup = useCallback((name: string, date?: string, isDaily?: boolean, scheduledTime?: string, pomodoroCount?: number, customTimeMinutes?: number) => {
    const group: TaskGroup = {
      id: generateId(),
      name,
      date: date ?? selectedDate,
      createdAt: new Date().toISOString(),
      isDaily,
      scheduledTime,
      pomodoroCount,
      customTimeMinutes,
    };
    setGroups(prev => [...prev, group]);
    return group.id;
  }, [selectedDate]);

  const editGroup = useCallback((id: string, updates: { name?: string; date?: string; isDaily?: boolean; scheduledTime?: string; pomodoroCount?: number; customTimeMinutes?: number }) => {
    const target = groups.find(g => g.id === id);
    const isDailyGroup = target?.isDaily || updates.isDaily;
    // For daily groups, propagate non-date edits to ALL historical copies sharing the same name
    // so edits stick across days (templates used by reset/repair stay consistent).
    const { date: _omitDate, ...propagatable } = updates;
    setGroups(prev => prev.map(g => {
      if (g.id === id) return { ...g, ...updates };
      if (isDailyGroup && target && g.isDaily && g.name === (updates.name ?? target.name) ) {
        return { ...g, ...propagatable };
      }
      // Match by previous name too in case rename
      if (isDailyGroup && target && g.isDaily && g.name === target.name) {
        return { ...g, ...propagatable };
      }
      return g;
    }));
    // If date changed on a non-daily group, propagate to all tasks in the group
    if (updates.date) {
      setTasks(prev => prev.map(t => {
        if (t.groupId !== id) return t;
        const group = groups.find(g => g.id === id);
        if (group?.isDaily) return t;
        return { ...t, date: updates.date! };
      }));
    }
  }, [groups]);

  const deleteGroup = useCallback((id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id));
    setTasks(prev => prev.filter(t => t.groupId !== id));
  }, []);

  const addTask = useCallback((title: string, pomodoroCount: number = 1, date?: string, scheduledTime?: string, groupId?: string, isDaily?: boolean, customTimeMinutes?: number) => {
    const task: Task = {
      id: generateId(),
      title,
      status: 'todo',
      date: date ?? selectedDate,
      scheduledTime,
      createdAt: new Date().toISOString(),
      pomodoroCount,
      pomodorosCompleted: 0,
      overtimeSeconds: 0,
      totalWorkSeconds: 0,
      groupId,
      isDaily,
      customTimeMinutes,
    };
    setTasks(prev => [...prev, task]);
  }, [selectedDate]);

  // Auto-complete groups based on task status changes (scope to group's current date for daily groups)
  const updateGroupCompletionFromTasks = useCallback((currentTasks: Task[]) => {
    setGroups(prev => prev.map(g => {
      // For daily groups, only check tasks on the group's current date
      const groupTasks = g.isDaily
        ? currentTasks.filter(t => t.groupId === g.id && t.date === g.date)
        : currentTasks.filter(t => t.groupId === g.id);
      if (groupTasks.length === 0) return { ...g, completedAt: undefined };
      const allDone = groupTasks.every(t => t.status === 'done');
      return { ...g, completedAt: allDone ? (g.completedAt ?? new Date().toISOString()) : undefined };
    }));
  }, []);

  const updateStatus = useCallback((id: string, status: TaskStatus) => {
    setTasks(prev => {
      const updated = prev.map(t => {
        if (t.id !== id) return t;
        return {
          ...t,
          status,
          startedAt: status === 'in_progress' ? new Date().toISOString() : t.startedAt,
          completedAt: status === 'done' ? new Date().toISOString() : undefined,
        };
      });
      return updated;
    });
  }, []);

  // Watch for task changes and update group completion
  const prevTasksRef = useRef(tasks);
  useEffect(() => {
    if (prevTasksRef.current !== tasks) {
      prevTasksRef.current = tasks;
      updateGroupCompletionFromTasks(tasks);
    }
  }, [tasks, updateGroupCompletionFromTasks]);

  const editTask = useCallback((id: string, updates: { title?: string; description?: string; pomodoroCount?: number; date?: string; scheduledTime?: string; groupId?: string; isDaily?: boolean; customTimeMinutes?: number }) => {
    setTasks(prev => {
      const target = prev.find(t => t.id === id);
      if (!target) return prev;
      const isDailyTask = target.isDaily || updates.isDaily;
      // For daily tasks, propagate non-date/non-status edits to ALL historical copies
      // sharing the same (title, groupId), so edits persist across days.
      const { date: _d, scheduledTime: _s, groupId: _g, ...propagatable } = updates;
      return prev.map(t => {
        if (t.id === id) return { ...t, ...updates };
        if (
          isDailyTask &&
          t.isDaily &&
          t.title === target.title &&
          (t.groupId ?? '') === (target.groupId ?? '')
        ) {
          return { ...t, ...propagatable };
        }
        return t;
      });
    });
  }, []);

  const incrementPomodoro = useCallback((id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      return { ...t, pomodorosCompleted: t.pomodorosCompleted + 1 };
    }));
  }, []);

  const addOvertime = useCallback((id: string, seconds: number) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      return { ...t, overtimeSeconds: t.overtimeSeconds + seconds };
    }));
  }, []);

  const setTotalWork = useCallback((id: string, seconds: number) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      return { ...t, totalWorkSeconds: seconds };
    }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => {
      const target = prev.find(t => t.id === id);
      if (!target) return prev;
      // If it's a daily task (standalone or inside a daily group), remove ALL historical copies
      // sharing the same (title, groupId) so it never reappears via reset/repair.
      if (target.isDaily) {
        return prev.filter(t => !(t.isDaily && t.title === target.title && (t.groupId ?? '') === (target.groupId ?? '')));
      }
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const reorderTask = useCallback((draggedId: string, targetId: string, position: 'before' | 'after') => {
    if (draggedId === targetId) return;
    setTasks(prev => {
      const dragged = prev.find(t => t.id === draggedId);
      const target = prev.find(t => t.id === targetId);
      if (!dragged || !target) return prev;
      const without = prev.filter(t => t.id !== draggedId);
      const targetIdx = without.findIndex(t => t.id === targetId);
      if (targetIdx === -1) return prev;
      // If dragged status differs from target, align it so it appears in the same column
      const aligned: Task = dragged.status !== target.status
        ? {
            ...dragged,
            status: target.status,
            startedAt: target.status === 'in_progress' ? new Date().toISOString() : dragged.startedAt,
            completedAt: target.status === 'done' ? new Date().toISOString() : undefined,
          }
        : dragged;
      const insertAt = position === 'before' ? targetIdx : targetIdx + 1;
      return [...without.slice(0, insertAt), aligned, ...without.slice(insertAt)];
    });
  }, []);

  const reorderGroup = useCallback((draggedId: string, targetId: string, position: 'before' | 'after') => {
    if (draggedId === targetId) return;
    setGroups(prev => {
      const dragged = prev.find(g => g.id === draggedId);
      if (!dragged) return prev;
      const without = prev.filter(g => g.id !== draggedId);
      const targetIdx = without.findIndex(g => g.id === targetId);
      if (targetIdx === -1) return prev;
      const insertAt = position === 'before' ? targetIdx : targetIdx + 1;
      return [...without.slice(0, insertAt), dragged, ...without.slice(insertAt)];
    });
  }, []);

  // Cross reorder: place a task or group before/after another task or group in the same column
  // by recomputing createdAt so the mixed render order reflects the move.
  const reorderMixed = useCallback((
    draggedId: string,
    draggedKind: 'task' | 'group',
    targetId: string,
    targetKind: 'task' | 'group',
    position: 'before' | 'after',
  ) => {
    if (draggedId === targetId && draggedKind === targetKind) return;

    // Scope the mixed list to items currently visible for selectedDate so that
    // createdAt midpoint placement is relative to what the user actually sees.
    const dailyGroupIdsLocal = new Set(groups.filter(g => g.isDaily).map(g => g.id));
    const projectGroupIdsOnDate = new Set(
      groups.filter(g => !g.isDaily && g.date !== selectedDate)
        .filter(g => tasks.some(t => t.groupId === g.id && t.date === selectedDate))
        .map(g => g.id)
    );
    const visibleTasks = tasks.filter(t => {
      if (t.date === selectedDate) return true;
      if (t.groupId && projectGroupIdsOnDate.has(t.groupId)) return true;
      return false;
    });
    const visibleGroups = groups.filter(g => g.date === selectedDate || g.isDaily || projectGroupIdsOnDate.has(g.id));

    // Determine target column status so we order only within that column.
    let columnStatus: TaskStatus | null = null;
    if (targetKind === 'task') {
      const targetTask = visibleTasks.find(t => t.id === targetId);
      if (targetTask) columnStatus = targetTask.status;
    } else {
      const targetGroup = visibleGroups.find(g => g.id === targetId);
      if (targetGroup) {
        const gt = visibleTasks.filter(t => t.groupId === targetGroup.id && (targetGroup.isDaily ? t.date === selectedDate : true));
        if (targetGroup.completedAt && gt.length > 0) columnStatus = 'done';
        else if (gt.some(t => t.status === 'in_progress')) columnStatus = 'in_progress';
        else columnStatus = 'todo';
      }
    }

    const taskInColumn = (t: Task) => {
      if (t.groupId) return false; // grouped tasks render inside their group card
      return columnStatus ? t.status === columnStatus : true;
    };
    const groupInColumn = (g: TaskGroup) => {
      const gt = visibleTasks.filter(t => t.groupId === g.id && (g.isDaily ? t.date === selectedDate : true));
      if (!columnStatus) return true;
      if (columnStatus === 'todo') {
        if (gt.length === 0 && !g.completedAt) return true;
        return gt.length > 0 && gt.some(t => t.status === 'todo');
      }
      if (columnStatus === 'in_progress') return gt.some(t => t.status === 'in_progress');
      return !!g.completedAt && gt.length > 0;
    };

    const mixed = [
      ...visibleTasks.filter(taskInColumn).map(t => ({ id: t.id, kind: 'task' as const, createdAt: t.createdAt })),
      ...visibleGroups.filter(groupInColumn).map(g => ({ id: g.id, kind: 'group' as const, createdAt: g.createdAt })),
    ]
      .filter(x => !(x.kind === draggedKind && x.id === draggedId))
      .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));

    const targetIdx = mixed.findIndex(x => x.kind === targetKind && x.id === targetId);
    if (targetIdx === -1) return;

    const beforeIdx = position === 'before' ? targetIdx - 1 : targetIdx;
    const afterIdx = position === 'before' ? targetIdx : targetIdx + 1;

    const beforeTime = beforeIdx >= 0 ? new Date(mixed[beforeIdx].createdAt).getTime() : 0;
    const afterTime = afterIdx < mixed.length ? new Date(mixed[afterIdx].createdAt).getTime() : Date.now() + 1000 * 60 * 60 * 24;

    let newTime: number;
    if (beforeIdx < 0) {
      newTime = afterTime - 1;
    } else if (afterIdx >= mixed.length) {
      newTime = beforeTime + 1;
    } else {
      newTime = Math.floor((beforeTime + afterTime) / 2);
      if (newTime <= beforeTime) newTime = beforeTime + 1;
    }

    const newCreatedAt = new Date(newTime).toISOString();

    if (draggedKind === 'task') {
      setTasks(prev => prev.map(t => t.id === draggedId ? { ...t, createdAt: newCreatedAt } : t));
    } else {
      setGroups(prev => prev.map(g => g.id === draggedId ? { ...g, createdAt: newCreatedAt } : g));
    }
  }, [tasks, groups, selectedDate]);


  const duplicateTask = useCallback((id: string) => {
    setTasks(prev => {
      const original = prev.find(t => t.id === id);
      if (!original) return prev;
      const copy: Task = {
        ...original,
        id: generateId(),
        status: 'todo',
        createdAt: new Date().toISOString(),
        completedAt: undefined,
        startedAt: undefined,
        pomodorosCompleted: 0,
        overtimeSeconds: 0,
        totalWorkSeconds: 0,
      };
      return [...prev, copy];
    });
  }, []);

  const duplicateGroup = useCallback((id: string) => {
    const originalGroup = groups.find(g => g.id === id);
    if (!originalGroup) return;
    const newGroupId = generateId();
    const newGroup: TaskGroup = {
      ...originalGroup,
      id: newGroupId,
      createdAt: new Date().toISOString(),
      completedAt: undefined,
    };
    setGroups(prev => [...prev, newGroup]);
    // Duplicate all tasks belonging to this group
    setTasks(prev => {
      const groupTasks = prev.filter(t => t.groupId === id);
      const copies = groupTasks.map(t => ({
        ...t,
        id: generateId(),
        groupId: newGroupId,
        status: 'todo' as TaskStatus,
        createdAt: new Date().toISOString(),
        completedAt: undefined,
        startedAt: undefined,
        pomodorosCompleted: 0,
        overtimeSeconds: 0,
        totalWorkSeconds: 0,
      }));
      return [...prev, ...copies];
    });
  }, [groups]);

  // Reset daily tasks: preserve yesterday's records as snapshots, create fresh copies for new day
  const resetDailyTasks = useCallback((newDate: string) => {
    setTasks(prev => {
      const dailyGroupIdSet = new Set(groups.filter(g => g.isDaily).map(g => g.id));
      const allGroupIdSet = new Set(groups.map(g => g.id));
      const isDailyTask = (t: Task) => !!t.isDaily || (!!t.groupId && dailyGroupIdSet.has(t.groupId));

      // Step 1: drop any existing todo copies for newDate so we can regenerate cleanly.
      // Also drop ORPHAN tasks whose group no longer exists (deleted groups must stay deleted).
      const cleaned = prev.filter(t => {
        if (t.groupId && !allGroupIdSet.has(t.groupId)) return false;
        if (isDailyTask(t) && t.date === newDate && t.status === 'todo') return false;
        return true;
      });

      // Step 2: pick the most recent template per (title + group) across ALL daily tasks
      // Sort by createdAt desc so the first occurrence we keep is the freshest template
      const templates = new Map<string, Task>();
      [...cleaned]
        .filter(isDailyTask)
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
        .forEach(t => {
          const key = `${t.title}::${t.groupId ?? ''}`;
          if (!templates.has(key)) templates.set(key, t);
        });

      // Step 3: build fresh copies for newDate from each template
      const newTasks: Task[] = Array.from(templates.values()).map(t => ({
        ...t,
        id: generateId(),
        status: 'todo' as TaskStatus,
        date: newDate,
        completedAt: undefined,
        startedAt: undefined,
        pomodorosCompleted: 0,
        overtimeSeconds: 0,
        totalWorkSeconds: 0,
        createdAt: new Date().toISOString(),
      }));

      return [...cleaned, ...newTasks];
    });
    // Daily groups: keep old records, update group date for display purposes
    setGroups(prev => prev.map(g => {
      if (!g.isDaily) return g;
      return { ...g, date: newDate, completedAt: undefined };
    }));
  }, [groups]);

  const dailyGroupIds = new Set(groups.filter(g => g.isDaily).map(g => g.id));
  // Project groups: show on any date where their tasks exist
  const projectGroupsOnDate = new Set(
    groups.filter(g => !g.isDaily && g.date !== selectedDate)
      .filter(g => tasks.some(t => t.groupId === g.id && t.date === selectedDate))
      .map(g => g.id)
  );
  // Daily tasks: show by their actual date (each day has its own copies now)
  // For today/selected date that matches a daily group's current date, also show those
  const dayTasks = tasks.filter(t => {
    if (t.date === selectedDate) return true;
    // Show daily group tasks if the group's current date matches selectedDate
    if (t.groupId && dailyGroupIds.has(t.groupId)) {
      const group = groups.find(g => g.id === t.groupId);
      if (group && group.date === selectedDate && t.date === selectedDate) return true;
    }
    if (t.groupId && projectGroupsOnDate.has(t.groupId)) return true;
    return false;
  });
  const dayGroups = groups.filter(g => g.date === selectedDate || g.isDaily || projectGroupsOnDate.has(g.id));
  const allTasks = tasks;

  return {
    tasks: dayTasks, allTasks, groups: dayGroups, allGroups: groups,
    addTask, updateStatus, deleteTask, duplicateTask, duplicateGroup, selectedDate, setSelectedDate, setTasks, setGroups,
    incrementPomodoro, addOvertime, setTotalWork, editTask,
    addGroup, editGroup, deleteGroup, resetDailyTasks, reorderTask, reorderGroup, reorderMixed,
  };
}
