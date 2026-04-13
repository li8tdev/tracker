import { Task, TaskStatus } from '@/lib/storage';
import { Circle, Clock, CheckCircle2, Trash2 } from 'lucide-react';

interface Props {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
}

const statusConfig: Record<TaskStatus, { icon: typeof Circle; label: string; className: string; next: TaskStatus }> = {
  todo: { icon: Circle, label: 'Pendiente', className: 'text-muted-foreground', next: 'in_progress' },
  in_progress: { icon: Clock, label: 'En progreso', className: 'text-accent', next: 'done' },
  done: { icon: CheckCircle2, label: 'Completada', className: 'text-success', next: 'todo' },
};

export function TaskCard({ task, onStatusChange, onDelete }: Props) {
  const config = statusConfig[task.status];
  const Icon = config.icon;

  return (
    <div className={`group flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-all ${task.status === 'done' ? 'opacity-60' : ''}`}>
      <button
        onClick={() => onStatusChange(task.id, config.next)}
        className={`shrink-0 ${config.className} hover:scale-110 transition-transform`}
        title={`Cambiar a ${statusConfig[config.next].label}`}
      >
        <Icon size={20} />
      </button>
      <span className={`flex-1 text-sm ${task.status === 'done' ? 'line-through' : ''}`}>
        {task.title}
      </span>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        task.status === 'todo' ? 'bg-secondary text-muted-foreground' :
        task.status === 'in_progress' ? 'bg-accent/10 text-accent' :
        'bg-success/10 text-success'
      }`}>
        {config.label}
      </span>
      <button
        onClick={() => onDelete(task.id)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
