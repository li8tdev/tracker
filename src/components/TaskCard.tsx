import { Task, TaskStatus } from '@/lib/storage';
import { Circle, Clock, CheckCircle2, Trash2, Play, Pause, RotateCcw, Timer, Coffee, AlertTriangle } from 'lucide-react';

export type PomodoroPhase = 'idle' | 'working' | 'paused' | 'break_pending' | 'breaking' | 'next_pending' | 'overtime' | 'all_done';

interface PomodoroState {
  phase: PomodoroPhase;
  remainingSeconds: number;
  currentPomodoro: number; // 1-based
  restMessage?: string;
}

interface Props {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  pomodoroState?: PomodoroState;
  onPomodoroStart?: (id: string) => void;
  onPomodoroStop?: (id: string) => void;
  onPomodoroReset?: (id: string) => void;
  onStartBreak?: (id: string) => void;
  onContinueNext?: (id: string) => void;
}

const statusConfig: Record<TaskStatus, { icon: typeof Circle; label: string; className: string; next: TaskStatus }> = {
  todo: { icon: Circle, label: 'Pendiente', className: 'text-muted-foreground', next: 'in_progress' },
  in_progress: { icon: Clock, label: 'En progreso', className: 'text-accent', next: 'done' },
  done: { icon: CheckCircle2, label: 'Completada', className: 'text-success', next: 'todo' },
};

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function TaskCard({ task, onStatusChange, onDelete, pomodoroState, onPomodoroStart, onPomodoroStop, onPomodoroReset, onStartBreak, onContinueNext }: Props) {
  const config = statusConfig[task.status];
  const Icon = config.icon;
  const isInProgress = task.status === 'in_progress';
  const phase = pomodoroState?.phase ?? 'idle';

  return (
    <div className={`group flex flex-col gap-2 p-3 rounded-xl hover:bg-secondary/50 transition-all ${task.status === 'done' ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onStatusChange(task.id, config.next)}
          className={`shrink-0 ${config.className} hover:scale-110 transition-transform`}
          title={`Cambiar a ${statusConfig[config.next].label}`}
        >
          <Icon size={20} />
        </button>
        <span className={`flex-1 text-sm ${task.status === 'done' ? 'line-through' : ''}`}>
          {task.title}
        </span>
        <span className="text-xs text-muted-foreground font-mono">
          🍅 {task.pomodorosCompleted}/{task.pomodoroCount}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          task.status === 'todo' ? 'bg-secondary text-muted-foreground' :
          task.status === 'in_progress' ? 'bg-accent/10 text-accent' :
          'bg-success/10 text-success'
        }`}>
          {config.label}
        </span>
        <button
          onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Pomodoro section for in-progress tasks */}
      {isInProgress && (
        <div className="ml-8 space-y-2">
          {/* Working / Paused */}
          {(phase === 'idle' || phase === 'working' || phase === 'paused') && (
            <div className="flex items-center gap-2">
              <Timer size={13} className="text-accent" />
              <span className="font-mono text-xs font-semibold text-accent tabular-nums">
                {pomodoroState ? formatTime(pomodoroState.remainingSeconds) : '60:00'}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Pomodoro {pomodoroState?.currentPomodoro ?? 1}/{task.pomodoroCount}
              </span>
              <div className="flex gap-1 ml-1">
                {phase === 'working' ? (
                  <button onClick={() => onPomodoroStop?.(task.id)} className="p-1 rounded hover:bg-accent/10 text-accent transition-colors" title="Pausar">
                    <Pause size={12} />
                  </button>
                ) : (
                  <button onClick={() => onPomodoroStart?.(task.id)} className="p-1 rounded hover:bg-accent/10 text-accent transition-colors" title="Iniciar">
                    <Play size={12} />
                  </button>
                )}
                <button onClick={() => onPomodoroReset?.(task.id)} className="p-1 rounded hover:bg-secondary text-muted-foreground transition-colors" title="Reiniciar">
                  <RotateCcw size={12} />
                </button>
              </div>
            </div>
          )}

          {/* Break pending - pomodoro just finished */}
          {phase === 'break_pending' && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-accent">
                <Coffee size={14} />
                <span className="text-xs font-semibold">¡Pomodoro completado! Es hora de descansar</span>
              </div>
              {pomodoroState?.restMessage && (
                <p className="text-xs text-muted-foreground leading-relaxed">{pomodoroState.restMessage}</p>
              )}
              <button
                onClick={() => onStartBreak?.(task.id)}
                className="text-xs bg-accent text-accent-foreground px-3 py-1.5 rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Iniciar descanso (10 min)
              </button>
            </div>
          )}

          {/* Breaking */}
          {phase === 'breaking' && (
            <div className="flex items-center gap-2">
              <Coffee size={13} className="text-success" />
              <span className="font-mono text-xs font-semibold text-success tabular-nums">
                {formatTime(pomodoroState?.remainingSeconds ?? 0)}
              </span>
              <span className="text-[10px] text-muted-foreground">Descanso</span>
            </div>
          )}

          {/* Next pending - break finished */}
          {phase === 'next_pending' && (
            <div className="bg-success/5 border border-success/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-success">
                <Play size={14} />
                <span className="text-xs font-semibold">¡Descanso terminado! Listo para continuar</span>
              </div>
              <button
                onClick={() => onContinueNext?.(task.id)}
                className="text-xs bg-foreground text-background px-3 py-1.5 rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Iniciar pomodoro {(pomodoroState?.currentPomodoro ?? 1) + 1}/{task.pomodoroCount}
              </button>
            </div>
          )}

          {/* All done / Overtime */}
          {(phase === 'all_done' || phase === 'overtime') && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle size={14} />
                <span className="text-xs font-semibold">¡Terminaste los {task.pomodoroCount} pomodoros!</span>
              </div>
              {phase === 'overtime' && (
                <div className="flex items-center gap-2">
                  <Timer size={12} className="text-destructive" />
                  <span className="font-mono text-xs font-semibold text-destructive tabular-nums">
                    +{formatTime(pomodoroState?.remainingSeconds ?? 0)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Tiempo adicional</span>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">El tiempo adicional se registra en tus estadísticas.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
