import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getToday } from '@/lib/storage';

interface Props {
  selectedDate: string;
  onDateChange: (date: string) => void;
}

export function DatePicker({ selectedDate, onDateChange }: Props) {
  const isToday = selectedDate === getToday();

  const shift = (days: number) => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    onDateChange(d.toISOString().split('T')[0]);
  };

  const formatted = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="flex items-center gap-3">
      <button onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
        <ChevronLeft size={16} />
      </button>
      <div className="text-center">
        <p className="font-heading font-semibold text-sm capitalize">{formatted}</p>
        {isToday && <p className="text-xs text-accent font-medium">Hoy</p>}
      </div>
      <button onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
        <ChevronRight size={16} />
      </button>
      {!isToday && (
        <button
          onClick={() => onDateChange(getToday())}
          className="text-xs text-accent hover:underline ml-1"
        >
          Ir a hoy
        </button>
      )}
    </div>
  );
}
