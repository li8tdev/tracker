import { useEffect, useCallback, useRef, useState } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { useTimer } from '@/hooks/useTimer';
import { useDaySession } from '@/hooks/useDaySession';
import { requestNotificationPermission, sendNotification } from '@/lib/notifications';
import { getRandomRestMessage } from '@/lib/restMessages';
import {
  upsertTimerState, clearTimerState, loadTimerStates,
  savePomodoroMeta, loadPomodoroMeta,
  saveOvertimeStates, loadOvertimeStates,
  getWorkanaPaused, setWorkanaPaused as persistWorkanaPaused,
  PersistedPomodoroMeta,
  PersistedTimer,
} from '@/lib/timerPersistence';
import { TaskInput } from '@/components/TaskInput';
import { TaskCard, PomodoroPhase } from '@/components/TaskCard';
import { TaskGroupCard } from '@/components/TaskGroupCard';
import { StatsCard } from '@/components/StatsCard';
import { Analytics } from '@/components/Analytics';
import { CalendarView } from '@/components/CalendarView';
import { DatePicker } from '@/components/DatePicker';
import { DataActions } from '@/components/DataActions';
import { StartDayScreen } from '@/components/StartDayScreen';
import { WorkanaBar } from '@/components/WorkanaBar';
import { SystemRAM } from '@/components/SystemRAM';
import { ListTodo, CheckCircle2, Flame, Target, Zap, CalendarDays, LayoutGrid, Timer, Cpu } from 'lucide-react';
import { toast } from 'sonner';

const POMODORO_DURATION = 60 * 60;
const BREAK_DURATION = 10 * 60;
const WORKANA_INTERVAL = 60 * 60;
const WORKANA_TIMER_ID = '__workana__';

interface PomodoroMeta {
  currentPomodoro: number;
  phase: PomodoroPhase;
  restMessage?: string;
}

function getRemainingFromTimer(timer: PersistedTimer) {
  if (timer.running) {
    return Math.max(0, timer.duration - Math.floor((Date.now() - timer.startedAt) / 1000));
  }

  return timer.pausedRemaining ?? timer.duration;
}

function getTaskIdFromTimerId(timerId: string) {
  return timerId.replace('pomo-', '');
}

