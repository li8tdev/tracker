import { Task, TaskGroup } from '@/lib/storage';
import { useMemo } from 'react';
import { Flame } from 'lucide-react';

interface Props {
  allTasks: Task[];
  allGroups: TaskGroup[];
}

interface DailyItem {
  id: string;
  name: string;
  type: 'task' | 'group';
  completedDates: Set<string>;
  currentStreak: number;
}

function getLast12Weeks(): string[] {
  const days: string[] = [];
  const now = new Date(Date.now() - 5 * 3600000); // UTC-5
  for (let i = 83; i >= 0; i--) { // 12 weeks = 84 days
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function getWeekday(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00');
  return d.getDay(); // 0=Sun, 6=Sat
}

const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export function DailyStreakGrid({ allTasks, allGroups }: Props) {
  const dailyItems = useMemo(() => {
    const items: DailyItem[] = [];
    const dailyGroups = allGroups.filter(g => g.isDaily);
    const dailyTasks = allTasks.filter(t => t.isDaily && !t.groupId);

    // Daily groups: completed when all tasks done on that date
    for (const group of dailyGroups) {
      const groupTasks = allTasks.filter(t => t.groupId === group.id);
      const completedDates = new Set<string>();

      // Check each date where group tasks were completed
      for (const task of groupTasks) {
        if (task.completedAt) {
          const date = new Date(new Date(task.completedAt).getTime() - 5 * 3600000).toISOString().split('T')[0];
          completedDates.add(date);
        }
      }

      // Only count dates where ALL group tasks were completed
      const validDates = new Set<string>();
      for (const date of completedDates) {
        const allDone = groupTasks.every(t => {
          if (!t.completedAt) return false;
          const completedDate = new Date(new Date(t.completedAt).getTime() - 5 * 3600000).toISOString().split('T')[0];
          return completedDate === date;
        });
        // For daily tasks that reset, check if at least completed once on that date
        // Since daily tasks reset, we check completedAt dates from all tasks
        if (allDone || groupTasks.length === 0) validDates.add(date);
      }

      // Calculate streak
      let streak = 0;
      const now = new Date(Date.now() - 5 * 3600000);
      for (let i = 0; i < 365; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        if (validDates.has(dateStr)) streak++;
        else break;
      }

      items.push({ id: group.id, name: group.name, type: 'group', completedDates: validDates, currentStreak: streak });
    }

    // Individual daily tasks (not in groups)
    for (const task of dailyTasks) {
      const completedDates = new Set<string>();
      if (task.completedAt) {
        const date = new Date(new Date(task.completedAt).getTime() - 5 * 3600000).toISOString().split('T')[0];
        completedDates.add(date);
      }

      let streak = 0;
      const now = new Date(Date.now() - 5 * 3600000);
      for (let i = 0; i < 365; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        if (completedDates.has(dateStr)) streak++;
        else break;
      }

      items.push({ id: task.id, name: task.title, type: 'task', completedDates, currentStreak: streak });
    }

    return items;
  }, [allTasks, allGroups]);

  const days = useMemo(() => getLast12Weeks(), []);

  // Group days into weeks (columns)
  const weeks = useMemo(() => {
    const w: string[][] = [];
    let currentWeek: string[] = [];
    for (const day of days) {
      const wd = getWeekday(day);
      if (wd === 0 && currentWeek.length > 0) {
        w.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(day);
    }
    if (currentWeek.length > 0) w.push(currentWeek);
    return w;
  }, [days]);

  if (dailyItems.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Flame size={16} className="text-warning" />
        <h3 className="font-heading font-semibold text-sm">Racha Diaria</h3>
        <span className="text-xs text-muted-foreground ml-auto">Últimas 12 semanas</span>
      </div>

      <div className="space-y-4">
        {dailyItems.map(item => (
          <div key={item.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium truncate max-w-[200px]">{item.name}</span>
              <div className="flex items-center gap-1.5">
                <Flame size={12} className={item.currentStreak > 0 ? 'text-warning' : 'text-muted-foreground'} />
                <span className={`text-xs font-bold ${item.currentStreak > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                  {item.currentStreak}d
                </span>
              </div>
            </div>

            <div className="flex gap-0.5">
              {/* Day labels */}
              <div className="flex flex-col gap-0.5 mr-1">
                {DAY_LABELS.map((label, i) => (
                  <div key={i} className="w-3 h-3 flex items-center justify-center">
                    <span className="text-[8px] text-muted-foreground">{i % 2 === 1 ? label : ''}</span>
                  </div>
                ))}
              </div>

              {/* Weeks grid */}
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-0.5">
                  {Array.from({ length: 7 }, (_, dayIndex) => {
                    const dayStr = week.find(d => getWeekday(d) === dayIndex);
                    if (!dayStr) return <div key={dayIndex} className="w-3 h-3" />;

                    const isCompleted = item.completedDates.has(dayStr);
                    const isToday = dayStr === new Date(Date.now() - 5 * 3600000).toISOString().split('T')[0];
                    const dayLabel = new Date(dayStr + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short' });

                    return (
                      <div
                        key={dayIndex}
                        title={`${dayLabel}: ${isCompleted ? '✅ Completado' : '—'}`}
                        className={`w-3 h-3 rounded-[2px] transition-colors ${
                          isCompleted
                            ? 'bg-success'
                            : isToday
                              ? 'bg-accent/40 ring-1 ring-accent'
                              : 'bg-secondary'
                        }`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 pt-1">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <div className="w-2.5 h-2.5 rounded-[2px] bg-secondary" /> Sin completar
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <div className="w-2.5 h-2.5 rounded-[2px] bg-success" /> Completado
        </div>
      </div>
    </div>
  );
}
