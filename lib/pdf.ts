/* eslint-disable @typescript-eslint/no-require-imports */
import type { Scan, Vulnerability } from '@prisma/client';
import { gradeLabel, scoreInterpretation, scoreStatusKey } from '@/lib/scoring';
import { buildScoreDrivers } from '@/lib/score-drivers';

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
    publicSlug: string | null;
    visibility: string;
    owner?: {
      plan: string;
    } | null;
  } | null;
};

interface PdfRenderOptions {
  watermarked: boolean;
}

function severityOrder(severity: string) {
  return { critical: 0, high: 1, medium: 2, low: 3, info: 4 }[severity.toLowerCase()] ?? 5;
}

function severityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical': return '#b91c1c';
    case 'high': return '#c2410c';
    case 'medium': return '#a16207';
    case 'low': return '#1d4ed8';
    default: return '#475569';
  }
}

function severityMarkerCanvas(severity: string, size = 8) {
  return [
    {
      type: 'rect',
      x: 0,
      y: 0,
      w: size,
      h: size,
      r: Math.max(2, Math.round(size / 2)),
      color: severityColor(severity),
    },
  ];
}

function scoreStatusLabel(score: number): string {
  switch (scoreStatusKey(score)) {
    case 'excellent': return 'Excellent';
    case 'good': return 'Good';
    case 'fair': return 'Fair';
    case 'poor': return 'Poor';
    default: return 'Critical Risk';
  }
}

function scanTypeLabel(scan: Scan): string {
  switch (scan.scanType) {
    case 'website':
      return 'Website Security Scan';
    case 'upload':
      return 'Uploaded Codebase Scan';
    default:
      return 'Repository Security Scan';
  }
}

function targetName(scan: Scan): string {
  if (scan.scanType === 'website') return scan.websiteUrl ?? 'Website Target';
  return scan.repoName ?? scan.fileName ?? 'Uploaded Project';
}

function confidenceLabel(confidence: string | null | undefined): string {
  if (!confidence) return 'Detected';
  const value = confidence.toLowerCase();
  if (value === 'verified') return 'Verified';
  if (value === 'likely') return 'Likely';
  return 'Detected';
}

function exploitabilityLabel(exploitability: string | null | undefined): string {
  if (!exploitability) return 'None';
  const value = exploitability.toLowerCase();
  if (value === 'confirmed') return 'Confirmed';
  if (value === 'possible') return 'Possible';
  return 'None';
}

function exploitabilityColor(exploitability: string | null | undefined): string {
  const value = (exploitability ?? 'none').toLowerCase();
  if (value === 'confirmed') return '#b91c1c';
  if (value === 'possible') return '#c2410c';
  return '#475569';
}

function exploitabilityBackground(exploitability: string | null | undefined): string {
  const value = (exploitability ?? 'none').toLowerCase();
  if (value === 'confirmed') return '#fef2f2';
  if (value === 'possible') return '#fff7ed';
  return '#f8fafc';
}

function categoryLabel(category: string | null | undefined): string {
  const value = (category ?? 'code').toLowerCase();
  if (value === 'secret') return 'Secret';
  if (value === 'dependency') return 'Dependency';
  if (value === 'exposure') return 'Exposure';
  if (value === 'configuration') return 'Config';
  return 'Code';
}

function categoryColor(category: string | null | undefined): string {
  const value = (category ?? 'code').toLowerCase();
  if (value === 'secret') return '#475569';
  if (value === 'dependency') return '#475569';
  if (value === 'exposure') return '#475569';
  if (value === 'configuration') return '#64748b';
  return '#475569';
}

function categoryBackground(category: string | null | undefined): string {
  const value = (category ?? 'code').toLowerCase();
  if (value === 'configuration') return '#f8fafc';
  return '#f8fafc';
}

function findingId(scanType: string, index: number): string {
  const prefix = scanType === 'website'
    ? 'WEB'
    : scanType === 'upload'
    ? 'UPL'
    : 'CODE';

  return `ALM-${prefix}-${String(index + 1).padStart(3, '0')}`;
}

function severityCounts(vulnerabilities: Vulnerability[]) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const vuln of vulnerabilities) {
    const key = vuln.severity.toLowerCase() as keyof typeof counts;
    if (key in counts) counts[key]++;
  }
  return counts;
}

function executiveSummary(score: number, counts: ReturnType<typeof severityCounts>): string {
  const grade = gradeLabel(score);
  const status = scoreStatusLabel(score);
  if (counts.critical > 0) {
    return `This assessment indicates Grade ${grade} (${status}) with critical findings present. The current posture should not be treated as production-ready until the identified high-impact issues are remediated and validated.`;
  }
  if (counts.high > 0) {
    return `This assessment indicates Grade ${grade} (${status}). No critical issues were detected, but high-severity weaknesses remain and should be addressed before using this result as an external trust signal.`;
  }
  return `This assessment indicates Grade ${grade} (${status}). The automated analysis did not surface critical or high-severity vulnerabilities, but the result should still be treated as a point-in-time security assessment rather than a manual penetration test.`;
}

function recommendationItems(counts: ReturnType<typeof severityCounts>) {
  const items: string[] = [];
  if (counts.critical > 0) items.push('Resolve critical findings first and validate fixes before relying on this assessment externally.');
  if (counts.high > 0) items.push('Prioritize high-severity weaknesses in the next remediation cycle and retest the affected areas.');
  if (counts.medium + counts.low > 0) items.push('Use the findings in this report to harden configuration, dependencies, and application controls.');
  if (items.length < 2) items.push('Maintain periodic verification after releases to detect regressions in security posture.');
  if (items.length < 2) items.push('Use manual review when deeper expert validation is required beyond automated scanning.');
  return items.slice(0, 2);
}

function remediationPriorities(counts: ReturnType<typeof severityCounts>) {
  return [
    {
      title: 'Priority 1',
      body: counts.critical + counts.high > 0
        ? `Address critical and high-severity issues first. ${counts.critical} critical and ${counts.high} high-severity findings were identified in this assessment and should be remediated and validated before relying on this result externally.`
        : 'No critical or high-severity vulnerabilities were detected in this assessment.',
    },
    {
      title: 'Priority 2',
      body: counts.medium > 0
        ? `Resolve medium-severity findings next. ${counts.medium} medium-severity issues were detected and should be scheduled into the next hardening cycle to reduce implementation and configuration risk.`
        : 'Continue structured hardening work across application controls, dependency posture, and configuration quality even where medium-severity findings were not observed.',
    },
    {
      title: 'Priority 3',
      body: counts.low + counts.info > 0
        ? `Maintain preventative controls across lower-severity issues (${counts.low} low, ${counts.info} informational) and establish repeat verification after future deployments.`
        : 'Maintain preventive controls, release checks, and recurring verification to preserve the current security posture over time.',
    },
  ];
}

function scoreColor(score: number): string {
  if (score >= 90) return '#15803d';
  if (score >= 80) return '#2563eb';
  if (score >= 65) return '#d97706';
  if (score >= 50) return '#ea580c';
  return '#b91c1c';
}

