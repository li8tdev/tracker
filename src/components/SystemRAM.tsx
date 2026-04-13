import { useState, useEffect, useCallback, useRef } from 'react';
import { AlertTriangle, Plus, X, Trash2, Download, Upload } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

interface RAMLog {
  id: string;
  level: number;
  timestamp: string;
  trigger: string;
  note: string;
}

interface TriggerDef {
  label: string;
  debug: string;
  color: string;
}

const DEFAULT_TRIGGERS: TriggerDef[] = [
  { label: 'Sensor Gástrico', debug: 'Es solo el Nervio Vago procesando digestión. No hay peligro real.', color: 'hsl(var(--accent))' },
  { label: 'Pensamiento Intrusivo', debug: 'Tu cerebro genera ~6000 pensamientos/día. Este es solo ruido, no señal.', color: 'hsl(270, 50%, 60%)' },
  { label: 'Fricción Inicial (Trabajo/Estudio)', debug: 'Resistencia normal al cambio de contexto. Desaparece en ~20 min de exposición.', color: 'hsl(200, 50%, 55%)' },
  { label: 'Miedo Existencial/Tiempo', debug: 'Sesgo de urgencia temporal. El tiempo no se "acaba", se redistribuye.', color: 'hsl(30, 60%, 55%)' },
  { label: 'Excitación Anticipada (Social/Intimidad)', debug: 'Adrenalina + dopamina anticipatoria. No es ansiedad, es activación.', color: 'hsl(340, 50%, 60%)' },
];

const STORAGE_KEY = 'system-ram-state';
const TRIGGERS_KEY = 'system-ram-custom-triggers';

function loadState(): { level: number; logs: RAMLog[] } {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return { level: 1, logs: [] };
    return JSON.parse(data);
  } catch { return { level: 1, logs: [] }; }
}

function saveState(level: number, logs: RAMLog[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ level, logs }));
}

