'use client';
import Link from 'next/link';
import { Activity, ArrowRight, ArrowUpRight, FolderKanban, Globe, Github, Plus, Shield, TrendingDown, TrendingUp, TriangleAlert, Upload } from 'lucide-react';
import StatsCard from '@/components/StatsCard';
import ScanListItem from '@/components/ScanListItem';
import { useLanguage } from '@/contexts/LanguageContext';
import { strings } from '@/lib/i18n';
import { formatDate, scoreRingColor } from '@/lib/utils';
import { gradeLabel, scoreStatusKey } from '@/lib/scoring';

interface ProjectEntry {
  id: string;
  name: string;
  projectType: string;
  visibility: string;
  badgeEligible: boolean;
  monitoringEnabled: boolean;
  publicSlug: string | null;
  latestScan: {
    id: string;
    createdAt: Date | string;
    status: string;
    score: number | null;
    regressionStatus: string | null;
    repoName: string | null;
    fileName: string | null;
    websiteUrl: string | null;
    _count: { vulnerabilities: number };
    vulnerabilities: Array<{ severity: string }>;
  } | null;
}

interface RecentScan {
  id: string;
  status: string;
  score: number | null;
  repoName: string | null;
  fileName: string | null;
  createdAt: Date | string;
  _count: { vulnerabilities: number };
}

interface DashboardStats {
  totalProjects: number;
  avgLatestScore: number | null;
  projectsWithCriticalFindings: number;
  improvedProjects: number;
  degradedProjects: number;
}