function renderLogoSvg(): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" fill="none">
  <rect width="48" height="48" rx="12" fill="#121826"/>
  <path d="M14.68 15.35C18.1 13.83 26.14 11.95 33.97 15.36C34.11 20.27 34.36 24.31 33.26 27.74C32.18 31.11 29.77 33.95 24.33 36.26C21.74 35.42 20.54 34.23 19.14 33.27C16.91 30.99 15.74 29.72 15.12 27.46C14.49 25.14 14.42 21.77 14.68 15.35Z" stroke="#ffffff" stroke-width="1.38" stroke-linecap="round"/>
  <path d="M18.5 23.48H18.06C17.96 23.48 17.88 23.56 17.88 23.66V24.01C17.88 24.11 17.8 24.19 17.7 24.19C17.61 24.19 17.53 24.27 17.53 24.37V24.63C17.53 24.72 17.61 24.8 17.7 24.8C17.8 24.8 17.88 24.88 17.88 24.97V26.42C17.88 26.44 17.88 26.46 17.89 26.48C18.09 27.14 18.75 27.13 19.15 27.02C19.23 27 19.28 26.92 19.27 26.84L19.25 26.72L19.25 26.71C19.23 26.59 19.08 26.53 18.96 26.49C18.83 26.46 18.74 26.33 18.69 26.23C18.69 26.2 18.68 26.18 18.68 26.15V24.97C18.68 24.88 18.76 24.8 18.85 24.8H19.03C19.12 24.8 19.2 24.72 19.2 24.63V24.37C19.2 24.27 19.12 24.19 19.03 24.19H18.85C18.76 24.19 18.68 24.11 18.68 24.01V23.66C18.68 23.56 18.6 23.48 18.5 23.48Z" fill="#ffffff"/>
  <path d="M21.7 25.8H20.22C20.11 25.8 20.03 25.91 20.08 26.01C20.33 26.53 20.84 26.36 21.12 26.17C21.15 26.15 21.19 26.14 21.22 26.14H21.66C21.76 26.14 21.84 26.22 21.81 26.31C21.71 26.63 21.38 27.06 20.6 27.06C19.66 27.06 19.37 26.22 19.34 25.8C19.25 25.26 19.39 24.19 20.6 24.19C21.7 24.19 21.9 25.09 21.87 25.65C21.86 25.73 21.79 25.8 21.7 25.8Z" fill="#ffffff"/>
  <path d="M23.98 23.31H23.3C23.23 23.31 23.17 23.35 23.15 23.42L21.94 26.68C21.9 26.79 21.98 26.9 22.1 26.9H22.58C22.65 26.9 22.71 26.86 22.74 26.79L22.99 26.16C23.01 26.1 23.08 26.06 23.14 26.06H24.16C24.23 26.06 24.29 26.1 24.31 26.16L24.56 26.79C24.59 26.86 24.65 26.9 24.71 26.9H25.11C25.23 26.9 25.31 26.79 25.27 26.68L24.14 23.42C24.11 23.35 24.05 23.31 23.98 23.31Z" fill="#ffffff"/>
  <path d="M21.15 25.3H19.98C19.98 25.11 20.1 24.72 20.6 24.72C21.08 24.72 21.15 25.11 21.15 25.3Z" fill="#121826"/>
  <path d="M23.03 25.55L23.46 24.19L23.88 25.55H23.03Z" fill="#121826"/>
  <rect x="25.52" y="24.37" width="0.84" height="2.67" rx="0.17" fill="#ffffff"/>
  <circle cx="25.94" cy="23.78" r="0.42" fill="#ffffff"/>
  <path d="M18.68 19.2C19.67 17.71 22.67 15.06 26.83 16.96" stroke="#ffffff" stroke-width="0.84" stroke-linecap="round"/>
  <path d="M19.34 22.88H18.26C18.84 20.12 21.37 17.92 22.26 17.45C24.5 18.7 25.91 21.54 26.24 22.88H25.16C24.09 20.28 22.77 19.07 22.26 18.79C20.65 19.92 19.63 21.99 19.34 22.88Z" fill="#ffffff"/>
  <path d="M25 27.63H26.08C25.17 30.64 23.14 31.91 22.25 32.3C19.76 30.89 18.93 29.4 18.35 27.63H19.43C20.49 29.8 21.77 30.8 22.26 31.03C23.87 30.07 24.72 28.36 25 27.63Z" fill="#ffffff"/>
  <circle cx="18.1" cy="20.43" r="0.42" fill="#ffffff"/>
  <circle cx="17.43" cy="27.95" r="0.42" fill="#ffffff"/>
  <circle cx="21.69" cy="32.89" r="0.34" fill="#ffffff"/>
  <circle cx="26.13" cy="29.79" r="0.42" fill="#ffffff"/>
  <circle cx="28.3" cy="31.8" r="0.42" fill="#ffffff"/>
  <circle cx="28.3" cy="25.1" r="0.42" fill="#ffffff"/>
  <circle cx="30.97" cy="27.95" r="0.42" fill="#ffffff"/>
  <circle cx="28.81" cy="19.76" r="0.42" fill="#ffffff"/>
  <circle cx="30.3" cy="19.43" r="0.42" fill="#ffffff"/>
  <circle cx="28.14" cy="17.43" r="0.42" fill="#ffffff"/>
  <circle cx="27.81" cy="18.93" r="0.42" fill="#ffffff"/>
  <path d="M22.92 20.16L22.28 19.52C22.27 19.51 22.26 19.51 22.25 19.52C20.21 20.97 19.53 23.02 19.43 23.89C19.43 23.9 19.44 23.91 19.45 23.91C19.71 23.79 20.08 23.71 20.25 23.68C20.26 23.67 20.27 23.67 20.27 23.66C20.73 21.36 22.2 20.38 22.9 20.17C22.91 20.17 22.92 20.16 22.92 20.16Z" fill="#ffffff"/>
  <path d="M21.58 23.68C21.44 23.49 21.12 23.35 20.96 23.29C20.95 23.29 20.94 23.28 20.94 23.27C21.34 21.29 22.7 20.51 23.34 20.37C23.35 20.37 23.36 20.37 23.36 20.38L23.83 21.01C23.84 21.02 23.83 21.03 23.82 21.03C22.66 21 21.87 22.75 21.62 23.67C21.61 23.68 21.59 23.69 21.58 23.68Z" fill="#ffffff"/>
  <path d="M24.41 22.88H22.88C22.87 22.88 22.86 22.87 22.87 22.86C23.14 22.42 23.79 22.14 24.09 22.06C24.1 22.06 24.11 22.06 24.11 22.07L24.43 22.86C24.44 22.87 24.43 22.88 24.41 22.88Z" fill="#ffffff"/>
  <path d="M17.43 23.82C17.57 22.37 18.1 21.19 18.35 20.76C18.36 20.75 18.35 20.74 18.35 20.73L17.79 20.17C17.78 20.16 17.77 20.16 17.77 20.17C17.24 20.92 16.72 23.08 16.52 24.07C16.52 24.07 16.52 24.08 16.52 24.08C16.59 24.74 16.76 24.75 16.84 24.67C16.84 24.67 16.84 24.67 16.84 24.66C17.04 24.02 17.29 23.84 17.41 23.82C17.42 23.82 17.42 23.82 17.43 23.82Z" fill="#ffffff"/>
  <path d="M17.41 25.25C17.19 25.19 17.11 24.97 17.1 24.82C17.09 24.8 17.07 24.8 17.07 24.81C16.89 25.18 16.52 25.92 16.52 26C16.52 26.08 16.52 26.83 16.77 26.75C16.96 26.68 17.18 26.39 17.26 26.25C17.26 26.25 17.27 26.25 17.27 26.25C17.53 26.05 17.49 25.51 17.43 25.26C17.43 25.25 17.42 25.25 17.41 25.25Z" fill="#ffffff"/>
  <path d="M18.08 27.24L17.61 26.93C17.6 26.92 17.59 26.93 17.59 26.94C17.52 27.2 17.25 27.52 17.11 27.67C17.1 27.68 17.1 27.69 17.11 27.7C17.34 27.88 17.79 28.17 17.86 28.11C17.94 28.03 17.86 27.86 17.86 27.7C17.86 27.58 18.01 27.39 18.1 27.3C18.11 27.29 18.1 27.27 18.08 27.24Z" fill="#ffffff"/>
  <path d="M18.6 29.41L18.27 28.6C18.27 28.59 18.25 28.59 18.24 28.6C17.91 28.82 17.47 29.13 17.86 29.5C18.1 29.75 18.52 29.52 18.59 29.43C18.59 29.43 18.6 29.42 18.6 29.41Z" fill="#ffffff"/>
  <path d="M18.52 30.34C18.66 30.85 19.31 30.89 19.65 30.84C19.67 30.84 19.67 30.83 19.66 30.82C19.41 30.57 19.14 30.25 19.03 30.11C19.02 30.1 19.01 30.1 19 30.1C18.56 30.23 18.49 30.32 18.5 30.35C18.51 30.35 18.52 30.35 18.52 30.34Z" fill="#ffffff"/>
  <path d="M20.99 32.07L20.2 31.52C20.2 31.52 20.19 31.51 20.19 31.51C20.06 31.31 19.81 31.37 19.7 31.42C19.7 31.42 19.69 31.43 19.68 31.43C19.22 31.43 19.38 31.65 19.52 31.76C19.9 32.14 20.62 32.14 20.97 32.09C20.99 32.09 21 32.08 20.99 32.07Z" fill="#ffffff"/>
  <path d="M22.52 32.6C22.2 32.91 21.86 32.75 21.71 32.62C21.7 32.61 21.69 32.61 21.69 32.62L21.37 33.18C21.36 33.18 21.36 33.19 21.37 33.2C22.12 33.78 23.45 33.03 24.44 32.37C25.23 31.85 26.03 30.52 26.35 29.9C26.35 29.89 26.35 29.88 26.34 29.88H25.55C25.54 29.88 25.54 29.89 25.53 29.89C24.86 31.35 23.25 32.32 22.53 32.6C22.53 32.6 22.52 32.6 22.52 32.6Z" fill="#ffffff"/>
  <path d="M22.1 30.38L21.46 29.98C21.45 29.97 21.45 29.96 21.46 29.95C22.95 28.91 22.78 28.55 23.74 26.78C23.75 26.77 23.77 26.77 23.77 26.79C23.8 27.02 23.99 27.51 24.09 27.71C24.09 27.72 24.09 27.72 24.09 27.73C23.56 29.17 22.55 30.09 22.11 30.38C22.11 30.38 22.1 30.38 22.1 30.38Z" fill="#ffffff"/>
  <path d="M22.58 27.63H21.79C21.79 27.63 21.78 27.63 21.78 27.64C21.45 28.16 20.83 28.73 20.55 28.95C20.54 28.96 20.53 28.97 20.54 28.98L21.01 29.54C21.02 29.54 21.03 29.54 21.03 29.54C21.68 29.08 22.32 28.1 22.58 27.65C22.59 27.64 22.59 27.63 22.58 27.63Z" fill="#ffffff"/>
  <path d="M19.94 27.65C19.95 27.9 20.15 28.22 20.26 28.36C20.27 28.37 20.28 28.37 20.29 28.36C20.42 28.23 20.74 27.86 20.91 27.66C20.92 27.65 20.91 27.63 20.9 27.63C20.58 27.68 20.16 27.64 19.96 27.62C19.95 27.62 19.94 27.63 19.94 27.65Z" fill="#ffffff"/>
  <path d="M27.4 32.51C27.21 32.44 27.01 32.73 26.92 32.9C26.91 32.92 26.92 32.93 26.93 32.93C27.13 32.89 27.65 32.59 27.4 32.51Z" fill="#ffffff"/>
  <path d="M30.65 29.32C30.46 29.39 30.35 29.85 30.32 30.11C30.31 30.13 30.33 30.14 30.34 30.13C30.74 29.72 30.89 29.24 30.65 29.32Z" fill="#ffffff"/>
  <path d="M30.9 20.99C30.7 21.18 31.18 22.03 31.46 22.45C31.47 22.46 31.49 22.46 31.49 22.45C31.72 21.78 31.15 20.74 30.9 20.99Z" fill="#ffffff"/>
  <path d="M30.64 19.73C30.17 19.2 28.97 18.15 28.42 17.67C28.41 17.67 28.4 17.67 28.4 17.68L27.92 18.31C27.91 18.32 27.92 18.33 27.93 18.33C28.53 18.55 29.54 19.67 29.98 20.22C29.99 20.23 30 20.23 30 20.23L30.64 19.75C30.64 19.75 30.65 19.74 30.64 19.73Z" fill="#ffffff"/>
  <path d="M24.11 18.57L23.31 17.85C23.3 17.84 23.31 17.82 23.32 17.82C25.17 17.38 27.21 18.51 28.02 19.14C28.03 19.15 28.03 19.16 28.02 19.17L27.46 19.73C27.46 19.74 27.45 19.74 27.45 19.73C26.06 18.68 24.67 18.52 24.13 18.57C24.12 18.57 24.11 18.57 24.11 18.57Z" fill="#ffffff"/>
  <path d="M28.2 23.82C27.68 22.59 26.66 21.62 26.16 21.26C26.15 21.25 26.13 21.27 26.14 21.28L26.7 22.73C26.7 22.73 26.7 22.74 26.71 22.74C26.85 22.83 27.31 23.69 27.53 24.11C27.58 24.23 27.76 24.47 28.03 24.39C28.3 24.32 28.26 23.98 28.2 23.82Z" fill="#ffffff"/>
  <path d="M25.54 20.66L24.82 19.7C24.81 19.69 24.82 19.67 24.83 19.67C31.76 21.61 30.47 29.58 28.71 32.55C28.7 32.55 28.69 32.56 28.69 32.56L28.05 32.32C28.04 32.31 28.04 32.3 28.04 32.29C31.49 25.39 27.82 21.66 25.55 20.66C25.54 20.66 25.54 20.66 25.54 20.66Z" fill="#ffffff"/>
  <path d="M24.06 34.36C28.18 33.03 28.89 27.78 28.73 25.3C28.73 25.29 28.72 25.28 28.71 25.29L28.08 25.61C28.08 25.61 28.07 25.61 28.07 25.62C28.06 31.25 24.91 33.49 23.32 33.91C23.32 33.91 23.31 33.92 23.31 33.92C23.26 34.37 23.79 34.37 24.06 34.36Z" fill="#ffffff"/>
  <path d="M26.12 27.3V24.14C26.12 24.12 26.15 24.11 26.16 24.13C26.91 26.03 26.57 28.16 26.3 29.02C26.29 29.03 26.28 29.04 26.27 29.04L25.65 28.8C25.64 28.8 25.64 28.78 25.65 28.77C25.78 28.58 26.02 27.72 26.12 27.31C26.12 27.31 26.12 27.3 26.12 27.3Z" fill="#ffffff"/>
  <path d="M30.66 28.9C31.38 25.12 29.59 22.29 28.59 21.34C28.58 21.34 28.58 21.33 28.59 21.32L29.15 20.76C29.16 20.75 29.17 20.75 29.18 20.76C31.76 23.62 31.78 27.46 31.43 28.99C31.43 29 31.42 29 31.41 29L30.69 28.92C30.67 28.92 30.66 28.91 30.66 28.9Z" fill="#ffffff"/>
  <circle cx="25.95" cy="28.87" r="0.34" fill="#ffffff"/>
