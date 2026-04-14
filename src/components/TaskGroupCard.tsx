import { useState } from 'react';
import { Task, TaskGroup, TaskStatus } from '@/lib/storage';
import { ChevronDown, ChevronRight, FolderOpen, Pencil, Trash2, Check, X, Plus, MoreHorizontal, Minus, Clock, CalendarDays, Repeat, Circle, CheckCircle2, Play, Pause, Timer, RotateCcw, Coffee, AlertTriangle, Copy } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { TaskCard, PomodoroPhase } from '@/components/TaskCard';

interface PomodoroState {
  phase: PomodoroPhase;
  remainingSeconds: number;
  currentPomodoro: number;
  restMessage?: string;
}

interface Props {
  group: TaskGroup;
  tasks: Task[];
  onEditGroup: (id: string, updates: { name?: string; date?: string; isDaily?: boolean; scheduledTime?: string; pomodoroCount?: number; customTimeMinutes?: number }) => void;
  onDeleteGroup: (id: string) => void;
  onDuplicateGroup?: (id: string) => void;
  onAddSubtask: (title: string, pomodoroCount: number, groupId: string, date?: string, scheduledTime?: string, isDaily?: boolean) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onEdit?: (id: string, updates: { title?: string; pomodoroCount?: number; date?: string; scheduledTime?: string; isDaily?: boolean; customTimeMinutes?: number }) => void;
  getPomodoroState?: (taskId: string) => PomodoroState | undefined;
  onPomodoroStart?: (id: string) => void;
  onPomodoroStop?: (id: string) => void;
  onPomodoroReset?: (id: string) => void;
  onStartBreak?: (id: string) => void;
  onContinueNext?: (id: string) => void;
  onFinishTask?: (id: string) => void;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function SimpleSubtask({ task, onStatusChange }: { task: Task; onStatusChange: (id: string, status: TaskStatus) => void }) {
  const isDone = task.status === 'done';
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
      }}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/40 transition-colors cursor-grab active:cursor-grabbing ${isDone ? 'opacity-50' : ''}`}
    >
      <button
        onClick={() => onStatusChange(task.id, isDone ? 'todo' : 'done')}
        className={`shrink-0 ${isDone ? 'text-success' : 'text-muted-foreground'} hover:scale-110 transition-transform`}
      >
        {isDone ? <CheckCircle2 size={14} /> : <Circle size={14} />}
      </button>
      <span className={`text-[12px] ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
        {task.title}
      </span>
    </div>
  );
}

