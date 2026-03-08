'use client';

interface Props {
  category: string | null | undefined;
  className?: string;
}

const categoryMap: Record<string, { label: string; bg: string; text: string; border: string }> = {
  secret: {
    label: 'Secret',
    bg: '#F8FAFC',
    text: '#475569',
    border: '#CBD5E1',
  },
  dependency: {
    label: 'Dependency',
    bg: '#F8FAFC',
    text: '#475569',
    border: '#CBD5E1',
  },
  code: {
    label: 'Code',
    bg: '#F8FAFC',
    text: '#475569',
    border: '#CBD5E1',
  },
  exposure: {
    label: 'Exposure',
    bg: '#F8FAFC',
    text: '#475569',
    border: '#CBD5E1',
  },
  configuration: {
    label: 'Config',
    bg: '#F8FAFC',
    text: '#475569',
    border: '#CBD5E1',
  },
};

export default function CategoryBadge({ category, className }: Props) {
  const key = (category ?? 'code').toLowerCase();
  const style = categoryMap[key] ?? categoryMap.code;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${className ?? ''}`}
      style={{
        backgroundColor: style.bg,
        color: style.text,
        borderColor: style.border,
      }}
    >
      {style.label}
    </span>
  );
}