const Index = () => {
  const { tasks, allTasks, groups, allGroups, addTask, updateStatus, deleteTask, selectedDate, setSelectedDate, setTasks, incrementPomodoro, addOvertime, setTotalWork, editTask, addGroup, editGroup, deleteGroup, resetDailyTasks } = useTasks();
  const session = useDaySession();
  const workanaInitialized = useRef(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'calendar' | 'ram'>('tasks');
  const [workanaPaused, setWorkanaPausedState] = useState(() => getWorkanaPaused());
  const [timersHydrated, setTimersHydrated] = useState(false);
  const sessionActiveRef = useRef(session.active);
  const workanaPausedRef = useRef(workanaPaused);

  // Track pomodoro phase per task - restore from localStorage
  const [pomodoroMeta, setPomodoroMeta] = useState<Record<string, PomodoroMeta>>(() => {
    const saved = loadPomodoroMeta();
    const result: Record<string, PomodoroMeta> = {};
    for (const [k, v] of Object.entries(saved)) {
      result[k] = { currentPomodoro: v.currentPomodoro, phase: v.phase as PomodoroPhase, restMessage: v.restMessage };
    }
    return result;
  });

  // Track overtime counters - restore from localStorage
  const overtimeIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const [overtimeCounters, setOvertimeCounters] = useState<Record<string, number>>(() => {
    const saved = loadOvertimeStates();
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(saved)) {
      const elapsedBase = v.elapsedSeconds ?? 0;
      if (v.running === false || !v.startedAt) {
        result[k] = elapsedBase;
      } else {
        result[k] = elapsedBase + Math.floor((Date.now() - v.startedAt) / 1000);
      }
    }
    return result;
  });

  // Persist pomodoroMeta whenever it changes
  useEffect(() => {
    const toSave: Record<string, PersistedPomodoroMeta> = {};
    for (const [k, v] of Object.entries(pomodoroMeta)) {
      toSave[k] = { currentPomodoro: v.currentPomodoro, phase: v.phase, restMessage: v.restMessage };
    }
    savePomodoroMeta(toSave);
  }, [pomodoroMeta]);

  useEffect(() => {
    sessionActiveRef.current = session.active;
  }, [session.active]);

  useEffect(() => {
    workanaPausedRef.current = workanaPaused;
  }, [workanaPaused]);

  const getNextWorkanaRemaining = useCallback(() => {
    if (!session.startedAt) return WORKANA_INTERVAL;

    const elapsed = Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000));
    const remainder = elapsed % WORKANA_INTERVAL;
    return remainder === 0 ? WORKANA_INTERVAL : WORKANA_INTERVAL - remainder;
  }, [session.startedAt]);

  const startOvertime = useCallback((taskId: string) => {
    if (overtimeIntervals.current[taskId]) clearInterval(overtimeIntervals.current[taskId]);
    const startedAt = Date.now();
    setOvertimeCounters(prev => ({ ...prev, [taskId]: 0 }));
    const otStates = loadOvertimeStates();
    otStates[taskId] = { startedAt, elapsedSeconds: 0, running: true };
    saveOvertimeStates(otStates);
    overtimeIntervals.current[taskId] = setInterval(() => {
      setOvertimeCounters(prev => ({ ...prev, [taskId]: Math.floor((Date.now() - startedAt) / 1000) }));
    }, 1000);
    setPomodoroMeta(prev => ({ ...prev, [taskId]: { ...prev[taskId], phase: 'overtime' } }));
  }, []);

  const stopOvertime = useCallback((taskId: string) => {
    if (overtimeIntervals.current[taskId]) {
      clearInterval(overtimeIntervals.current[taskId]);
      delete overtimeIntervals.current[taskId];
    }
    const seconds = overtimeCounters[taskId] ?? 0;
    if (seconds > 0) addOvertime(taskId, seconds);
    setOvertimeCounters(prev => { const n = { ...prev }; delete n[taskId]; return n; });
    const otStates = loadOvertimeStates();
    delete otStates[taskId];
    saveOvertimeStates(otStates);
  }, [overtimeCounters, addOvertime]);

    if (timerType === 'workana') {
      clearTimerState(WORKANA_TIMER_ID);
      if (!sessionActiveRef.current || workanaPausedRef.current) return;

      sendNotification('📨 ¡Envía propuestas en Workana!', 'Es hora de revisar Workana y enviar propuestas.');
      toast('📨 ¡Envía propuestas en Workana!', { description: 'Revisa Workana y envía propuestas ahora.', duration: 10000 });
      start(WORKANA_TIMER_ID, WORKANA_INTERVAL, 'workana');
      upsertTimerState({ id: WORKANA_TIMER_ID, type: 'workana', duration: WORKANA_INTERVAL, startedAt: Date.now(), running: true });
    } else if (timerType === 'break') {
      const taskId = id.replace('pomo-', '');
      sendNotification('✅ ¡Descanso terminado!', '¡Listo para el siguiente pomodoro!');
      toast.success('✅ ¡Descanso terminado!', { description: 'Continúa con el siguiente pomodoro.' });
      clearTimerState(id);
      setPomodoroMeta(prev => ({ ...prev, [taskId]: { ...prev[taskId], phase: 'next_pending' } }));
    } else {
      const taskId = id.replace('pomo-', '');
      const meta = pomodoroMeta[taskId];
      const task = allTasks.find(t => t.id === taskId);
      const group = !task ? allGroups.find(g => g.id === taskId) : undefined;
      if (!task && !group) return;

      const pomCount = task?.pomodoroCount ?? group?.pomodoroCount ?? 1;
      let newCompleted: number;

      if (task) {
        incrementPomodoro(taskId);
        newCompleted = (task.pomodorosCompleted ?? 0) + 1;
      } else {
        newCompleted = meta?.currentPomodoro ?? 1;
      }
      clearTimerState(id);

      const title = task?.title ?? group?.name ?? '';
      if (newCompleted >= pomCount) {
        sendNotification('🎉 ¡Todos los pomodoros completados!', `Tarea: ${title}. ¡Puedes marcarla como completada!`);
        toast.success('🎉 ¡Todos los pomodoros completados!', { description: title });
        setPomodoroMeta(prev => ({ ...prev, [taskId]: { ...prev[taskId], phase: 'all_done', currentPomodoro: newCompleted } }));
        startOvertime(taskId);
      } else {
        const msg = getRandomRestMessage();
        sendNotification('🍅 ¡Pomodoro completado!', `${title}. ¡Toma un descanso!`);
        toast.success('🍅 ¡Pomodoro completado!', { description: msg });
        setPomodoroMeta(prev => ({ ...prev, [taskId]: { ...prev[taskId], phase: 'break_pending', restMessage: msg, currentPomodoro: newCompleted } }));
      }
    }
  }, [allTasks, allGroups, pomodoroMeta, incrementPomodoro, startOvertime]);

  const { timers, start, stop, remove, restore } = useTimer(handleTimerDone);

  const getRemainingForTimer = useCallback((timerId: string) => {
    const savedTimer = loadTimerStates().find(timer => timer.id === timerId);
    if (savedTimer) return getRemainingFromTimer(savedTimer);

    return timers[timerId];
  }, [timers]);

  // Restore timers on mount
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const saved = loadTimerStates();
    if (saved.length === 0) {
      setTimersHydrated(true);
      return;
    }

    const restoredMeta: Record<string, PomodoroMeta> = {};
    const expiredTimers: Array<{ id: string; type: PersistedTimer['type'] }> = [];

    const entries = saved
      .map((timer) => {
        const remaining = getRemainingFromTimer(timer);

        if (timer.id.startsWith('pomo-')) {
          const taskId = getTaskIdFromTimerId(timer.id);
          const task = allTasks.find(candidate => candidate.id === taskId);
          restoredMeta[taskId] = {
            currentPomodoro: pomodoroMeta[taskId]?.currentPomodoro ?? Math.max(1, (task?.pomodorosCompleted ?? 0) + 1),
            phase: timer.type === 'break' ? 'breaking' : timer.running ? 'working' : 'paused',
            restMessage: pomodoroMeta[taskId]?.restMessage,
          };
        }

        if (timer.running && remaining <= 0) {
          expiredTimers.push({ id: timer.id, type: timer.type });
          return null;
        }

        if (remaining <= 0) return null;
        return { id: timer.id, remaining, running: timer.running && remaining > 0, type: timer.type };
      })
      .filter((entry): entry is { id: string; remaining: number; running: boolean; type: PersistedTimer['type'] } => entry !== null);

    if (Object.keys(restoredMeta).length > 0) {
      setPomodoroMeta(prev => ({ ...prev, ...restoredMeta }));
    }

    if (entries.length > 0) restore(entries);
    expiredTimers.forEach((timer) => handleTimerDone(timer.id, timer.type));
    setTimersHydrated(true);
  }, [restore, allTasks, pomodoroMeta, handleTimerDone]);

  // Restore overtime intervals on mount
  useEffect(() => {
    const saved = loadOvertimeStates();
    for (const [taskId, state] of Object.entries(saved)) {
      if (state.running === false || !state.startedAt || overtimeIntervals.current[taskId]) continue;

      const elapsedBase = state.elapsedSeconds ?? 0;
      overtimeIntervals.current[taskId] = setInterval(() => {
        setOvertimeCounters(prev => {
          const elapsed = elapsedBase + Math.floor((Date.now() - state.startedAt!) / 1000);
          return { ...prev, [taskId]: elapsed };
        });
      }, 1000);
    }
    return () => {
      Object.values(overtimeIntervals.current).forEach(clearInterval);
    };
  }, []);


  useEffect(() => { requestNotificationPermission(); }, []);

  // Update browser tab title with active timer
  useEffect(() => {
    const activeTask = tasks.find(t => t.status === 'in_progress' && pomodoroMeta[t.id]?.phase === 'working');
    if (activeTask) {
      const secs = timers[`pomo-${activeTask.id}`];
      if (secs !== undefined) {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        document.title = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} - ${activeTask.title}`;
        return;
      }
    }
    const breakingTask = tasks.find(t => t.status === 'in_progress' && pomodoroMeta[t.id]?.phase === 'breaking');
    if (breakingTask) {
      const secs = timers[`pomo-${breakingTask.id}`];
      if (secs !== undefined) {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        document.title = `☕ ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} - Descanso`;
        return;
      }
    }
    document.title = 'Tracker';
  }, [timers, tasks, pomodoroMeta]);

  // Workana timer init/restore
  useEffect(() => {
    if (!session.active) {
      workanaInitialized.current = false;
      remove(WORKANA_TIMER_ID);
      clearTimerState(WORKANA_TIMER_ID);
      return;
    }

    if (!timersHydrated || workanaPaused || workanaInitialized.current) return;

    const savedWorkana = loadTimerStates().find(timer => timer.id === WORKANA_TIMER_ID);
    if (savedWorkana) {
      const remaining = getRemainingFromTimer(savedWorkana);
      if (savedWorkana.running && remaining > 0) {
        workanaInitialized.current = true;
        return;
      }
    }

    workanaInitialized.current = true;
    const remaining = getNextWorkanaRemaining();
    start(WORKANA_TIMER_ID, remaining, 'workana');
    upsertTimerState({ id: WORKANA_TIMER_ID, type: 'workana', duration: remaining, startedAt: Date.now(), running: true });
  }, [session.active, workanaPaused, timersHydrated, start, remove, getNextWorkanaRemaining]);

  // Workana pause/resume
  const handleToggleWorkanaPause = useCallback(() => {
    const remaining = Math.max(1, getRemainingForTimer(WORKANA_TIMER_ID) ?? getNextWorkanaRemaining());

    if (workanaPaused) {
      setWorkanaPausedState(false);
      persistWorkanaPaused(false);
      start(WORKANA_TIMER_ID, remaining, 'workana');
      upsertTimerState({ id: WORKANA_TIMER_ID, type: 'workana', duration: remaining, startedAt: Date.now(), running: true });
      return;
    }

    setWorkanaPausedState(true);
    persistWorkanaPaused(true);
    stop(WORKANA_TIMER_ID);
    upsertTimerState({ id: WORKANA_TIMER_ID, type: 'workana', duration: remaining, startedAt: Date.now(), running: false, pausedRemaining: remaining });
  }, [workanaPaused, getRemainingForTimer, getNextWorkanaRemaining, start, stop]);

  const handleEndDay = useCallback(() => {
    const nextPomodoroMeta: Record<string, PomodoroMeta> = { ...pomodoroMeta };
    const nextOvertimeStates = { ...loadOvertimeStates() };
    const savedTimers = loadTimerStates();

    savedTimers.forEach((timer) => {
      if (timer.id === WORKANA_TIMER_ID || !timer.id.startsWith('pomo-')) return;

      const taskId = getTaskIdFromTimerId(timer.id);
      const task = allTasks.find(candidate => candidate.id === taskId);
      const currentPomodoro = nextPomodoroMeta[taskId]?.currentPomodoro ?? Math.max(1, (task?.pomodorosCompleted ?? 0) + 1);

      if (timer.type === 'break') {
        remove(timer.id);
        clearTimerState(timer.id);
        nextPomodoroMeta[taskId] = {
          currentPomodoro,
          phase: 'break_pending',
          restMessage: nextPomodoroMeta[taskId]?.restMessage,
        };
        return;
      }

      const remaining = Math.max(1, getRemainingForTimer(timer.id) ?? getRemainingFromTimer(timer));
      stop(timer.id);
      upsertTimerState({ id: timer.id, type: 'pomodoro', duration: remaining, startedAt: Date.now(), running: false, pausedRemaining: remaining });
      nextPomodoroMeta[taskId] = {
        currentPomodoro,
        phase: 'paused',
        restMessage: nextPomodoroMeta[taskId]?.restMessage,
      };
    });

    Object.entries(overtimeCounters).forEach(([taskId, seconds]) => {
      if (overtimeIntervals.current[taskId]) {
        clearInterval(overtimeIntervals.current[taskId]);
        delete overtimeIntervals.current[taskId];
      }

      nextOvertimeStates[taskId] = { elapsedSeconds: seconds, running: false };
    });

    saveOvertimeStates(nextOvertimeStates);
    remove(WORKANA_TIMER_ID);
    clearTimerState(WORKANA_TIMER_ID);
    workanaInitialized.current = false;
    setPomodoroMeta(nextPomodoroMeta);
    // Reset daily tasks to pending for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    resetDailyTasks(tomorrowStr);
    session.endDay();
  }, [allTasks, getRemainingForTimer, overtimeCounters, pomodoroMeta, remove, session.endDay, stop, resetDailyTasks]);

  const handleStartDay = () => {
    session.startDay();
    requestNotificationPermission();
    toast('🚀 ¡Día iniciado!', { description: 'Recibirás recordatorios cada hora para Workana.' });
  };

  // Pomodoro controls - with persistence
  const handlePomodoroStart = useCallback((taskId: string) => {
    const meta = pomodoroMeta[taskId];
    const task = allTasks.find(candidate => candidate.id === taskId);
    const group = !task ? allGroups.find(g => g.id === taskId) : undefined;
    const currentPomodoro = meta?.currentPomodoro ?? Math.max(1, (task?.pomodorosCompleted ?? 0) + 1);
    const duration = meta?.phase === 'paused'
      ? Math.max(1, getRemainingForTimer(`pomo-${taskId}`) ?? POMODORO_DURATION)
      : POMODORO_DURATION;

    start(`pomo-${taskId}`, duration, 'pomodoro');
    upsertTimerState({ id: `pomo-${taskId}`, type: 'pomodoro', duration, startedAt: Date.now(), running: true });
    setPomodoroMeta(prev => ({
      ...prev,
      [taskId]: {
        currentPomodoro,
        phase: 'working',
        restMessage: prev[taskId]?.restMessage,
      },
    }));
  }, [allTasks, allGroups, getRemainingForTimer, pomodoroMeta, start]);

  const handlePomodoroStop = useCallback((taskId: string) => {
    const remaining = Math.max(1, getRemainingForTimer(`pomo-${taskId}`) ?? POMODORO_DURATION);
    stop(`pomo-${taskId}`);
    upsertTimerState({ id: `pomo-${taskId}`, type: 'pomodoro', duration: remaining, startedAt: Date.now(), running: false, pausedRemaining: remaining });
    setPomodoroMeta(prev => ({ ...prev, [taskId]: { ...prev[taskId], phase: 'paused' } }));
  }, [getRemainingForTimer, stop]);

  const handlePomodoroReset = useCallback((taskId: string) => {
    remove(`pomo-${taskId}`);
    clearTimerState(`pomo-${taskId}`);
    setPomodoroMeta(prev => ({ ...prev, [taskId]: { ...prev[taskId], phase: 'idle' } }));
  }, [remove]);

  const handleStartBreak = useCallback((taskId: string) => {
    start(`pomo-${taskId}`, BREAK_DURATION, 'break');
    upsertTimerState({ id: `pomo-${taskId}`, type: 'break', duration: BREAK_DURATION, startedAt: Date.now(), running: true });
    setPomodoroMeta(prev => ({ ...prev, [taskId]: { ...prev[taskId], phase: 'breaking' } }));
  }, [start]);

  const handleContinueNext = useCallback((taskId: string) => {
    const meta = pomodoroMeta[taskId];
    const nextPom = (meta?.currentPomodoro ?? 0) + 1;
    start(`pomo-${taskId}`, POMODORO_DURATION, 'pomodoro');
    upsertTimerState({ id: `pomo-${taskId}`, type: 'pomodoro', duration: POMODORO_DURATION, startedAt: Date.now(), running: true });
    setPomodoroMeta(prev => ({ ...prev, [taskId]: { phase: 'working', currentPomodoro: nextPom } }));
  }, [start, pomodoroMeta]);

  // Finish task
  const handleFinishTask = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    const group = !task ? groups.find(g => g.id === taskId) : undefined;

    if (group) {
      // Finish daily group - mark all subtasks as done
      const groupTasks = tasks.filter(t => t.groupId === group.id);
      const meta = pomodoroMeta[taskId];
      const pomCount = group.pomodoroCount ?? 1;
      let workSeconds = (meta?.currentPomodoro ?? 0) * POMODORO_DURATION;
      const timerVal = getRemainingForTimer(`pomo-${taskId}`);
      if (meta && (meta.phase === 'working' || meta.phase === 'paused') && timerVal !== undefined) {
        workSeconds += POMODORO_DURATION - timerVal;
      }
      workSeconds += overtimeCounters[taskId] ?? 0;

      // Distribute work time across subtasks
      if (groupTasks.length > 0) {
        const perTask = Math.floor(workSeconds / groupTasks.length);
        groupTasks.forEach(t => {
          setTotalWork(t.id, perTask);
          if (t.status !== 'done') updateStatus(t.id, 'done');
        });
      }

      stopOvertime(taskId);
      remove(`pomo-${taskId}`);
      clearTimerState(`pomo-${taskId}`);
      setPomodoroMeta(prev => { const n = { ...prev }; delete n[taskId]; return n; });
      toast.success('✅ ¡Grupo terminado!', { description: `Tiempo: ${Math.floor(workSeconds / 3600)}h ${Math.floor((workSeconds % 3600) / 60)}m` });
      return;
    }

    if (!task) return;
    const meta = pomodoroMeta[taskId];
    const timerVal = getRemainingForTimer(`pomo-${taskId}`);

    let workSeconds = task.pomodorosCompleted * POMODORO_DURATION;
    if (meta && (meta.phase === 'working' || meta.phase === 'paused') && timerVal !== undefined) {
      workSeconds += POMODORO_DURATION - timerVal;
    }
    const ot = overtimeCounters[taskId] ?? 0;
    workSeconds += ot;

    setTotalWork(taskId, workSeconds);
    stopOvertime(taskId);
    remove(`pomo-${taskId}`);
    clearTimerState(`pomo-${taskId}`);
    setPomodoroMeta(prev => { const n = { ...prev }; delete n[taskId]; return n; });
    updateStatus(taskId, 'done');
    toast.success('✅ ¡Tarea terminada!', { description: `Tiempo de trabajo: ${Math.floor(workSeconds / 3600)}h ${Math.floor((workSeconds % 3600) / 60)}m` });
  }, [tasks, groups, pomodoroMeta, getRemainingForTimer, overtimeCounters, setTotalWork, stopOvertime, remove, updateStatus]);

  const handleStatusChange = useCallback((id: string, status: string) => {
    if (status === 'done') {
      const task = tasks.find(t => t.id === id);
      if (task && task.totalWorkSeconds === 0) {
        const meta = pomodoroMeta[id];
        let workSeconds = task.pomodorosCompleted * POMODORO_DURATION;
        const timerVal = getRemainingForTimer(`pomo-${id}`);
        if (meta && (meta.phase === 'working' || meta.phase === 'paused') && timerVal !== undefined) {
          workSeconds += POMODORO_DURATION - timerVal;
        }
        workSeconds += overtimeCounters[id] ?? 0;
        if (workSeconds > 0) setTotalWork(id, workSeconds);
      }
      stopOvertime(id);
      remove(`pomo-${id}`);
      clearTimerState(`pomo-${id}`);
      setPomodoroMeta(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
    updateStatus(id, status as any);
  }, [updateStatus, stopOvertime, remove, tasks, pomodoroMeta, getRemainingForTimer, overtimeCounters, setTotalWork]);

  if (!session.active) {
    return <StartDayScreen onStart={handleStartDay} />;
  }

  const handleAddSubtask = (title: string, pomodoroCount: number, groupId: string, date?: string, scheduledTime?: string, isDaily?: boolean) => {
    addTask(title, pomodoroCount, date ?? selectedDate, scheduledTime, groupId, isDaily);
  };

  const getGroupTasks = (groupId: string) => tasks.filter(t => t.groupId === groupId);

  const ungroupedTasks = tasks.filter(t => !t.groupId);
  const todo = ungroupedTasks.filter(t => t.status === 'todo');
  const inProgress = ungroupedTasks.filter(t => t.status === 'in_progress');
  const done = ungroupedTasks.filter(t => t.status === 'done');
  const allDayDone = tasks.filter(t => t.status === 'done');
  const allDayTasks = tasks;
  const completionRate = allDayTasks.length > 0 ? Math.round((allDayDone.length / allDayTasks.length) * 100) : 0;

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayCompleted = allTasks.filter(t => t.date === dateStr && t.status === 'done').length;
    if (dayCompleted > 0) streak++;
    else break;
  }

  const todayWorkSeconds = tasks.reduce((sum, t) => sum + (t.totalWorkSeconds ?? 0), 0);
  const totalWorkSeconds = allTasks.reduce((sum, t) => sum + (t.totalWorkSeconds ?? 0), 0);
  const workanaRemaining = getRemainingForTimer(WORKANA_TIMER_ID) ?? getNextWorkanaRemaining();

  const getPomodoroState = (taskId: string) => {
    const meta = pomodoroMeta[taskId];
    if (!meta) return undefined;
    const timerVal = getRemainingForTimer(`pomo-${taskId}`);
    let remaining = timerVal ?? 0;
    if (meta.phase === 'overtime') remaining = overtimeCounters[taskId] ?? 0;
    if (meta.phase === 'idle' && !timerVal) remaining = POMODORO_DURATION;
    return {
      phase: meta.phase,
      remainingSeconds: remaining,
      currentPomodoro: meta.currentPomodoro,
      restMessage: meta.restMessage,
    };
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-4">
        <WorkanaBar
          secondsUntilNext={workanaRemaining}
          elapsedSeconds={session.elapsedSeconds}
          onEndDay={handleEndDay}
          paused={workanaPaused}
          onTogglePause={handleToggleWorkanaPause}
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold tracking-tight">Tracker</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Enfócate. Ejecuta. Repite.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-secondary rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab('tasks')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === 'tasks' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutGrid size={13} />
                Tareas
              </button>
               <button
                 onClick={() => setActiveTab('calendar')}
                 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                   activeTab === 'calendar' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                 }`}
               >
                 <CalendarDays size={13} />
                 Calendario
               </button>
               <button
                 onClick={() => setActiveTab('ram')}
                 className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                   activeTab === 'ram' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                 }`}
               >
                 <Cpu size={13} />
                 RAM
               </button>
            </div>
            <DatePicker selectedDate={selectedDate} onDateChange={setSelectedDate} />
            <DataActions tasks={allTasks} onImport={setTasks} />
          </div>
        </div>

        {activeTab === 'tasks' ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatsCard label="Total hoy" value={allDayTasks.length} icon={ListTodo} />
              <StatsCard label="Completadas" value={allDayDone.length} icon={CheckCircle2} />
              <StatsCard label="Tasa de éxito" value={`${completionRate}%`} icon={Target} accent />
              <StatsCard label="Racha" value={`${streak}d`} icon={Flame} />
              <StatsCard label="Trabajo hoy" value={`${Math.floor(todayWorkSeconds / 3600)}h${Math.floor((todayWorkSeconds % 3600) / 60).toString().padStart(2, '0')}m`} icon={Timer} />
              <StatsCard label="Trabajo total" value={`${Math.floor(totalWorkSeconds / 3600)}h${Math.floor((totalWorkSeconds % 3600) / 60).toString().padStart(2, '0')}m`} icon={Timer} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-card border border-border rounded-2xl p-5">
                  <TaskInput onAdd={addTask} onAddGroup={addGroup} defaultDate={selectedDate} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-card border border-border rounded-2xl p-5 space-y-1">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                      <h3 className="font-heading font-semibold text-sm">Pendientes</h3>
                      <span className="text-xs text-muted-foreground ml-auto">{todo.length}</span>
                    </div>
                    {groups.map(g => {
                      const gt = getGroupTasks(g.id);
                      if (gt.length === 0 && !g.completedAt) return (
                        <TaskGroupCard key={g.id} group={g} tasks={[]} onEditGroup={editGroup} onDeleteGroup={deleteGroup} onAddSubtask={handleAddSubtask} onStatusChange={handleStatusChange} onDelete={deleteTask} onEdit={editTask} getPomodoroState={getPomodoroState} onPomodoroStart={handlePomodoroStart} onPomodoroStop={handlePomodoroStop} onPomodoroReset={handlePomodoroReset} onStartBreak={handleStartBreak} onContinueNext={handleContinueNext} onFinishTask={handleFinishTask} />
                      );
                      const hasTodo = gt.some(t => t.status === 'todo');
                      if (!hasTodo && gt.length > 0) return null;
                      return (
                        <TaskGroupCard key={g.id} group={g} tasks={gt} onEditGroup={editGroup} onDeleteGroup={deleteGroup} onAddSubtask={handleAddSubtask} onStatusChange={handleStatusChange} onDelete={deleteTask} onEdit={editTask} getPomodoroState={getPomodoroState} onPomodoroStart={handlePomodoroStart} onPomodoroStop={handlePomodoroStop} onPomodoroReset={handlePomodoroReset} onStartBreak={handleStartBreak} onContinueNext={handleContinueNext} onFinishTask={handleFinishTask} />
                      );
                    })}
                    {todo.length === 0 && groups.filter(g => getGroupTasks(g.id).length === 0 && !g.completedAt).length === 0 && groups.filter(g => getGroupTasks(g.id).some(t => t.status === 'todo')).length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">Sin tareas pendientes</p>}
                    {todo.map(t => (
                     <TaskCard key={t.id} task={t} onStatusChange={handleStatusChange} onDelete={deleteTask} onEdit={editTask} />
                    ))}
                  </div>

                  <div className="bg-card border border-border rounded-2xl p-5 space-y-1">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-accent" />
                      <h3 className="font-heading font-semibold text-sm">En Progreso</h3>
                      <span className="text-xs text-muted-foreground ml-auto">{inProgress.length}</span>
                    </div>
                    {groups.map(g => {
                      const gt = getGroupTasks(g.id);
                      const hasInProgress = gt.some(t => t.status === 'in_progress');
                      if (!hasInProgress) return null;
                      return (
                        <TaskGroupCard key={g.id} group={g} tasks={gt} onEditGroup={editGroup} onDeleteGroup={deleteGroup} onAddSubtask={handleAddSubtask} onStatusChange={handleStatusChange} onDelete={deleteTask} onEdit={editTask} getPomodoroState={getPomodoroState} onPomodoroStart={handlePomodoroStart} onPomodoroStop={handlePomodoroStop} onPomodoroReset={handlePomodoroReset} onStartBreak={handleStartBreak} onContinueNext={handleContinueNext} onFinishTask={handleFinishTask} />
                      );
                    })}
                    {inProgress.length === 0 && groups.filter(g => getGroupTasks(g.id).some(t => t.status === 'in_progress')).length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">Nada en progreso</p>}
                    {inProgress.map(t => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        onStatusChange={handleStatusChange}
                        onDelete={deleteTask}
                        onEdit={editTask}
                        pomodoroState={getPomodoroState(t.id)}
                        onPomodoroStart={handlePomodoroStart}
                        onPomodoroStop={handlePomodoroStop}
                        onPomodoroReset={handlePomodoroReset}
                        onStartBreak={handleStartBreak}
                        onContinueNext={handleContinueNext}
                        onFinishTask={handleFinishTask}
                      />
                    ))}
                  </div>

                  <div className="bg-card border border-border rounded-2xl p-5 space-y-1">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-success" />
                      <h3 className="font-heading font-semibold text-sm">Completadas</h3>
                      <span className="text-xs text-muted-foreground ml-auto">{done.length}</span>
                    </div>
                    {groups.map(g => {
                      const gt = getGroupTasks(g.id);
                      if (!g.completedAt || gt.length === 0) return null;
                      return (
                        <TaskGroupCard key={g.id} group={g} tasks={gt} onEditGroup={editGroup} onDeleteGroup={deleteGroup} onAddSubtask={handleAddSubtask} onStatusChange={handleStatusChange} onDelete={deleteTask} onEdit={editTask} getPomodoroState={getPomodoroState} onPomodoroStart={handlePomodoroStart} onPomodoroStop={handlePomodoroStop} onPomodoroReset={handlePomodoroReset} onStartBreak={handleStartBreak} onContinueNext={handleContinueNext} onFinishTask={handleFinishTask} />
                      );
                    })}
                    {done.length === 0 && groups.filter(g => g.completedAt && getGroupTasks(g.id).length > 0).length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">Nada completado aún</p>}
                    {done.map(t => (
                      <TaskCard key={t.id} task={t} onStatusChange={handleStatusChange} onDelete={deleteTask} onEdit={editTask} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-card border border-border rounded-2xl p-5">
                  <Analytics allTasks={allTasks} />
                </div>
              </div>
            </div>
          </>
        ) : activeTab === 'calendar' ? (
          <CalendarView allTasks={allTasks} allGroups={allGroups} />
        ) : (
          <div className="bg-card border border-border rounded-2xl p-6">
            <SystemRAM />
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
