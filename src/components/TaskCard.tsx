import { Task, TaskStatus } from '@/lib/storage';
import { Circle, Clock, CheckCircle2, Trash2, Play, Pause, RotateCcw, Timer } from 'lucide-react';

interface Props {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  pomodoroSeconds?: number;
  onPomodoroStart?: (id: string) => void;
  onPomodoroStop?: (id: string) => void;
  onPomodoroReset?: (id: string) => void;
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

export function TaskCard({ task, onStatusChange, onDelete, pomodoroSeconds, onPomodoroStart, onPomodoroStop, onPomodoroReset }: Props) {
  const config = statusConfig[task.status];
  const Icon = config.icon;
  const isInProgress = task.status === 'in_progress';
  const hasPomodoro = isInProgress && pomodoroSeconds !== undefined;
  const isRunning = hasPomodoro && pomodoroSeconds > 0;

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

      {/* Pomodoro for in-progress tasks */}
      {isInProgress && (
        <div className="flex items-center gap-2 ml-8">
          <Timer size={13} className="text-accent" />
          <span className="font-mono text-xs font-semibold text-accent tabular-nums">
            {hasPomodoro ? formatTime(pomodoroSeconds) : '25:00'}
          </span>
          <div className="flex gap-1 ml-1">
            {(!hasPomodoro || pomodoroSeconds === 0) ? (
              <button
                onClick={() => onPomodoroStart?.(task.id)}
                className="p-1 rounded hover:bg-accent/10 text-accent transition-colors"
                title="Iniciar Pomodoro"
              >
                <Play size={12} />
              </button>
            ) : (
              <button
                onClick={() => onPomodoroStop?.(task.id)}
                className="p-1 rounded hover:bg-accent/10 text-accent transition-colors"
                title="Pausar"
              >
                <Pause size={12} />
              </button>
            )}
            <button
              onClick={() => onPomodoroReset?.(task.id)}
              className="p-1 rounded hover:bg-secondary text-muted-foreground transition-colors"
              title="Reiniciar"
            >
              <RotateCcw size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
