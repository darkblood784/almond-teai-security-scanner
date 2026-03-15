'use client';

import { Activity, BadgeCheck, Calendar, ExternalLink, FileSearch, Globe, Shield, TrendingUp } from 'lucide-react';
import SeverityBadge from '@/components/SeverityBadge';
import { formatDate, scoreRingColor } from '@/lib/utils';
import { gradeLabel, scoreStatusKey } from '@/lib/scoring';

interface VerificationVulnerability {
  id: string;
  type: string;
  severity: string;
  file: string;
  line: number | null;
  description: string;
}

interface VerificationScan {
  id: string;
  createdAt: Date | string;
  status: string;
  score: number | null;
  scanType: string;
  summary: string | null;
  repoName: string | null;
  fileName: string | null;
  websiteUrl: string | null;
  vulnerabilities?: VerificationVulnerability[];
  _count?: { vulnerabilities: number };
}

interface VerificationProject {
  id: string;
  name: string;
  projectType: string;
  publicSlug: string | null;
  badgeEligible: boolean;
  repoUrl: string | null;
  websiteUrl: string | null;
  latestScan: VerificationScan & { vulnerabilities: VerificationVulnerability[] };
  scans: VerificationScan[];
}

function getScoreLabel(score: number) {
  const key = scoreStatusKey(score);
  switch (key) {
    case 'excellent': return 'Excellent';
    case 'good': return 'Good';
    case 'fair': return 'Fair';
    case 'poor': return 'Poor';
    default: return 'Critical Risk';
  }
}

function projectTypeLabel(projectType: string) {
  switch (projectType) {
    case 'github':
      return 'GitHub Repository';
    case 'website':
      return 'Website';
    case 'upload':
      return 'Uploaded Codebase';
    default:
      return 'Project';
  }
}

function severityRank(severity: string) {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[severity.toLowerCase()] ?? 5;
}

function scanTypeLabel(scanType: string) {
  switch (scanType) {
    case 'github':
      return 'Repository scan';
    case 'website':
      return 'Website scan';
    case 'upload':
      return 'Uploaded code scan';
    default:
      return 'Automated scan';
  }
}

