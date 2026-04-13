import { useEffect, useCallback, useRef, useState } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { useTimer } from '@/hooks/useTimer';
import { useDaySession } from '@/hooks/useDaySession';
import { requestNotificationPermission, sendNotification } from '@/lib/notifications';
import { getRandomRestMessage } from '@/lib/restMessages';
import { TaskInput } from '@/components/TaskInput';
import { TaskCard, PomodoroPhase } from '@/components/TaskCard';
import { StatsCard } from '@/components/StatsCard';
import { Analytics } from '@/components/Analytics';
import { CalendarView } from '@/components/CalendarView';
import { DatePicker } from '@/components/DatePicker';
import { DataActions } from '@/components/DataActions';
import { StartDayScreen } from '@/components/StartDayScreen';
import { WorkanaBar } from '@/components/WorkanaBar';
import { ListTodo, CheckCircle2, Flame, Target, Zap, CalendarDays, LayoutGrid } from 'lucide-react';
import { toast } from 'sonner';

const POMODORO_DURATION = 60 * 60; // 60 min
const BREAK_DURATION = 10 * 60; // 10 min
const WORKANA_INTERVAL = 60 * 60;
const WORKANA_TIMER_ID = '__workana__';

interface PomodoroMeta {
  currentPomodoro: number;
  phase: PomodoroPhase;
  restMessage?: string;
}

