import type { Vulnerability } from '@prisma/client';

export type RegressionStatus = 'improved' | 'stable' | 'degraded';

interface ComparableScan {
  id: string;
  score: number | null;
  vulnerabilities: Array<Pick<Vulnerability, 'type' | 'category' | 'severity' | 'file' | 'line'>>;
}

export interface RegressionResult {
  previousScanId: string | null;
  previousScore: number | null;
  currentScore: number | null;
  scoreDelta: number | null;
  regressionStatus: RegressionStatus | null;
  regressionSummary: string | null;
  newFindingsCount: number;
  resolvedFindingsCount: number;
  unchangedFindingsCount: number;
}

function lineKey(line: number | null): string {
  return line == null ? '' : String(line);
}

function findingFingerprint(
  finding: Pick<Vulnerability, 'type' | 'category' | 'file' | 'line'>,
): string {
  return [
    finding.type.trim().toLowerCase(),
    finding.category.trim().toLowerCase(),
    finding.file.trim().toLowerCase(),
    lineKey(finding.line),
  ].join('|');
}

function uniqueFingerprints(
  findings: Array<Pick<Vulnerability, 'type' | 'category' | 'file' | 'line'>>,
): Set<string> {
  return new Set(findings.map(findingFingerprint));
}

function countNewHighRiskFindings(
  currentFindings: Array<Pick<Vulnerability, 'type' | 'category' | 'severity' | 'file' | 'line'>>,
  previousFingerprints: Set<string>,
): number {
  return currentFindings.filter(finding => {
    const severity = finding.severity.toLowerCase();
    if (severity !== 'critical' && severity !== 'high') return false;
    return !previousFingerprints.has(findingFingerprint(finding));
  }).length;
}

function summarizeRegression(
  scoreDelta: number,
  newCount: number,
  resolvedCount: number,
  newHighRiskCount: number,
): { status: RegressionStatus; summary: string } {
  if (newHighRiskCount > 0 || scoreDelta < 0) {
    return {
      status: 'degraded',
      summary: newHighRiskCount > 0
        ? 'Security posture degraded since the previous scan. New higher-risk findings were introduced.'
        : 'Security posture degraded since the previous scan. The overall score declined compared with the previous assessment.',
    };
  }

  if (scoreDelta > 0 || resolvedCount > newCount) {
    return {
      status: 'improved',
      summary: 'Security posture improved since the previous scan. Previously detected issues were resolved and overall risk decreased.',
    };
  }

  return {
    status: 'stable',
    summary: 'Security posture remained broadly stable compared with the previous scan.',
  };
}

export function compareScans(
  previousScan: ComparableScan | null,
  currentScan: ComparableScan,
): RegressionResult {
  if (!previousScan) {
    return {
      previousScanId: null,
      previousScore: null,
      currentScore: currentScan.score,
      scoreDelta: null,
      regressionStatus: null,
      regressionSummary: null,
      newFindingsCount: 0,
      resolvedFindingsCount: 0,
      unchangedFindingsCount: 0,
    };
  }

  const previousFingerprints = uniqueFingerprints(previousScan.vulnerabilities);
  const currentFingerprints = uniqueFingerprints(currentScan.vulnerabilities);

  let newFindingsCount = 0;
  let unchangedFindingsCount = 0;
  currentFingerprints.forEach(fingerprint => {
    if (previousFingerprints.has(fingerprint)) unchangedFindingsCount += 1;
    else newFindingsCount += 1;
  });

  let resolvedFindingsCount = 0;
  previousFingerprints.forEach(fingerprint => {
    if (!currentFingerprints.has(fingerprint)) resolvedFindingsCount += 1;
  });

  const currentScore = currentScan.score;
  const previousScore = previousScan.score;
  const scoreDelta =
    currentScore == null || previousScore == null
      ? null
      : currentScore - previousScore;

  if (scoreDelta == null) {
    return {
      previousScanId: previousScan.id,
      previousScore,
      currentScore,
      scoreDelta: null,
      regressionStatus: null,
      regressionSummary: null,
      newFindingsCount,
      resolvedFindingsCount,
      unchangedFindingsCount,
    };
  }

  const newHighRiskCount = countNewHighRiskFindings(currentScan.vulnerabilities, previousFingerprints);
  const summary = summarizeRegression(scoreDelta, newFindingsCount, resolvedFindingsCount, newHighRiskCount);

  return {
    previousScanId: previousScan.id,
    previousScore,
    currentScore,
    scoreDelta,
    regressionStatus: summary.status,
    regressionSummary: summary.summary,
    newFindingsCount,
    resolvedFindingsCount,
    unchangedFindingsCount,
  };
}
