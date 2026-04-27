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
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
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

  const editTask = useCallback((id: string, updates: { title?: string; pomodoroCount?: number; date?: string; scheduledTime?: string; groupId?: string; isDaily?: boolean; customTimeMinutes?: number }) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      return { ...t, ...updates };
    }));
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
    setTasks(prev => prev.filter(t => t.id !== id));
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

    // Build mixed list of {id, kind, createdAt} sorted ascending by createdAt
    const mixed = [
      ...tasks.map(t => ({ id: t.id, kind: 'task' as const, createdAt: t.createdAt })),
      ...groups.map(g => ({ id: g.id, kind: 'group' as const, createdAt: g.createdAt })),
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
      // Insert at the very top: 1ms before the first
      newTime = afterTime - 1;
    } else if (afterIdx >= mixed.length) {
      // Insert at the very bottom: 1ms after the last
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
  }, [tasks, groups]);


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
      const isDailyTask = (t: Task) => !!t.isDaily || (!!t.groupId && dailyGroupIdSet.has(t.groupId));

      // Step 1: drop any existing todo copies for newDate so we can regenerate cleanly
      const cleaned = prev.filter(t => !(isDailyTask(t) && t.date === newDate && t.status === 'todo'));

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
    addGroup, editGroup, deleteGroup, resetDailyTasks, reorderTask, reorderGroup,
  };
}
