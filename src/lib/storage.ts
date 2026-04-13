export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  date: string; // YYYY-MM-DD
  scheduledTime?: string; // HH:mm
  createdAt: string;
  completedAt?: string;
  startedAt?: string;
  pomodoroCount: number;
  pomodorosCompleted: number;
  overtimeSeconds: number;
  totalWorkSeconds: number; // actual focused work time (no breaks)
  groupId?: string; // belongs to a task group
  isDaily?: boolean; // repeats every day
}

export interface TaskGroup {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  createdAt: string;
  completedAt?: string;
  isDaily?: boolean; // all tasks in group repeat daily
}

const STORAGE_KEY = 'productivity-tracker-tasks';
const GROUPS_KEY = 'productivity-tracker-groups';

export function loadGroups(): TaskGroup[] {
  try {
    const data = localStorage.getItem(GROUPS_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveGroups(groups: TaskGroup[]) {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
}

export function loadTasks(): Task[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const tasks = JSON.parse(data);
    // Migrate old tasks
    return tasks.map((t: any) => ({
      ...t,
      pomodoroCount: t.pomodoroCount ?? 1,
      pomodorosCompleted: t.pomodorosCompleted ?? 0,
      overtimeSeconds: t.overtimeSeconds ?? 0,
      totalWorkSeconds: t.totalWorkSeconds ?? 0,
      scheduledTime: t.scheduledTime ?? undefined,
    }));
  } catch {
    return [];
  }
}

export function saveTasks(tasks: Task[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export function exportData(tasks: Task[]) {
  const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tracker-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importData(file: File): Promise<Task[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const tasks = JSON.parse(e.target?.result as string);
        if (Array.isArray(tasks)) resolve(tasks);
        else reject(new Error('Invalid format'));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    };
    reader.readAsText(file);
  });
}

export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function generateId(): string {
  return crypto.randomUUID();
}