</svg>`;
}

function renderScoreGaugeSvg(
  score: number,
  grade: string,
  status: string,
  interpretation: { headline: string; detail: string },
): string {
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score)) / 100;
  const dash = circumference * progress;
  const gap = circumference - dash;
  const color = scoreColor(score);
  let progressArc = '';
  if (dash > 0 && gap > 0) {
    progressArc = `<circle cx="122" cy="104" r="${radius}" stroke="${color}" stroke-width="13" fill="none"
    stroke-linecap="round" stroke-dasharray="${dash} ${gap}" transform="rotate(-90 122 104)"/>`;
  } else if (dash > 0) {
    progressArc = `<circle cx="122" cy="104" r="${radius}" stroke="${color}" stroke-width="13" fill="none"
    stroke-linecap="round" transform="rotate(-90 122 104)"/>`;
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 244 252" width="244" height="252" fill="none">
  <circle cx="122" cy="104" r="${radius}" stroke="#e5e7eb" stroke-width="13" fill="none"/>
  ${progressArc}
  <text x="122" y="82" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" fill="#0f172a">Grade ${grade}</text>
  <text x="122" y="118" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700" fill="#0f172a">${score}</text>
  <text x="122" y="139" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" fill="#94a3b8">/ 100</text>
  <text x="122" y="164" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" fill="${color}">${status}</text>
  <text x="122" y="210" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" fill="#475569">${interpretation.headline}</text>
  <text x="122" y="228" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="10.5" fill="#94a3b8">${interpretation.detail}</text>
</svg>`;
}

