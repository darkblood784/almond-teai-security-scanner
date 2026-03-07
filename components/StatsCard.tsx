import type { LucideIcon } from 'lucide-react';

interface Props {
  title:     string;
  value:     string | number;
  subtitle?: string;
  icon:      LucideIcon;
  color?:    'default' | 'red' | 'orange' | 'yellow' | 'blue';
}

const colorMap = {
  default: { iconBg: '#F3F4F6', iconBorder: '#E5E7EB', iconColor: '#374151', valColor: '#111827' },
  red:     { iconBg: '#FEF2F2', iconBorder: '#FECACA', iconColor: '#DC2626', valColor: '#DC2626' },
  orange:  { iconBg: '#FFF7ED', iconBorder: '#FED7AA', iconColor: '#EA580C', valColor: '#EA580C' },
  yellow:  { iconBg: '#FEFCE8', iconBorder: '#FEF08A', iconColor: '#CA8A04', valColor: '#CA8A04' },
  blue:    { iconBg: '#EFF6FF', iconBorder: '#BFDBFE', iconColor: '#2563EB', valColor: '#2563EB' },
};

export default function StatsCard({ title, value, subtitle, icon: Icon, color = 'default' }: Props) {
  const c = colorMap[color];
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 card-shadow">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-gray-500">{title}</p>
          <p className="mt-1 text-3xl font-bold" style={{ color: c.valColor }}>{value}</p>
          {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
        </div>
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border"
          style={{ backgroundColor: c.iconBg, borderColor: c.iconBorder }}
        >
          <Icon className="h-5 w-5" style={{ color: c.iconColor }} />
        </div>
      </div>
    </div>
  );
}