const Index = () => {
  const { tasks, allTasks, addTask, updateStatus, deleteTask, selectedDate, setSelectedDate, setTasks, incrementPomodoro, addOvertime } = useTasks();
  const session = useDaySession();
  const workanaInitialized = useRef(false);
  const [activeTab, setActiveTab] = useState<'tasks' | 'calendar'>('tasks');

  // Track pomodoro phase per task
  const [pomodoroMeta, setPomodoroMeta] = useState<Record<string, PomodoroMeta>>({});
  // Track overtime counters
  const overtimeIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({});
  const [overtimeCounters, setOvertimeCounters] = useState<Record<string, number>>({});

  const handleTimerDone = useCallback((id: string, timerType: string) => {
    if (timerType === 'workana') {
      sendNotification('📨 ¡Envía propuestas en Workana!', 'Es hora de revisar Workana y enviar propuestas.');
      toast('📨 ¡Envía propuestas en Workana!', { description: 'Revisa Workana y envía propuestas ahora.', duration: 10000 });
      setTimeout(() => start(WORKANA_TIMER_ID, WORKANA_INTERVAL, 'workana'), 500);
    } else if (timerType === 'break') {
      // Break finished
      const taskId = id.replace('pomo-', '');
      sendNotification('✅ ¡Descanso terminado!', '¡Listo para el siguiente pomodoro!');
      toast.success('✅ ¡Descanso terminado!', { description: 'Continúa con el siguiente pomodoro.' });
      setPomodoroMeta(prev => ({ ...prev, [taskId]: { ...prev[taskId], phase: 'next_pending' } }));
    } else {
      // Pomodoro finished
      const taskId = id.replace('pomo-', '');
      const meta = pomodoroMeta[taskId];
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      incrementPomodoro(taskId);
      const newCompleted = (task.pomodorosCompleted ?? 0) + 1;

      if (newCompleted >= task.pomodoroCount) {
        // All pomodoros done
        sendNotification('🎉 ¡Todos los pomodoros completados!', `Tarea: ${task.title}. ¡Puedes marcarla como completada!`);
        toast.success('🎉 ¡Todos los pomodoros completados!', { description: `${task.title}` });
        setPomodoroMeta(prev => ({ ...prev, [taskId]: { ...prev[taskId], phase: 'all_done', currentPomodoro: newCompleted } }));
        // Start overtime counter
        startOvertime(taskId);
      } else {
        // More pomodoros left - show break pending
        const msg = getRandomRestMessage();
        sendNotification('🍅 ¡Pomodoro completado!', `${task.title}. ¡Toma un descanso!`);
        toast.success('🍅 ¡Pomodoro completado!', { description: msg });
        setPomodoroMeta(prev => ({ ...prev, [taskId]: { ...prev[taskId], phase: 'break_pending', restMessage: msg, currentPomodoro: newCompleted } }));
      }
    }
  }, [tasks, pomodoroMeta, incrementPomodoro]);

  const { timers, start, stop, reset, remove } = useTimer(handleTimerDone);

  const startOvertime = useCallback((taskId: string) => {
    if (overtimeIntervals.current[taskId]) clearInterval(overtimeIntervals.current[taskId]);
    setOvertimeCounters(prev => ({ ...prev, [taskId]: 0 }));
    overtimeIntervals.current[taskId] = setInterval(() => {
      setOvertimeCounters(prev => ({ ...prev, [taskId]: (prev[taskId] ?? 0) + 1 }));
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
  }, [overtimeCounters, addOvertime]);

  useEffect(() => { requestNotificationPermission(); }, []);

  useEffect(() => {
    if (session.active && !workanaInitialized.current) {
      workanaInitialized.current = true;
      const elapsed = session.elapsedSeconds;
      const remaining = WORKANA_INTERVAL - (elapsed % WORKANA_INTERVAL);
      start(WORKANA_TIMER_ID, remaining, 'workana');
    }
    if (!session.active) {
      workanaInitialized.current = false;
      remove(WORKANA_TIMER_ID);
    }
  }, [session.active]);

  const handleStartDay = () => {
    session.startDay();
    requestNotificationPermission();
    toast('🚀 ¡Día iniciado!', { description: 'Recibirás recordatorios cada hora para Workana.' });
  };

  // Pomodoro controls
  const handlePomodoroStart = useCallback((taskId: string) => {
    const meta = pomodoroMeta[taskId];
    const currentPom = meta?.currentPomodoro ?? 0;
    start(`pomo-${taskId}`, POMODORO_DURATION, 'pomodoro');
    setPomodoroMeta(prev => ({ ...prev, [taskId]: { phase: 'working', currentPomodoro: currentPom || 1 } }));
  }, [start, pomodoroMeta]);

  const handlePomodoroStop = useCallback((taskId: string) => {
    stop(`pomo-${taskId}`);
    setPomodoroMeta(prev => ({ ...prev, [taskId]: { ...prev[taskId], phase: 'paused' } }));
  }, [stop]);

  const handlePomodoroReset = useCallback((taskId: string) => {
    reset(`pomo-${taskId}`, POMODORO_DURATION, 'pomodoro');
    setPomodoroMeta(prev => ({ ...prev, [taskId]: { ...prev[taskId], phase: 'idle' } }));
  }, [reset]);

  const handleStartBreak = useCallback((taskId: string) => {
    start(`pomo-${taskId}`, BREAK_DURATION, 'break');
    setPomodoroMeta(prev => ({ ...prev, [taskId]: { ...prev[taskId], phase: 'breaking' } }));
  }, [start]);

  const handleContinueNext = useCallback((taskId: string) => {
    const meta = pomodoroMeta[taskId];
    const nextPom = (meta?.currentPomodoro ?? 0) + 1;
    start(`pomo-${taskId}`, POMODORO_DURATION, 'pomodoro');
    setPomodoroMeta(prev => ({ ...prev, [taskId]: { phase: 'working', currentPomodoro: nextPom } }));
  }, [start, pomodoroMeta]);

  // Stop overtime when task status changes to done
  const handleStatusChange = useCallback((id: string, status: string) => {
    if (status === 'done') {
      stopOvertime(id);
      remove(`pomo-${id}`);
      setPomodoroMeta(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
    updateStatus(id, status as any);
  }, [updateStatus, stopOvertime, remove]);

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
        <WorkanaBar secondsUntilNext={workanaRemaining} elapsedSeconds={session.elapsedSeconds} onEndDay={session.endDay} />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold tracking-tight">Tracker</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Enfócate. Ejecuta. Repite.</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Tab switcher */}
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatsCard label="Total hoy" value={tasks.length} icon={ListTodo} />
              <StatsCard label="Completadas" value={done.length} icon={CheckCircle2} />
              <StatsCard label="Tasa de éxito" value={`${completionRate}%`} icon={Target} accent />
              <StatsCard label="Racha" value={`${streak}d`} icon={Flame} />
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
                      <TaskCard key={t.id} task={t} onStatusChange={handleStatusChange} onDelete={deleteTask} />
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
                        pomodoroState={getPomodoroState(t.id)}
                        onPomodoroStart={handlePomodoroStart}
                        onPomodoroStop={handlePomodoroStop}
                        onPomodoroReset={handlePomodoroReset}
                        onStartBreak={handleStartBreak}
                        onContinueNext={handleContinueNext}
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
                      <TaskCard key={t.id} task={t} onStatusChange={handleStatusChange} onDelete={deleteTask} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-card border border-border rounded-2xl p-5">
                  <Analytics allTasks={allTasks} />
                </div>

                <div className="bg-foreground text-background rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap size={16} />
                    <h3 className="font-heading font-semibold text-sm">Consejo</h3>
                  </div>
                  <p className="text-xs leading-relaxed opacity-70">
                    {inProgress.length === 0 && todo.length > 0
                      ? "Tienes tareas pendientes. Elige una y empieza ahora."
                      : inProgress.length > 2
                      ? "Demasiadas tareas en progreso. Enfócate en terminar una."
                      : done.length > 0 && todo.length === 0
                      ? "¡Excelente! Has completado todas tus tareas del día."
                      : "Mantén máximo 2-3 tareas en progreso."
                    }
                  </p>
                </div>

                <div className="bg-card border border-border rounded-2xl p-5 flex flex-col items-center">
                  <div className="relative w-28 h-28">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="50" fill="none" className="stroke-secondary" strokeWidth="8" />
                      <circle cx="60" cy="60" r="50" fill="none" className="stroke-accent" strokeWidth="8" strokeLinecap="round"
                        strokeDasharray={`${(completionRate / 100) * 314} 314`}
                        style={{ transition: 'stroke-dasharray 0.5s ease' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xl font-heading font-bold">{completionRate}%</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">Progreso del día</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5">
              <CalendarView allTasks={allTasks} />
            </div>
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-2xl p-5">
                <Analytics allTasks={allTasks} />
              </div>
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col items-center">
                <div className="relative w-28 h-28">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" className="stroke-secondary" strokeWidth="8" />
                    <circle cx="60" cy="60" r="50" fill="none" className="stroke-accent" strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${(completionRate / 100) * 314} 314`}
                      style={{ transition: 'stroke-dasharray 0.5s ease' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-heading font-bold">{completionRate}%</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-3">Progreso del día</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
