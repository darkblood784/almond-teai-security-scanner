'use client';
import Link from 'next/link';
import { Plus, Shield, AlertTriangle, FileSearch } from 'lucide-react';
import StatsCard from '@/components/StatsCard';
import ScanListItem from '@/components/ScanListItem';
import { useLanguage } from '@/contexts/LanguageContext';
import { strings } from '@/lib/i18n';

interface Scan {
  id: string;
  status: string;
  score: number | null;
  repoName: string | null;
  fileName: string | null;
  createdAt: Date | string;
  _count: { vulnerabilities: number };
}

interface Props {
  scans:     Scan[];
  avgScore:  number | null;
  critCount: number;
}

export default function DashboardView({ scans, avgScore, critCount }: Props) {
  const { lang } = useLanguage();
  const t = strings[lang];
  const completed = scans.filter(s => s.status === 'completed');

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">

      {/* Header */}
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t.dash_title}</h1>
          <p className="mt-1 text-sm text-gray-400">{t.dash_sub}</p>
        </div>
        <Link href="/new"
          className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-gray-700"
        >
          <Plus className="h-4 w-4" />
          {t.dash_new}
        </Link>
      </div>

      {/* Stats */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard title={t.dash_stat1}    value={scans.length}      icon={FileSearch} color="default" />
        <StatsCard title={t.dash_stat2}    value={avgScore ?? '—'}   icon={Shield}     color="blue"    subtitle={t.dash_stat2sub} />
        <StatsCard title={t.dash_stat3}    value={critCount}         icon={AlertTriangle} color="red"  subtitle={t.dash_stat3sub} />
        <StatsCard title={t.dash_stat4}    value={completed.length}  icon={FileSearch} color="default" />
      </div>

      {/* Scan list */}
      <div className="rounded-xl border border-gray-200 overflow-hidden card-shadow">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-6 py-4">
          <h2 className="font-semibold text-gray-900">{t.dash_list_title}</h2>
          <span className="text-sm text-gray-400">{t.dash_list_count(scans.length)}</span>
        </div>

        {scans.length === 0 ? (
          <div className="flex flex-col items-center gap-4 bg-white py-20">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-gray-50">
              <FileSearch className="h-5 w-5 text-gray-300" />
            </div>
            <p className="text-gray-400">{t.dash_empty}</p>
            <Link href="/new"
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900">
              {t.dash_empty_cta}
            </Link>
          </div>
        ) : (
          <div className="bg-white">
            {scans.map((scan, i) => (
              <ScanListItem key={scan.id} scan={scan} isLast={i === scans.length - 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
