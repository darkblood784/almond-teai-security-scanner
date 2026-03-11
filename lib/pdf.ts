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
  return `This assessment indicates Grade ${grade} (${status}). The automated analysis did not surface critical or high-severity vulnerabilities, but the result should still be treated as a point-in-time security assessment rather than a complete guarantee.`;
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
  <rect x="2" y="2" width="44" height="44" rx="12" fill="#111c34" stroke="#ffffff" stroke-width="1.2"/>
  <path d="M17 18C15.8 16.9 18.2 15.9 17 14.7" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" />
  <path d="M24 17.8C22.8 16.7 25.2 15.6 24 14.4" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" />
  <path d="M31 18C29.8 16.9 32.2 15.9 31 14.7" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" />
  <rect x="13.5" y="21.5" width="18" height="12.5" rx="3" stroke="#ffffff" stroke-width="2.2" />
  <path d="M31.5 25.5H34C36.8 25.5 38 27 38 28.4C38 29.8 36.8 31.6 34 31.6H31.5" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" />
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

function coverageNotesSection(scan: ScanWithVulns) {
  const notes = (scan.coverageNotes ?? '')
    .split('\n')
    .map((note: string) => note.trim())
    .filter(Boolean);

  const dependencyComplete = scan.dependencyAnalysisComplete ?? true;
  const safeVerificationOnly = scan.safeVerificationOnly ?? false;
  const networkChecksPartial = scan.networkChecksPartial ?? false;

  const metrics = scan.scanType === 'website'
    ? [
        coverageMetricCard('Checks Run', String(scan.totalFiles), 'neutral'),
        coverageMetricCard('Checks Passed', String(scan.scannedFiles), 'neutral'),
        coverageMetricCard('Safe Read-Only', yesNoText(safeVerificationOnly), safeVerificationOnly ? 'success' : 'neutral'),
        coverageMetricCard('Network Partial', yesNoText(networkChecksPartial), networkChecksPartial ? 'warning' : 'neutral'),
      ]
    : [
        coverageMetricCard('Files Scanned', String(scan.scannedFiles), 'neutral'),
        coverageMetricCard('Files Skipped', String(scan.filesSkipped ?? 0), (scan.filesSkipped ?? 0) > 0 ? 'warning' : 'neutral'),
        coverageMetricCard('Skipped by Size', String(scan.filesSkippedBySize ?? 0), (scan.filesSkippedBySize ?? 0) > 0 ? 'warning' : 'neutral'),
        coverageMetricCard('Skipped by Type', String(scan.filesSkippedByType ?? 0), (scan.filesSkippedByType ?? 0) > 0 ? 'warning' : 'neutral'),
      ];

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
            table: {
              widths: ['*', '*', '*', '*'],
              body: [metrics],
            },
            layout: {
              hLineWidth: () => 0,
              vLineWidth: () => 0,
              paddingLeft: () => 6,
              paddingRight: () => 6,
              paddingTop: () => 0,
              paddingBottom: () => 0,
            },
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
                  { svg: renderLogoSvg(), width: 48, height: 48 },
                  {
                    width: '*',
                    stack: [
                      { text: 'Almond teAI', color: '#ffffff', bold: true, fontSize: 17, margin: [0, 2, 0, 8] },
                      { text: 'Security Assessment Report', color: '#ffffff', bold: true, fontSize: 26, margin: [0, 0, 0, 8] },
                      { text: 'Security verification and trust reporting', color: '#94a3b8', fontSize: 10.5 },
                    ],
                  },
                ],
                columnGap: 16,
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
            text: 'Almond teAI scores reflect severity and confidence from the automated scan. They are designed to communicate current security posture and support prioritization, but automated analysis alone does not guarantee complete security coverage.',
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
            serviceCard('verification', 'Public Trust Verification', 'External verification pages and trust badges help partners and customers review the latest verified posture of a project.'),
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
