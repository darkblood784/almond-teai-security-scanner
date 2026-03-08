'use client';
import { scoreRingColor } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { strings } from '@/lib/i18n';
import { gradeLabel, scoreStatusKey } from '@/lib/scoring';

interface Props {
  score:        number;
  totalFiles:   number;
  linesScanned: number;
  repoName?:    string | null;
  counts: { critical: number; high: number; medium: number; low: number };
}

function getScoreLabel(score: number, t: typeof strings['en']) {
  const key = scoreStatusKey(score);
  switch (key) {
    case 'excellent': return t.score_excellent;
    case 'good': return t.score_good;
    case 'fair': return t.score_fair;
    case 'poor': return t.score_poor;
    default: return t.score_critical;
  }
}

export default function ScoreCard({ score, totalFiles, linesScanned, repoName, counts }: Props) {
  const { lang } = useLanguage();
  const t = strings[lang];

  const label     = getScoreLabel(score, t);
  const grade     = gradeLabel(score);
  const ringColor = scoreRingColor(score);

  const RADIUS     = 72;
  const CIRCUMF    = 2 * Math.PI * RADIUS;
  const dashOffset = CIRCUMF * (1 - score / 100);

  const severities = [
    { label: t.card_sev_critical, count: counts.critical, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
    { label: t.card_sev_high,     count: counts.high,     color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
    { label: t.card_sev_medium,   count: counts.medium,   color: '#CA8A04', bg: '#FEFCE8', border: '#FEF08A' },
    { label: t.card_sev_low,      count: counts.low,      color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 card-shadow">
      <div className="flex flex-col items-center gap-8 sm:flex-row">

        {/* Circle gauge */}
        <div className="relative flex-shrink-0">
          <svg width="180" height="180" className="-rotate-90">
            <circle cx="90" cy="90" r={RADIUS} fill="none" stroke="#F3F4F6" strokeWidth="12" />
            <circle
              cx="90" cy="90" r={RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth="12"
              strokeDasharray={CIRCUMF}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1.2s ease, stroke 0.5s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-gray-900">{score}</span>
            <span className="text-xs uppercase tracking-widest text-gray-400">/ 100</span>
            <span className="mt-1 text-sm font-semibold" style={{ color: ringColor }}>{label}</span>
          </div>
        </div>

        {/* Severity breakdown */}
        <div className="flex-1 w-full">
          {repoName && (
            <p className="mb-4 truncate text-sm font-mono text-gray-400">{repoName}</p>
          )}
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Grade</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{grade}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Score</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{score} <span className="text-sm font-medium text-gray-400">/ 100</span></p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Status</p>
              <p className="mt-1 text-base font-semibold" style={{ color: ringColor }}>{label}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {severities.map(({ label: sevLabel, count, color, bg, border }) => (
              <div
                key={sevLabel}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
                style={{ backgroundColor: bg, borderColor: border }}
              >
                <span className="text-sm font-medium text-gray-700">{sevLabel}</span>
                <span className="text-2xl font-bold" style={{ color }}>{count}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-6 text-sm text-gray-400">
            <span><strong className="text-gray-700">{totalFiles.toLocaleString()}</strong> {t.card_files}</span>
            <span><strong className="text-gray-700">{linesScanned.toLocaleString()}</strong> {t.card_lines}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
