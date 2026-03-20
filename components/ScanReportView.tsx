'use client';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Download, Bot, ExternalLink, Calendar, FileCode, Hash, ShieldAlert, Globe, CheckCircle2 } from 'lucide-react';
import ScoreCard from '@/components/ScoreCard';
import VulnerabilityTable from '@/components/VulnerabilityTable';
import { formatDate } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { strings } from '@/lib/i18n';
import { gradeLabel, scoreStatusKey } from '@/lib/scoring';
import { buildScoreDrivers } from '@/lib/score-drivers';
import { getPlanEntitlements } from '@/lib/entitlements';
import type { Scan, Vulnerability } from '@prisma/client';

type ScanCoverageFields = {
  filesSkipped?: number;
  filesSkippedBySize?: number;
  filesSkippedByType?: number;
  dependencyAnalysisComplete?: boolean;
  dependencyWarning?: string | null;
  coverageNotes?: string | null;
  safeVerificationOnly?: boolean;
  networkChecksPartial?: boolean;
};

type ScanWithVulns = Scan & ScanCoverageFields & {
  vulnerabilities: Vulnerability[];
  project?: {
    id: string;
    visibility: string;
    badgeEligible: boolean;
    monitoringEnabled: boolean;
    publicSlug: string | null;
    owner?: {
      plan: string;
    } | null;
  } | null;
};

interface ScanReportViewProps {
  scan: ScanWithVulns;
  allowFixesForFree?: boolean;
  fixUsage?: {
    period: string;
    used: number;
    limit: number;
    remaining: number;
  } | null;
}

function badgeGradeColor(grade: string): string {
  switch (grade) {
    case 'A':
      return 'bg-green-700';
    case 'B':
      return 'bg-blue-600';
    case 'C':
      return 'bg-amber-600';
    case 'D':
      return 'bg-orange-600';
    default:
      return 'bg-red-600';
  }
}

function badgeStatusLabel(score: number, t: typeof strings['en']) {
  const key = scoreStatusKey(score);
  switch (key) {
    case 'excellent': return t.score_excellent;
    case 'good': return t.score_good;
    case 'fair': return t.score_fair;
    case 'poor': return t.score_poor;
    default: return t.score_critical;
  }
}

