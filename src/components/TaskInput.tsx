import { useState } from 'react';
import { Plus, Minus, CalendarDays, Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Props {
  onAdd: (title: string, pomodoroCount: number, date: string, scheduledTime?: string) => void;
  defaultDate: string;
}

export function TaskInput({ onAdd, defaultDate }: Props) {
  const [value, setValue] = useState('');
  const [pomodoros, setPomodoros] = useState(1);
  const [taskDate, setTaskDate] = useState<Date>(new Date(defaultDate + 'T12:00:00'));
  const [calOpen, setCalOpen] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    const dateStr = taskDate.toISOString().split('T')[0];
    onAdd(value.trim(), pomodoros, dateStr, scheduledTime || undefined);
    setValue('');
    setPomodoros(1);
    setScheduledTime('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 items-end">
      <div className="flex-1 space-y-2">
        <input
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Agregar nueva tarea..."
          className="w-full bg-secondary/50 border-0 rounded-lg px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
        />
        <div className="flex items-center gap-3 flex-wrap">
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
        </div>
      </div>
      <button
        type="submit"
        className="bg-foreground text-background rounded-lg px-4 py-3 hover:opacity-80 transition-opacity flex items-center gap-1 text-sm font-medium font-heading"
      >
        <Plus size={16} />
        Añadir
      </button>
    </form>
  );
}