function serviceIconCanvas(kind: 'review' | 'monitoring' | 'verification') {
  if (kind === 'review') {
    return [
      { type: 'rect', x: 0, y: 0, w: 18, h: 18, color: '#eff6ff', lineColor: '#1d4ed8', lineWidth: 1, r: 4 },
      { type: 'line', x1: 5, y1: 9, x2: 13, y2: 9, lineColor: '#1d4ed8', lineWidth: 1.4 },
      { type: 'line', x1: 9, y1: 5, x2: 9, y2: 13, lineColor: '#1d4ed8', lineWidth: 1.4 },
    ];
  }
  if (kind === 'monitoring') {
    return [
      { type: 'rect', x: 0, y: 0, w: 18, h: 18, color: '#f0fdf4', lineColor: '#15803d', lineWidth: 1, r: 4 },
      { type: 'line', x1: 4, y1: 11, x2: 7, y2: 8, lineColor: '#15803d', lineWidth: 1.4 },
      { type: 'line', x1: 7, y1: 8, x2: 10, y2: 10, lineColor: '#15803d', lineWidth: 1.4 },
      { type: 'line', x1: 10, y1: 10, x2: 14, y2: 5, lineColor: '#15803d', lineWidth: 1.4 },
    ];
  }
  return [
    { type: 'rect', x: 0, y: 0, w: 18, h: 18, color: '#fff7ed', lineColor: '#c2410c', lineWidth: 1, r: 4 },
    { type: 'line', x1: 9, y1: 4, x2: 9, y2: 13, lineColor: '#c2410c', lineWidth: 1.4 },
    { type: 'line', x1: 5, y1: 9, x2: 13, y2: 9, lineColor: '#c2410c', lineWidth: 1.4 },
  ];
}

function serviceCard(
  kind: 'review' | 'monitoring' | 'verification',
  title: string,
  body: string,
) {
  return {
    stack: [
      {
        columns: [
          { width: 18, canvas: serviceIconCanvas(kind), margin: [0, 1, 0, 0] },
          { width: '*', text: title, bold: true, fontSize: 11, color: '#0f172a' },
        ],
        columnGap: 10,
        margin: [0, 0, 0, 10],
      },
      { text: body, style: 'bodyText' },
    ],
    border: [false, false, false, false],
  };
}

