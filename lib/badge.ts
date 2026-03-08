import { gradeLabel, scoreStatusKey } from '@/lib/scoring';

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A':
      return '#15803d';
    case 'B':
      return '#2563eb';
    case 'C':
      return '#d97706';
    case 'D':
      return '#ea580c';
    default:
      return '#dc2626';
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function scoreStatusLabel(score: number): string {
  const key = scoreStatusKey(score);
  switch (key) {
    case 'excellent': return 'Excellent';
    case 'good': return 'Good';
    case 'fair': return 'Fair';
    case 'poor': return 'Poor';
    default: return 'Critical Risk';
  }
}

export function renderTrustBadge(score: number, createdAt: Date | string): string {
  const grade = gradeLabel(score);
  const rightColor = gradeColor(grade);
  const status = scoreStatusLabel(score);
  const date = new Date(createdAt).toISOString().slice(0, 10);
  const leftLabel = 'Almond teAI';
  const rightLabel = `${score} · ${grade}`;
  const metaLabel = `Status ${status} - Last scan ${date}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="332" height="74" role="img" aria-label="${escapeXml(`${leftLabel} ${rightLabel} ${metaLabel}`)}">
  <defs>
    <clipPath id="badge-main-clip">
      <rect x="16" y="14" width="280" height="40" rx="8"/>
    </clipPath>
  </defs>
  <rect width="332" height="74" rx="14" fill="#ffffff"/>
  <rect x="0.5" y="0.5" width="331" height="73" rx="13.5" fill="#ffffff" stroke="#e5e7eb"/>
  <g clip-path="url(#badge-main-clip)">
    <rect x="16" y="14" width="280" height="40" fill="#1f2937"/>
    <rect x="198" y="14" width="98" height="40" fill="${rightColor}"/>
  </g>

  <text x="38" y="39" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700">
    ${escapeXml(leftLabel)}
  </text>
  <text x="247" y="39" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" text-anchor="middle">
    ${escapeXml(rightLabel)}
  </text>
  <text x="16" y="67" fill="#6b7280" font-family="Arial, Helvetica, sans-serif" font-size="11">
    ${escapeXml(metaLabel)}
  </text>
</svg>`;
}
