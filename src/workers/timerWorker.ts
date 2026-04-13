// Web Worker for timers that don't pause on tab switch
// Manages both pomodoro timers and the hourly Workana reminder

interface TimerState {
  id: string;
  remaining: number; // seconds
  running: boolean;
  type: 'pomodoro' | 'workana';
}

const timers = new Map<string, TimerState>();

let intervalId: ReturnType<typeof setInterval> | null = null;

function startLoop() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    timers.forEach((timer) => {
      if (!timer.running || timer.remaining <= 0) return;
      timer.remaining--;
      if (timer.remaining <= 0) {
        timer.running = false;
        self.postMessage({ type: 'TIMER_DONE', id: timer.id, timerType: timer.type });
      }
    });
    // Send tick updates
    const updates: Record<string, number> = {};
    timers.forEach((t, id) => { updates[id] = t.remaining; });
    self.postMessage({ type: 'TICK', timers: updates });
  }, 1000);
}

function stopLoopIfIdle() {
  const hasRunning = Array.from(timers.values()).some(t => t.running);
  if (!hasRunning && intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

self.onmessage = (e: MessageEvent) => {
  const { action, id, duration, timerType } = e.data;

  switch (action) {
    case 'START': {
      timers.set(id, { id, remaining: duration, running: true, type: timerType || 'pomodoro' });
      startLoop();
      break;
    }
    case 'STOP': {
      const t = timers.get(id);
      if (t) { t.running = false; }
      stopLoopIfIdle();
      break;
    }
    case 'RESET': {
      timers.set(id, { id, remaining: duration, running: false, type: timerType || 'pomodoro' });
      stopLoopIfIdle();
      break;
    }
    case 'REMOVE': {
      timers.delete(id);
      stopLoopIfIdle();
      break;
    }
  }
};