function findingCard(finding: Vulnerability, index: number, scanType: string) {
  const location = `${finding.file}${finding.line ? `:${finding.line}` : ''}`;
  const severity = finding.severity.toUpperCase();
  const category = categoryLabel(finding.category);
  const confidence = confidenceLabel(finding.confidence);
  const exploitability = exploitabilityLabel(finding.exploitability);
  const vulnId = findingId(scanType, index);
  return {
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          {
            columns: [
              {
                width: '*',
                stack: [
                  { text: vulnId, fontSize: 8.5, bold: true, color: '#94a3b8', margin: [0, 0, 0, 5] },
                  { text: finding.type, fontSize: 13, bold: true, color: '#0f172a', margin: [0, 0, 0, 6] },
                  {
                    table: {
                      widths: ['auto'],
                      body: [[{
                        text: `Location  ${location}`,
                        fontSize: 8.8,
                        color: '#475569',
                        border: [false, false, false, false],
                      }]],
                    },
                    layout: {
                      fillColor: () => '#f8fafc',
                      hLineWidth: () => 0,
                      vLineWidth: () => 0,
                      paddingLeft: () => 8,
                      paddingRight: () => 8,
                      paddingTop: () => 5,
                      paddingBottom: () => 5,
                    },
                  },
                ],
              },
              {
                width: 308,
                columns: [
                  {
                    width: 72,
                    table: {
                      widths: ['*'],
                      body: [[{
                        text: category,
                        color: categoryColor(finding.category),
                        fillColor: categoryBackground(finding.category),
                        bold: true,
                        alignment: 'center',
                        fontSize: 7.4,
                        border: [false, false, false, false],
                      }]],
                    },
                    layout: {
                      hLineWidth: () => 0,
                      vLineWidth: () => 0,
                      paddingLeft: () => 8,
                      paddingRight: () => 8,
                      paddingTop: () => 6,
                      paddingBottom: () => 6,
                    },
                  },
                  {
                    width: 6,
                    text: '',
                  },
                  {
                    width: 72,
                    table: {
                      widths: ['*'],
                      body: [[{
                        text: severity,
                        color: '#ffffff',
                        bold: true,
                        alignment: 'center',
                        fontSize: 7.8,
                        fillColor: severityColor(finding.severity),
                        border: [false, false, false, false],
                      }]],
                    },
                    layout: {
                      hLineWidth: () => 0,
                      vLineWidth: () => 0,
                      paddingLeft: () => 8,
                      paddingRight: () => 8,
                      paddingTop: () => 6,
                      paddingBottom: () => 6,
                    },
                  },
                  {
                    width: 6,
                    text: '',
                  },
                  {
                    width: 72,
                    table: {
                      widths: ['*'],
                      body: [[{
                        text: confidence,
                        color: '#334155',
                        fillColor: '#eef2f7',
                        bold: true,
                        alignment: 'center',
                        fontSize: 7.4,
                        border: [false, false, false, false],
                      }]],
                    },
                    layout: {
                      hLineWidth: () => 0,
                      vLineWidth: () => 0,
                      paddingLeft: () => 8,
                      paddingRight: () => 8,
                      paddingTop: () => 6,
                      paddingBottom: () => 6,
                    },
                  },
                  {
                    width: 6,
                    text: '',
                  },
                  {
                    width: 72,
                    table: {
                      widths: ['*'],
                      body: [[{
                        text: exploitability,
                        color: exploitabilityColor(finding.exploitability),
                        fillColor: exploitabilityBackground(finding.exploitability),
                        bold: true,
                        alignment: 'center',
                        fontSize: 7.4,
                        border: [false, false, false, false],
                      }]],
                    },
                    layout: {
                      hLineWidth: () => 0,
                      vLineWidth: () => 0,
                      paddingLeft: () => 8,
                      paddingRight: () => 8,
                      paddingTop: () => 6,
                      paddingBottom: () => 6,
                    },
                  },
                ],
              },
            ],
            columnGap: 12,
          },
          {
            margin: [0, 14, 0, 0],
            stack: [
              { text: 'Description', fontSize: 8.5, color: '#94a3b8', bold: true, margin: [0, 0, 0, 8] },
              { text: finding.description, fontSize: 10, color: '#374151', lineHeight: 1.35 },
            ],
          },
          {
            margin: [0, 15, 0, 0],
            table: {
              widths: ['*'],
              body: [[{
                stack: [
                  { text: 'Recommendation', fontSize: 8.5, color: '#64748b', bold: true, margin: [0, 0, 0, 6] },
                  { text: finding.suggestion, fontSize: 10, color: '#111827', lineHeight: 1.35 },
                ],
                border: [false, false, false, false],
              }]],
            },
            layout: {
              fillColor: () => '#f8fafc',
              hLineWidth: () => 0,
              vLineWidth: () => 0,
              paddingLeft: () => 16,
              paddingRight: () => 14,
              paddingTop: () => 11,
              paddingBottom: () => 11,
            },
          },
        ],
        border: [false, false, false, false],
      }]],
    },
    layout: {
      fillColor: () => index % 2 === 0 ? '#ffffff' : '#fcfcfd',
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 18,
      paddingRight: () => 18,
      paddingTop: () => 18,
      paddingBottom: () => 18,
    },
    margin: [0, 0, 0, 14],
  };
}

function remediationCard(priority: { title: string; body: string }, index: number) {
  const accent = ['#b91c1c', '#d97706', '#2563eb'][index] ?? '#64748b';
  return {
    table: {
      widths: [6, '*'],
      body: [[
        { text: '', fillColor: accent, border: [false, false, false, false] },
        {
          stack: [
            { text: priority.title, fontSize: 12, bold: true, color: '#0f172a', margin: [0, 0, 0, 8] },
            { text: priority.body, fontSize: 10.5, color: '#374151', lineHeight: 1.35 },
          ],
          border: [false, false, false, false],
        },
      ]],
    },
    layout: {
      fillColor: () => index % 2 === 0 ? '#ffffff' : '#f8fafc',
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: (i: number) => (i === 0 ? 0 : 18),
      paddingRight: () => 18,
      paddingTop: () => 18,
      paddingBottom: () => 18,
    },
    margin: [0, 0, 0, 14],
  };
}

function issueDistributionChart(rows: Array<{ label: string; count: number; color: string }>, maxCount: number) {
  return {
    table: {
      widths: [100, '*', 32],
      body: rows.map((row) => ([
        {
          columns: [
            { width: 8, canvas: severityMarkerCanvas(row.label, 8), margin: [0, 8, 8, 0] },
            { width: '*', text: row.label, fontSize: 9.5, color: '#334155', margin: [0, 6, 0, 0] },
          ],
          border: [false, false, false, false],
        },
        {
          stack: [
            {
              canvas: [
                { type: 'rect', x: 0, y: 0, w: 280, h: 11, color: '#e5e7eb', r: 4 },
                { type: 'rect', x: 0, y: 0, w: row.count === 0 ? 0 : Math.max(10, Math.round((row.count / maxCount) * 280)), h: 11, color: row.color, r: 4 },
              ],
            },
          ],
          margin: [0, 8, 0, 0],
          border: [false, false, false, false],
        },
        { text: String(row.count), alignment: 'right', fontSize: 9.5, color: '#111827', margin: [0, 6, 0, 0], border: [false, false, false, false] },
      ])),
    },
    layout: {
      fillColor: () => '#f8fafc',
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 18,
      paddingRight: () => 18,
      paddingTop: () => 12,
      paddingBottom: () => 12,
    },
  };
}

function verificationText(verificationUrl: string | null): any {
  if (verificationUrl) {
    return {
      text: verificationUrl,
      style: 'bodyText',
      color: '#1d4ed8',
      link: verificationUrl,
      decoration: 'underline',
    };
  }

  return {
    text: 'This report does not yet have a public verification URL. Publish the project verification page to generate a shareable online verification link.',
    style: 'bodyText',
    color: '#64748b',
  };
}

function coverageStatusText(value: boolean | null | undefined): string {
  return value === false ? 'Incomplete' : 'Complete';
}

function yesNoText(value: boolean | null | undefined): string {
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

function coverageMetricCard(label: string, value: string, tone: 'neutral' | 'success' | 'warning' = 'neutral') {
  const palette = {
    neutral: { text: '#0f172a', bg: '#f8fafc' },
    success: { text: '#15803d', bg: '#f0fdf4' },
    warning: { text: '#c2410c', bg: '#fff7ed' },
  }[tone];

  return {
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          { text: label, fontSize: 8.2, bold: true, color: '#94a3b8', margin: [0, 0, 0, 6] },
          { text: value, fontSize: 14, bold: true, color: palette.text },
        ],
        border: [false, false, false, false],
      }]],
    },
    layout: {
      fillColor: () => palette.bg,
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 12,
      paddingRight: () => 12,
      paddingTop: () => 12,
      paddingBottom: () => 12,
    },
  };
}

function chunkCoverageMetrics<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

