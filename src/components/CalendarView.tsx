import { Task } from '@/lib/storage';
import { Calendar } from '@/components/ui/calendar';
import { useState, useMemo } from 'react';
import { Circle, Clock, CheckCircle2 } from 'lucide-react';

interface Props {
  allTasks: Task[];
}

const statusIcons: Record<string, typeof Circle> = {
  todo: Circle,
  in_progress: Clock,
  done: CheckCircle2,
};

const statusColors: Record<string, string> = {
  todo: 'text-muted-foreground',
  in_progress: 'text-accent',
  done: 'text-success',
};

export function CalendarView({ allTasks }: Props) {
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());

  const selectedDateStr = selectedDay ? selectedDay.toISOString().split('T')[0] : '';
  const dayTasks = useMemo(() => allTasks.filter(t => t.date === selectedDateStr), [allTasks, selectedDateStr]);

  // Days that have tasks (for highlighting)
  const taskDates = useMemo(() => {
    const dates = new Set<string>();
    allTasks.forEach(t => dates.add(t.date));
    return dates;
  }, [allTasks]);

  const modifiers = useMemo(() => {
    const hasTasks: Date[] = [];
    taskDates.forEach(d => hasTasks.push(new Date(d + 'T12:00:00')));
    return { hasTasks };
  }, [taskDates]);

  const modifiersStyles = {
    hasTasks: {
      fontWeight: 700,
      textDecoration: 'underline' as const,
      textDecorationColor: 'hsl(var(--accent))',
      textUnderlineOffset: '3px',
    },
  };

  const totalPomodoros = dayTasks.reduce((s, t) => s + t.pomodoroCount, 0);
  const completedPomodoros = dayTasks.reduce((s, t) => s + t.pomodorosCompleted, 0);
  const totalMinutes = totalPomodoros * 60 + (totalPomodoros > 0 ? (totalPomodoros - 1) * 10 : 0);

  return (
    <div className="space-y-4">
      <Calendar
        mode="single"
        selected={selectedDay}
        onSelect={setSelectedDay}
        className="p-3 pointer-events-auto"
        modifiers={modifiers}
        modifiersStyles={modifiersStyles}
      />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-semibold text-sm">
            {selectedDay?.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <span className="text-xs text-muted-foreground">
            {dayTasks.length} tareas · {totalMinutes} min · 🍅 {completedPomodoros}/{totalPomodoros}
          </span>
        </div>

        {dayTasks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Sin tareas para este día</p>
        ) : (
          <div className="space-y-1">
            {dayTasks.map(task => {
              const Icon = statusIcons[task.status];
              return (
                <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                  <Icon size={14} className={statusColors[task.status]} />
                  <span className={`flex-1 text-xs ${task.status === 'done' ? 'line-through opacity-60' : ''}`}>
                    {task.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    🍅 {task.pomodorosCompleted}/{task.pomodoroCount}
                  </span>
                  {task.overtimeSeconds > 0 && (
                    <span className="text-[10px] text-destructive font-mono">
                      +{Math.floor(task.overtimeSeconds / 60)}m
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
