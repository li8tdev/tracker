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
} from '@/lib/timerPersistence';
import { TaskInput } from '@/components/TaskInput';
import { TaskCard, PomodoroPhase } from '@/components/TaskCard';
import { StatsCard } from '@/components/StatsCard';
import { Analytics } from '@/components/Analytics';
import { CalendarView } from '@/components/CalendarView';
import { DatePicker } from '@/components/DatePicker';
import { DataActions } from '@/components/DataActions';
import { StartDayScreen } from '@/components/StartDayScreen';
import { WorkanaBar } from '@/components/WorkanaBar';
import { ListTodo, CheckCircle2, Flame, Target, Zap, CalendarDays, LayoutGrid, Timer } from 'lucide-react';
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

const Index = () => {
  const { tasks, allTasks, addTask, updateStatus, deleteTask, selectedDate, setSelectedDate, setTasks, incrementPomodoro, addOvertime, setTotalWork, editTask } = useTasks();
  const session = useDaySession();
  const workanaInitialized = useRef(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'calendar'>('tasks');
  const [workanaPaused, setWorkanaPausedState] = useState(() => getWorkanaPaused());

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
      result[k] = Math.floor((Date.now() - v.startedAt) / 1000);
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

  const handleTimerDone = useCallback((id: string, timerType: string) => {
    if (timerType === 'workana') {
      sendNotification('📨 ¡Envía propuestas en Workana!', 'Es hora de revisar Workana y enviar propuestas.');
      toast('📨 ¡Envía propuestas en Workana!', { description: 'Revisa Workana y envía propuestas ahora.', duration: 10000 });
      clearTimerState(WORKANA_TIMER_ID);
      setTimeout(() => {
        start(WORKANA_TIMER_ID, WORKANA_INTERVAL, 'workana');
        upsertTimerState({ id: WORKANA_TIMER_ID, type: 'workana', duration: WORKANA_INTERVAL, startedAt: Date.now(), running: true });
      }, 500);
    } else if (timerType === 'break') {
      const taskId = id.replace('pomo-', '');
      sendNotification('✅ ¡Descanso terminado!', '¡Listo para el siguiente pomodoro!');
      toast.success('✅ ¡Descanso terminado!', { description: 'Continúa con el siguiente pomodoro.' });
      clearTimerState(id);
      setPomodoroMeta(prev => ({ ...prev, [taskId]: { ...prev[taskId], phase: 'next_pending' } }));
    } else {
      const taskId = id.replace('pomo-', '');
      const meta = pomodoroMeta[taskId];
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      incrementPomodoro(taskId);
      const newCompleted = (task.pomodorosCompleted ?? 0) + 1;
      clearTimerState(id);

      if (newCompleted >= task.pomodoroCount) {
        sendNotification('🎉 ¡Todos los pomodoros completados!', `Tarea: ${task.title}. ¡Puedes marcarla como completada!`);
        toast.success('🎉 ¡Todos los pomodoros completados!', { description: `${task.title}` });
        setPomodoroMeta(prev => ({ ...prev, [taskId]: { ...prev[taskId], phase: 'all_done', currentPomodoro: newCompleted } }));
        startOvertime(taskId);
      } else {
        const msg = getRandomRestMessage();
        sendNotification('🍅 ¡Pomodoro completado!', `${task.title}. ¡Toma un descanso!`);
        toast.success('🍅 ¡Pomodoro completado!', { description: msg });
        setPomodoroMeta(prev => ({ ...prev, [taskId]: { ...prev[taskId], phase: 'break_pending', restMessage: msg, currentPomodoro: newCompleted } }));
      }
    }
  }, [tasks, pomodoroMeta, incrementPomodoro]);

  const { timers, start, stop, reset, remove, restore } = useTimer(handleTimerDone);

  // Restore timers on mount
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const saved = loadTimerStates();
    if (saved.length === 0) return;

    const entries = saved.map(t => {
      let remaining: number;
      if (t.running) {
        const elapsed = Math.floor((Date.now() - t.startedAt) / 1000);
        remaining = Math.max(0, t.duration - elapsed);
      } else {
        remaining = t.pausedRemaining ?? t.duration;
      }
      return { id: t.id, remaining, running: t.running && remaining > 0, type: t.type };
    }).filter(e => e.remaining > 0);

    if (entries.length > 0) restore(entries);
  }, [restore]);

  // Restore overtime intervals on mount
  useEffect(() => {
    const saved = loadOvertimeStates();
    for (const [taskId, state] of Object.entries(saved)) {
      if (!overtimeIntervals.current[taskId]) {
        overtimeIntervals.current[taskId] = setInterval(() => {
          setOvertimeCounters(prev => {
            const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
            return { ...prev, [taskId]: elapsed };
          });
        }, 1000);
      }
    }
    return () => {
      Object.values(overtimeIntervals.current).forEach(clearInterval);
    };
  }, []);

  const startOvertime = useCallback((taskId: string) => {
    if (overtimeIntervals.current[taskId]) clearInterval(overtimeIntervals.current[taskId]);
    const startedAt = Date.now();
    setOvertimeCounters(prev => ({ ...prev, [taskId]: 0 }));
    const otStates = loadOvertimeStates();
    otStates[taskId] = { startedAt };
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
    if (session.active && !workanaInitialized.current) {
      workanaInitialized.current = true;
      if (workanaPaused) return; // Don't start if paused
      // Check if already restored from persistence
      if (timers[WORKANA_TIMER_ID] !== undefined) return;
      const elapsed = session.elapsedSeconds;
      const remaining = WORKANA_INTERVAL - (elapsed % WORKANA_INTERVAL);
      start(WORKANA_TIMER_ID, remaining, 'workana');
      upsertTimerState({ id: WORKANA_TIMER_ID, type: 'workana', duration: remaining, startedAt: Date.now(), running: true });
    }
    if (!session.active) {
      workanaInitialized.current = false;
      remove(WORKANA_TIMER_ID);
      clearTimerState(WORKANA_TIMER_ID);
    }
  }, [session.active]);

  // Workana pause/resume
  const handleToggleWorkanaPause = useCallback(() => {
    if (workanaPaused) {
      // Resume
      setWorkanaPausedState(false);
      persistWorkanaPaused(false);
      start(WORKANA_TIMER_ID, WORKANA_INTERVAL, 'workana');
      upsertTimerState({ id: WORKANA_TIMER_ID, type: 'workana', duration: WORKANA_INTERVAL, startedAt: Date.now(), running: true });
    } else {
      // Pause
      setWorkanaPausedState(true);
      persistWorkanaPaused(true);
      remove(WORKANA_TIMER_ID);
      clearTimerState(WORKANA_TIMER_ID);
    }
  }, [workanaPaused, start, remove]);

  const handleStartDay = () => {
    session.startDay();
    requestNotificationPermission();
    toast('🚀 ¡Día iniciado!', { description: 'Recibirás recordatorios cada hora para Workana.' });
  };

  // Pomodoro controls - with persistence
  const handlePomodoroStart = useCallback((taskId: string) => {
    const meta = pomodoroMeta[taskId];
    const currentPom = meta?.currentPomodoro ?? 0;
    start(`pomo-${taskId}`, POMODORO_DURATION, 'pomodoro');
    upsertTimerState({ id: `pomo-${taskId}`, type: 'pomodoro', duration: POMODORO_DURATION, startedAt: Date.now(), running: true });
    setPomodoroMeta(prev => ({ ...prev, [taskId]: { phase: 'working', currentPomodoro: currentPom || 1 } }));
  }, [start, pomodoroMeta]);

  const handlePomodoroStop = useCallback((taskId: string) => {
    stop(`pomo-${taskId}`);
    const remaining = timers[`pomo-${taskId}`] ?? POMODORO_DURATION;
    upsertTimerState({ id: `pomo-${taskId}`, type: 'pomodoro', duration: POMODORO_DURATION, startedAt: Date.now(), running: false, pausedRemaining: remaining });
    setPomodoroMeta(prev => ({ ...prev, [taskId]: { ...prev[taskId], phase: 'paused' } }));
  }, [stop, timers]);

  const handlePomodoroReset = useCallback((taskId: string) => {
    reset(`pomo-${taskId}`, POMODORO_DURATION, 'pomodoro');
    upsertTimerState({ id: `pomo-${taskId}`, type: 'pomodoro', duration: POMODORO_DURATION, startedAt: Date.now(), running: false, pausedRemaining: POMODORO_DURATION });
    setPomodoroMeta(prev => ({ ...prev, [taskId]: { ...prev[taskId], phase: 'idle' } }));
  }, [reset]);

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
    if (!task) return;
    const meta = pomodoroMeta[taskId];
    const timerVal = timers[`pomo-${taskId}`];

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
  }, [tasks, pomodoroMeta, timers, overtimeCounters, setTotalWork, stopOvertime, remove, updateStatus]);

  const handleStatusChange = useCallback((id: string, status: string) => {
    if (status === 'done') {
      const task = tasks.find(t => t.id === id);
      if (task && task.totalWorkSeconds === 0) {
        const meta = pomodoroMeta[id];
        let workSeconds = task.pomodorosCompleted * POMODORO_DURATION;
        const timerVal = timers[`pomo-${id}`];
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
  }, [updateStatus, stopOvertime, remove, tasks, pomodoroMeta, timers, overtimeCounters, setTotalWork]);

  if (!session.active) {
    return <StartDayScreen onStart={handleStartDay} />;
  }

  const todo = tasks.filter(t => t.status === 'todo');
  const inProgress = tasks.filter(t => t.status === 'in_progress');
  const done = tasks.filter(t => t.status === 'done');
  const completionRate = tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0;

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
  const workanaRemaining = timers[WORKANA_TIMER_ID] ?? WORKANA_INTERVAL;

  const getPomodoroState = (taskId: string) => {
    const meta = pomodoroMeta[taskId];
    if (!meta) return undefined;
    const timerVal = timers[`pomo-${taskId}`];
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
          onEndDay={session.endDay}
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
            </div>
            <DatePicker selectedDate={selectedDate} onDateChange={setSelectedDate} />
            <DataActions tasks={allTasks} onImport={setTasks} />
          </div>
        </div>

        {activeTab === 'tasks' ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatsCard label="Total hoy" value={tasks.length} icon={ListTodo} />
              <StatsCard label="Completadas" value={done.length} icon={CheckCircle2} />
              <StatsCard label="Tasa de éxito" value={`${completionRate}%`} icon={Target} accent />
              <StatsCard label="Racha" value={`${streak}d`} icon={Flame} />
              <StatsCard label="Trabajo hoy" value={`${Math.floor(todayWorkSeconds / 3600)}h${Math.floor((todayWorkSeconds % 3600) / 60).toString().padStart(2, '0')}m`} icon={Timer} />
              <StatsCard label="Trabajo total" value={`${Math.floor(totalWorkSeconds / 3600)}h${Math.floor((totalWorkSeconds % 3600) / 60).toString().padStart(2, '0')}m`} icon={Timer} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-card border border-border rounded-2xl p-5">
                  <TaskInput onAdd={addTask} defaultDate={selectedDate} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-card border border-border rounded-2xl p-5 space-y-1">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                      <h3 className="font-heading font-semibold text-sm">Pendientes</h3>
                      <span className="text-xs text-muted-foreground ml-auto">{todo.length}</span>
                    </div>
                    {todo.length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">Sin tareas pendientes</p>}
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
                    {inProgress.length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">Nada en progreso</p>}
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
                    {done.length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">Nada completado aún</p>}
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
        ) : (
          <CalendarView allTasks={allTasks} />
        )}
      </div>
    </div>
  );
};

export default Index;