function coverageNotesSection(scan: ScanWithVulns) {
  const notes = (scan.coverageNotes ?? '')
    .split('\n')
    .map((note: string) => note.trim())
    .filter(Boolean);
  const websiteCoverage = parseWebsiteCoverageMetadata(notes);

  const dependencyComplete = scan.dependencyAnalysisComplete ?? true;
  const safeVerificationOnly = scan.safeVerificationOnly ?? false;
  const networkChecksPartial = scan.networkChecksPartial ?? false;

  const metrics = scan.scanType === 'website'
    ? [
        coverageMetricCard('Checks Run', String(scan.totalFiles), 'neutral'),
        ...(websiteCoverage.profile
          ? [coverageMetricCard('Profile', websiteCoverage.profile, 'neutral')]
          : []),
        coverageMetricCard('Checks Passed', String(scan.scannedFiles), 'neutral'),
        coverageMetricCard('Safe Read-Only', yesNoText(safeVerificationOnly), safeVerificationOnly ? 'success' : 'neutral'),
        ...(websiteCoverage.activeValidation
          ? [coverageMetricCard('Active Validation', websiteCoverage.activeValidation, websiteCoverage.activeValidation.startsWith('Performed') ? 'warning' : 'neutral')]
          : []),
        coverageMetricCard('Network Partial', yesNoText(networkChecksPartial), networkChecksPartial ? 'warning' : 'neutral'),
      ]
    : [
        coverageMetricCard('Files Scanned', String(scan.scannedFiles), 'neutral'),
        coverageMetricCard('Files Skipped', String(scan.filesSkipped ?? 0), (scan.filesSkipped ?? 0) > 0 ? 'warning' : 'neutral'),
        coverageMetricCard('Skipped by Size', String(scan.filesSkippedBySize ?? 0), (scan.filesSkippedBySize ?? 0) > 0 ? 'warning' : 'neutral'),
        coverageMetricCard('Skipped by Type', String(scan.filesSkippedByType ?? 0), (scan.filesSkippedByType ?? 0) > 0 ? 'warning' : 'neutral'),
      ];
  const metricRows = chunkCoverageMetrics(metrics, scan.scanType === 'website' ? 2 : 4);

  const repoMeta = scan.scanType === 'website'
    ? []
    : [
        {
          columns: [
            { width: 130, text: 'Dependency analysis', fontSize: 9.2, bold: true, color: '#64748b' },
            { width: '*', text: coverageStatusText(dependencyComplete), fontSize: 9.5, color: dependencyComplete ? '#15803d' : '#c2410c', bold: true },
          ],
          margin: [0, 0, 0, scan.dependencyWarning ? 6 : 0],
        },
        ...(scan.dependencyWarning
          ? [{
              text: scan.dependencyWarning,
              fontSize: 9.3,
              color: '#9a3412',
              lineHeight: 1.3,
              margin: [0, 0, 0, 0],
            }]
          : []),
      ];

  return {
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          { text: 'Coverage Notes', color: '#94a3b8', fontSize: 9, bold: true, margin: [0, 0, 0, 10] },
          {
            stack: metricRows.map((row, rowIndex) => ({
              table: {
                widths: row.map(() => '*'),
                body: [row],
              },
              layout: {
                hLineWidth: () => 0,
                vLineWidth: () => 0,
                paddingLeft: () => 6,
                paddingRight: () => 6,
                paddingTop: () => 0,
                paddingBottom: () => 0,
              },
              margin: [0, 0, 0, rowIndex === metricRows.length - 1 ? 0 : 10],
            })),
            margin: [0, 0, 0, repoMeta.length > 0 || notes.length > 0 ? 12 : 0],
          },
          ...(repoMeta.length > 0
            ? [{
                table: {
                  widths: ['*'],
                  body: [[{
                    stack: repoMeta,
                    border: [false, false, false, false],
                  }]],
                },
                layout: {
                  fillColor: () => '#f8fafc',
                  hLineWidth: () => 0,
                  vLineWidth: () => 0,
                  paddingLeft: () => 12,
                  paddingRight: () => 12,
                  paddingTop: () => 10,
                  paddingBottom: () => 10,
                },
                margin: [0, 0, 0, notes.length > 0 ? 10 : 0],
              }]
            : []),
          ...(notes.length > 0
            ? [{
                table: {
                  widths: ['*'],
                  body: [[{
                    ul: notes.map((note: string) => ({
                      text: note,
                      margin: [0, 0, 0, 4],
                    })),
                    fontSize: 9.5,
                    color: '#374151',
                    border: [false, false, false, false],
                  }]],
                },
                layout: {
                  fillColor: () => '#f8fafc',
                  hLineWidth: () => 0,
                  vLineWidth: () => 0,
                  paddingLeft: () => 12,
                  paddingRight: () => 12,
                  paddingTop: () => 10,
                  paddingBottom: () => 8,
                },
              }]
            : []),
        ],
        border: [false, false, false, false],
      }]],
    },
    layout: {
      fillColor: () => '#ffffff',
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 18,
      paddingRight: () => 18,
      paddingTop: () => 16,
      paddingBottom: () => 16,
    },
    margin: [0, 0, 0, 18],
  };
}

