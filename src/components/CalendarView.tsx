import { Task, TaskGroup } from '@/lib/storage';
import { Calendar } from '@/components/ui/calendar';
import { useState, useMemo } from 'react';
import { Circle, Clock, CheckCircle2, Repeat, Layers } from 'lucide-react';

interface Props {
  allTasks: Task[];
  allGroups?: TaskGroup[];
  selectedDate?: string;
  onDateChange?: (date: string) => void;
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

// Duration = custom time OR pomodoros * 60min + (pomodoros - 1) * 10min breaks
function calcDurationMin(pomodoros: number, customTimeMinutes?: number): number {
  if (customTimeMinutes) return customTimeMinutes;
  if (pomodoros <= 0) return 0;
  return pomodoros * 60 + (pomodoros > 1 ? (pomodoros - 1) * 10 : 0);
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMin = h * 60 + m + minutes;
  const endH = Math.floor(totalMin / 60) % 24;
  const endM = totalMin % 60;
  return `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
}

// Unified calendar entry: either a task or a daily group
interface CalendarEntry {
  id: string;
  title: string;
  scheduledTime: string;
  pomodoros: number;
  durationMin: number;
  endTime: string;
  status: 'todo' | 'in_progress' | 'done';
  isGroup: boolean;
  isDaily: boolean;
  pomodorosCompleted: number;
  overtimeSeconds: number;
}

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

export function CalendarView({ allTasks, allGroups = [], selectedDate, onDateChange }: Props) {
  const externalDate = selectedDate ? new Date(selectedDate + 'T12:00:00') : undefined;
  const [internalDay, setInternalDay] = useState<Date | undefined>(new Date());
  const selectedDay = externalDate ?? internalDay;

  const handleDaySelect = (day: Date | undefined) => {
    if (day && onDateChange) {
      onDateChange(day.toISOString().split('T')[0]);
    } else {
      setInternalDay(day);
    }
  };

  const selectedDateStr = selectedDay ? selectedDay.toISOString().split('T')[0] : '';

  // Build calendar entries: individual scheduled tasks + daily groups
  const entries = useMemo(() => {
    const result: CalendarEntry[] = [];

    // Daily groups appear on every date — only count tasks for the selected date
    const dailyGroups = allGroups.filter(g => g.isDaily && g.scheduledTime && g.pomodoroCount);
    dailyGroups.forEach(g => {
      const groupTasks = allTasks.filter(t => t.groupId === g.id && t.date === selectedDateStr);
      const allDone = groupTasks.length > 0 && groupTasks.every(t => t.status === 'done');
      const anyInProgress = groupTasks.some(t => t.status === 'in_progress');
      const completedPomos = groupTasks.reduce((s, t) => s + t.pomodorosCompleted, 0);
      const overtime = groupTasks.reduce((s, t) => s + t.overtimeSeconds, 0);
      const dur = calcDurationMin(g.pomodoroCount!, g.customTimeMinutes);

      result.push({
        id: g.id,
        title: g.name,
        scheduledTime: g.scheduledTime!,
        pomodoros: g.pomodoroCount!,
        durationMin: dur,
        endTime: addMinutesToTime(g.scheduledTime!, dur),
        status: allDone ? 'done' : anyInProgress ? 'in_progress' : 'todo',
        isGroup: true,
        isDaily: true,
        pomodorosCompleted: completedPomos,
        overtimeSeconds: overtime,
      });
    });

    // Non-daily groups with scheduledTime on this date
    const projectGroups = allGroups.filter(g => !g.isDaily && g.scheduledTime && g.pomodoroCount);
    projectGroups.forEach(g => {
      // Show if group date matches OR any task on this date belongs to it
      const groupTasks = allTasks.filter(t => t.groupId === g.id && t.date === selectedDateStr);
      if (groupTasks.length === 0 && g.date !== selectedDateStr) return;
      const allDone = groupTasks.length > 0 && groupTasks.every(t => t.status === 'done');
      const anyInProgress = groupTasks.some(t => t.status === 'in_progress');
      const completedPomos = groupTasks.reduce((s, t) => s + t.pomodorosCompleted, 0);
      const overtime = groupTasks.reduce((s, t) => s + t.overtimeSeconds, 0);
      const dur = calcDurationMin(g.pomodoroCount!, g.customTimeMinutes);

      result.push({
        id: g.id,
        title: g.name,
        scheduledTime: g.scheduledTime!,
        pomodoros: g.pomodoroCount!,
        durationMin: dur,
        endTime: addMinutesToTime(g.scheduledTime!, dur),
        status: allDone ? 'done' : anyInProgress ? 'in_progress' : 'todo',
        isGroup: true,
        isDaily: false,
        pomodorosCompleted: completedPomos,
        overtimeSeconds: overtime,
      });
    });

    // Individual scheduled tasks (not belonging to a group with scheduledTime)
    const groupsWithSchedule = new Set(allGroups.filter(g => g.scheduledTime).map(g => g.id));
    
    const directTasks = allTasks.filter(t => t.date === selectedDateStr && t.scheduledTime);
    const dailyTasks = allTasks.filter(t => {
      if (t.date === selectedDateStr) return false;
      return t.isDaily && t.scheduledTime;
    });

    [...directTasks, ...dailyTasks].forEach(t => {
      // Skip tasks that belong to a group shown as a block
      if (t.groupId && groupsWithSchedule.has(t.groupId)) return;

      const dur = calcDurationMin(t.pomodoroCount, t.customTimeMinutes);
      result.push({
        id: t.id,
        title: t.title,
        scheduledTime: t.scheduledTime!,
        pomodoros: t.pomodoroCount,
        durationMin: dur,
        endTime: addMinutesToTime(t.scheduledTime!, dur),
        status: t.status,
        isGroup: false,
        isDaily: !!t.isDaily,
        pomodorosCompleted: t.pomodorosCompleted,
        overtimeSeconds: t.overtimeSeconds,
      });
    });

    return result.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  }, [allTasks, allGroups, selectedDateStr]);

  // Unscheduled tasks for the sidebar
  const unscheduledTasks = useMemo(() => {
    const groupsWithSchedule = new Set(allGroups.filter(g => g.scheduledTime).map(g => g.id));
    const direct = allTasks.filter(t => t.date === selectedDateStr && !t.scheduledTime && !(t.groupId && groupsWithSchedule.has(t.groupId)));
    const daily = allTasks.filter(t => {
      if (t.date === selectedDateStr) return false;
      return t.isDaily && !t.scheduledTime && !(t.groupId && groupsWithSchedule.has(t.groupId));
    });
    return [...direct, ...daily];
  }, [allTasks, allGroups, selectedDateStr]);

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

  const totalPomodoros = entries.reduce((s, e) => s + e.pomodoros, 0);
  const completedPomodoros = entries.reduce((s, e) => s + e.pomodorosCompleted, 0);

  // Map entries to hour slots (an entry can span multiple hours)
  const entriesByHour = useMemo(() => {
    const map: Record<number, CalendarEntry[]> = {};
    entries.forEach(e => {
      const startHour = parseInt(e.scheduledTime.split(':')[0], 10);
      const endHour = Math.min(23, parseInt(e.endTime.split(':')[0], 10));
      // Place entry in start hour only, but track span
      if (!map[startHour]) map[startHour] = [];
      map[startHour].push(e);
    });
    return map;
  }, [entries]);

  // Track which hours are "occupied" by a spanning entry
  const occupiedHours = useMemo(() => {
    const set = new Set<number>();
    entries.forEach(e => {
      const startH = parseInt(e.scheduledTime.split(':')[0], 10);
      const endMinTotal = parseInt(e.endTime.split(':')[0], 10) * 60 + parseInt(e.endTime.split(':')[1], 10);
      const startMin = parseInt(e.scheduledTime.split(':')[1], 10);
      // Mark intermediate hours
      for (let h = startH + 1; h * 60 < endMinTotal; h++) {
        set.add(h);
      }
    });
    return set;
  }, [entries]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Calendar + summary */}
      <div className="space-y-4">
        <Calendar
          mode="single"
          selected={selectedDay}
          onSelect={handleDaySelect}
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
              {entries.length + unscheduledTasks.length} tareas · 🍅 {completedPomodoros}/{totalPomodoros}
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
              const hourEntries = entriesByHour[hour] || [];
              const timeStr = `${hour.toString().padStart(2, '0')}:00`;
              const hasEntry = hourEntries.length > 0;
              const isOccupied = occupiedHours.has(hour);

              return (
                <div key={hour} className={`flex border-b border-border/50 last:border-0 min-h-[48px] ${hasEntry ? 'bg-card' : isOccupied ? 'bg-card/50' : ''}`}>
                  <div className="w-14 shrink-0 py-2 px-2 text-[11px] text-muted-foreground font-mono border-r border-border/50 flex items-start justify-end">
                    {timeStr}
                  </div>
                  <div className="flex-1 py-1.5 px-2 space-y-1">
                    {hourEntries.map(entry => {
                      const Icon = entry.isGroup ? Layers : statusIcons[entry.status];
                      return (
                        <div key={entry.id} className={`flex items-center gap-2 p-1.5 rounded-md border ${statusBg[entry.status]} transition-colors`}>
                          <Icon size={12} className={entry.isGroup ? 'text-primary' : statusColors[entry.status]} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={`text-xs truncate ${entry.status === 'done' ? 'line-through opacity-60' : ''}`}>
                                {entry.title}
                              </p>
                              {entry.isDaily && <Repeat size={10} className="text-accent shrink-0" />}
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] text-muted-foreground">
                                {entry.scheduledTime} – {entry.endTime}
                              </span>
                              <span className="text-[9px] text-muted-foreground">
                                · {formatDuration(entry.durationMin)}
                              </span>
                              <span className="text-[9px] text-muted-foreground font-mono">
                                🍅{entry.pomodorosCompleted}/{entry.pomodoros}
                              </span>
                              {entry.pomodoros > 1 && (
                                <span className="text-[9px] text-muted-foreground/60">
                                  ({(entry.pomodoros - 1) * 10}min descanso)
                                </span>
                              )}
                            </div>
                          </div>
                          {entry.overtimeSeconds > 0 && (
                            <span className="text-[9px] text-destructive font-mono shrink-0">
                              +{Math.floor(entry.overtimeSeconds / 60)}m
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {isOccupied && hourEntries.length === 0 && (
                      <div className="h-1 rounded-full bg-primary/20 my-2" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {entries.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            Agrega una hora a tus tareas para ver tu agenda organizada aquí
          </p>
        )}
      </div>
    </div>
  );
}
