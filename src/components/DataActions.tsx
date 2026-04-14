import { useRef, useState } from 'react';
import { Download, Upload, Trash2 } from 'lucide-react';
import { Task, TaskGroup, exportData, importData, resetAllData } from '@/lib/storage';
import { toast } from 'sonner';

interface Props {
  tasks: Task[];
  groups: TaskGroup[];
  onImport: (tasks: Task[], groups: TaskGroup[]) => void;
}

export function DataActions({ tasks, groups, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importData(file);
      onImport(imported.tasks, imported.groups);
      toast.success(`${imported.tasks.length} tareas y ${imported.groups.length} grupos importados`);
    } catch {
      toast.error('Error al importar archivo');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    resetAllData();
    toast.success('Todos los datos han sido eliminados');
    window.location.reload();
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => exportData(tasks, groups)}
        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-muted-foreground"
      >
        <Download size={13} /> Exportar
      </button>
      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-muted-foreground"
      >
        <Upload size={13} /> Importar
      </button>
      <button
        onClick={handleReset}
        className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-colors ${confirmReset ? 'bg-destructive text-destructive-foreground' : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'}`}
      >
        <Trash2 size={13} /> {confirmReset ? '¿Confirmar?' : 'Formatear todo'}
      </button>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
    </div>
  );
}
