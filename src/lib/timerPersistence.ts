// Persists timer states using timestamps so they survive page reloads

const TIMERS_KEY = 'tracker-timer-states';
const POMO_META_KEY = 'tracker-pomodoro-meta';
const OVERTIME_KEY = 'tracker-overtime-states';
const WORKANA_PAUSED_KEY = 'tracker-workana-paused';

export interface PersistedTimer {
  id: string;
  type: 'pomodoro' | 'workana' | 'break';
  duration: number; // total duration in seconds
  startedAt: number; // Date.now() when started
  running: boolean;
  pausedRemaining?: number; // remaining seconds when paused
}

export interface PersistedPomodoroMeta {
  currentPomodoro: number;
  phase: string;
  restMessage?: string;
}

export interface PersistedOvertime {
  startedAt?: number; // Date.now() when overtime started or resumed
  elapsedSeconds?: number; // accumulated elapsed seconds before the latest resume
  running?: boolean;
}

// Timer states
export function saveTimerStates(timers: PersistedTimer[]) {
  try {
    localStorage.setItem(TIMERS_KEY, JSON.stringify(timers));
  } catch {}
}

export function loadTimerStates(): PersistedTimer[] {
  try {
    const data = localStorage.getItem(TIMERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch { return []; }
}

export function clearTimerState(id: string) {
  const timers = loadTimerStates().filter(t => t.id !== id);
  saveTimerStates(timers);
}

export function upsertTimerState(timer: PersistedTimer) {
  const timers = loadTimerStates().filter(t => t.id !== timer.id);
  timers.push(timer);
  saveTimerStates(timers);
}

// Pomodoro meta
export function savePomodoroMeta(meta: Record<string, PersistedPomodoroMeta>) {
  try {
    localStorage.setItem(POMO_META_KEY, JSON.stringify(meta));
  } catch {}
}

export function loadPomodoroMeta(): Record<string, PersistedPomodoroMeta> {
  try {
    const data = localStorage.getItem(POMO_META_KEY);
    return data ? JSON.parse(data) : {};
  } catch { return {}; }
}

// Overtime
export function saveOvertimeStates(states: Record<string, PersistedOvertime>) {
  try {
    localStorage.setItem(OVERTIME_KEY, JSON.stringify(states));
  } catch {}
}

export function loadOvertimeStates(): Record<string, PersistedOvertime> {
  try {
    const data = localStorage.getItem(OVERTIME_KEY);
    return data ? JSON.parse(data) : {};
  } catch { return {}; }
}

// Workana paused
export function setWorkanaPaused(paused: boolean) {
  localStorage.setItem(WORKANA_PAUSED_KEY, JSON.stringify(paused));
}

export function getWorkanaPaused(): boolean {
  try {
    return JSON.parse(localStorage.getItem(WORKANA_PAUSED_KEY) ?? 'false');
  } catch { return false; }
}
