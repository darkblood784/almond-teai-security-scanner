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

function formatBadgeDate(createdAt: Date | string): string {
  return new Date(createdAt).toISOString().slice(0, 10);
}

export function renderTrustBadge(score: number, createdAt: Date | string): string {
  const grade = gradeLabel(score);
  const accentColor = gradeColor(grade);
  const status = scoreStatusLabel(score);
  const date = formatBadgeDate(createdAt);
  const title = 'Almond teAI';
  const subtitle = 'Verified posture';
  const scoreLabel = `${score}`;
  const gradeLabelText = `Grade ${grade}`;
  const metaLeft = `Status ${status}`;
  const metaRight = `Last scan ${date}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="332" height="74" role="img" aria-label="${escapeXml(`${title} ${subtitle} ${scoreLabel} ${gradeLabelText} ${metaLeft} ${metaRight}`)}">
  <rect width="332" height="74" rx="14" fill="#ffffff"/>
  <rect x="0.5" y="0.5" width="331" height="73" rx="13.5" fill="#ffffff" stroke="#e5e7eb"/>
  <rect x="16" y="14" width="190" height="40" rx="11" fill="#0f172a"/>
  <rect x="214" y="14" width="102" height="40" rx="11" fill="${accentColor}"/>
  <rect x="24" y="24" width="18" height="18" rx="4" fill="#121826" stroke="#ffffff" stroke-opacity="0.14"/>
  <path d="M28.1 28.5C29.8 27.7 33.8 26.8 37.7 28.5C37.8 30.9 37.9 32.9 37.4 34.6C36.9 36.3 35.7 37.7 32.9 38.9C31.6 38.5 31 37.9 30.2 37.4C29.1 36.3 28.5 35.7 28.2 34.5C27.9 33.3 27.8 31.6 28.1 28.5Z" stroke="#ffffff" stroke-width="0.9" stroke-linecap="round" fill="none"/>
  <text x="48" y="31" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700">
    ${escapeXml(title)}
  </text>
  <text x="48" y="45" fill="#cbd5e1" font-family="Arial, Helvetica, sans-serif" font-size="10.5" font-weight="600">
    ${escapeXml(subtitle)}
  </text>
  <text x="265" y="31" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="21" font-weight="700" text-anchor="middle">
    ${escapeXml(scoreLabel)}
  </text>
  <text x="265" y="45" fill="#ffedd5" font-family="Arial, Helvetica, sans-serif" font-size="10.5" font-weight="700" text-anchor="middle">
    ${escapeXml(gradeLabelText)}
  </text>
  <text x="16" y="65" fill="#64748b" font-family="Arial, Helvetica, sans-serif" font-size="10.5" font-weight="600">
    ${escapeXml(metaLeft)}
  </text>
  <text x="316" y="65" fill="#64748b" font-family="Arial, Helvetica, sans-serif" font-size="10.5" font-weight="600" text-anchor="end">
    ${escapeXml(metaRight)}
  </text>
</svg>`;
}
