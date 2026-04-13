import { useState } from 'react';
import { Plus } from 'lucide-react';

interface Props {
  onAdd: (title: string) => void;
}

export function TaskInput({ onAdd }: Props) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Agregar nueva tarea..."
        className="flex-1 bg-secondary/50 border-0 rounded-lg px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
      />
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
