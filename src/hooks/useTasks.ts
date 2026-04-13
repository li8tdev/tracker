import { useState, useEffect, useCallback } from 'react';
import { Task, TaskStatus, loadTasks, saveTasks, getToday, generateId } from '@/lib/storage';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [selectedDate, setSelectedDate] = useState(getToday());

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const addTask = useCallback((title: string, pomodoroCount: number = 1) => {
    const task: Task = {
      id: generateId(),
      title,
      status: 'todo',
      date: selectedDate,
      createdAt: new Date().toISOString(),
      pomodoroCount,
      pomodorosCompleted: 0,
      overtimeSeconds: 0,
    };
    setTasks(prev => [...prev, task]);
  }, [selectedDate]);

  const updateStatus = useCallback((id: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      return {
        ...t,
        status,
        startedAt: status === 'in_progress' ? new Date().toISOString() : t.startedAt,
        completedAt: status === 'done' ? new Date().toISOString() : undefined,
      };
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

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const dayTasks = tasks.filter(t => t.date === selectedDate);
  const allTasks = tasks;

  return { tasks: dayTasks, allTasks, addTask, updateStatus, deleteTask, selectedDate, setSelectedDate, setTasks, incrementPomodoro, addOvertime };
}
