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
  scheduledTime?: string; // HH:mm - when daily group starts
  pomodoroCount?: number; // total pomodoros for the daily group
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

export function exportData(tasks: Task[], groups: TaskGroup[]) {
  const blob = new Blob([JSON.stringify({ tasks, groups }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tracker-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importData(file: File): Promise<{ tasks: Task[]; groups: TaskGroup[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        // New format: { tasks, groups }
        if (data && !Array.isArray(data) && Array.isArray(data.tasks)) {
          const tasks = migrateTasks(data.tasks);
          const groups: TaskGroup[] = data.groups ?? [];
          // For any groupId referenced by tasks but missing from groups, try existing localStorage
          const existingGroups = loadGroups();
          const groupIdsInData = new Set(groups.map((g: TaskGroup) => g.id));
          const missingGroupIds = new Set<string>();
          tasks.forEach((t: Task) => { if (t.groupId && !groupIdsInData.has(t.groupId)) missingGroupIds.add(t.groupId); });
          missingGroupIds.forEach(id => {
            const existing = existingGroups.find(g => g.id === id);
            if (existing) {
              groups.push(existing);
            } else {
              groups.push(inferGroupFromTasks(id, tasks));
            }
          });
          resolve({ tasks, groups });
        }
        // Legacy format: plain array of tasks
        else if (Array.isArray(data)) {
          const tasks = migrateTasks(data);
          const existingGroups = loadGroups();
          const groupIds = new Set<string>();
          tasks.forEach((t: Task) => { if (t.groupId) groupIds.add(t.groupId); });
          const inferredGroups: TaskGroup[] = Array.from(groupIds).map(id => {
            // Prefer existing group from localStorage (preserves name, isDaily, etc.)
            const existing = existingGroups.find(g => g.id === id);
            if (existing) return existing;
            return inferGroupFromTasks(id, tasks);
          });
          resolve({ tasks, groups: inferredGroups });
        }
        else reject(new Error('Invalid format'));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    };
    reader.readAsText(file);
  });
}

function migrateTasks(tasks: any[]): Task[] {
  return tasks.map((t: any) => ({
    ...t,
    pomodoroCount: t.pomodoroCount ?? 1,
    pomodorosCompleted: t.pomodorosCompleted ?? 0,
    overtimeSeconds: t.overtimeSeconds ?? 0,
    totalWorkSeconds: t.totalWorkSeconds ?? 0,
    scheduledTime: t.scheduledTime ?? undefined,
  }));
}

function inferGroupFromTasks(groupId: string, tasks: Task[]): TaskGroup {
  const groupTasks = tasks.filter(t => t.groupId === groupId);
  // Try to build a meaningful name from the first task's context
  const firstTask = groupTasks[0];
  const hasDaily = groupTasks.some(t => t.isDaily);
  
  // Build group name from common words or first task
  let name = 'Grupo';
  if (groupTasks.length > 0) {
    // Use the shortest task title as a hint, or just "Grupo (N tareas)"
    name = `Grupo (${groupTasks.length} tareas)`;
  }

  return {
    id: groupId,
    name,
    date: firstTask?.date ?? getToday(),
    createdAt: firstTask?.createdAt ?? new Date().toISOString(),
    isDaily: hasDaily || undefined,
    scheduledTime: firstTask?.scheduledTime ?? undefined,
    pomodoroCount: hasDaily ? groupTasks.length : undefined,
  };
}

export function getNowUTC5(): Date {
  return new Date(Date.now() - 5 * 3600000);
}

export function getToday(): string {
  return getNowUTC5().toISOString().split('T')[0];
}

export function resetAllData() {
  const keys = ['productivity-tracker-tasks', 'productivity-tracker-groups', 'day-session', 'pomodoro-meta', 'timer-states', 'overtime-states', 'workana-paused'];
  keys.forEach(k => localStorage.removeItem(k));
  // Clear any other tracker keys
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('productivity-tracker') || k.startsWith('timer-') || k.startsWith('pomodoro-')) {
      localStorage.removeItem(k);
    }
  });
}

export function generateId(): string {
  return crypto.randomUUID();
}
