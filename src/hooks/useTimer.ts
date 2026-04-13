import { useEffect, useRef, useState, useCallback } from 'react';

type TimerCallback = (id: string, timerType: string) => void;

let workerInstance: Worker | null = null;
let listenerCount = 0;
const tickListeners = new Set<(timers: Record<string, number>) => void>();
const doneListeners = new Set<TimerCallback>();

function getWorker() {
  if (!workerInstance) {
    workerInstance = new Worker(new URL('../workers/timerWorker.ts', import.meta.url), { type: 'module' });
    workerInstance.onmessage = (e) => {
      if (e.data.type === 'TICK') {
        tickListeners.forEach(fn => fn(e.data.timers));
      } else if (e.data.type === 'TIMER_DONE') {
        doneListeners.forEach(fn => fn(e.data.id, e.data.timerType));
      }
    };
  }
  return workerInstance;
}

export function useTimer(onDone?: TimerCallback) {
  const [timers, setTimers] = useState<Record<string, number>>({});
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const worker = getWorker();
    listenerCount++;

    const tickHandler = (t: Record<string, number>) => setTimers({ ...t });
    const doneHandler: TimerCallback = (id, timerType) => onDoneRef.current?.(id, timerType);

    tickListeners.add(tickHandler);
    doneListeners.add(doneHandler);

    return () => {
      tickListeners.delete(tickHandler);
      doneListeners.delete(doneHandler);
      listenerCount--;
      if (listenerCount === 0 && workerInstance) {
        workerInstance.terminate();
        workerInstance = null;
      }
    };
  }, []);

  const start = useCallback((id: string, duration: number, timerType = 'pomodoro') => {
    getWorker().postMessage({ action: 'START', id, duration, timerType });
  }, []);

  const stop = useCallback((id: string) => {
    getWorker().postMessage({ action: 'STOP', id });
  }, []);

  const reset = useCallback((id: string, duration: number, timerType = 'pomodoro') => {
    getWorker().postMessage({ action: 'RESET', id, duration, timerType });
  }, []);

  const remove = useCallback((id: string) => {
    getWorker().postMessage({ action: 'REMOVE', id });
  }, []);

  const restore = useCallback((entries: Array<{ id: string; remaining: number; running: boolean; type: string }>) => {
    getWorker().postMessage({ action: 'RESTORE_BATCH', entries });
  }, []);

  return { timers, start, stop, reset, remove, restore };
}