function loadCustomTriggers(): TriggerDef[] {
  try {
    const data = localStorage.getItem(TRIGGERS_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch { return []; }
}

function saveCustomTriggers(triggers: TriggerDef[]) {
  localStorage.setItem(TRIGGERS_KEY, JSON.stringify(triggers));
}

function getColor(pct: number) {
  if (pct <= 30) return { ring: 'hsl(145, 60%, 42%)', bg: 'hsla(145, 60%, 42%, 0.1)', label: 'Estado de Flujo', labelColor: 'hsl(145, 60%, 50%)' };
  if (pct <= 60) return { ring: 'hsl(50, 80%, 50%)', bg: 'hsla(50, 80%, 50%, 0.1)', label: 'Ruido de fondo / Fricción', labelColor: 'hsl(50, 80%, 55%)' };
  if (pct <= 80) return { ring: 'hsl(30, 80%, 55%)', bg: 'hsla(30, 80%, 55%, 0.1)', label: 'Sistema sobrecalentado', labelColor: 'hsl(30, 80%, 60%)' };
  return { ring: 'hsl(0, 72%, 51%)', bg: 'hsla(0, 72%, 51%, 0.1)', label: 'Modo Emergencia / Pánico', labelColor: 'hsl(0, 72%, 58%)' };
}

export function SystemRAM() {
  const [level, setLevel] = useState(() => loadState().level);
  const [logs, setLogs] = useState<RAMLog[]>(() => loadState().logs);
  const [selectedTrigger, setSelectedTrigger] = useState<string>('');
  const [customTriggers, setCustomTriggers] = useState<TriggerDef[]>(() => loadCustomTriggers());
  const [addingTrigger, setAddingTrigger] = useState(false);
  const [newTriggerLabel, setNewTriggerLabel] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allTriggers = [...DEFAULT_TRIGGERS, ...customTriggers];

  useEffect(() => { saveState(level, logs); }, [level, logs]);
  useEffect(() => { saveCustomTriggers(customTriggers); }, [customTriggers]);

  const pct = level * 10;
  const { ring, bg, label, labelColor } = getColor(pct);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (pct / 100) * circumference;

  const handleLevelSelect = useCallback((newLevel: number) => {
    setLevel(newLevel);
    const trigger = selectedTrigger || 'Sin trigger';
    const log: RAMLog = {
      id: crypto.randomUUID(),
      level: newLevel,
      timestamp: new Date().toISOString(),
      trigger,
      note: '',
    };
    setLogs(prev => [log, ...prev].slice(0, 200));
  }, [selectedTrigger]);

  const handleAddCustomTrigger = () => {
    if (!newTriggerLabel.trim()) return;
    const t: TriggerDef = { label: newTriggerLabel.trim(), debug: 'Trigger personalizado agregado por el usuario.', color: 'hsl(var(--muted-foreground))' };
    setCustomTriggers(prev => [...prev, t]);
    setNewTriggerLabel('');
    setAddingTrigger(false);
  };

  const handleRemoveCustomTrigger = (label: string) => {
    setCustomTriggers(prev => prev.filter(t => t.label !== label));
    if (selectedTrigger === label) setSelectedTrigger('');
  };

  const handleSaveNote = (logId: string) => {
    setLogs(prev => prev.map(l => l.id === logId ? { ...l, note: noteText } : l));
    setEditingNote(null);
    setNoteText('');
  };

  const handleClearLogs = () => {
    setLogs([]);
    toast.success('Log limpiado');
  };

  const handleExportRAM = () => {
    const data = { level, logs, customTriggers };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ram-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('RAM exportada');
  };

  const handleImportRAM = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (typeof data.level === 'number') setLevel(data.level);
        if (Array.isArray(data.logs)) setLogs(data.logs);
        if (Array.isArray(data.customTriggers)) setCustomTriggers(data.customTriggers);
        toast.success('RAM importada correctamente');
      } catch {
        toast.error('Archivo JSON inválido');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-8 font-mono text-sm">
      {/* Top section: Gauge + Level in a horizontal layout */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {/* Gauge - compact */}
        <div className="relative w-28 h-28 shrink-0">
          <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
            <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--border))" strokeWidth="6" opacity="0.2" />
            <circle
              cx="60" cy="60" r="54" fill="none"
              stroke={ring} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset}
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold tabular-nums" style={{ color: ring }}>{level}</span>
            <span className="text-[9px] text-muted-foreground tracking-wider uppercase">/10</span>
          </div>
        </div>

        {/* Right side: Status + Level buttons */}
        <div className="flex-1 w-full space-y-4">
          {/* Status label */}
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ring }} />
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>

          {/* Level selector - minimal pills */}
          <div className="grid grid-cols-10 gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map(n => {
              const isSelected = level === n;
              return (
                <button
                  key={n}
                  onClick={() => handleLevelSelect(n)}
                  className={`py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 ${
                    isSelected
                      ? 'bg-foreground text-background shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>

          {/* Triggers inline */}
          <div className="flex flex-wrap gap-1.5">
            {allTriggers.map((t) => {
              const isCustom = customTriggers.some(ct => ct.label === t.label);
              const isActive = selectedTrigger === t.label;
              return (
                <Tooltip key={t.label}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setSelectedTrigger(prev => prev === t.label ? '' : t.label)}
                      className={`relative group text-[11px] px-2.5 py-1 rounded-md transition-all duration-200 ${
                        isActive
                          ? 'bg-foreground text-background'
                          : 'bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground'
                      }`}
                    >
                      {t.label}
                      {isCustom && (
                        <span
                          onClick={(e) => { e.stopPropagation(); handleRemoveCustomTrigger(t.label); }}
                          className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity inline-flex"
                        >
                          <X size={9} />
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs font-mono text-xs bg-popover border-border">
                    <span className="text-muted-foreground">DEBUG: </span>{t.debug}
                  </TooltipContent>
                </Tooltip>
              );
            })}

            {addingTrigger ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={newTriggerLabel}
                  onChange={e => setNewTriggerLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCustomTrigger(); if (e.key === 'Escape') setAddingTrigger(false); }}
                  placeholder="trigger..."
                  className="text-[11px] px-2.5 py-1 rounded-md border border-border bg-transparent text-foreground outline-none focus:border-foreground/40 w-32"
                />
              </div>
            ) : (
              <button
                onClick={() => setAddingTrigger(true)}
                className="text-[11px] px-2.5 py-1 rounded-md border border-dashed border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Plus size={10} /> custom
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Emergency protocol */}
      {level > 7 && (
        <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertTriangle size={14} className="text-destructive mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="text-[11px] font-bold text-destructive">PROTOCOLO 20 MIN</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Exhala 8s, inhala 4s. Es química, no realidad.
            </p>
          </div>
        </div>
      )}

      {/* Process Logs */}
      <div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-muted-foreground text-xs">Historial de registros</span>
          <span className="text-xs text-muted-foreground ml-auto">{logs.length} {logs.length === 1 ? 'registro' : 'registros'}</span>
          <div className="flex gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={handleClearLogs} className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" disabled={logs.length === 0}>
                  <Trash2 size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="font-mono text-xs">Limpiar log</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={handleExportRAM} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  <Download size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="font-mono text-xs">Exportar RAM (.json)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  <Upload size={12} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="font-mono text-xs">Importar RAM (.json)</TooltipContent>
            </Tooltip>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportRAM} className="hidden" />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
          {logs.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6 opacity-50">No logs yet. Selecciona un nivel para registrar.</p>
          )}
          {logs.map(log => {
            const c = getColor(log.level * 10);
            const time = new Date(log.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            return (
              <div key={log.id} className="flex items-start gap-2 text-xs py-1.5 px-2 rounded-lg hover:bg-muted/30 group">
                <span className="text-muted-foreground shrink-0">[{time}]</span>
                <span className="font-bold shrink-0" style={{ color: c.ring }}>LVL:{log.level}</span>
                <span className="text-muted-foreground shrink-0">→</span>
                <span className="text-foreground/80 truncate">{log.trigger}</span>
                {editingNote === log.id ? (
                  <input
                    autoFocus
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveNote(log.id); if (e.key === 'Escape') setEditingNote(null); }}
                    onBlur={() => handleSaveNote(log.id)}
                    placeholder="Nota..."
                    className="flex-1 bg-transparent border-b border-border text-foreground outline-none text-xs min-w-0"
                  />
                ) : (
                  <span
                    onClick={() => { setEditingNote(log.id); setNoteText(log.note); }}
                    className={`flex-1 truncate cursor-pointer min-w-0 ${log.note ? 'text-muted-foreground italic' : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100'}`}
                  >
                    {log.note || '+ nota'}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}