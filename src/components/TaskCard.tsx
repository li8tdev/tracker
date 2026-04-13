import { useState } from 'react';
import { Task, TaskStatus } from '@/lib/storage';
import { Circle, Clock, CheckCircle2, Trash2, Play, Pause, RotateCcw, Timer, Coffee, AlertTriangle, Pencil, Check, X, Minus, Plus, CalendarDays } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export type PomodoroPhase = 'idle' | 'working' | 'paused' | 'break_pending' | 'breaking' | 'next_pending' | 'overtime' | 'all_done';

interface PomodoroState {
  phase: PomodoroPhase;
  remainingSeconds: number;
  currentPomodoro: number;
  restMessage?: string;
}

interface Props {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  onEdit?: (id: string, updates: { title?: string; pomodoroCount?: number; date?: string }) => void;
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

export function TaskCard({ task, onStatusChange, onDelete, onEdit, pomodoroState, onPomodoroStart, onPomodoroStop, onPomodoroReset, onStartBreak, onContinueNext }: Props) {
  const config = statusConfig[task.status];
  const Icon = config.icon;
  const isInProgress = task.status === 'in_progress';
  const phase = pomodoroState?.phase ?? 'idle';

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editPomodoros, setEditPomodoros] = useState(task.pomodoroCount);
  const [editDate, setEditDate] = useState<Date>(new Date(task.date + 'T12:00:00'));
  const [calOpen, setCalOpen] = useState(false);

  const startEdit = () => {
    setEditTitle(task.title);
    setEditPomodoros(task.pomodoroCount);
    setEditDate(new Date(task.date + 'T12:00:00'));
    setEditing(true);
  };

  const saveEdit = () => {
    onEdit?.(task.id, {
      title: editTitle.trim() || task.title,
      pomodoroCount: editPomodoros,
      date: editDate.toISOString().split('T')[0],
    });
    setEditing(false);
  };

  const cancelEdit = () => setEditing(false);

  if (editing) {
    return (
      <div className="p-3 rounded-xl bg-secondary/30 border border-border space-y-2">
        <input
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
        />
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground">🍅</span>
            <button type="button" onClick={() => setEditPomodoros(p => Math.max(1, p - 1))} className="p-0.5 rounded hover:bg-secondary text-muted-foreground"><Minus size={10} /></button>
            <span className="text-xs font-mono font-semibold w-4 text-center">{editPomodoros}</span>
            <button type="button" onClick={() => setEditPomodoros(p => Math.min(10, p + 1))} className="p-0.5 rounded hover:bg-secondary text-muted-foreground"><Plus size={10} /></button>
          </div>
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                <CalendarDays size={10} />
                {format(editDate, "d MMM", { locale: es })}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={editDate} onSelect={d => { if (d) { setEditDate(d); setCalOpen(false); } }} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <div className="flex gap-1 ml-auto">
            <button onClick={saveEdit} className="p-1 rounded hover:bg-success/10 text-success transition-colors"><Check size={14} /></button>
            <button onClick={cancelEdit} className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"><X size={14} /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`group flex flex-col gap-2 p-3 rounded-xl hover:bg-secondary/50 transition-all ${task.status === 'done' ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-2">
        <button
          onClick={() => onStatusChange(task.id, config.next)}
          className={`shrink-0 mt-0.5 ${config.className} hover:scale-110 transition-transform`}
          title={`Cambiar a ${statusConfig[config.next].label}`}
        >
          <Icon size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <span className={`text-sm leading-tight break-words ${task.status === 'done' ? 'line-through' : ''}`}>
            {task.title}
          </span>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground font-mono">
              🍅 {task.pomodorosCompleted}/{task.pomodoroCount}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              task.status === 'todo' ? 'bg-secondary text-muted-foreground' :
              task.status === 'in_progress' ? 'bg-accent/10 text-accent' :
              'bg-success/10 text-success'
            }`}>
              {config.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={startEdit}
            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-accent transition-all"
            title="Editar"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Date badge if not today */}
      {task.date !== new Date().toISOString().split('T')[0] && (
        <div className="ml-8">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <CalendarDays size={10} />
            {format(new Date(task.date + 'T12:00:00'), "d MMM yyyy", { locale: es })}
          </span>
        </div>
      )}

      {isInProgress && (
        <div className="ml-8 space-y-2">
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
                  <button onClick={() => onPomodoroStop?.(task.id)} className="p-1 rounded hover:bg-accent/10 text-accent transition-colors" title="Pausar"><Pause size={12} /></button>
                ) : (
                  <button onClick={() => onPomodoroStart?.(task.id)} className="p-1 rounded hover:bg-accent/10 text-accent transition-colors" title="Iniciar"><Play size={12} /></button>
                )}
                <button onClick={() => onPomodoroReset?.(task.id)} className="p-1 rounded hover:bg-secondary text-muted-foreground transition-colors" title="Reiniciar"><RotateCcw size={12} /></button>
              </div>
            </div>
          )}

          {phase === 'break_pending' && (
            <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-accent">
                <Coffee size={14} />
                <span className="text-xs font-semibold">¡Pomodoro completado! Es hora de descansar</span>
              </div>
              {pomodoroState?.restMessage && (
                <p className="text-xs text-muted-foreground leading-relaxed">{pomodoroState.restMessage}</p>
              )}
              <button onClick={() => onStartBreak?.(task.id)} className="text-xs bg-accent text-accent-foreground px-3 py-1.5 rounded-lg font-medium hover:opacity-90 transition-opacity">
                Iniciar descanso (10 min)
              </button>
            </div>
          )}

          {phase === 'breaking' && (
            <div className="flex items-center gap-2">
              <Coffee size={13} className="text-success" />
              <span className="font-mono text-xs font-semibold text-success tabular-nums">{formatTime(pomodoroState?.remainingSeconds ?? 0)}</span>
              <span className="text-[10px] text-muted-foreground">Descanso</span>
            </div>
          )}

          {phase === 'next_pending' && (
            <div className="bg-success/5 border border-success/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-success">
                <Play size={14} />
                <span className="text-xs font-semibold">¡Descanso terminado! Listo para continuar</span>
              </div>
              <button onClick={() => onContinueNext?.(task.id)} className="text-xs bg-foreground text-background px-3 py-1.5 rounded-lg font-medium hover:opacity-90 transition-opacity">
                Iniciar pomodoro {(pomodoroState?.currentPomodoro ?? 1) + 1}/{task.pomodoroCount}
              </button>
            </div>
          )}

          {(phase === 'all_done' || phase === 'overtime') && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle size={14} />
                <span className="text-xs font-semibold">¡Terminaste los {task.pomodoroCount} pomodoros!</span>
              </div>
              {phase === 'overtime' && (
                <div className="flex items-center gap-2">
                  <Timer size={12} className="text-destructive" />
                  <span className="font-mono text-xs font-semibold text-destructive tabular-nums">+{formatTime(pomodoroState?.remainingSeconds ?? 0)}</span>
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
