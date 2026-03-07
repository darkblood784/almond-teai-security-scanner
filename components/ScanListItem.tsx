'use client';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { scoreRingColor, formatDate } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { strings } from '@/lib/i18n';

interface ScanItem {
  id: string;
  status: string;
  score: number | null;
  repoName: string | null;
  fileName: string | null;
  createdAt: Date | string;
  _count: { vulnerabilities: number };
}

interface Props { scan: ScanItem; isLast: boolean; }

function getScoreLabel(score: number, t: typeof strings['en']) {
  if (score >= 90) return t.score_excellent;
  if (score >= 70) return t.score_good;
  if (score >= 50) return t.score_fair;
  if (score >= 30) return t.score_poor;
  return t.score_critical;
}

export default function ScanListItem({ scan, isLast }: Props) {
  const { lang } = useLanguage();
  const t = strings[lang];

  const score = scan.score;
  const color = score != null ? scoreRingColor(score) : '#D1D5DB';
  const label = score != null ? getScoreLabel(score, t) : '—';
  const vulnN = scan._count.vulnerabilities;

  return (
    <Link
      href={scan.status === 'completed' ? `/scan/${scan.id}` : '#'}
      className="flex items-center gap-5 px-6 py-4 transition-colors hover:bg-gray-50"
      style={{ borderBottom: !isLast ? '1px solid #F3F4F6' : 'none' }}
    >
      {/* Score ring */}
      <div
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold"
        style={{ color, border: `2px solid ${color}` }}
      >
        {score ?? '?'}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-gray-900">
          {scan.repoName ?? scan.fileName ?? t.item_unnamed}
        </p>
        <p className="mt-0.5 text-xs text-gray-400">{formatDate(scan.createdAt)}</p>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        {scan.status === 'completed' ? (
          <>
            <span className="text-sm font-medium" style={{ color }}>{label}</span>
            {vulnN > 0 && (
              <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                {t.item_issues(vulnN)}
              </span>
            )}
          </>
        ) : scan.status === 'scanning' ? (
          <span className="animate-pulse text-xs text-gray-400">{t.item_scanning}</span>
        ) : scan.status === 'failed' ? (
          <span className="text-xs text-red-500">{t.item_failed}</span>
        ) : null}
        <ChevronRight className="h-4 w-4 text-gray-300" />
      </div>
    </Link>
  );
}
