import { useState, useEffect, useCallback } from 'react';
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

  const addGroup = useCallback((name: string, date?: string) => {
    const group: TaskGroup = {
      id: generateId(),
      name,
      date: date ?? selectedDate,
      createdAt: new Date().toISOString(),
    };
    setGroups(prev => [...prev, group]);
    return group.id;
  }, [selectedDate]);

  const editGroup = useCallback((id: string, updates: { name?: string; date?: string }) => {
    setGroups(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id));
    setTasks(prev => prev.filter(t => t.groupId !== id));
  }, []);

  const addTask = useCallback((title: string, pomodoroCount: number = 1, date?: string, scheduledTime?: string, groupId?: string) => {
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
    };
    setTasks(prev => [...prev, task]);
  }, [selectedDate]);

  // Auto-complete group when all subtasks are done
  const checkGroupCompletion = useCallback((groupId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      // We need current tasks - will be called after task update
      return g;
    }));
  }, []);

  // Call this after status changes to update group completion
  const updateGroupCompletion = useCallback((updatedTasks: Task[]) => {
    setGroups(prev => prev.map(g => {
      const groupTasks = updatedTasks.filter(t => t.groupId === g.id);
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
      // Check group completion
      const task = updated.find(t => t.id === id);
      if (task?.groupId) {
        setTimeout(() => updateGroupCompletion(updated), 0);
      }
      return updated;
    });
  }, [updateGroupCompletion]);

  const editTask = useCallback((id: string, updates: { title?: string; pomodoroCount?: number; date?: string; scheduledTime?: string; groupId?: string }) => {
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
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== id);
      // Check group completion for the deleted task's group
      const deleted = prev.find(t => t.id === id);
      if (deleted?.groupId) {
        setTimeout(() => updateGroupCompletion(updated), 0);
      }
      return updated;
    });
  }, [updateGroupCompletion]);

  const dayTasks = tasks.filter(t => t.date === selectedDate);
  const dayGroups = groups.filter(g => g.date === selectedDate);
  const allTasks = tasks;

  return {
    tasks: dayTasks, allTasks, groups: dayGroups, allGroups: groups,
    addTask, updateStatus, deleteTask, selectedDate, setSelectedDate, setTasks,
    incrementPomodoro, addOvertime, setTotalWork, editTask,
    addGroup, editGroup, deleteGroup,
  };
}
