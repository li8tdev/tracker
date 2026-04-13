import { useState } from 'react';
import { Task, TaskGroup, TaskStatus } from '@/lib/storage';
import { ChevronDown, ChevronRight, FolderOpen, Pencil, Trash2, Check, X, Plus, MoreHorizontal, Minus, Clock, CalendarDays, Repeat, Circle, CheckCircle2 } from 'lucide-react';
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
  onEditGroup: (id: string, updates: { name?: string; isDaily?: boolean; scheduledTime?: string; pomodoroCount?: number }) => void;
  onDeleteGroup: (id: string) => void;
  onAddSubtask: (title: string, pomodoroCount: number, groupId: string, date?: string, scheduledTime?: string, isDaily?: boolean) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  onEdit?: (id: string, updates: { title?: string; pomodoroCount?: number; date?: string; scheduledTime?: string; isDaily?: boolean }) => void;
  getPomodoroState?: (taskId: string) => PomodoroState | undefined;
  onPomodoroStart?: (id: string) => void;
  onPomodoroStop?: (id: string) => void;
  onPomodoroReset?: (id: string) => void;
  onStartBreak?: (id: string) => void;
  onContinueNext?: (id: string) => void;
  onFinishTask?: (id: string) => void;
}

function SimpleSubtask({ task, onStatusChange }: { task: Task; onStatusChange: (id: string, status: TaskStatus) => void }) {
  const isDone = task.status === 'done';
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/40 transition-colors ${isDone ? 'opacity-50' : ''}`}>
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

export function TaskGroupCard({
  group, tasks, onEditGroup, onDeleteGroup, onAddSubtask,
  onStatusChange, onDelete, onEdit,
  getPomodoroState, onPomodoroStart, onPomodoroStop, onPomodoroReset,
  onStartBreak, onContinueNext, onFinishTask,
}: Props) {
  const [open, setOpen] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [editDaily, setEditDaily] = useState(!!group.isDaily);
  const [editTime, setEditTime] = useState(group.scheduledTime || '');
  const [editPomodoros, setEditPomodoros] = useState(group.pomodoroCount || 1);
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

  const startEditing = () => {
    setEditName(group.name);
    setEditDaily(!!group.isDaily);
    setEditTime(group.scheduledTime || '');
    setEditPomodoros(group.pomodoroCount || 1);
    setEditing(true);
    setShowActions(false);
  };

  const saveEdit = () => {
    onEditGroup(group.id, {
      name: editName.trim() || group.name,
      isDaily: editDaily || undefined,
      scheduledTime: editDaily && editTime ? editTime : undefined,
      pomodoroCount: editDaily ? editPomodoros : undefined,
    });
    setEditing(false);
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    if (isDaily) {
      // Daily group subtasks: simple, no pomodoro/date/time
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

  return (
    <div className={`rounded-lg border transition-all overflow-hidden ${allDone ? 'border-success/30 bg-success/5 opacity-60' : 'border-accent/20 bg-accent/5'}`}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-2 p-2.5">
          <CollapsibleTrigger asChild>
            <button className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          </CollapsibleTrigger>

          <FolderOpen size={14} className={allDone ? 'text-success' : 'text-accent'} />

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
                    <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      🍅
                      <button type="button" onClick={() => setEditPomodoros(p => Math.max(1, p - 1))} className="w-5 h-5 flex items-center justify-center hover:bg-secondary rounded"><Minus size={9} /></button>
                      <span className="w-3 text-center font-mono">{editPomodoros}</span>
                      <button type="button" onClick={() => setEditPomodoros(p => Math.min(10, p + 1))} className="w-5 h-5 flex items-center justify-center hover:bg-secondary rounded"><Plus size={9} /></button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              <span className={`flex-1 text-[13px] font-semibold truncate ${allDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {group.name}
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                {isDaily && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-accent">
                    <Repeat size={9} />
                  </span>
                )}
                {isDaily && group.scheduledTime && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    <Clock size={9} className="inline mr-0.5" />
                    {group.scheduledTime}
                  </span>
                )}
                {isDaily && group.pomodoroCount && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    🍅 {group.pomodoroCount}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground font-mono">
                  {done}/{total}
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

                <Popover open={showActions} onOpenChange={setShowActions}>
                  <PopoverTrigger asChild>
                    <button className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
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
                      onClick={() => { onDeleteGroup(group.id); setShowActions(false); }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={12} /> Eliminar
                    </button>
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}
        </div>

        {total > 0 && (
          <div className="px-2.5 pb-1">
            <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${allDone ? 'bg-success' : 'bg-accent'}`}
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <CollapsibleContent>
          <div className="px-2 pb-2 space-y-0.5">
            {isDaily ? (
              // Daily group: simple subtask checkboxes
              <>
                {tasks.map(t => (
                  <SimpleSubtask key={t.id} task={t} onStatusChange={onStatusChange} />
                ))}
              </>
            ) : (
              // Project group: full-featured subtask cards
              tasks.map(t => {
                const pomState = getPomodoroState?.(t.id);
                return (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onStatusChange={onStatusChange}
                    onDelete={onDelete}
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
              <form onSubmit={handleAddSubtask} className="p-2 ml-4 space-y-2">
                <input
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="Subtarea..."
                  className="w-full bg-background border border-border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30"
                  autoFocus
                />
                {isDaily ? (
                  // Daily group: just confirm/cancel
                  <div className="flex gap-1 justify-end">
                    <button type="submit" className="w-6 h-6 flex items-center justify-center rounded-md bg-accent/10 text-accent hover:bg-accent/20"><Check size={11} /></button>
                    <button type="button" onClick={() => setAdding(false)} className="w-6 h-6 flex items-center justify-center rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20"><X size={11} /></button>
                  </div>
                ) : (
                  // Project group: full controls
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
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1.5 ml-4 rounded-md hover:bg-secondary/50 transition-colors w-full"
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
