'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Bot, ExternalLink, Calendar, FileCode, Hash, ShieldAlert, Globe, CheckCircle2 } from 'lucide-react';
import ScoreCard from '@/components/ScoreCard';
import VulnerabilityTable from '@/components/VulnerabilityTable';
import { formatDate } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { strings } from '@/lib/i18n';
import type { Scan, Vulnerability } from '@prisma/client';

type ScanWithVulns = Scan & {
  vulnerabilities: Vulnerability[];
  project?: {
    id: string;
    visibility: string;
    badgeEligible: boolean;
    monitoringEnabled: boolean;
    publicSlug: string | null;
  } | null;
};

export default function ScanReportView({ scan }: { scan: ScanWithVulns }) {
  const { lang } = useLanguage();
  const t = strings[lang];
  const [visibility, setVisibility] = useState(scan.project?.visibility ?? 'private');
  const [badgeEligible, setBadgeEligible] = useState(scan.project?.badgeEligible ?? false);
  const [monitoringEnabled, setMonitoringEnabled] = useState(scan.project?.monitoringEnabled ?? false);
  const [adminToken, setAdminToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function saveProjectSettings() {
    if (!scan.project?.id) return;

    setSaving(true);
    setSettingsMessage(null);

    try {
      const res = await fetch(`/api/projects/${scan.project.id}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: adminToken,
          visibility,
          badgeEligible,
          monitoringEnabled,
        }),
      });

      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setSettingsMessage({ type: 'error', text: data.error ?? 'Failed to save project settings.' });
      } else {
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
  const counts = {
    critical: vulns.filter(v => v.severity === 'critical').length,
    high:     vulns.filter(v => v.severity === 'high').length,
    medium:   vulns.filter(v => v.severity === 'medium').length,
    low:      vulns.filter(v => v.severity === 'low').length,
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">

      {/* Top bar */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Link href="/dashboard"
          className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.report_back}
        </Link>

        <div className="flex items-center gap-3">
          {scan.scanType === 'website' && scan.websiteUrl && (
            <a href={scan.websiteUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900"
            >
              <ExternalLink className="h-4 w-4" />
              {t.report_view_website}
            </a>
          )}
          {scan.scanType !== 'website' && scan.repoUrl && (
            <a href={scan.repoUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-900"
            >
              <ExternalLink className="h-4 w-4" />
              {t.report_view_repo}
            </a>
          )}
          <a href={`/api/report/${scan.id}`}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
          >
            <Download className="h-4 w-4" />
            {t.report_download}
          </a>
        </div>
      </div>

      {/* Scan meta */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">
            {scan.scanType === 'website'
              ? (scan.websiteUrl ?? t.report_unnamed)
              : (scan.repoName ?? scan.fileName ?? t.report_unnamed)}
          </h1>
          {/* Scan type badge */}
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

      {/* Score card */}
      <div className="mb-8">
        <ScoreCard
          score={scan.score ?? 0}
          totalFiles={scan.totalFiles}
          linesScanned={scan.linesScanned}
          repoName={scan.repoName ?? scan.fileName}
          counts={counts}
        />
      </div>

      {/* Summary */}
      {scan.summary && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-6 card-shadow">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">{t.report_summary}</h2>
          <p className="text-gray-700">{scan.summary}</p>
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

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
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

            <div>
              <label className="block text-sm font-medium text-gray-700">Internal admin token</label>
              <input
                type="password"
                value={adminToken}
                onChange={e => setAdminToken(e.target.value)}
                placeholder="Enter INTERNAL_ADMIN_TOKEN"
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={badgeEligible}
                onChange={e => setBadgeEligible(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Badge eligible
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={monitoringEnabled}
                onChange={e => setMonitoringEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              Monitoring enabled
            </label>
          </div>

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

      {/* AI Analysis */}
      {scan.aiSummary && (
        <div className="mb-8 rounded-xl border border-blue-100 bg-blue-50 p-6">
          <div className="mb-3 flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-600">{t.report_ai}</h2>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-blue-800">{scan.aiSummary}</p>
        </div>
      )}

      {/* Vulnerability list */}
      <div>
        <h2 className="mb-5 text-xl font-bold text-gray-900">
          {t.report_vuln_title}
          {vulns.length > 0 && (
            <span className="ml-2 text-base font-normal text-gray-400">{t.report_vuln_found(vulns.length)}</span>
          )}
        </h2>
        <VulnerabilityTable vulnerabilities={vulns} />
      </div>

      {/* Disclaimer */}
      <div className="mt-10 rounded-xl border border-gray-100 bg-gray-50 p-5">
        <p className="text-center text-xs leading-relaxed text-gray-400">
          <strong className="text-gray-500">Almond teAI</strong> — {t.report_disclaimer}
        </p>
      </div>
    </div>
  );
}
