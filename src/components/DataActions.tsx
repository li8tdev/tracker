import { useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { Task, exportData, importData } from '@/lib/storage';
import { toast } from 'sonner';

interface Props {
  tasks: Task[];
  onImport: (tasks: Task[]) => void;
}

export function DataActions({ tasks, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importData(file);
      onImport(imported);
      toast.success(`${imported.length} tareas importadas`);
    } catch {
      toast.error('Error al importar archivo');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => exportData(tasks)}
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
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
    </div>
  );
}
