import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

interface Props {
  onAdd: (title: string, pomodoroCount: number) => void;
}

export function TaskInput({ onAdd }: Props) {
  const [value, setValue] = useState('');
  const [pomodoros, setPomodoros] = useState(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onAdd(value.trim(), pomodoros);
    setValue('');
    setPomodoros(1);
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
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Pomodoros:</span>
          <button
            type="button"
            onClick={() => setPomodoros(p => Math.max(1, p - 1))}
            className="p-1 rounded hover:bg-secondary text-muted-foreground transition-colors"
          >
            <Minus size={12} />
          </button>
          <span className="text-sm font-mono font-semibold w-6 text-center">{pomodoros}</span>
          <button
            type="button"
            onClick={() => setPomodoros(p => Math.min(10, p + 1))}
            className="p-1 rounded hover:bg-secondary text-muted-foreground transition-colors"
          >
            <Plus size={12} />
          </button>
          <span className="text-xs text-muted-foreground ml-1">
            ({pomodoros * 60} min + {(pomodoros - 1) * 10} min descanso)
          </span>
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