function DailyGroupPomodoroControls({
  group, pomState, onPomodoroStart, onPomodoroStop, onPomodoroReset, onStartBreak, onContinueNext, onFinishTask,
}: {
  group: TaskGroup;
  pomState: PomodoroState;
  onPomodoroStart?: (id: string) => void;
  onPomodoroStop?: (id: string) => void;
  onPomodoroReset?: (id: string) => void;
  onStartBreak?: (id: string) => void;
  onContinueNext?: (id: string) => void;
  onFinishTask?: (id: string) => void;
}) {
  const phase = pomState.phase;
  const pomCount = group.pomodoroCount ?? 1;

  if (phase === 'idle') return null;

  return (
    <div className="px-2.5 pb-2 space-y-1.5">
      {(phase === 'working' || phase === 'paused') && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1 bg-accent/5 border border-accent/15 rounded-md px-2 py-1">
            <Timer size={11} className="text-accent" />
            <span className="font-mono text-[11px] font-semibold text-accent tabular-nums">
              {formatTime(pomState.remainingSeconds)}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {pomState.currentPomodoro}/{pomCount}
          </span>
          <div className="flex gap-0.5 ml-auto">
            {phase === 'working' ? (
              <button onClick={() => onPomodoroStop?.(group.id)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-accent/10 text-accent transition-colors" title="Pausar"><Pause size={11} /></button>
            ) : (
              <button onClick={() => onPomodoroStart?.(group.id)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-accent/10 text-accent transition-colors" title="Reanudar"><Play size={11} /></button>
            )}
            <button onClick={() => onPomodoroReset?.(group.id)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground transition-colors" title="Reiniciar"><RotateCcw size={11} /></button>
            <button onClick={() => onFinishTask?.(group.id)} className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-success/10 text-success transition-colors" title="Terminar"><CheckCircle2 size={11} /></button>
          </div>
        </div>
      )}

      {phase === 'break_pending' && (
        <div className="bg-accent/5 border border-accent/15 rounded-md p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-accent">
            <Coffee size={12} />
            <span className="text-[11px] font-semibold">¡Hora de descansar!</span>
          </div>
          {pomState.restMessage && (
            <p className="text-[10px] text-muted-foreground leading-relaxed">{pomState.restMessage}</p>
          )}
          <button onClick={() => onStartBreak?.(group.id)} className="w-full text-[11px] bg-accent text-accent-foreground px-2.5 py-1 rounded-md font-medium hover:opacity-90 transition-opacity">
            Descanso (10 min)
          </button>
        </div>
      )}

      {phase === 'breaking' && (
        <div className="flex items-center gap-1.5 bg-success/5 border border-success/15 rounded-md px-2 py-1">
          <Coffee size={11} className="text-success" />
          <span className="font-mono text-[11px] font-semibold text-success tabular-nums">{formatTime(pomState.remainingSeconds)}</span>
          <span className="text-[10px] text-muted-foreground">Descanso</span>
        </div>
      )}

      {phase === 'next_pending' && (
        <div className="bg-success/5 border border-success/15 rounded-md p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-success">
            <Play size={12} />
            <span className="text-[11px] font-semibold">¡Listo para continuar!</span>
          </div>
          <button onClick={() => onContinueNext?.(group.id)} className="w-full text-[11px] bg-foreground text-background px-2.5 py-1 rounded-md font-medium hover:opacity-90 transition-opacity">
            Pomodoro {(pomState.currentPomodoro ?? 1) + 1}/{pomCount}
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
            <button onClick={() => onFinishTask?.(group.id)} className="w-7 h-7 flex items-center justify-center rounded-md bg-success/10 text-success hover:bg-success/20 transition-colors" title="Terminar">
              <CheckCircle2 size={14} />
            </button>
          </div>
          {phase === 'overtime' && (
            <div className="flex items-center gap-1.5">
              <Timer size={10} className="text-destructive" />
              <span className="font-mono text-[11px] font-semibold text-destructive tabular-nums">+{formatTime(pomState.remainingSeconds)}</span>
              <span className="text-[10px] text-muted-foreground">extra</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TaskGroupCard({
  group, tasks, onEditGroup, onDeleteGroup, onDuplicateGroup, onAddSubtask,
  onStatusChange, onDelete, onDuplicate, onEdit,
  getPomodoroState, onPomodoroStart, onPomodoroStop, onPomodoroReset,
  onStartBreak, onContinueNext, onFinishTask,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [editDaily, setEditDaily] = useState(!!group.isDaily);
  const [editTime, setEditTime] = useState(group.scheduledTime || '');
  const [editPomodoros, setEditPomodoros] = useState(group.pomodoroCount || 1);
  const [editTimerMode, setEditTimerMode] = useState<'pomodoro' | 'custom'>(group.customTimeMinutes ? 'custom' : 'pomodoro');
  const [editCustomMinutes, setEditCustomMinutes] = useState(group.customTimeMinutes ?? 30);
  const [editDate, setEditDate] = useState<Date>(new Date(group.date + 'T12:00:00'));
  const [editCalOpen, setEditCalOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPomodoros, setNewPomodoros] = useState(1);
  const [newTime, setNewTime] = useState('');
  const [newDate, setNewDate] = useState<Date>(new Date(group.date + 'T12:00:00'));
  const [newDaily, setNewDaily] = useState(false);
  const [newCalOpen, setNewCalOpen] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const isDaily = !!group.isDaily;
  const done = tasks.filter(t => t.status === 'done').length;
  const total = tasks.length;
  const allDone = total > 0 && done === total;
  const totalWork = tasks.reduce((s, t) => s + (t.totalWorkSeconds ?? 0), 0);
  const totalPomodoros = tasks.reduce((s, t) => s + t.pomodorosCompleted, 0);
  const totalPomodoroTarget = tasks.reduce((s, t) => s + t.pomodoroCount, 0);

  // Pomodoro state for daily groups (uses group.id as timer key)
  const groupPomState = isDaily ? getPomodoroState?.(group.id) : undefined;
  const groupPhase = groupPomState?.phase ?? 'idle';
  const isGroupActive = groupPhase === 'working' || groupPhase === 'paused' || groupPhase === 'breaking' || groupPhase === 'break_pending' || groupPhase === 'next_pending' || groupPhase === 'overtime' || groupPhase === 'all_done';

  const startEditing = () => {
    setEditName(group.name);
    setEditDaily(!!group.isDaily);
    setEditTime(group.scheduledTime || '');
    setEditPomodoros(group.pomodoroCount || 1);
    setEditTimerMode(group.customTimeMinutes ? 'custom' : 'pomodoro');
    setEditCustomMinutes(group.customTimeMinutes ?? 30);
    setEditDate(new Date(group.date + 'T12:00:00'));
    setEditing(true);
    setShowActions(false);
  };

  const saveEdit = () => {
    onEditGroup(group.id, {
      name: editName.trim() || group.name,
      date: editDate.toISOString().split('T')[0],
      isDaily: editDaily || undefined,
      scheduledTime: editDaily && editTime ? editTime : undefined,
      pomodoroCount: editDaily ? (editTimerMode === 'pomodoro' ? editPomodoros : 1) : undefined,
      customTimeMinutes: editDaily && editTimerMode === 'custom' ? editCustomMinutes : undefined,
    });
    setEditing(false);
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    if (isDaily) {
      onAddSubtask(newTitle.trim(), 1, group.id, group.date, undefined, undefined);
    } else {
      const dateStr = newDate.toISOString().split('T')[0];
      onAddSubtask(newTitle.trim(), newPomodoros, group.id, dateStr, newTime || undefined, newDaily || undefined);
    }
    setNewTitle('');
    setNewPomodoros(1);
    setNewTime('');
    setNewDaily(false);
    setAdding(false);
  };

  const handlePlayPause = () => {
    if (groupPhase === 'working') {
      onPomodoroStop?.(group.id);
      // Pause: set in_progress tasks back to todo
      tasks.filter(t => t.status === 'in_progress').forEach(t => onStatusChange(t.id, 'todo'));
    } else {
      onPomodoroStart?.(group.id);
      // Play: set all non-done tasks to in_progress
      tasks.filter(t => t.status === 'todo').forEach(t => onStatusChange(t.id, 'in_progress'));
    }
  };

  const borderClass = allDone
    ? 'border-success/30 bg-success/5 opacity-60'
    : isGroupActive && isDaily
      ? 'border-warning/30 bg-warning/5'
      : 'border-accent/20 bg-accent/5';

  return (
    <div
      draggable
      onDragStart={(e) => {
        // Only start group drag if the event originated from this element, not a subtask
        if ((e.target as HTMLElement).closest('[draggable]') !== e.currentTarget) {
          return;
        }
        e.dataTransfer.setData('text/plain', `group:${group.id}`);
        e.dataTransfer.effectAllowed = 'move';
        (e.currentTarget as HTMLElement).style.opacity = '0.5';
      }}
      onDragEnd={(e) => {
        (e.currentTarget as HTMLElement).style.opacity = '1';
      }}
      className={`rounded-lg border transition-all overflow-hidden cursor-grab active:cursor-grabbing ${borderClass}`}
    >
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-start gap-1.5 p-2.5">
          <CollapsibleTrigger asChild>
            <button className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors">
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          </CollapsibleTrigger>

          <FolderOpen size={14} className={`shrink-0 mt-0.5 ${allDone ? 'text-success' : isGroupActive ? 'text-warning' : 'text-accent'}`} />

          {/* Play/Pause for daily groups */}
          {isDaily && !editing && !allDone && (groupPhase === 'idle' || groupPhase === 'working' || groupPhase === 'paused') && (
            <button
              onClick={handlePlayPause}
              className={`shrink-0 w-5 h-5 flex items-center justify-center rounded-full transition-all ${
                groupPhase === 'working'
                  ? 'bg-warning/15 text-warning hover:bg-warning/25'
                  : 'bg-accent/10 text-accent hover:bg-accent/20'
              }`}
              title={groupPhase === 'working' ? 'Pausar' : 'Iniciar'}
            >
              {groupPhase === 'working' ? <Pause size={10} /> : <Play size={10} />}
            </button>
          )}

          {editing ? (
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="flex-1 min-w-0 bg-background border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30"
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
                />
                <button onClick={saveEdit} className="w-5 h-5 flex items-center justify-center rounded text-success hover:bg-success/10 shrink-0"><Check size={11} /></button>
                <button onClick={() => setEditing(false)} className="w-5 h-5 flex items-center justify-center rounded text-destructive hover:bg-destructive/10 shrink-0"><X size={11} /></button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditDaily(d => !d)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${editDaily ? 'bg-accent/15 text-accent border border-accent/30' : 'text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent'}`}
                >
                  <Repeat size={9} /> Diario
                </button>
                {!editDaily && (
                  <Popover open={editCalOpen} onOpenChange={setEditCalOpen}>
                    <PopoverTrigger asChild>
                      <button type="button" className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-secondary">
                        <CalendarDays size={10} />
                        {format(editDate, "d MMM", { locale: es })}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={editDate} onSelect={d => { if (d) { setEditDate(d); setEditCalOpen(false); } }} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                )}
                {editDaily && (
                  <>
                    <div className="flex items-center gap-1">
                      <Clock size={10} className="text-muted-foreground" />
                      <input
                        type="time"
                        value={editTime}
                        onChange={e => setEditTime(e.target.value)}
                        className="bg-transparent border border-border rounded px-1 py-0.5 text-[10px] text-foreground focus:outline-none w-[4.5rem]"
                      />
                    </div>
                    <div className="flex items-center gap-0.5">
                      <div className="flex bg-secondary rounded-md p-0.5">
                        <button type="button" onClick={() => setEditTimerMode('pomodoro')} className={`px-1 py-0.5 rounded text-[9px] font-medium transition-colors ${editTimerMode === 'pomodoro' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>🍅</button>
                        <button type="button" onClick={() => setEditTimerMode('custom')} className={`px-1 py-0.5 rounded text-[9px] font-medium transition-colors ${editTimerMode === 'custom' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>⏱</button>
                      </div>
                      {editTimerMode === 'pomodoro' ? (
                        <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <button type="button" onClick={() => setEditPomodoros(p => Math.max(1, p - 1))} className="w-5 h-5 flex items-center justify-center hover:bg-secondary rounded"><Minus size={9} /></button>
                          <span className="w-3 text-center font-mono">{editPomodoros}</span>
                          <button type="button" onClick={() => setEditPomodoros(p => Math.min(10, p + 1))} className="w-5 h-5 flex items-center justify-center hover:bg-secondary rounded"><Plus size={9} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5">
                          <input
                            type="number"
                            min={1}
                            max={480}
                            value={editCustomMinutes}
                            onChange={e => setEditCustomMinutes(Math.max(1, Math.min(480, parseInt(e.target.value) || 1)))}
                            className="w-12 bg-background border border-border rounded px-1 py-0.5 text-[10px] font-mono text-center focus:outline-none"
                          />
                          <span className="text-[10px] text-muted-foreground">min</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className={`flex-1 text-[13px] font-semibold truncate ${allDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {group.name}
                </span>
                <Popover open={showActions} onOpenChange={setShowActions}>
                  <PopoverTrigger asChild>
                    <button className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
                      <MoreHorizontal size={13} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-1 flex flex-wrap gap-0.5" align="end" sideOffset={4}>
                    <button
                      onClick={startEditing}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil size={12} /> Editar
                    </button>
                    <button
                      onClick={() => { onDuplicateGroup?.(group.id); setShowActions(false); }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Copy size={12} /> Duplicar
                    </button>
                    <button
                      onClick={() => { onDeleteGroup(group.id); setShowActions(false); }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={12} /> Eliminar
                    </button>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                {isDaily && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-accent">
                    <Repeat size={9} /> Diario
                  </span>
                )}
                {isDaily && group.scheduledTime && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    <Clock size={9} className="inline mr-0.5" />
                    {group.scheduledTime}
                  </span>
                )}
                {isDaily && group.pomodoroCount && !group.customTimeMinutes && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    🍅 {group.pomodoroCount}
                  </span>
                )}
                {isDaily && group.customTimeMinutes && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ⏱ {group.customTimeMinutes}min
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground font-mono">
                  ✓ {done}/{total}
                </span>
                {!isDaily && totalPomodoros > 0 && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    🍅 {totalPomodoros}/{totalPomodoroTarget}
                  </span>
                )}
                {totalWork > 0 && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ⏱ {Math.floor(totalWork / 3600)}h{Math.floor((totalWork % 3600) / 60).toString().padStart(2, '0')}m
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="px-2.5 pb-1">
            <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${allDone ? 'bg-success' : isGroupActive ? 'bg-warning' : 'bg-accent'}`}
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Pomodoro controls for daily groups */}
        {isDaily && groupPomState && groupPhase !== 'idle' && (
          <DailyGroupPomodoroControls
            group={group}
            pomState={groupPomState}
            onPomodoroStart={onPomodoroStart}
            onPomodoroStop={onPomodoroStop}
            onPomodoroReset={onPomodoroReset}
            onStartBreak={onStartBreak}
            onContinueNext={onContinueNext}
            onFinishTask={onFinishTask}
          />
        )}

        <CollapsibleContent>
          <div className="px-2 pb-2 space-y-0.5">
            {isDaily ? (
              <>
                {tasks.map(t => (
                  <SimpleSubtask key={t.id} task={t} onStatusChange={onStatusChange} />
                ))}
              </>
            ) : (
              tasks.map(t => {
                const pomState = getPomodoroState?.(t.id);
                return (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onStatusChange={onStatusChange}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onEdit={onEdit}
                    pomodoroState={pomState}
                    onPomodoroStart={onPomodoroStart}
                    onPomodoroStop={onPomodoroStop}
                    onPomodoroReset={onPomodoroReset}
                    onStartBreak={onStartBreak}
                    onContinueNext={onContinueNext}
                    onFinishTask={onFinishTask}
                  />
                );
              })
            )}

            {adding ? (
              <form onSubmit={handleAddSubtask} className="p-2 ml-2 space-y-2">
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Subtarea..."
                  className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30"
                  autoFocus
                />
                {isDaily ? (
                  <div className="flex gap-1 justify-end">
                    <button type="submit" className="w-6 h-6 flex items-center justify-center rounded-md bg-accent/10 text-accent hover:bg-accent/20"><Check size={11} /></button>
                    <button type="button" onClick={() => setAdding(false)} className="w-6 h-6 flex items-center justify-center rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20"><X size={11} /></button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                      🍅
                      <button type="button" onClick={() => setNewPomodoros(p => Math.max(1, p - 1))} className="w-5 h-5 flex items-center justify-center hover:bg-secondary rounded"><Minus size={9} /></button>
                      <span className="w-3 text-center">{newPomodoros}</span>
                      <button type="button" onClick={() => setNewPomodoros(p => Math.min(10, p + 1))} className="w-5 h-5 flex items-center justify-center hover:bg-secondary rounded"><Plus size={9} /></button>
                    </div>
                    <Popover open={newCalOpen} onOpenChange={setNewCalOpen}>
                      <PopoverTrigger asChild>
                        <button type="button" className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-secondary">
                          <CalendarDays size={10} />
                          {format(newDate, "d MMM", { locale: es })}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={newDate} onSelect={d => { if (d) { setNewDate(d); setNewCalOpen(false); } }} className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                    <div className="flex items-center gap-1">
                      <Clock size={10} className="text-muted-foreground" />
                      <input
                        type="time"
                        value={newTime}
                        onChange={e => setNewTime(e.target.value)}
                        className="bg-transparent border-0 text-[10px] text-muted-foreground hover:text-foreground focus:outline-none w-[3.5rem]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewDaily(d => !d)}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${newDaily ? 'bg-accent/15 text-accent border border-accent/30' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
                    >
                      <Repeat size={9} />
                      Diario
                    </button>
                    <div className="flex gap-1 ml-auto shrink-0">
                      <button type="submit" className="w-6 h-6 flex items-center justify-center rounded-md bg-accent/10 text-accent hover:bg-accent/20"><Check size={11} /></button>
                      <button type="button" onClick={() => setAdding(false)} className="w-6 h-6 flex items-center justify-center rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20"><X size={11} /></button>
                    </div>
                  </div>
                )}
              </form>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1.5 ml-2 rounded-md hover:bg-secondary/50 transition-colors w-full"
              >
                <Plus size={11} /> Agregar subtarea
              </button>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
