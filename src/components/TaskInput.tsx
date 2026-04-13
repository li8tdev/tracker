import { useState } from 'react';
import { Plus, Minus, CalendarDays, Clock, FolderPlus, Repeat } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  onAdd: (title: string, pomodoroCount: number, date: string, scheduledTime?: string, groupId?: string, isDaily?: boolean) => void;
  onAddGroup?: (name: string, date?: string, isDaily?: boolean) => void;
  defaultDate: string;
}

export function TaskInput({ onAdd, onAddGroup, defaultDate }: Props) {
  const [value, setValue] = useState('');
  const [pomodoros, setPomodoros] = useState(1);
  const [taskDate, setTaskDate] = useState<Date>(new Date(defaultDate + 'T12:00:00'));
  const [calOpen, setCalOpen] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  const [mode, setMode] = useState<'task' | 'group'>('task');
  const [isDaily, setIsDaily] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    if (mode === 'group') {
      const dateStr = taskDate.toISOString().split('T')[0];
      onAddGroup?.(value.trim(), dateStr, isDaily || undefined);
      setValue('');
      setMode('task');
      setIsDaily(false);
      return;
    }
    const dateStr = taskDate.toISOString().split('T')[0];
    onAdd(value.trim(), pomodoros, dateStr, scheduledTime || undefined, undefined, isDaily || undefined);
    setValue('');
    setPomodoros(1);
    setScheduledTime('');
    setIsDaily(false);
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <div className="flex-1 space-y-2">
        <div className="flex gap-1.5">
          <div className="flex bg-secondary rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setMode('task')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${mode === 'task' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Tarea
            </button>
            <button
              type="button"
              onClick={() => setMode('group')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${mode === 'group' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <FolderPlus size={11} />
              Grupo
            </button>
          </div>
        </div>
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={mode === 'group' ? 'Nombre del grupo (ej: Subir reel)...' : 'Agregar nueva tarea...'}
          className="w-full bg-secondary/50 border-0 rounded-lg px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
        />
        <div className="flex items-center gap-3 flex-wrap">
          {mode === 'task' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Pomodoros:</span>
                <button type="button" onClick={() => setPomodoros(p => Math.max(1, p - 1))} className="p-1 rounded hover:bg-secondary text-muted-foreground transition-colors">
                  <Minus size={12} />
                </button>
                <span className="text-sm font-mono font-semibold w-6 text-center">{pomodoros}</span>
                <button type="button" onClick={() => setPomodoros(p => Math.min(10, p + 1))} className="p-1 rounded hover:bg-secondary text-muted-foreground transition-colors">
                  <Plus size={12} />
                </button>
                <span className="text-xs text-muted-foreground">({pomodoros * 60} min)</span>
              </div>
              <div className="w-px h-4 bg-border" />
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <button type="button" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <CalendarDays size={12} />
                    {format(taskDate, "d MMM yyyy", { locale: es })}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={taskDate}
                    onSelect={(d) => { if (d) { setTaskDate(d); setCalOpen(false); } }}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <div className="w-px h-4 bg-border" />
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-muted-foreground" />
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={e => setScheduledTime(e.target.value)}
                  className="bg-transparent border-0 text-xs text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
                  title="Hora programada"
                />
                {scheduledTime && (
                  <button type="button" onClick={() => setScheduledTime('')} className="text-[10px] text-muted-foreground hover:text-destructive">✕</button>
                )}
              </div>
              <div className="w-px h-4 bg-border" />
            </>
          )}
          {mode === 'task' && (
            <button
              type="button"
              onClick={() => setIsDaily(d => !d)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${isDaily ? 'bg-accent/15 text-accent border border-accent/30' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}
              title="Se repite todos los días"
            >
              <Repeat size={11} />
              Diario
            </button>
          )}
        </div>
      </div>
      <button
        type="submit"
        className="bg-foreground text-background rounded-lg px-4 py-3 hover:opacity-80 transition-opacity flex items-center gap-1 text-sm font-medium font-heading"
      >
        <Plus size={16} />
        {mode === 'group' ? 'Crear grupo' : 'Añadir'}
      </button>
    </form>
  );
}
