import { Rocket, Zap, Target, Flame, Coffee } from 'lucide-react';
import { getNowUTC5 } from '@/lib/storage';

const motivationMessages = [
  { icon: Rocket, title: "¡Es hora de conquistar el día!", text: "Cada tarea completada te acerca a tu versión más productiva." },
  { icon: Zap, title: "¡Energía activada!", text: "No esperes motivación, crea impulso. Empieza con la tarea más pequeña." },
  { icon: Target, title: "¡Enfócate en lo importante!", text: "Define tus 3 tareas más importantes y atácalas primero." },
  { icon: Flame, title: "¡A quemar procrastinación!", text: "El secreto no es tener tiempo, es decidir empezar ahora." },
  { icon: Coffee, title: "¡Listo para la acción!", text: "Un día productivo empieza con una sola decisión: comenzar." },
];

interface Props {
  onStart: () => void;
}

export function StartDayScreen({ onStart }: Props) {
  const msg = motivationMessages[Math.floor(Math.random() * motivationMessages.length)];
  const Icon = msg.icon;

  const hour = getNowUTC5().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground font-heading">{greeting}</p>
          <h1 className="text-3xl font-heading font-bold tracking-tight">¿Listo para empezar?</h1>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
            <Icon size={24} className="text-accent" />
          </div>
          <h2 className="font-heading font-semibold text-lg">{msg.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{msg.text}</p>
        </div>

        <button
          onClick={onStart}
          className="w-full bg-foreground text-background font-heading font-semibold py-4 px-8 rounded-2xl hover:opacity-90 transition-opacity text-sm tracking-wide"
        >
          🚀 Iniciar mi día
        </button>

        <p className="text-xs text-muted-foreground">
          Se activará un recordatorio cada hora para enviar propuestas en Workana
        </p>
      </div>
    </div>
  );
}
