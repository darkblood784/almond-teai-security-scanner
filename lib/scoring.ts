export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingConfidence = 'detected' | 'likely' | 'verified';
export type FindingExploitability = 'none' | 'possible' | 'confirmed';
export type FindingCategory = 'secret' | 'dependency' | 'code' | 'exposure' | 'configuration';
export type ScanKind = 'code' | 'website';
export type ScoreGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type ScoreStatusKey = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
export interface ScoreInterpretation {
  headline: string;
  detail: string;
}

export interface ScoredFinding {
  type: string;
  category: FindingCategory;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  exploitability?: FindingExploitability;
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

const EXPLOITABILITY_MULTIPLIERS: Record<FindingExploitability, number> = {
  none: 1,
  possible: 1.1,
  confirmed: 1.25,
};

const CATEGORY_MULTIPLIERS: Record<FindingCategory, number> = {
  secret: 1.6,
  dependency: 1.3,
  code: 1.2,
  exposure: 1.1,
  configuration: 1.0,
};

function getDuplicateMultiplier(index: number): number {
  if (index === 0) return 1;
  if (index === 1) return 0.6;
  return 0.3;
}

function getCategoryModifier(finding: ScoredFinding, scanKind: ScanKind): number {
  const type = finding.type.toLowerCase();
  const base = CATEGORY_MULTIPLIERS[finding.category] ?? 1;

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
      return base * 0.5;
    }

    if (
      type.includes('exposed .env') ||
      type.includes('exposed git repository') ||
      type.includes('wordpress config') ||
      type.includes('php info page exposed') ||
      type.includes('cors wildcard + credentials')
    ) {
      return base * 1.5;
    }

    return base;
  }

  if (
    type.includes('hardcoded secret') ||
    type.includes('sql injection') ||
    type.includes('unsafe code execution') ||
    type.includes('insecure authentication')
  ) {
    return base * 1.1;
  }

  return base;
}

function getGrade(score: number): ScoreGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 65) return 'C';
  if (score >= 50) return 'D';
  return 'F';
}

function getStatusKey(score: number): ScoreStatusKey {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  if (score >= 30) return 'poor';
  return 'critical';
}

export interface ScoreResult {
  score: number;
  grade: ScoreGrade;
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
    const exploitabilityMultiplier = EXPLOITABILITY_MULTIPLIERS[finding.exploitability ?? 'none'] ?? 1;
    const categoryModifier = getCategoryModifier(finding, scanKind);

    const currentOccurrence = occurrenceCount.get(finding.type) ?? 0;
    occurrenceCount.set(finding.type, currentOccurrence + 1);

    const duplicateMultiplier = getDuplicateMultiplier(currentOccurrence);
    const penalty = severityWeight * confidenceMultiplier * exploitabilityMultiplier * categoryModifier * duplicateMultiplier;

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

export function gradeLabel(score: number): ScoreGrade {
  return getGrade(score);
}

export function scoreStatusKey(score: number): ScoreStatusKey {
  return getStatusKey(score);
}

export function scoreInterpretation(score: number): ScoreInterpretation {
  switch (getGrade(score)) {
    case 'A':
      return {
        headline: 'Strong security posture',
        detail: 'No critical vulnerabilities detected',
      };
    case 'B':
      return {
        headline: 'Good security posture',
        detail: 'Some issues should be addressed to maintain trust',
      };
    case 'C':
      return {
        headline: 'Moderate security risk',
        detail: 'Remediation is recommended before broader trust use',
      };
    case 'D':
      return {
        headline: 'Elevated security risk',
        detail: 'Significant remediation is recommended',
      };
    default:
      return {
        headline: 'Serious security concerns detected',
        detail: 'Immediate remediation is recommended',
      };
  }
}
