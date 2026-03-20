import { calculateScore } from '@/lib/scoring';
import { runApiHeuristics } from './modules/api-heuristics';
import { runAuthHeuristics } from './modules/auth-heuristics';
import { runBrowserInspection } from './modules/browser-inspection';
import { runFrontendInspection } from './modules/frontend-inspection';
import { profileWebsite, websiteProfileLabel } from './website-profiler';
import type { WebsiteModuleResult, WebsiteProfile } from './types';
import { buildWebsiteSummary, scanUrl, type UrlScanResult, type UrlVulnerability } from './url-scanner';

function dedupeWebsiteFindings<T extends {
  type: string;
  category: string;
  file: string;
  line?: number | null;
  code?: string | null;
}>(vulnerabilities: T[]): T[] {
  const seen = new Set<string>();
  return vulnerabilities.filter(vulnerability => {
    const key = [
      vulnerability.type,
      vulnerability.category,
      vulnerability.file,
      vulnerability.line ?? 0,
      vulnerability.code ?? '',
    ].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeCoverageNotes(baseNotes: string[], extraNotes: string[]): string[] {
  const seen = new Set<string>();
  return [...baseNotes, ...extraNotes].filter(note => {
    const normalized = note.trim();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export async function scanWebsiteTarget(rawUrl: string): Promise<UrlScanResult> {
  const fingerprint = await profileWebsite(rawUrl);
  const baseline = await scanUrl(fingerprint.normalizedUrl);

  const moduleResults: WebsiteModuleResult[] = [];
  const browserInspectionEligible = /html|xhtml|text\//i.test(fingerprint.pageContentType || 'text/html');

  if (browserInspectionEligible) {
    moduleResults.push(await runBrowserInspection(fingerprint));
  }

  const mergedSignals = mergeCoverageNotes(
    fingerprint.signals,
    moduleResults.flatMap(result => result.profileSignals ?? []),
  );
  const browserAuthRouteHint = moduleResults.find(result => result.authRouteHint)?.authRouteHint ?? null;
  const browserActiveValidationPerformed = moduleResults.some(result => result.activeValidationPerformed);
  const effectiveProfile = moduleResults.reduce<WebsiteProfile>(
    (current, result) => result.profileOverride ?? current,
    fingerprint.profile,
  );

  const effectiveFingerprint = browserAuthRouteHint
    ? {
        ...fingerprint,
        normalizedUrl: browserAuthRouteHint.url,
        pageBody: browserAuthRouteHint.html,
        hasPasswordField: true,
        probableAuthSurface: true,
      }
    : fingerprint;

  if (effectiveProfile === 'webapp-light') {
    moduleResults.push(await runFrontendInspection(effectiveFingerprint));
    if (!browserActiveValidationPerformed) {
      moduleResults.push(await runAuthHeuristics(effectiveFingerprint));
    }
  }

  if (effectiveProfile === 'api-surface') {
    moduleResults.push(await runApiHeuristics(fingerprint));
  }

  if (effectiveProfile === 'cms-exposure') {
    moduleResults.push({
      vulnerabilities: [],
      coverageNotes: ['CMS-oriented exposure checks were emphasized because the target showed CMS markers.'],
      activeValidationPerformed: false,
      networkChecksPartial: false,
    });
  }

  const adaptiveFindings = moduleResults.flatMap(result => result.vulnerabilities) as UrlVulnerability[];
  const mergedFindings = dedupeWebsiteFindings([
    ...baseline.vulnerabilities,
    ...adaptiveFindings,
  ]);

  const activeValidationPerformed = moduleResults.some(result => result.activeValidationPerformed);
  const networkChecksPartial = baseline.networkChecksPartial || moduleResults.some(result => result.networkChecksPartial);

  const profileNotes = [
    `Selected scan profile: ${websiteProfileLabel(effectiveProfile)}.`,
    mergedSignals.length > 0
      ? `Profile signals: ${mergedSignals.join(', ')}.`
      : 'Profile signals: baseline surface indicators only.',
    activeValidationPerformed
      ? 'Limited active validation: Performed using non-destructive authentication heuristics only.'
      : 'Limited active validation: Not performed in this run.',
  ];

  const moduleNotes = moduleResults.flatMap(result => result.coverageNotes);
  const coverageNotes = mergeCoverageNotes(profileNotes, [...moduleNotes, ...baseline.coverageNotes]);
  const score = calculateScore(mergedFindings, 'website').score;
  const summary = buildWebsiteSummary(fingerprint.normalizedUrl, mergedFindings, score);

  return {
    ...baseline,
    score,
    vulnerabilities: mergedFindings,
    summary,
    coverageNotes,
    safeVerificationOnly: !activeValidationPerformed,
    networkChecksPartial,
  };
}
