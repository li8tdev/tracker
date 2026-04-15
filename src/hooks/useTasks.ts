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
      const newTasks: Task[] = [];
      const seen = new Set<string>();
      prev.forEach(t => {
        const belongsToDailyGroup = t.groupId && groups.some(g => g.id === t.groupId && g.isDaily);
        if (!t.isDaily && !belongsToDailyGroup) return;
        // Skip if we already have a fresh copy for this date (e.g. double-click protection)
        if (t.date === newDate && t.status === 'todo') return;
        // Only create a new copy if one doesn't already exist for newDate with same title+group
        const key = `${t.title}::${t.groupId ?? ''}`;
        if (seen.has(key)) return;
        seen.add(key);
        newTasks.push({
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
        });
      });
      // Keep all old tasks (historical) + add new fresh copies
      // But remove any existing todo daily tasks for newDate to avoid duplicates
      const filtered = prev.filter(t => {
        const belongsToDailyGroup = t.groupId && groups.some(g => g.id === t.groupId && g.isDaily);
        if ((t.isDaily || belongsToDailyGroup) && t.date === newDate && t.status === 'todo') return false;
        return true;
      });
      return [...filtered, ...newTasks];
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
    addGroup, editGroup, deleteGroup, resetDailyTasks,
  };
}
