import { useState } from 'react';
import { Task, TaskStatus, getToday } from '@/lib/storage';
import { Circle, Clock, CheckCircle2, Trash2, Play, Pause, RotateCcw, Timer, Coffee, AlertTriangle, Pencil, Check, X, Minus, Plus, CalendarDays, MoreHorizontal, Repeat, Copy } from 'lucide-react';
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
  onEdit?: (id: string, updates: { title?: string; pomodoroCount?: number; date?: string; scheduledTime?: string; isDaily?: boolean; customTimeMinutes?: number }) => void;
  onDuplicate?: (id: string) => void;
  pomodoroState?: PomodoroState;
  onPomodoroStart?: (id: string) => void;
  onPomodoroStop?: (id: string) => void;
  onPomodoroReset?: (id: string) => void;
  onStartBreak?: (id: string) => void;
  onContinueNext?: (id: string) => void;
  onFinishTask?: (id: string) => void;
  onReorder?: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  onReorderMixed?: (draggedId: string, draggedKind: 'task' | 'group', targetId: string, targetKind: 'task' | 'group', position: 'before' | 'after') => void;
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

export function TaskCard({ task, onStatusChange, onDelete, onEdit, onDuplicate, pomodoroState, onPomodoroStart, onPomodoroStop, onPomodoroReset, onStartBreak, onContinueNext, onFinishTask, onReorder }: Props) {
  const config = statusConfig[task.status];
  const [dropIndicator, setDropIndicator] = useState<'before' | 'after' | null>(null);
  const Icon = config.icon;
  const isInProgress = task.status === 'in_progress';
  const phase = pomodoroState?.phase ?? 'idle';

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editPomodoros, setEditPomodoros] = useState(task.pomodoroCount);
  const [editDate, setEditDate] = useState<Date>(new Date(task.date + 'T12:00:00'));
  const [editTime, setEditTime] = useState(task.scheduledTime ?? '');
  const [editDaily, setEditDaily] = useState(task.isDaily ?? false);
  const [editTimerMode, setEditTimerMode] = useState<'pomodoro' | 'custom'>(task.customTimeMinutes ? 'custom' : 'pomodoro');
  const [editCustomMinutes, setEditCustomMinutes] = useState(task.customTimeMinutes ?? 30);
  const [calOpen, setCalOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const startEdit = () => {
    setEditTitle(task.title);
    setEditPomodoros(task.pomodoroCount);
    setEditDate(new Date(task.date + 'T12:00:00'));
    setEditTime(task.scheduledTime ?? '');
    setEditDaily(task.isDaily ?? false);
    setEditTimerMode(task.customTimeMinutes ? 'custom' : 'pomodoro');
    setEditCustomMinutes(task.customTimeMinutes ?? 30);
    setEditing(true);
    setShowActions(false);
  };

  const saveEdit = () => {
    onEdit?.(task.id, {
      title: editTitle.trim() || task.title,
      pomodoroCount: editTimerMode === 'pomodoro' ? editPomodoros : 1,
      date: editDate.toISOString().split('T')[0],
      scheduledTime: editTime || undefined,
      isDaily: editDaily || undefined,
      customTimeMinutes: editTimerMode === 'custom' ? editCustomMinutes : undefined,
    });
    setEditing(false);
  };

  const cancelEdit = () => setEditing(false);

  if (editing) {
    return (
      <div className="p-3 rounded-lg bg-secondary/40 border border-border space-y-2 overflow-hidden">
        <input
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          className="w-full bg-background border border-border rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1">
            <div className="flex bg-secondary rounded-md p-0.5">
              <button type="button" onClick={() => setEditTimerMode('pomodoro')} className={`px-1 py-0.5 rounded text-[9px] font-medium transition-colors ${editTimerMode === 'pomodoro' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>🍅</button>
              <button type="button" onClick={() => setEditTimerMode('custom')} className={`px-1 py-0.5 rounded text-[9px] font-medium transition-colors ${editTimerMode === 'custom' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>⏱</button>
            </div>
            {editTimerMode === 'pomodoro' ? (
              <>
                <button type="button" onClick={() => setEditPomodoros(p => Math.max(1, p - 1))} className="w-5 h-5 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground"><Minus size={10} /></button>
                <span className="text-xs font-mono font-semibold w-3 text-center">{editPomodoros}</span>
                <button type="button" onClick={() => setEditPomodoros(p => Math.min(10, p + 1))} className="w-5 h-5 flex items-center justify-center rounded hover:bg-secondary text-muted-foreground"><Plus size={10} /></button>
              </>
            ) : (
              <>
                <input
                  type="number"
                  min={1}
                  max={480}
                  value={editCustomMinutes}
                  onChange={e => setEditCustomMinutes(Math.max(1, Math.min(480, parseInt(e.target.value) || 1)))}
                  className="w-12 bg-background border border-border rounded px-1 py-0.5 text-[10px] font-mono text-center focus:outline-none"
                />
                <span className="text-[10px] text-muted-foreground">min</span>
              </>
            )}
          </div>
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <button type="button" className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-secondary">
                <CalendarDays size={10} />
                {format(editDate, "d MMM", { locale: es })}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={editDate} onSelect={d => { if (d) { setEditDate(d); setCalOpen(false); } }} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-1">
            <Clock size={10} className="text-muted-foreground" />
            <input
              type="time"
              value={editTime}
              onChange={e => setEditTime(e.target.value)}
              className="bg-transparent border-0 text-[10px] text-muted-foreground hover:text-foreground focus:outline-none w-[3.5rem]"
            />
          </div>
          <button
            type="button"
            onClick={() => setEditDaily(d => !d)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${editDaily ? 'bg-accent/15 text-accent border border-accent/30' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
            title="Se repite todos los días"
          >
            <Repeat size={9} />
            Diario
          </button>
          <div className="flex gap-1 ml-auto">
            <button onClick={saveEdit} className="w-6 h-6 flex items-center justify-center rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors"><Check size={12} /></button>
            <button onClick={cancelEdit} className="w-6 h-6 flex items-center justify-center rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"><X size={12} /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
        (e.currentTarget as HTMLElement).style.opacity = '0.4';
      }}
      onDragEnd={(e) => {
        (e.currentTarget as HTMLElement).style.opacity = '';
        setDropIndicator(null);
      }}
      onDragOver={(e) => {
        if (!onReorder) return;
        // Ignore group drags — let them bubble to the column
        if (e.dataTransfer.types.includes('application/x-group')) return;
        if (!e.dataTransfer.types.includes('text/plain')) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const isBefore = e.clientY < rect.top + rect.height / 2;
        setDropIndicator(isBefore ? 'before' : 'after');
      }}
      onDragLeave={() => setDropIndicator(null)}
      onDrop={(e) => {
        if (!onReorder) return;
        // Ignore group drops — let them bubble to the column
        if (e.dataTransfer.types.includes('application/x-group')) {
          setDropIndicator(null);
          return;
        }
        const draggedId = e.dataTransfer.getData('text/plain');
        if (!draggedId || draggedId.startsWith('group:') || draggedId === task.id) {
          setDropIndicator(null);
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        const position = dropIndicator ?? 'before';
        setDropIndicator(null);
        onReorder(draggedId, task.id, position);
      }}
      className={`group relative p-2.5 rounded-lg transition-all hover:bg-secondary/40 cursor-grab active:cursor-grabbing ${task.status === 'done' ? 'opacity-50' : ''} ${dropIndicator === 'before' ? 'border-t-2 border-accent' : ''} ${dropIndicator === 'after' ? 'border-b-2 border-accent' : ''}`}
    >
      {/* Main row */}
      <div className="flex items-start gap-2">
        <button
          onClick={() => onStatusChange(task.id, config.next)}
          className={`shrink-0 mt-[3px] ${config.className} hover:scale-110 transition-transform`}
          title={`Cambiar a ${statusConfig[config.next].label}`}
        >
          <Icon size={16} />
        </button>

        <div className="flex-1 min-w-0 space-y-1">
          <p className={`text-[13px] leading-snug break-words ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {task.title}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono">
              {task.customTimeMinutes ? `⏱ ${task.customTimeMinutes}min` : `🍅 ${task.pomodorosCompleted}/${task.pomodoroCount}`}
            </span>
            {task.totalWorkSeconds > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono">
                ⏱ {Math.floor(task.totalWorkSeconds / 3600)}h{Math.floor((task.totalWorkSeconds % 3600) / 60).toString().padStart(2, '0')}m
              </span>
            )}
            {task.scheduledTime && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Clock size={9} />
                {task.scheduledTime}
              </span>
            )}
            {task.isDaily && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-accent">
                <Repeat size={9} />
                Diario
              </span>
            )}
            {task.date !== getToday() && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <CalendarDays size={9} />
                {format(new Date(task.date + 'T12:00:00'), "d MMM", { locale: es })}
              </span>
            )}
          </div>
        </div>

        {/* Actions - compact popover for small columns */}
        <Popover open={showActions} onOpenChange={setShowActions}>
          <PopoverTrigger asChild>
            <button className="shrink-0 mt-[2px] p-1 rounded-md opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
              <MoreHorizontal size={14} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-1 flex gap-0.5" align="end" sideOffset={4}>
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil size={12} /> Editar
            </button>
            <button
              onClick={() => { onDuplicate?.(task.id); setShowActions(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy size={12} /> Duplicar
            </button>
            <button
              onClick={() => { onDelete(task.id); setShowActions(false); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 size={12} /> Eliminar
            </button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Pomodoro controls */}
      {isInProgress && (
        <div className="mt-2 ml-6 space-y-2">
          {(phase === 'idle' || phase === 'working' || phase === 'paused') && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 bg-accent/5 border border-accent/15 rounded-md px-2 py-1">
                <Timer size={11} className="text-accent" />
                <span className="font-mono text-[11px] font-semibold text-accent tabular-nums">
                  {pomodoroState ? formatTime(pomodoroState.remainingSeconds) : formatTime(task.customTimeMinutes ? task.customTimeMinutes * 60 : 3600)}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {task.customTimeMinutes ? `⏱ ${task.customTimeMinutes}min` : `${pomodoroState?.currentPomodoro ?? 1}/${task.pomodoroCount}`}
              </span>
              <div className="flex gap-0.5 ml-auto">
                {phase === 'working' ? (
                  <button onClick={() => onPomodoroStop?.(task.id)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-accent/10 text-accent transition-colors" title="Pausar"><Pause size={11} /></button>
                ) : (
                  <button onClick={() => onPomodoroStart?.(task.id)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-accent/10 text-accent transition-colors" title="Iniciar"><Play size={11} /></button>
                )}
                <button onClick={() => onPomodoroReset?.(task.id)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground transition-colors" title="Reiniciar"><RotateCcw size={11} /></button>
                <button onClick={() => onFinishTask?.(task.id)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-success/10 text-success transition-colors" title="Terminar tarea"><CheckCircle2 size={11} /></button>
              </div>
            </div>
          )}

          {phase === 'break_pending' && (
            <div className="bg-accent/5 border border-accent/15 rounded-md p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-accent">
                <Coffee size={12} />
                <span className="text-[11px] font-semibold">¡Hora de descansar!</span>
              </div>
              {pomodoroState?.restMessage && (
                <p className="text-[10px] text-muted-foreground leading-relaxed">{pomodoroState.restMessage}</p>
              )}
              <button onClick={() => onStartBreak?.(task.id)} className="w-full text-[11px] bg-accent text-accent-foreground px-2.5 py-1 rounded-md font-medium hover:opacity-90 transition-opacity">
                Descanso (10 min)
              </button>
            </div>
          )}

          {phase === 'breaking' && (
            <div className="flex items-center gap-1.5 bg-success/5 border border-success/15 rounded-md px-2 py-1">
              <Coffee size={11} className="text-success" />
              <span className="font-mono text-[11px] font-semibold text-success tabular-nums">{formatTime(pomodoroState?.remainingSeconds ?? 0)}</span>
              <span className="text-[10px] text-muted-foreground">Descanso</span>
            </div>
          )}

          {phase === 'next_pending' && (
            <div className="bg-success/5 border border-success/15 rounded-md p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-success">
                <Play size={12} />
                <span className="text-[11px] font-semibold">¡Listo para continuar!</span>
              </div>
              <button onClick={() => onContinueNext?.(task.id)} className="w-full text-[11px] bg-foreground text-background px-2.5 py-1 rounded-md font-medium hover:opacity-90 transition-opacity">
                Pomodoro {(pomodoroState?.currentPomodoro ?? 1) + 1}/{task.pomodoroCount}
              </button>
            </div>
          )}

          {(phase === 'all_done' || phase === 'overtime') && (
            <div className="bg-destructive/5 border border-destructive/15 rounded-md p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-destructive">
                  <AlertTriangle size={12} />
                  <span className="text-[11px] font-semibold">¡Pomodoros completados!</span>
                </div>
                <button onClick={() => onFinishTask?.(task.id)} className="w-7 h-7 flex items-center justify-center rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors" title="Terminar tarea">
                  <CheckCircle2 size={14} />
                </button>
              </div>
              {phase === 'overtime' && (
                <div className="flex items-center gap-1.5">
                  <Timer size={10} className="text-destructive" />
                  <span className="font-mono text-[11px] font-semibold text-destructive tabular-nums">+{formatTime(pomodoroState?.remainingSeconds ?? 0)}</span>
                  <span className="text-[10px] text-muted-foreground">extra</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