export default function ProjectVerificationView({ project }: { project: VerificationProject }) {
  const latestScan = project.latestScan;
  const latestScore = latestScan.score ?? 0;
  const latestGrade = gradeLabel(latestScore);
  const latestColor = scoreRingColor(latestScore);
  const latestScoreLabel = getScoreLabel(latestScore);

  const completedScans = project.scans
    .filter(scan => scan.status === 'completed' && scan.score != null)
    .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

  const trendScans = completedScans.slice(-6);
  const previousScore = trendScans.length > 1 ? trendScans[trendScans.length - 2].score : null;
  const scoreDelta = previousScore != null && latestScan.score != null
    ? latestScan.score - previousScore
    : null;

  const topFindings = [...latestScan.vulnerabilities]
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, 5);

  const avgRecentScore = completedScans.length
    ? Math.round(completedScans.reduce((sum, scan) => sum + (scan.score ?? 0), 0) / completedScans.length)
    : null;

  const criticalCount = latestScan.vulnerabilities.filter(v => v.severity === 'critical').length;
  const issueCount = latestScan.vulnerabilities.length;
  const publicSourceUrl = project.projectType === 'website' ? project.websiteUrl : project.repoUrl;
  const badgeUrl = project.badgeEligible && project.publicSlug ? `/api/badge/${project.publicSlug}` : null;
  const latestIssueSummary = criticalCount > 0
    ? `${criticalCount} critical finding${criticalCount === 1 ? '' : 's'} require attention.`
    : issueCount > 0
    ? `${issueCount} non-critical finding${issueCount === 1 ? '' : 's'} were detected in the latest scan.`
    : 'No vulnerabilities were detected in the latest public scan.';

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-8 card-shadow">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <BadgeCheck className="h-4 w-4 text-emerald-600" />
              Almond teAI Verification Record
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950">{project.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                <Shield className="h-4 w-4 text-slate-400" />
                {projectTypeLabel(project.projectType)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                <Calendar className="h-4 w-4 text-slate-400" />
                Last verified {formatDate(latestScan.createdAt, 'en')}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                <Activity className="h-4 w-4 text-slate-400" />
                {scanTypeLabel(latestScan.scanType)}
              </span>
            </div>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-600">
              This page is Almond teAI&apos;s public trust record for the latest automated verification of this project.
              It gives customers, partners, and reviewers a clear snapshot of current posture, recent scan history, and surfaced findings.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Verification status</p>
                <p className="mt-2 text-xl font-bold" style={{ color: latestColor }}>{latestScoreLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Latest score</p>
                <p className="mt-2 text-xl font-bold text-slate-900">{latestScore} / 100</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Latest finding summary</p>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-700">{latestIssueSummary}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {publicSourceUrl && (
                <a
                  href={publicSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900"
                >
                  <ExternalLink className="h-4 w-4" />
                  {project.projectType === 'website' ? 'Visit website' : 'View source'}
                </a>
              )}
              {project.publicSlug && (
                <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-500">
                  Public slug
                  <span className="font-mono text-slate-700">{project.publicSlug}</span>
                </span>
              )}
            </div>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Trust badge</p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {badgeUrl ? (
                <img src={badgeUrl} alt="Almond teAI trust badge" className="h-[74px] w-[332px] max-w-full" />
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                  Public trust badge is not enabled for this project yet.
                </div>
              )}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-slate-400">Grade</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{latestGrade}</p>
              </div>
              <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-slate-400">Score</p>
                <div className="mt-1 flex items-end gap-2">
                  <span className="text-4xl font-bold" style={{ color: latestColor }}>{latestScore}</span>
                  <span className="pb-1 text-sm text-slate-400">/ 100</span>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-slate-400">Scan type</p>
                <p className="mt-1 font-semibold text-slate-900">{scanTypeLabel(latestScan.scanType)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-slate-400">Critical findings</p>
                <p className="mt-1 font-semibold text-slate-900">{criticalCount}</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-4">
              <p className="text-sm font-semibold text-emerald-800">Professional trust snapshot</p>
              <p className="mt-1 text-sm leading-relaxed text-emerald-900/80">
                Share this page as a living verification record for due diligence, partner review, or investor checks.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-6 card-shadow">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Latest grade</p>
            <Shield className="h-5 w-5 text-gray-400" />
          </div>
          <p className="mt-2 text-3xl font-bold" style={{ color: latestColor }}>{latestGrade}</p>
          <p className="mt-1 text-sm text-gray-500">Score {latestScore} / 100</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 card-shadow">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Public scans</p>
            <FileSearch className="h-5 w-5 text-gray-400" />
          </div>
          <p className="mt-2 text-3xl font-bold text-gray-900">{project.scans.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 card-shadow">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Average score</p>
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </div>
          <p className="mt-2 text-3xl font-bold text-gray-900">{avgRecentScore ?? '—'}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 card-shadow">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Latest findings</p>
            <Activity className="h-5 w-5 text-gray-400" />
          </div>
          <p className="mt-2 text-3xl font-bold text-gray-900">{latestScan.vulnerabilities.length}</p>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-xl border border-gray-200 bg-white p-6 card-shadow">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Top findings</h2>
              <p className="mt-1 text-sm text-gray-500">Highest-severity issues from the latest completed scan.</p>
            </div>
          </div>

          {topFindings.length === 0 ? (
            <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-5">
              <p className="text-sm font-medium text-green-700">No vulnerabilities were detected in the latest public scan.</p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {topFindings.map(finding => (
                <div key={finding.id} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <SeverityBadge severity={finding.severity} />
                    <p className="font-semibold text-gray-900">{finding.type}</p>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{finding.description}</p>
                  <p className="mt-2 text-xs font-mono text-gray-400">
                    {finding.file}{finding.line ? `:${finding.line}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 card-shadow">
          <h2 className="text-lg font-bold text-gray-900">Score trend</h2>
          <p className="mt-1 text-sm text-gray-500">Recent completed scans for this project.</p>

          {trendScans.length === 0 ? (
            <p className="mt-5 text-sm text-gray-500">No completed scan history is available yet.</p>
          ) : (
            <>
              <div className="mt-6 flex h-40 items-end gap-3">
                {trendScans.map(scan => {
                  const score = scan.score ?? 0;
                  const height = Math.max(16, Math.round(score * 1.2));
                  return (
                    <div key={scan.id} className="flex flex-1 flex-col items-center gap-2">
                      <div
                        className="w-full rounded-t-lg"
                        style={{ height, backgroundColor: scoreRingColor(score) }}
                      />
                      <span className="text-xs font-semibold text-gray-700">{score}</span>
                      <span className="text-[11px] text-gray-400">
                        {new Date(scan.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                <p className="text-sm text-gray-500">Latest movement</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {scoreDelta == null
                    ? 'This is the first completed public scan in the recent history window.'
                    : scoreDelta === 0
                    ? 'No score change from the previous completed scan.'
                    : `Score ${scoreDelta > 0 ? 'improved' : 'declined'} by ${Math.abs(scoreDelta)} points from the previous completed scan.`}
                </p>
              </div>
            </>
          )}
        </section>
      </div>

      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 card-shadow">
        <h2 className="text-lg font-bold text-gray-900">Scan history summary</h2>
        <p className="mt-1 text-sm text-gray-500">Recent public verification records for this project.</p>

        <div className="mt-5 overflow-hidden rounded-xl border border-gray-200">
          {project.scans.map((scan, index) => (
            <div
              key={scan.id}
              className="grid gap-3 bg-white px-4 py-4 text-sm sm:grid-cols-[1.1fr_0.5fr_0.6fr_0.7fr_0.7fr]"
              style={{ borderBottom: index === project.scans.length - 1 ? 'none' : '1px solid #F3F4F6' }}
            >
              <div>
                <p className="font-medium text-gray-900">{formatDate(scan.createdAt, 'en')}</p>
                <p className="mt-1 text-xs text-gray-400">{scan.status === 'completed' ? 'Completed' : scan.status}</p>
              </div>
              <div>
                <p className="text-gray-400">Grade</p>
                <p className="mt-1 font-semibold text-gray-900">{scan.score != null ? gradeLabel(scan.score) : '—'}</p>
              </div>
              <div>
                <p className="text-gray-400">Score</p>
                <p className="mt-1 font-semibold text-gray-900">{scan.score ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-400">Type</p>
                <p className="mt-1 font-semibold text-gray-900">{scanTypeLabel(scan.scanType)}</p>
              </div>
              <div>
                <p className="text-gray-400">Issues</p>
                <p className="mt-1 font-semibold text-gray-900">{scan._count?.vulnerabilities ?? scan.vulnerabilities?.length ?? 0}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-6">
        <div className="flex items-start gap-3">
          <Globe className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Public trust record</h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              Almond teAI publishes this page as a transparent record of recent automated security scans for this project.
              It helps users, partners, and investors review current security posture over time, but it should be used alongside manual review and deeper testing.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
