'use client';

import { Activity, Calendar, ExternalLink, FileSearch, Globe, Shield, TrendingUp } from 'lucide-react';
import SeverityBadge from '@/components/SeverityBadge';
import { formatDate, scoreRingColor } from '@/lib/utils';

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
  repoUrl: string | null;
  websiteUrl: string | null;
  latestScan: VerificationScan & { vulnerabilities: VerificationVulnerability[] };
  scans: VerificationScan[];
}

function getScoreLabel(score: number) {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Poor';
  return 'Critical Risk';
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

export default function ProjectVerificationView({ project }: { project: VerificationProject }) {
  const latestScan = project.latestScan;
  const latestScore = latestScan.score ?? 0;
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
  const publicSourceUrl = project.projectType === 'website' ? project.websiteUrl : project.repoUrl;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 card-shadow">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
              Public Verification
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900">{project.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-500">
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5">
                <Shield className="h-4 w-4 text-gray-400" />
                {projectTypeLabel(project.projectType)}
              </span>
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                Last scan {formatDate(latestScan.createdAt, 'en')}
              </span>
            </div>
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-gray-600">
              This public page shows Almond teAI&apos;s latest automated security verification record for this project.
              It is intended to improve transparency and trust, not to guarantee absolute security.
            </p>
            {publicSourceUrl && (
              <a
                href={publicSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
              >
                <ExternalLink className="h-4 w-4" />
                View source
              </a>
            )}
          </div>

          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <p className="text-sm text-gray-500">Latest security score</p>
            <div className="mt-3 flex items-end gap-3">
              <span className="text-5xl font-bold" style={{ color: latestColor }}>{latestScore}</span>
              <span className="pb-2 text-sm text-gray-400">/ 100</span>
            </div>
            <p className="mt-2 text-sm font-semibold" style={{ color: latestColor }}>{latestScoreLabel}</p>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-gray-400">Latest scan type</p>
                <p className="mt-1 font-semibold text-gray-900">{projectTypeLabel(project.projectType)}</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-gray-400">Critical findings</p>
                <p className="mt-1 font-semibold text-gray-900">{criticalCount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-6 card-shadow">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Latest score</p>
            <Shield className="h-5 w-5 text-gray-400" />
          </div>
          <p className="mt-2 text-3xl font-bold" style={{ color: latestColor }}>{latestScore}</p>
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
              className="grid gap-3 bg-white px-4 py-4 text-sm sm:grid-cols-[1.1fr_0.6fr_0.7fr_0.7fr]"
              style={{ borderBottom: index === project.scans.length - 1 ? 'none' : '1px solid #F3F4F6' }}
            >
              <div>
                <p className="font-medium text-gray-900">{formatDate(scan.createdAt, 'en')}</p>
                <p className="mt-1 text-xs text-gray-400">{scan.status === 'completed' ? 'Completed' : scan.status}</p>
              </div>
              <div>
                <p className="text-gray-400">Score</p>
                <p className="mt-1 font-semibold text-gray-900">{scan.score ?? '—'}</p>
              </div>
              <div>
                <p className="text-gray-400">Type</p>
                <p className="mt-1 font-semibold text-gray-900">{scan.scanType}</p>
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
