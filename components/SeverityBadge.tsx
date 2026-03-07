import { cn } from '@/lib/utils';

interface Props {
  severity: string;
  className?: string;
}

const badgeMap: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  high:     { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' },
  medium:   { bg: '#FEFCE8', text: '#CA8A04', border: '#FEF08A' },
  low:      { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
};

export default function SeverityBadge({ severity, className }: Props) {
  const s = badgeMap[severity.toLowerCase()] ?? { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' };
  return (
    <span
      className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide', className)}
      style={{ backgroundColor: s.bg, color: s.text, borderColor: s.border }}
    >
      {severity}
    </span>
  );
}
