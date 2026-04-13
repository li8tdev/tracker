import { Task } from '@/lib/storage';
import { useMemo } from 'react';

interface Props {
  allTasks: Task[];
}

export function Analytics({ allTasks }: Props) {
  const stats = useMemo(() => {
    const last7Days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      last7Days.push(d.toISOString().split('T')[0]);
    }

    const dailyData = last7Days.map(date => {
      const dayTasks = allTasks.filter(t => t.date === date);
      const completed = dayTasks.filter(t => t.status === 'done').length;
      const total = dayTasks.length;
      return { date, completed, total, label: new Date(date + 'T12:00:00').toLocaleDateString('es', { weekday: 'short' }) };
    });

    const totalCompleted = allTasks.filter(t => t.status === 'done').length;
    const totalTasks = allTasks.length;
    const completionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

    // Streak calculation
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayCompleted = allTasks.filter(t => t.date === dateStr && t.status === 'done').length;
      if (dayCompleted > 0) streak++;
      else break;
    }

    return { dailyData, completionRate, streak };
  }, [allTasks]);

  const maxTasks = Math.max(...stats.dailyData.map(d => d.total), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold text-sm">Últimos 7 días</h3>
        <span className="text-xs text-muted-foreground">{stats.completionRate}% completado</span>
      </div>
      
      <div className="flex items-end gap-2 h-24">
        {stats.dailyData.map(day => (
          <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full relative" style={{ height: '80px' }}>
              {/* Total bar */}
              <div
                className="absolute bottom-0 w-full bg-secondary rounded-t-md transition-all"
                style={{ height: `${(day.total / maxTasks) * 100}%`, minHeight: day.total > 0 ? '4px' : '0' }}
              />
              {/* Completed bar */}
              <div
                className="absolute bottom-0 w-full bg-foreground rounded-t-md transition-all"
                style={{ height: `${(day.completed / maxTasks) * 100}%`, minHeight: day.completed > 0 ? '4px' : '0' }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground capitalize">{day.label}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-4 pt-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-foreground" />
          Completadas
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-secondary" />
          Total
        </div>
      </div>
    </div>
  );
}
