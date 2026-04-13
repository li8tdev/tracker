import { useEffect, useCallback, useRef } from 'react';
import { useTasks } from '@/hooks/useTasks';
import { useTimer } from '@/hooks/useTimer';
import { useDaySession } from '@/hooks/useDaySession';
import { requestNotificationPermission, sendNotification } from '@/lib/notifications';
import { TaskInput } from '@/components/TaskInput';
import { TaskCard } from '@/components/TaskCard';
import { StatsCard } from '@/components/StatsCard';
import { Analytics } from '@/components/Analytics';
import { DatePicker } from '@/components/DatePicker';
import { DataActions } from '@/components/DataActions';
import { StartDayScreen } from '@/components/StartDayScreen';
import { WorkanaBar } from '@/components/WorkanaBar';
import { ListTodo, CheckCircle2, Flame, Target, Zap } from 'lucide-react';
import { toast } from 'sonner';

const POMODORO_DURATION = 25 * 60;
const WORKANA_INTERVAL = 60 * 60; // 1 hour
const WORKANA_TIMER_ID = '__workana__';

const Index = () => {
  const { tasks, allTasks, addTask, updateStatus, deleteTask, selectedDate, setSelectedDate, setTasks } = useTasks();
  const session = useDaySession();
  const workanaInitialized = useRef(false);

  const handleTimerDone = useCallback((id: string, timerType: string) => {
    if (timerType === 'workana') {
      sendNotification('📨 ¡Envía propuestas en Workana!', 'Es hora de revisar Workana y enviar propuestas. ¡No pierdas oportunidades!');
      toast('📨 ¡Envía propuestas en Workana!', { description: 'Revisa Workana y envía propuestas ahora.', duration: 10000 });
      // Restart the workana timer
      setTimeout(() => start(WORKANA_TIMER_ID, WORKANA_INTERVAL, 'workana'), 500);
    } else {
      const task = tasks.find(t => `pomo-${t.id}` === id);
      sendNotification('🍅 ¡Pomodoro completado!', task ? `Tarea: ${task.title}. ¡Toma un descanso de 5 min!` : '¡Toma un descanso!');
      toast.success('🍅 ¡Pomodoro completado!', { description: '¡Buen trabajo! Toma un descanso de 5 minutos.' });
    }
  }, [tasks]);

  const { timers, start, stop, reset, remove } = useTimer(handleTimerDone);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Start Workana timer when session starts
  useEffect(() => {
    if (session.active && !workanaInitialized.current) {
      workanaInitialized.current = true;
      // Calculate remaining time in current hour
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

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Workana Bar - always visible at top */}
        <WorkanaBar
          secondsUntilNext={workanaRemaining}
          elapsedSeconds={session.elapsedSeconds}
          onEndDay={session.endDay}
        />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-heading font-bold tracking-tight">Tracker</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Enfócate. Ejecuta. Repite.</p>
          </div>
          <div className="flex items-center gap-4">
            <DatePicker selectedDate={selectedDate} onDateChange={setSelectedDate} />
            <DataActions tasks={allTasks} onImport={setTasks} />
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatsCard label="Total hoy" value={tasks.length} icon={ListTodo} />
          <StatsCard label="Completadas" value={done.length} icon={CheckCircle2} />
          <StatsCard label="Tasa de éxito" value={`${completionRate}%`} icon={Target} accent />
          <StatsCard label="Racha" value={`${streak}d`} icon={Flame} />
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <TaskInput onAdd={addTask} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Todo */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                  <h3 className="font-heading font-semibold text-sm">Pendientes</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{todo.length}</span>
                </div>
                {todo.length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">Sin tareas pendientes</p>}
                {todo.map(t => (
                  <TaskCard key={t.id} task={t} onStatusChange={updateStatus} onDelete={deleteTask} />
                ))}
              </div>

              {/* In Progress */}
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
                    onStatusChange={updateStatus}
                    onDelete={deleteTask}
                    pomodoroSeconds={timers[`pomo-${t.id}`]}
                    onPomodoroStart={(id) => start(`pomo-${id}`, POMODORO_DURATION)}
                    onPomodoroStop={(id) => stop(`pomo-${id}`)}
                    onPomodoroReset={(id) => reset(`pomo-${id}`, POMODORO_DURATION)}
                  />
                ))}
              </div>

              {/* Done */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  <h3 className="font-heading font-semibold text-sm">Completadas</h3>
                  <span className="text-xs text-muted-foreground ml-auto">{done.length}</span>
                </div>
                {done.length === 0 && <p className="text-xs text-muted-foreground py-6 text-center">Nada completado aún</p>}
                {done.map(t => (
                  <TaskCard key={t.id} task={t} onStatusChange={updateStatus} onDelete={deleteTask} />
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
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
                  ? "Tienes tareas pendientes. Elige una y empieza ahora — el primer paso es el más difícil."
                  : inProgress.length > 2
                  ? "Demasiadas tareas en progreso. Enfócate en terminar una antes de empezar otra."
                  : done.length > 0 && todo.length === 0
                  ? "¡Excelente! Has completado todas tus tareas del día. Descansa o planifica mañana."
                  : "Mantén máximo 2-3 tareas en progreso. Menos es más cuando se trata de productividad."
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
      </div>
    </div>
  );
};

export default Index;
