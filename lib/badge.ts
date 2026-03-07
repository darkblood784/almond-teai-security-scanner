import { gradeLabel } from '@/lib/scoring';

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A':
      return '#15803d';
    case 'B':
      return '#2563eb';
    case 'C':
      return '#b45309';
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

export function renderTrustBadge(score: number, createdAt: Date | string): string {
  const grade = gradeLabel(score);
  const rightColor = gradeColor(grade);
  const date = new Date(createdAt).toISOString().slice(0, 10);
  const leftLabel = 'Almond teAI verified';
  const rightLabel = `Score ${score} · ${grade}`;
  const dateLabel = `Last scan ${date}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="54" role="img" aria-label="${escapeXml(`${leftLabel} ${rightLabel} ${dateLabel}`)}">
  <rect width="360" height="54" rx="10" fill="#ffffff"/>
  <rect x="0.5" y="0.5" width="359" height="53" rx="9.5" fill="#ffffff" stroke="#e5e7eb"/>
  <rect x="0" y="0" width="198" height="54" rx="10" fill="#111827"/>
  <rect x="198" y="0" width="162" height="54" rx="10" fill="${rightColor}"/>
  <rect x="198" y="0" width="10" height="54" fill="${rightColor}"/>

  <text x="18" y="23" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700">
    ${escapeXml(leftLabel)}
  </text>

  <text x="216" y="22" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700">
    ${escapeXml(rightLabel)}
  </text>

  <text x="216" y="39" fill="rgba(255,255,255,0.92)" font-family="Arial, Helvetica, sans-serif" font-size="10">
    ${escapeXml(dateLabel)}
  </text>
</svg>`;
}
