export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingConfidence = 'detected' | 'likely' | 'verified';
export type ScanKind = 'code' | 'website';

export interface ScoredFinding {
  type: string;
  severity: FindingSeverity;
  confidence: FindingConfidence;
}

const SEVERITY_WEIGHTS: Record<FindingSeverity, number> = {
  critical: 20,
  high: 10,
  medium: 5,
  low: 2,
  info: 0.25,
};

const CONFIDENCE_MULTIPLIERS: Record<FindingConfidence, number> = {
  detected: 0.7,
  likely: 1.0,
  verified: 1.4,
};

function getDuplicateMultiplier(index: number): number {
  if (index === 0) return 1;
  if (index === 1) return 0.6;
  return 0.3;
}

function getCategoryModifier(finding: ScoredFinding, scanKind: ScanKind): number {
  const type = finding.type.toLowerCase();

  if (scanKind === 'website') {
    if (
      type.includes('missing hsts') ||
      type.includes('missing content-security-policy') ||
      type.includes('missing x-frame-options') ||
      type.includes('missing x-content-type-options') ||
      type.includes('missing referrer-policy') ||
      type.includes('cookie missing httponly flag') ||
      type.includes('cookie missing secure flag') ||
      type.includes('server technology disclosed') ||
      type.includes('server version disclosed') ||
      type.includes('cors wildcard origin')
    ) {
      return 0.5;
    }

    if (
      type.includes('exposed .env') ||
      type.includes('exposed git repository') ||
      type.includes('wordpress config') ||
      type.includes('php info page exposed') ||
      type.includes('cors wildcard + credentials')
    ) {
      return 1.5;
    }

    return 1;
  }

  if (
    type.includes('hardcoded secret') ||
    type.includes('sql injection') ||
    type.includes('unsafe code execution') ||
    type.includes('insecure authentication')
  ) {
    return 1.1;
  }

  return 1;
}

function getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 65) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

export interface ScoreResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  totalPenalty: number;
}

export function calculateScore(findings: ScoredFinding[], scanKind: ScanKind): ScoreResult {
  const occurrenceCount = new Map<string, number>();
  let totalPenalty = 0;
  let websiteHygienePenalty = 0;
  let verifiedCriticalCount = 0;

  for (const finding of findings) {
    const severityWeight = SEVERITY_WEIGHTS[finding.severity] ?? 0;
    const confidenceMultiplier = CONFIDENCE_MULTIPLIERS[finding.confidence] ?? 1;
    const categoryModifier = getCategoryModifier(finding, scanKind);

    const currentOccurrence = occurrenceCount.get(finding.type) ?? 0;
    occurrenceCount.set(finding.type, currentOccurrence + 1);

    const duplicateMultiplier = getDuplicateMultiplier(currentOccurrence);
    const penalty = severityWeight * confidenceMultiplier * categoryModifier * duplicateMultiplier;

    if (
      scanKind === 'website' &&
      finding.confidence === 'detected' &&
      (finding.severity === 'info' || finding.severity === 'low' || categoryModifier <= 0.5)
    ) {
      websiteHygienePenalty += penalty;
    } else {
      totalPenalty += penalty;
    }

    if (finding.severity === 'critical' && finding.confidence === 'verified') {
      verifiedCriticalCount++;
    }
  }

  if (scanKind === 'website') {
    totalPenalty += Math.min(12, websiteHygienePenalty);
  } else {
    totalPenalty += websiteHygienePenalty;
  }

  let score = Math.max(0, Math.round((100 - totalPenalty) * 10) / 10);
  let grade = getGrade(score);

  if (verifiedCriticalCount >= 2) {
    grade = 'F';
    score = Math.min(score, 49);
  } else if (verifiedCriticalCount === 1 && grade !== 'D' && grade !== 'F') {
    grade = 'D';
    score = Math.min(score, 64);
  }

  return {
    score: Math.round(score),
    grade,
    totalPenalty: Math.round(totalPenalty * 10) / 10,
  };
}

export function gradeLabel(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  return getGrade(score);
}