function regressionStatusStyle(status: string) {
  switch (status) {
    case 'improved':
      return 'border-green-200 bg-green-50 text-green-700';
    case 'degraded':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

function regressionStatusLabel(status: string, t: typeof strings['en']) {
  switch (status) {
    case 'improved':
      return t.regression_improved;
    case 'degraded':
      return t.regression_degraded;
    default:
      return t.regression_stable;
  }
}

function coverageStatusLabel(complete: boolean) {
  return complete ? 'Complete' : 'Incomplete';
}

function yesNoLabel(value: boolean) {
  return value ? 'Yes' : 'No';
}

function parseWebsiteCoverageMetadata(notes: string[]) {
  const profileNote = notes.find(note => note.startsWith('Selected scan profile:'));
  const validationNote = notes.find(note => note.startsWith('Limited active validation:'));

  return {
    profile: profileNote ? profileNote.replace('Selected scan profile:', '').trim().replace(/\.$/, '') : null,
    activeValidation: validationNote ? validationNote.replace('Limited active validation:', '').trim().replace(/\.$/, '') : null,
  };
}

function LocalBadgePreview({ score, createdAt, status }: { score: number; createdAt: Date | string; status: string }) {
  const grade = gradeLabel(score);
  const date = new Date(createdAt).toISOString().slice(0, 10);

  return (
    <div className="relative h-[74px] w-[332px] overflow-hidden rounded-[14px] border border-gray-200 bg-white shadow-sm">
      <div className="absolute left-4 top-[14px] h-10 w-[190px] rounded-[11px] bg-slate-900" />
      <div className={`absolute left-[214px] top-[14px] flex h-10 w-[102px] items-center justify-center rounded-[11px] text-white ${badgeGradeColor(grade)}`}>
        <div className="text-center">
          <div className="text-[21px] font-bold leading-none">{score}</div>
          <div className="mt-1 text-[10.5px] font-bold uppercase leading-none text-orange-50">Grade {grade}</div>
        </div>
      </div>
      <div className="absolute left-6 top-[22px] overflow-hidden rounded-md border border-white/10 bg-slate-800 shadow-sm">
        <Image
          src="/branding/logo-mark.svg"
          alt="Almond teAI"
          width={18}
          height={18}
          className="h-[18px] w-[18px]"
        />
      </div>
      <div className="absolute left-12 top-[24px] text-[13px] font-bold leading-none text-white">Almond teAI</div>
      <div className="absolute left-12 top-[37px] text-[10.5px] font-semibold leading-none text-slate-300">Latest scan posture</div>
      <div className="absolute left-4 top-[58px] text-[10.5px] font-semibold text-slate-500">Status {status}</div>
      <div className="absolute right-4 top-[58px] text-[10.5px] font-semibold text-slate-500">Last scan {date}</div>
    </div>
  );
}

export default function ScanReportView({ scan, allowFixesForFree = false, fixUsage = null }: ScanReportViewProps) {
  const { lang } = useLanguage();
  const t = strings[lang];
  const [visibility, setVisibility] = useState(scan.project?.visibility ?? 'private');
  const [savedVisibility, setSavedVisibility] = useState(scan.project?.visibility ?? 'private');
  const [badgeEligible, setBadgeEligible] = useState(scan.project?.badgeEligible ?? false);
  const [savedBadgeEligible, setSavedBadgeEligible] = useState(scan.project?.badgeEligible ?? false);
  const [monitoringEnabled, setMonitoringEnabled] = useState(scan.project?.monitoringEnabled ?? false);
  const [saving, setSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedType, setCopiedType] = useState<'markdown' | 'html' | null>(null);

  async function saveProjectSettings() {
    if (!scan.project?.id) return;

    setSaving(true);
    setSettingsMessage(null);

    try {
      const res = await fetch(`/api/projects/${scan.project.id}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visibility,
          badgeEligible,
          monitoringEnabled,
        }),
      });

      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setSettingsMessage({ type: 'error', text: data.error ?? 'Failed to save project settings.' });
      } else {
        setSavedVisibility(visibility);
        setSavedBadgeEligible(badgeEligible);
        setSettingsMessage({ type: 'success', text: 'Project settings saved.' });
      }
    } catch {
      setSettingsMessage({ type: 'error', text: 'Network error while saving settings.' });
    } finally {
      setSaving(false);
    }
  }

  if (scan.status !== 'completed') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-gray-100" />
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-gray-200 bg-white">
            <ShieldAlert className="h-7 w-7 text-gray-400" />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {scan.status === 'failed' ? t.report_failed_h : t.report_scanning_h}
          </h2>
          <p className="mt-2 text-gray-400">
            {scan.status === 'failed'
              ? (scan.errorMessage ?? t.report_failed_p)
              : t.report_scanning_p}
          </p>
        </div>
        {scan.status !== 'failed' && <meta httpEquiv="refresh" content="3" />}
        <Link href="/dashboard" className="text-sm text-gray-400 underline hover:text-gray-900">
          {t.report_back}
        </Link>
      </div>
    );
  }

  const vulns = scan.vulnerabilities;
  const publicSlug = scan.project?.publicSlug;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';
  const badgeUrl = publicSlug ? (appUrl ? `${appUrl}/api/badge/${publicSlug}` : `/api/badge/${publicSlug}`) : null;
  const projectUrl = publicSlug ? (appUrl ? `${appUrl}/projects/${publicSlug}` : `/projects/${publicSlug}`) : null;
  const markdownEmbed = badgeUrl && projectUrl
    ? `[![Almond teAI verified](${badgeUrl})](${projectUrl})`
    : '';
  const htmlEmbed = badgeUrl && projectUrl
    ? `<a href="${projectUrl}"><img src="${badgeUrl}" alt="Almond teAI latest scan badge" /></a>`
    : '';
  const counts = {
    critical: vulns.filter(v => v.severity === 'critical').length,
    high: vulns.filter(v => v.severity === 'high').length,
    medium: vulns.filter(v => v.severity === 'medium').length,
    low: vulns.filter(v => v.severity === 'low').length,
  };
  const badgeStatus = badgeStatusLabel(scan.score ?? 0, t);
  const showRegression = Boolean(scan.previousScanId && scan.regressionStatus && scan.regressionSummary);
  const deltaValue = scan.scoreDelta ?? 0;
  const deltaText = `${deltaValue > 0 ? '+' : ''}${deltaValue}`;
  const badgeActive = savedVisibility === 'public' && savedBadgeEligible;
  const badgeGrade = gradeLabel(scan.score ?? 0);
  const badgeLastVerified = formatDate(scan.createdAt, lang);
  const badgePublishState = badgeActive
    ? 'Live and embeddable (latest scan)'
    : savedVisibility !== 'public'
    ? 'Waiting for public visibility'
    : savedBadgeEligible
    ? 'Pending plan access'
    : 'Waiting for badge eligibility';
  const coverageNotes = (scan.coverageNotes ?? '')
    .split('\n')
    .map((note: string) => note.trim())
    .filter(Boolean);
  const websiteCoverage = parseWebsiteCoverageMetadata(coverageNotes);
  const scoreDrivers = buildScoreDrivers(scan.scanType as 'github' | 'upload' | 'website', vulns);
  const isWebsiteScan = scan.scanType === 'website';
  const entitlements = getPlanEntitlements(scan.project?.owner?.plan);
  const isFreePlan = !entitlements.cleanPdf;
  const userPlan = scan.project?.owner?.plan ?? 'free';

  async function copyEmbed(type: 'markdown' | 'html') {
    const value = type === 'markdown' ? markdownEmbed : htmlEmbed;
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopiedType(type);
      window.setTimeout(() => {
        setCopiedType(current => current === type ? null : current);
      }, 2000);
    } catch {
      setCopiedType(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.report_back}
        </Link>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            {scan.scanType === 'website' && scan.websiteUrl && (
              <a
                href={scan.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900"
              >
                <ExternalLink className="h-4 w-4" />
                {t.report_view_website}
              </a>
            )}
            {scan.scanType !== 'website' && scan.repoUrl && (
              <a
                href={scan.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900"
              >
                <ExternalLink className="h-4 w-4" />
                {t.report_view_repo}
              </a>
            )}
            <a
              href={`/api/report/${scan.id}`}
              className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
            >
              <Download className="h-4 w-4" />
              {t.report_download}
            </a>
          </div>
          <p className="text-right text-xs text-gray-500">
            {isFreePlan
              ? 'Free plan exports are watermarked. Upgrade to Pro for clean PDF and certificate export.'
              : 'Pro plan includes clean PDF export and certificate export when available.'}
          </p>
        </div>
      </div>

      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">
            {scan.scanType === 'website'
              ? (scan.websiteUrl ?? t.report_unnamed)
              : (scan.repoName ?? scan.fileName ?? t.report_unnamed)}
          </h1>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
            scan.scanType === 'website'
              ? 'border-blue-200 bg-blue-50 text-blue-700'
              : 'border-gray-200 bg-gray-50 text-gray-600'
          }`}>
            {scan.scanType === 'website'
              ? <><Globe className="h-3.5 w-3.5" />{t.report_website_scan}</>
              : <><FileCode className="h-3.5 w-3.5" />{t.report_code_scan}</>
            }
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-6 text-sm text-gray-400">
          <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />{formatDate(scan.createdAt, lang)}</span>
          {scan.scanType === 'website' ? (
            <>
              <span className="flex items-center gap-1.5">
                <Hash className="h-4 w-4" />{scan.totalFiles} {t.report_checks_run}
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-green-500" />{scan.scannedFiles} {t.report_checks_passed}
              </span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5"><FileCode className="h-4 w-4" />{scan.scannedFiles} {t.report_files}</span>
              <span className="flex items-center gap-1.5"><Hash className="h-4 w-4" />{scan.linesScanned.toLocaleString()} {t.report_lines}</span>
            </>
          )}
        </div>
      </div>

      <div className="mb-8">
        <ScoreCard
          score={scan.score ?? 0}
          totalFiles={scan.totalFiles}
          linesScanned={scan.linesScanned}
          repoName={scan.repoName ?? scan.fileName}
          counts={counts}
        />
      </div>

      {showRegression && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 card-shadow">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">{t.regression_title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-700">{scan.regressionSummary}</p>
            </div>
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${regressionStatusStyle(scan.regressionStatus ?? 'stable')}`}>
              {regressionStatusLabel(scan.regressionStatus ?? 'stable', t)}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{t.regression_prev_score}</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{scan.previousScore ?? '-'}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{t.regression_curr_score}</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{scan.score ?? '-'}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{t.regression_delta}</p>
              <p className={`mt-1 text-xl font-bold ${deltaValue > 0 ? 'text-green-700' : deltaValue < 0 ? 'text-amber-700' : 'text-slate-700'}`}>{deltaText}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{t.regression_new}</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{scan.newFindingsCount}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{t.regression_resolved}</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{scan.resolvedFindingsCount}</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{t.regression_unchanged}</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{scan.unchangedFindingsCount}</p>
            </div>
          </div>
        </div>
      )}

      {scan.summary && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 card-shadow">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">{t.report_summary}</h2>
          <p className="text-gray-700">{scan.summary}</p>
        </div>
      )}

      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 card-shadow">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Why this score?</h2>
            <p className="mt-1 text-sm text-gray-500">
              Short explanation of the main factors that influenced this scan score.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            Score drivers
          </span>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm leading-relaxed text-slate-700">{scoreDrivers.summary}</p>
        </div>

        <div className="mt-5 space-y-3">
          {scoreDrivers.drivers.map((driver: string) => (
            <div key={driver} className="flex gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-500" />
              <p className="text-sm leading-relaxed text-gray-700">{driver}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 card-shadow">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Coverage Notes</h2>
            <p className="mt-1 text-sm text-gray-500">
              Coverage and completeness details for this scan run.
            </p>
          </div>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
            coverageNotes.length > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-green-200 bg-green-50 text-green-700'
          }`}>
            {coverageNotes.length > 0 ? 'Partial coverage notes present' : 'No notable coverage limits'}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isWebsiteScan ? (
            <>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Checks run</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{scan.totalFiles}</p>
              </div>
              {websiteCoverage.profile && (
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Selected profile</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{websiteCoverage.profile}</p>
                </div>
              )}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Checks passed</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{scan.scannedFiles}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Sensitive paths probed</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{scan.linesScanned}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Safe verification only</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{yesNoLabel(scan.safeVerificationOnly ?? false)}</p>
              </div>
              {websiteCoverage.activeValidation && (
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Active validation</p>
                  <p className="mt-1 text-base font-bold text-gray-900">{websiteCoverage.activeValidation}</p>
                </div>
              )}
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Network checks partial</p>
                <p className={`mt-1 text-xl font-bold ${scan.networkChecksPartial ?? false ? 'text-amber-700' : 'text-gray-900'}`}>
                  {yesNoLabel(scan.networkChecksPartial ?? false)}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Files scanned</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{scan.scannedFiles}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Files skipped</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{scan.filesSkipped ?? 0}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Skipped by size</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{scan.filesSkippedBySize ?? 0}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Skipped by type</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{scan.filesSkippedByType ?? 0}</p>
              </div>
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Dependency analysis</p>
                <p className={`mt-1 text-xl font-bold ${scan.dependencyAnalysisComplete ?? true ? 'text-green-700' : 'text-amber-700'}`}>
                  {coverageStatusLabel(scan.dependencyAnalysisComplete ?? true)}
                </p>
              </div>
            </>
          )}
          {!isWebsiteScan && scan.dependencyWarning && (
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 xl:col-span-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Dependency warning</p>
              <p className="mt-1 text-sm text-amber-800">{scan.dependencyWarning}</p>
            </div>
          )}
        </div>

        {coverageNotes.length > 0 && (
          <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4">
            <div className="space-y-3">
              {coverageNotes.map((note: string) => (
                <div key={note} className="flex gap-3 text-sm text-amber-900">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  <p className="leading-relaxed">{note}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {publicSlug && badgeUrl && projectUrl && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 card-shadow">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">{t.badge_title}</h2>
          <p className="mt-1 text-sm text-gray-500">{t.badge_desc}</p>
          {!entitlements.trustBadge && (
            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-sm leading-relaxed text-amber-800">
                Trust badges are available on Pro. Free projects can still publish a public verification page, but badge embeds remain locked.
              </p>
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-50 p-5">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-center">
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  <CheckCircle2 className="h-4 w-4" />
                  {t.badge_preview_note}
                </div>
                {badgeActive ? (
                  <a href={projectUrl} target="_blank" rel="noopener noreferrer">
                    <img src={badgeUrl} alt="Almond teAI latest scan badge" className="h-[74px] w-[332px]" />
                  </a>
                ) : (
                  <LocalBadgePreview score={scan.score ?? 0} createdAt={scan.createdAt} status={badgeStatus} />
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Latest score</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {scan.score ?? '-'}
                    <span className="ml-2 text-sm font-semibold text-slate-400">Grade {badgeGrade}</span>
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Risk level</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{badgeStatus}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Last scan</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{badgeLastVerified}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${badgeActive ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                {badgePublishState}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-slate-500">
                <Globe className="h-4 w-4" />
                Public verification page
              </span>
              <a
                href={projectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-4 hover:text-slate-900"
              >
                Open verification page
              </a>
            </div>
            {!badgeActive && (
              <p className="mt-3 text-sm text-gray-500">
                {savedVisibility !== 'public'
                  ? t.badge_unavailable
                  : 'Enable badge eligibility to publish the live trust badge.'}
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={() => copyEmbed('markdown')}
              disabled={!badgeActive}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copiedType === 'markdown' ? t.badge_copied : t.badge_copy_markdown}
            </button>
            <button
              onClick={() => copyEmbed('html')}
              disabled={!badgeActive}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copiedType === 'html' ? t.badge_copied : t.badge_copy_html}
            </button>
          </div>
        </div>
      )}

      {scan.project?.id && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 card-shadow">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Project Settings</h2>
              <p className="mt-1 text-sm text-gray-500">Internal-only trust controls for this project.</p>
            </div>
            {scan.project.publicSlug && visibility === 'public' && (
              <Link
                href={`/projects/${scan.project.publicSlug}`}
                className="text-sm font-medium text-gray-600 underline hover:text-gray-900"
              >
                View public page
              </Link>
            )}
          </div>

          <div className="mt-5">
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700">Visibility</label>
              <select
                value={visibility}
                onChange={e => setVisibility(e.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-300"
              >
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={badgeEligible}
                onChange={e => setBadgeEligible(e.target.checked)}
                disabled={!entitlements.trustBadge}
                className="h-4 w-4 rounded border-gray-300"
              />
              Badge eligible
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={monitoringEnabled}
                onChange={e => setMonitoringEnabled(e.target.checked)}
                disabled={!entitlements.continuousMonitoring}
                className="h-4 w-4 rounded border-gray-300"
              />
              Monitoring enabled
            </label>
          </div>

          {(!entitlements.trustBadge || !entitlements.continuousMonitoring) && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm leading-relaxed text-slate-700">
                {entitlements.trustBadge
                  ? 'Continuous monitoring is available on Pro.'
                  : entitlements.continuousMonitoring
                  ? 'Trust badge publishing is available on Pro.'
                  : 'Trust badge publishing and continuous monitoring are available on Pro.'}
              </p>
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={saveProjectSettings}
              disabled={saving}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>

            {settingsMessage && (
              <p className={`text-sm ${settingsMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {settingsMessage.text}
              </p>
            )}
          </div>
        </div>
      )}

      {scan.aiSummary && (
        <div className="mb-8 rounded-xl border border-blue-100 bg-blue-50 p-6">
          <div className="mb-3 flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">{t.report_ai}</h2>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-blue-800">{scan.aiSummary}</p>
        </div>
      )}

      <div>
        <h2 className="mb-5 text-xl font-bold text-gray-900">
          {t.report_vuln_title}
          {vulns.length > 0 && (
            <span className="ml-2 text-base font-normal text-gray-400">{t.report_vuln_found(vulns.length)}</span>
          )}
        </h2>
        <VulnerabilityTable
          vulnerabilities={vulns}
          userPlan={userPlan}
          allowFixesForFree={allowFixesForFree}
          fixUsage={fixUsage ?? undefined}
        />
      </div>

      <div className="mt-10 rounded-xl border border-gray-100 bg-gray-50 p-5">
        <p className="text-center text-xs leading-relaxed text-gray-400">
          <strong className="text-gray-500">Almond teAI</strong> - {t.report_disclaimer}
        </p>
      </div>
    </div>
  );
}
