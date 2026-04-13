import { Clock, Send, Pause, Play } from 'lucide-react';

interface Props {
  secondsUntilNext: number;
  elapsedSeconds: number;
  onEndDay: () => void;
  paused: boolean;
  onTogglePause: () => void;
}

function formatCountdown(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function formatElapsed(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export function WorkanaBar({ secondsUntilNext, elapsedSeconds, onEndDay, paused, onTogglePause }: Props) {
  const isUrgent = !paused && secondsUntilNext <= 300;

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border text-sm transition-colors ${
      paused ? 'bg-muted/50 border-border' : isUrgent ? 'bg-accent/10 border-accent/30' : 'bg-card border-border'
    }`}>
      <Send size={14} className={paused ? 'text-muted-foreground/50' : isUrgent ? 'text-accent' : 'text-muted-foreground'} />
      <span className="text-xs text-muted-foreground">Workana en</span>
      <span className={`font-mono font-semibold text-sm tabular-nums ${paused ? 'text-muted-foreground/50' : isUrgent ? 'text-accent' : ''}`}>
        {paused ? '--:--' : formatCountdown(secondsUntilNext)}
      </span>
      <button
        onClick={onTogglePause}
        className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${
          paused ? 'hover:bg-accent/10 text-accent' : 'hover:bg-secondary text-muted-foreground'
        }`}
        title={paused ? 'Reanudar notificaciones' : 'Pausar notificaciones'}
      >
        {paused ? <Play size={12} /> : <Pause size={12} />}
      </button>
      <div className="w-px h-4 bg-border mx-1" />
      <Clock size={13} className="text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Sesión: {formatElapsed(elapsedSeconds)}</span>
      <button
        onClick={onEndDay}
        className="ml-auto text-xs text-muted-foreground hover:text-destructive transition-colors"
      >
        Terminar día
      </button>
    </div>
  );
}