export async function generatePdfBuffer(scan: ScanWithVulns, options: PdfRenderOptions): Promise<Buffer> {
  const PdfPrinter = require('pdfmake/build/pdfmake');
  const vfsFonts = require('pdfmake/build/vfs_fonts');
  PdfPrinter.vfs = vfsFonts.pdfMake?.vfs ?? vfsFonts.vfs;

  const score = scan.score ?? 0;
  const grade = gradeLabel(score);
  const status = scoreStatusLabel(score);
  const interpretation = scoreInterpretation(score);
  const target = targetName(scan);
  const typeLabel = scanTypeLabel(scan);
  const counts = severityCounts(scan.vulnerabilities);
  const summary = executiveSummary(score, counts);
  const recommendations = recommendationItems(counts);
  const findings = [...scan.vulnerabilities].sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity));
  const priorities = remediationPriorities(counts);
  const maxCount = Math.max(1, counts.critical, counts.high, counts.medium, counts.low, counts.info);
  const distributionRows = [
    { label: 'Critical', count: counts.critical, color: '#b91c1c' },
    { label: 'High', count: counts.high, color: '#c2410c' },
    { label: 'Medium', count: counts.medium, color: '#a16207' },
    { label: 'Low', count: counts.low, color: '#1d4ed8' },
    { label: 'Info', count: counts.info, color: '#475569' },
  ];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';
  const verificationUrl = scan.project?.visibility === 'public' && scan.project.publicSlug
    ? `${appUrl || ''}/projects/${scan.project.publicSlug}`
    : null;
  const scoreDrivers = buildScoreDrivers(scan.scanType as 'github' | 'upload' | 'website', scan.vulnerabilities);
  const verificationFooterText = verificationUrl ?? 'Verification URL unavailable for private reports';

  const docDef: any = {
    pageSize: 'A4',
    pageMargins: [44, 44, 44, 42],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#111827' },
    ...(options.watermarked ? {
      watermark: {
        text: 'Almond teAI\nSecurity Verification',
        color: '#cbd5e1',
        opacity: 0.16,
        bold: true,
        angle: -24,
      },
    } : {}),
    footer: (currentPage: number, pageCount: number) => ({
      margin: [44, 0, 44, 16],
      stack: [
        {
          columns: [
            { text: 'Almond teAI Security Report', fontSize: 8.5, color: '#64748b' },
            { text: `Report ID: ${scan.id}`, fontSize: 8.5, color: '#64748b', alignment: 'center' },
            { text: `Page ${currentPage} of ${pageCount}`, fontSize: 8.5, color: '#64748b', alignment: 'right' },
          ],
        },
        {
          text: verificationFooterText,
          fontSize: 7.4,
          color: '#94a3b8',
          alignment: 'center',
          margin: [0, 3, 0, 0],
          link: verificationUrl ?? undefined,
          decoration: verificationUrl ? 'underline' : undefined,
        },
      ],
    }),
    content: [
      {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              {
                columns: [
                  { svg: renderLogoSvg(), width: 82, height: 82, margin: [0, 0, 6, 0] },
                  {
                    width: '*',
                    stack: [
                      { text: 'Almond teAI', color: '#ffffff', bold: true, fontSize: 21, margin: [0, 8, 0, 8] },
                      { text: 'Security Assessment Report', color: '#ffffff', bold: true, fontSize: 28, margin: [0, 0, 0, 8] },
                      { text: 'Security verification and trust reporting', color: '#94a3b8', fontSize: 10.5 },
                    ],
                  },
                ],
                columnGap: 20,
              },
            ],
            border: [false, false, false, false],
          }]],
        },
        layout: {
          fillColor: () => '#0f172a',
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 22,
          paddingRight: () => 22,
          paddingTop: () => 22,
          paddingBottom: () => 24,
        },
        margin: [0, 0, 0, 14],
      },
      {
        table: {
          widths: ['*', 120],
          body: [[
            {
              stack: [
                { text: target, fontSize: 22, bold: true, color: '#0f172a', margin: [0, 0, 0, 8] },
                {
                  columns: [
                    { text: typeLabel, fontSize: 10, color: '#64748b' },
                    { text: new Date(scan.createdAt).toLocaleString(), fontSize: 10, color: '#64748b', alignment: 'right' },
                  ],
                },
              ],
              border: [false, false, false, false],
            },
            {
              stack: [
                {
                  text: options.watermarked ? 'Watermarked Report' : 'Clean Report',
                  fontSize: 9,
                  bold: true,
                  color: options.watermarked ? '#c2410c' : '#15803d',
                  alignment: 'right',
                  margin: [0, 0, 0, 6],
                },
                {
                  text: `Report ID\n${scan.id}`,
                  fontSize: 8.6,
                  color: '#64748b',
                  alignment: 'right',
                  lineHeight: 1.35,
                },
              ],
              border: [false, false, false, false],
            },
          ]],
        },
        layout: {
          fillColor: () => '#ffffff',
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 2,
          paddingRight: () => 2,
          paddingTop: () => 2,
          paddingBottom: () => 2,
        },
        margin: [0, 0, 0, 12],
      },
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 448,
            table: {
              widths: [208, 16, '*'],
              body: [[
                {
                  svg: renderScoreGaugeSvg(score, grade, status, interpretation),
                  width: 206,
                  height: 212,
                  border: [false, false, false, false],
                },
                {
                  canvas: [{ type: 'line', x1: 8, y1: 6, x2: 8, y2: 230, lineWidth: 1.6, lineColor: '#cbd5e1' }],
                  border: [false, false, false, false],
                },
                {
                  table: {
                    widths: ['*'],
                    body: [
                      [{
                        stack: [
                          { text: 'Score', color: '#94a3b8', fontSize: 9, bold: true, margin: [0, 0, 0, 6] },
                          { text: `${score} / 100`, fontSize: 24, bold: true, color: '#0f172a' },
                        ],
                        border: [false, false, false, true],
                        borderColor: ['#ffffff', '#ffffff', '#ffffff', '#e2e8f0'],
                      }],
                      [{
                        stack: [
                          { text: 'Grade', color: '#94a3b8', fontSize: 9, bold: true, margin: [0, 0, 0, 6] },
                          { text: grade, fontSize: 24, bold: true, color: '#0f172a' },
                        ],
                        border: [false, false, false, true],
                        borderColor: ['#ffffff', '#ffffff', '#ffffff', '#e2e8f0'],
                      }],
                      [{
                        stack: [
                          { text: 'Status', color: '#94a3b8', fontSize: 9, bold: true, margin: [0, 0, 0, 6] },
                          { text: status, fontSize: 18, bold: true, color: scoreColor(score) },
                        ],
                        border: [false, false, false, false],
                      }],
                    ],
                  },
                  layout: {
                    hLineWidth: () => 0,
                    vLineWidth: () => 0,
                    paddingLeft: () => 10,
                    paddingRight: () => 0,
                    paddingTop: (i: number) => (i === 0 ? 6 : 16),
                    paddingBottom: (i: number, node: any) => (i === node.table.body.length - 1 ? 6 : 16),
                  },
                  border: [false, false, false, false],
                },
              ]],
            },
            layout: {
              fillColor: () => '#f8fafc',
              hLineWidth: () => 0,
              vLineWidth: () => 0,
              paddingLeft: () => 18,
              paddingRight: () => 18,
              paddingTop: () => 18,
              paddingBottom: () => 18,
            },
          },
          { width: '*', text: '' },
        ],
        margin: [0, 0, 0, 14],
      },
      {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: 'Executive Summary', color: '#94a3b8', fontSize: 9, bold: true, margin: [0, 0, 0, 8] },
              { text: summary, fontSize: 10.5, color: '#111827', lineHeight: 1.32 },
              {
                ul: recommendations.map(text => ({ text, margin: [0, 0, 0, 3] })),
                margin: [0, 12, 0, 0],
                fontSize: 9.8,
                color: '#374151',
              },
            ],
            border: [false, false, false, false],
          }]],
        },
        layout: {
          fillColor: () => '#ffffff',
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 18,
          paddingRight: () => 18,
          paddingTop: () => 16,
          paddingBottom: () => 16,
        },
        margin: [0, 0, 0, 18],
      },
      {
        columns: [
          { text: 'Generated by Almond teAI', fontSize: 8.8, color: '#475569', bold: true },
          { text: 'AI security verification and trust reporting platform', fontSize: 8.8, color: '#94a3b8', alignment: 'right' },
        ],
        margin: [0, 10, 0, 0],
      },

      {
        text: 'Executive Summary & Score Analysis',
        style: 'sectionHeader',
        pageBreak: 'before',
      },
      {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: 'Assessment Note', color: '#94a3b8', fontSize: 9, bold: true, margin: [0, 0, 0, 8] },
              { text: summary, fontSize: 11, color: '#111827', lineHeight: 1.35 },
              {
                ul: recommendations.map(text => ({ text, margin: [0, 0, 0, 3] })),
                margin: [0, 14, 0, 0],
                fontSize: 10,
                color: '#374151',
              },
            ],
            border: [false, false, false, false],
          }]],
        },
        layout: {
          fillColor: () => '#ffffff',
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 18,
          paddingRight: () => 18,
          paddingTop: () => 18,
          paddingBottom: () => 18,
        },
        margin: [0, 8, 0, 18],
      },
      {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: 'Why this score?', color: '#94a3b8', fontSize: 9, bold: true, margin: [0, 0, 0, 8] },
              { text: scoreDrivers.summary, fontSize: 10.2, color: '#111827', lineHeight: 1.34, margin: [0, 0, 0, 10] },
              {
                ul: scoreDrivers.drivers.slice(0, 3).map(text => ({ text, margin: [0, 0, 0, 3] })),
                fontSize: 9.6,
                color: '#374151',
              },
            ],
            border: [false, false, false, false],
          }]],
        },
        layout: {
          fillColor: () => '#f8fafc',
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 18,
          paddingRight: () => 18,
          paddingTop: () => 16,
          paddingBottom: () => 16,
        },
        margin: [0, 0, 0, 18],
      },
      coverageNotesSection(scan),
      {
        table: {
          widths: ['*', '*', '*', '*', '*'],
          body: [[
            { text: `Critical\n${counts.critical}`, style: 'metricCritical', border: [false, false, false, false] },
            { text: `High\n${counts.high}`, style: 'metricHigh', border: [false, false, false, false] },
            { text: `Medium\n${counts.medium}`, style: 'metricMedium', border: [false, false, false, false] },
            { text: `Low\n${counts.low}`, style: 'metricLow', border: [false, false, false, false] },
            { text: `Info\n${counts.info}`, style: 'metricInfo', border: [false, false, false, false] },
          ]],
        },
        layout: {
          fillColor: () => '#ffffff',
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 12,
          paddingRight: () => 12,
          paddingTop: () => 16,
          paddingBottom: () => 16,
        },
        margin: [0, 0, 0, 18],
      },
      {
        text: 'Issue Distribution',
        style: 'subHeader',
      },
      {
        text: 'Detected issues are distributed below by severity to make the current risk profile easier to scan at a glance.',
        style: 'bodyText',
        margin: [0, 0, 0, 10],
      },
      issueDistributionChart(distributionRows, maxCount),
      {
        table: {
          widths: ['*'],
          body: [[{
            text: 'Almond teAI scores reflect severity, confidence, and exploitability context from the automated scan. They communicate current posture and prioritization signals, but they remain point-in-time evidence rather than a complete manual security assessment.',
            style: 'bodyText',
            border: [false, false, false, false],
          }]],
        },
        layout: {
          fillColor: () => '#ffffff',
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 18,
          paddingRight: () => 18,
          paddingTop: () => 16,
          paddingBottom: () => 16,
        },
        margin: [0, 0, 0, 0],
      },

      {
        text: 'Detailed Findings',
        style: 'sectionHeader',
        pageBreak: 'before',
      },
      ...(findings.length === 0
        ? [{
            table: {
              widths: ['*'],
              body: [[{
                stack: [
                  { text: 'No findings were identified in the latest automated scan.', fontSize: 12, bold: true, color: '#0f172a' },
                  { text: 'A clean automated result should still be complemented with deeper expert review for production-critical systems.', margin: [0, 8, 0, 0], fontSize: 10, color: '#475569', lineHeight: 1.3 },
                ],
                border: [false, false, false, false],
              }]],
            },
            layout: {
              fillColor: () => '#ffffff',
              hLineWidth: () => 0,
              vLineWidth: () => 0,
              paddingLeft: () => 18,
              paddingRight: () => 18,
              paddingTop: () => 18,
              paddingBottom: () => 18,
            },
          }]
        : findings.map((finding, index) => findingCard(finding, index, scan.scanType))),

      {
        text: 'Remediation Guidance',
        style: 'sectionHeader',
        pageBreak: 'before',
      },
      {
        text: 'The priorities below convert the assessment into a practical remediation sequence for product, engineering, and security teams.',
        style: 'bodyText',
        margin: [0, 0, 0, 14],
      },
      ...priorities.map((priority, index) => remediationCard(priority, index)),

      {
        text: 'Platform Trust',
        style: 'sectionHeader',
        pageBreak: 'before',
      },
      {
        text: 'About Almond teAI',
        style: 'subHeader',
      },
      {
        text: 'Almond teAI is an AI security verification and trust platform for applications, websites, and codebases. It helps teams move from one-time scanning toward repeatable verification, public trust signals, and clearer security transparency over time.',
        style: 'bodyText',
        margin: [0, 0, 0, 16],
      },
      {
        text: 'Why Almond teAI',
        style: 'subHeader',
      },
      {
        text: 'The platform is designed to help technical and non-technical stakeholders understand the current security posture of a target through structured scoring, findings, trust records, and verification surfaces.',
        style: 'bodyText',
        margin: [0, 0, 0, 16],
      },
      {
        text: 'Additional Services',
        style: 'subHeader',
      },
      {
        table: {
          widths: ['*', '*', '*'],
          body: [[
            serviceCard('review', 'Manual Security Review', 'Deeper expert validation for exploitability, business logic risk, and remediation quality beyond automated detection.'),
            serviceCard('monitoring', 'Continuous Monitoring', 'Ongoing premium monitoring for repeated verification, score tracking, and regression visibility after releases.'),
            serviceCard('verification', 'Public Trust Verification', 'External verification pages and trust badges help partners and customers review the latest scan posture of a project.'),
          ]],
        },
        layout: {
          fillColor: () => '#f8fafc',
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 16,
          paddingRight: () => 16,
          paddingTop: () => 14,
          paddingBottom: () => 14,
        },
        margin: [0, 0, 0, 18],
      },
      {
        text: 'Verify this report online',
        style: 'subHeader',
      },
      {
        table: {
          widths: ['*'],
          body: [[{
            stack: [verificationText(verificationUrl)],
            border: [false, false, false, false],
          }]],
        },
        layout: {
          fillColor: () => '#f8fafc',
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 16,
          paddingRight: () => 16,
          paddingTop: () => 12,
          paddingBottom: () => 12,
        },
        margin: [0, 0, 0, 18],
      },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 507, y2: 0, lineWidth: 1, lineColor: '#e5e7eb' }],
        margin: [0, 6, 0, 10],
      },
      {
        columns: [
          { text: 'Generated by Almond teAI', fontSize: 8.5, color: '#475569', bold: true },
          { text: 'almondteai.com', fontSize: 8.5, color: '#94a3b8', alignment: 'right' },
        ],
      },
      {
        text: 'Automated security analysis provides guidance but does not guarantee the absence of vulnerabilities.',
        fontSize: 8.3,
        color: '#94a3b8',
        margin: [0, 4, 0, 0],
      },
    ],
    styles: {
      sectionHeader: {
        fontSize: 16,
        bold: true,
        color: '#0f172a',
        margin: [0, 0, 0, 12],
      },
      subHeader: {
        fontSize: 12,
        bold: true,
        color: '#0f172a',
        margin: [0, 0, 0, 8],
      },
      bodyText: {
        fontSize: 10,
        color: '#374151',
        lineHeight: 1.35,
      },
      metricCritical: {
        fontSize: 11,
        bold: true,
        alignment: 'center',
        color: '#b91c1c',
      },
      metricHigh: {
        fontSize: 11,
        bold: true,
        alignment: 'center',
        color: '#c2410c',
      },
      metricMedium: {
        fontSize: 11,
        bold: true,
        alignment: 'center',
        color: '#a16207',
      },
      metricLow: {
        fontSize: 11,
        bold: true,
        alignment: 'center',
        color: '#1d4ed8',
      },
      metricInfo: {
        fontSize: 11,
        bold: true,
        alignment: 'center',
        color: '#475569',
      },
    },
  };

  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = PdfPrinter.createPdf(docDef);
      pdfDoc.getBuffer((buffer: Buffer) => resolve(buffer));
    } catch (err) {
      reject(err);
    }
  });
}