interface Props {
  projects: ProjectEntry[];
  recentScans: RecentScan[];
  stats: DashboardStats;
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

function projectTypeLabel(projectType: string): string {
  switch (projectType) {
    case 'github':
      return 'GitHub';
    case 'website':
      return 'Website';
    case 'upload':
      return 'Upload';
    default:
      return 'Project';
  }
}

function projectTypeIcon(projectType: string) {
  switch (projectType) {
    case 'github':
      return Github;
    case 'website':
      return Globe;
    case 'upload':
      return Upload;
    default:
      return FolderKanban;
  }
}

function regressionStyle(status: string | null): string {
  switch (status) {
    case 'improved':
      return 'border-green-200 bg-green-50 text-green-700';
    case 'degraded':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

function regressionLabel(status: string | null): string {
  switch (status) {
    case 'improved':
      return 'Improved';
    case 'degraded':
      return 'Degraded';
    default:
      return 'Stable';
  }
}

export default function DashboardView({ projects, recentScans, stats }: Props) {
  const { lang } = useLanguage();
  const t = strings[lang];

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t.dash_title}</h1>
          <p className="mt-1 text-sm text-gray-400">Projects and their latest point-in-time security trust state.</p>
        </div>
        <Link href="/new"
          className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-gray-700"
        >
          <Plus className="h-4 w-4" />
          {t.dash_new}
        </Link>
      </div>

      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatsCard title="Total Projects" value={stats.totalProjects} icon={FolderKanban} color="default" />
        <StatsCard title="Average Latest Score" value={stats.avgLatestScore ?? '—'} icon={Shield} color="blue" subtitle="Across latest completed scans" />
        <StatsCard title="Critical Projects" value={stats.projectsWithCriticalFindings} icon={TriangleAlert} color="red" subtitle="Latest scan contains critical findings" />
        <StatsCard title="Improved Recently" value={stats.improvedProjects} icon={TrendingUp} color="blue" subtitle="Latest scan shows improvement" />
        <StatsCard title="Degraded Recently" value={stats.degradedProjects} icon={TrendingDown} color="orange" subtitle="Latest scan shows regression" />
      </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white card-shadow">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-6 py-4">
          <div>
            <h2 className="font-semibold text-gray-900">Projects</h2>
            <p className="mt-1 text-sm text-gray-400">Latest evidence-driven trust and security state per owned project.</p>
          </div>
          <span className="text-sm text-gray-400">{projects.length} project{projects.length === 1 ? '' : 's'}</span>
        </div>

        {projects.length === 0 ? (
          <div className="flex flex-col items-center gap-4 bg-white py-20">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-gray-50">
              <FolderKanban className="h-5 w-5 text-gray-300" />
            </div>
            <p className="text-gray-400">{t.dash_empty}</p>
            <Link href="/new"
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900">
              {t.dash_empty_cta}
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 bg-[linear-gradient(180deg,#ffffff_0%,#fcfcfd_100%)]">
            {projects.map(project => {
              const latestScan = project.latestScan;
              const score = latestScan?.score ?? null;
              const grade = score != null ? gradeLabel(score) : null;
              const scoreLabel = score != null ? getScoreLabel(score, t) : 'Pending';
              const color = score != null ? scoreRingColor(score) : '#94A3B8';
              const criticalCount = latestScan?.vulnerabilities.filter(vulnerability => vulnerability.severity === 'critical').length ?? 0;
              const issueCount = latestScan?._count.vulnerabilities ?? 0;
              const ProjectTypeIcon = projectTypeIcon(project.projectType);
              const statusTone =
                score == null
                  ? 'border-slate-200 bg-slate-50 text-slate-600'
                  : score >= 90
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : score >= 70
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : score >= 50
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-red-200 bg-red-50 text-red-700';

              return (
                <div key={project.id} className="px-6 py-6">
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_420px] xl:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-start gap-4">
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 text-gray-600">
                          <ProjectTypeIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            {latestScan ? (
                              <Link
                                href={`/scan/${latestScan.id}`}
                                className="truncate text-xl font-semibold tracking-tight text-gray-900 transition-colors hover:text-gray-700"
                              >
                                {project.name}
                              </Link>
                            ) : (
                              <p className="truncate text-xl font-semibold tracking-tight text-gray-900">{project.name}</p>
                            )}
                            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-600">
                              {projectTypeLabel(project.projectType)}
                            </span>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${regressionStyle(latestScan?.regressionStatus ?? null)}`}>
                              {regressionLabel(latestScan?.regressionStatus ?? null)}
                            </span>
                            <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-500">
                              {project.visibility === 'public' ? 'Public' : 'Private'}
                            </span>
                            {project.monitoringEnabled && (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                                Monitoring
                              </span>
                            )}
                          </div>
                            <p className="mt-3 max-w-2xl text-sm text-gray-500">
                            {latestScan
                              ? 'Latest project security state based on the most recent automated scan result.'
                              : 'No scans yet. Start a scan to establish a public trust record for this project.'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Latest Status</p>
                          <p className="mt-2 text-sm font-semibold text-gray-900">{latestScan?.status ?? 'No scans yet'}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Last Scan</p>
                          <p className="mt-2 text-sm font-semibold text-gray-900">{latestScan ? formatDate(latestScan.createdAt, lang) : '—'}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Issues</p>
                          <p className="mt-2 text-sm font-semibold text-gray-900">{issueCount}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Critical</p>
                          <p className={`mt-2 text-sm font-semibold ${criticalCount > 0 ? 'text-red-600' : 'text-gray-900'}`}>{criticalCount}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-4">
                      <div className="grid gap-3 sm:grid-cols-[96px_96px_minmax(0,1fr)]">
                        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Score</p>
                          <p className="mt-2 text-4xl font-bold leading-none" style={{ color }}>{score ?? '—'}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Grade</p>
                          <p className="mt-2 text-4xl font-bold leading-none text-gray-900">{grade ?? '—'}</p>
                        </div>
                        <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white px-4 py-3">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Trust State</p>
                            <div className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${statusTone}`}>
                              {scoreLabel}
                            </div>
                          </div>
                          <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
                            <Activity className="h-3.5 w-3.5" />
                            Regression: <span className="font-semibold text-gray-600">{regressionLabel(latestScan?.regressionStatus ?? null)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        {latestScan ? (
                          <Link
                            href={`/scan/${latestScan.id}`}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
                          >
                            View Latest Scan
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        ) : (
                          <Link
                            href="/new"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
                          >
                            Start First Scan
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        )}
                        {project.publicSlug && project.visibility === 'public' && (
                          <Link
                            href={`/projects/${project.publicSlug}`}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900"
                          >
                            View Public Page
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        )}
                        {project.badgeEligible && project.publicSlug && project.visibility === 'public' && (
                          <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                            Badge Active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-10 overflow-hidden rounded-xl border border-gray-200 bg-white card-shadow">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/80 px-6 py-4">
          <div>
            <h2 className="font-semibold text-gray-900">Recent Scans</h2>
            <p className="mt-1 text-sm text-gray-400">Secondary detail for recent activity across your projects.</p>
          </div>
          <span className="text-sm text-gray-400">{recentScans.length} recent scan{recentScans.length === 1 ? '' : 's'}</span>
        </div>

        {recentScans.length === 0 ? (
          <div className="px-6 py-10 text-sm text-gray-400">No recent scans yet.</div>
        ) : (
          <div className="bg-white">
            {recentScans.map((scan, index) => (
              <ScanListItem key={scan.id} scan={scan} isLast={index === recentScans.length - 1} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-end">
        <Link
          href="/new"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
        >
          Start another scan
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
