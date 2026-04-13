import { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: boolean;
}

export function StatsCard({ label, value, icon: Icon, accent }: Props) {
  return (
    <div className={`rounded-2xl p-5 ${accent ? 'bg-foreground text-background' : 'bg-card border border-border'}`}>
      <div className="flex items-center justify-between mb-3">
        <Icon size={18} className={accent ? 'text-background/60' : 'text-muted-foreground'} />
      </div>
      <p className={`text-2xl font-bold font-heading ${accent ? '' : ''}`}>{value}</p>
      <p className={`text-xs mt-1 ${accent ? 'text-background/60' : 'text-muted-foreground'}`}>{label}</p>
    </div>
  );
}
