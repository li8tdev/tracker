import { Task, TaskGroup } from '@/lib/storage';
import { useMemo, useState, useEffect } from 'react';
import { Flame, EyeOff, Eye, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface Props {
  allTasks: Task[];
  allGroups: TaskGroup[];
}

interface DailyItem {
  id: string;
  key: string; // stable key for hide/show persistence
  name: string;
  type: 'task' | 'group';
  completedDates: Set<string>;
  currentStreak: number;
}

const HIDDEN_KEY = 'daily-streak-hidden-v1';

function loadHidden(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHidden(keys: string[]) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(keys));
  } catch {
    // ignore
  }
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
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(loadHidden()));

  useEffect(() => {
    saveHidden(Array.from(hidden));
  }, [hidden]);

  const allDailyItems = useMemo(() => {
    const items: DailyItem[] = [];
    const dailyGroups = allGroups.filter(g => g.isDaily);
    const dailyTasks = allTasks.filter(t => t.isDaily && !t.groupId);

    // Daily groups: completed when all tasks done on that date
    for (const group of dailyGroups) {
      const groupTasks = allTasks.filter(t => t.groupId === group.id);
      const completedDates = new Set<string>();

      const tasksByDate = new Map<string, typeof groupTasks>();
      for (const task of groupTasks) {
        const date = task.date;
        if (!tasksByDate.has(date)) tasksByDate.set(date, []);
        tasksByDate.get(date)!.push(task);
      }

      for (const [date, dateTasks] of tasksByDate) {
        if (dateTasks.length > 0 && dateTasks.every(t => t.status === 'done')) {
          completedDates.add(date);
        }
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

      items.push({
        id: group.id,
        key: `group:${group.name}`,
        name: group.name,
        type: 'group',
        completedDates,
        currentStreak: streak,
      });
    }

    // Individual daily tasks (not in groups) — find all copies by title
    const seenTitles = new Set<string>();
    for (const task of dailyTasks) {
      if (seenTitles.has(task.title)) continue;
      seenTitles.add(task.title);

      const completedDates = new Set<string>();
      const allCopies = allTasks.filter(t => t.isDaily && !t.groupId && t.title === task.title);
      for (const copy of allCopies) {
        if (copy.status === 'done') {
          completedDates.add(copy.date);
        }
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

      items.push({
        id: task.id,
        key: `task:${task.title}`,
        name: task.title,
        type: 'task',
        completedDates,
        currentStreak: streak,
      });
    }

    return items;
  }, [allTasks, allGroups]);

  const dailyItems = useMemo(
    () => allDailyItems.filter(i => !hidden.has(i.key)),
    [allDailyItems, hidden]
  );

  const hiddenItems = useMemo(
    () => allDailyItems.filter(i => hidden.has(i.key)),
    [allDailyItems, hidden]
  );

  const days = useMemo(() => getLast12Weeks(), []);

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

  const hideItem = (key: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const showItem = (key: string) => {
    setHidden(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  if (allDailyItems.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Flame size={16} className="text-warning" />
        <h3 className="font-heading font-semibold text-sm">Racha Diaria</h3>
        <span className="text-xs text-muted-foreground ml-auto">Últimas 12 semanas</span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-secondary"
              title="Mostrar / ocultar hábitos"
            >
              <EyeOff size={12} />
              {hiddenItems.length > 0 && (
                <span className="text-[10px] font-medium">{hiddenItems.length}</span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
            <DropdownMenuLabel className="text-xs">Visibles</DropdownMenuLabel>
            {dailyItems.length === 0 && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">Ninguno</div>
            )}
            {dailyItems.map(item => (
              <DropdownMenuItem
                key={item.key}
                onClick={(e) => { e.preventDefault(); hideItem(item.key); }}
                className="text-xs flex items-center gap-2"
              >
                <EyeOff size={12} className="text-muted-foreground shrink-0" />
                <span className="truncate flex-1">{item.name}</span>
              </DropdownMenuItem>
            ))}

            {hiddenItems.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">Ocultos</DropdownMenuLabel>
                {hiddenItems.map(item => (
                  <DropdownMenuItem
                    key={item.key}
                    onClick={(e) => { e.preventDefault(); showItem(item.key); }}
                    className="text-xs flex items-center gap-2"
                  >
                    <Eye size={12} className="text-muted-foreground shrink-0" />
                    <span className="truncate flex-1 text-muted-foreground">{item.name}</span>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {dailyItems.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">
          Todos los hábitos están ocultos. Usa el menú para mostrarlos.
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin" style={{ scrollbarWidth: 'thin' }}>
          {dailyItems.map(item => (
            <div key={item.id} className="space-y-2 min-w-[220px] flex-shrink-0 group/item">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium truncate max-w-[160px]">{item.name}</span>
                <div className="flex items-center gap-1.5">
                  <Flame size={12} className={item.currentStreak > 0 ? 'text-warning' : 'text-muted-foreground'} />
                  <span className={`text-xs font-bold ${item.currentStreak > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                    {item.currentStreak}d
                  </span>
                  <button
                    onClick={() => hideItem(item.key)}
                    title="Ocultar de Racha Diaria"
                    className="opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                  >
                    <X size={11} />
                  </button>
                </div>
              </div>

              <div className="flex gap-0.5">
                <div className="flex flex-col gap-0.5 mr-1">
                  {DAY_LABELS.map((label, i) => (
                    <div key={i} className="w-3 h-3 flex items-center justify-center">
                      <span className="text-[8px] text-muted-foreground">{i % 2 === 1 ? label : ''}</span>
                    </div>
                  ))}
                </div>

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
      )}

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
