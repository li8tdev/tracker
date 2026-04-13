import { Task, TaskGroup } from '@/lib/storage';
import { Calendar } from '@/components/ui/calendar';
import { useState, useMemo } from 'react';
import { Circle, Clock, CheckCircle2, Repeat } from 'lucide-react';

interface Props {
  allTasks: Task[];
  allGroups?: TaskGroup[];
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

const statusBg: Record<string, string> = {
  todo: 'bg-muted/30 border-border',
  in_progress: 'bg-accent/10 border-accent/20',
  done: 'bg-success/10 border-success/20',
};

// Generate hour slots from 6am to 11pm
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

export function CalendarView({ allTasks, allGroups = [] }: Props) {
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(new Date());

  const selectedDateStr = selectedDay ? selectedDay.toISOString().split('T')[0] : '';
  
  // Include daily tasks on any selected date
  const dayTasks = useMemo(() => {
    const directTasks = allTasks.filter(t => t.date === selectedDateStr);
    const dailyTasks = allTasks.filter(t => {
      if (t.date === selectedDateStr) return false; // already included
      const group = allGroups.find(g => g.id === t.groupId);
      return t.isDaily || group?.isDaily;
    });
    return [...directTasks, ...dailyTasks];
  }, [allTasks, allGroups, selectedDateStr]);

  const scheduledTasks = useMemo(() => dayTasks.filter(t => t.scheduledTime).sort((a, b) => (a.scheduledTime! > b.scheduledTime! ? 1 : -1)), [dayTasks]);
  const unscheduledTasks = useMemo(() => dayTasks.filter(t => !t.scheduledTime), [dayTasks]);

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

  // Map tasks to hour slots
  const tasksByHour = useMemo(() => {
    const map: Record<number, Task[]> = {};
    scheduledTasks.forEach(t => {
      const hour = parseInt(t.scheduledTime!.split(':')[0], 10);
      if (!map[hour]) map[hour] = [];
      map[hour].push(t);
    });
    return map;
  }, [scheduledTasks]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Calendar + summary */}
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
              {dayTasks.length} tareas · 🍅 {completedPomodoros}/{totalPomodoros}
            </span>
          </div>

          {unscheduledTasks.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Sin hora asignada</p>
              {unscheduledTasks.map(task => {
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Timeline schedule */}
      <div className="space-y-2">
        <h3 className="font-heading font-semibold text-sm flex items-center gap-1.5">
          <Clock size={14} className="text-accent" />
          Agenda del día
        </h3>
        <div className="relative border border-border rounded-xl overflow-hidden bg-secondary/20">
          <div className="max-h-[500px] overflow-y-auto">
            {HOURS.map(hour => {
              const hourTasks = tasksByHour[hour] || [];
              const timeStr = `${hour.toString().padStart(2, '0')}:00`;
              const hasTask = hourTasks.length > 0;

              return (
                <div key={hour} className={`flex border-b border-border/50 last:border-0 min-h-[48px] ${hasTask ? 'bg-card' : ''}`}>
                  <div className="w-14 shrink-0 py-2 px-2 text-[11px] text-muted-foreground font-mono border-r border-border/50 flex items-start justify-end">
                    {timeStr}
                  </div>
                  <div className="flex-1 py-1.5 px-2 space-y-1">
                    {hourTasks.map(task => {
                      const Icon = statusIcons[task.status];
                      const durationMin = task.pomodoroCount * 60 + (task.pomodoroCount > 1 ? (task.pomodoroCount - 1) * 10 : 0);
                      return (
                        <div key={task.id} className={`flex items-center gap-2 p-1.5 rounded-md border ${statusBg[task.status]} transition-colors`}>
                          <Icon size={12} className={statusColors[task.status]} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs truncate ${task.status === 'done' ? 'line-through opacity-60' : ''}`}>
                              {task.title}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] text-muted-foreground">{task.scheduledTime}</span>
                              <span className="text-[9px] text-muted-foreground">· {durationMin}min</span>
                              <span className="text-[9px] text-muted-foreground font-mono">🍅{task.pomodorosCompleted}/{task.pomodoroCount}</span>
                            </div>
                          </div>
                          {task.overtimeSeconds > 0 && (
                            <span className="text-[9px] text-destructive font-mono shrink-0">
                              +{Math.floor(task.overtimeSeconds / 60)}m
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {scheduledTasks.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Agrega una hora a tus tareas para ver tu agenda organizada aquí
          </p>
        )}
      </div>
    </div>
  );
}
