import type { Vulnerability } from '@prisma/client';

type ScanType = 'github' | 'upload' | 'website';

export interface ScoreDriversResult {
  summary: string;
  drivers: string[];
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function buildScoreDrivers(scanType: ScanType, vulnerabilities: Vulnerability[]): ScoreDriversResult {
  if (vulnerabilities.length === 0) {
    return {
      summary: 'This score stayed high because the scan did not produce any persisted findings.',
      drivers: ['No critical, high-confidence, or exploitable findings were detected in this run.'],
    };
  }

  const verifiedCritical = vulnerabilities.filter(
    vulnerability => vulnerability.severity === 'critical' && (vulnerability.confidence ?? 'detected') === 'verified',
  );
  const criticalSecretsOrExposure = verifiedCritical.filter(
    vulnerability => vulnerability.category === 'secret' || vulnerability.category === 'exposure',
  );
  const dependencyFindings = vulnerabilities.filter(vulnerability => vulnerability.category === 'dependency');
  const confirmedExploitability = vulnerabilities.filter(vulnerability => (vulnerability.exploitability ?? 'none') === 'confirmed');
  const possibleExploitability = vulnerabilities.filter(vulnerability => (vulnerability.exploitability ?? 'none') === 'possible');
  const verifiedFindings = vulnerabilities.filter(vulnerability => (vulnerability.confidence ?? 'detected') === 'verified');
  const highSeverity = vulnerabilities.filter(vulnerability => vulnerability.severity === 'high');
  const websiteHygiene = scanType === 'website'
    ? vulnerabilities.filter(vulnerability =>
        vulnerability.category === 'configuration' &&
        (vulnerability.confidence ?? 'detected') === 'detected' &&
        (vulnerability.severity === 'low' || vulnerability.severity === 'info'),
      )
    : [];

  const repeatedTypeCount = Array.from(
    vulnerabilities.reduce((map, vulnerability) => {
      map.set(vulnerability.type, (map.get(vulnerability.type) ?? 0) + 1);
      return map;
    }, new Map<string, number>()).values(),
  ).filter(count => count > 1).length;

  const drivers: string[] = [];

  if (criticalSecretsOrExposure.length > 0) {
    drivers.push(`${pluralize(criticalSecretsOrExposure.length, 'verified critical secret or exposure finding')} significantly reduced the score.`);
  } else if (verifiedCritical.length > 0) {
    drivers.push(`${pluralize(verifiedCritical.length, 'verified critical finding')} materially reduced the score and capped the grade more aggressively.`);
  } else if (highSeverity.length > 0) {
    drivers.push(`${pluralize(highSeverity.length, 'high-severity finding')} had a meaningful impact on the final score.`);
  }

  if (dependencyFindings.length > 0) {
    drivers.push(`${pluralize(dependencyFindings.length, 'vulnerable dependency finding')} materially impacted the score.`);
  }

  if (confirmedExploitability.length > 0) {
    drivers.push(`${pluralize(confirmedExploitability.length, 'confirmed exploitable finding')} received a stronger penalty than non-exploitable findings.`);
  } else if (possibleExploitability.length > 0) {
    drivers.push(`${pluralize(possibleExploitability.length, 'possibly exploitable finding')} increased the score penalty.`);  
  }

  if (scanType === 'website' && websiteHygiene.length > 0) {
    drivers.push('Lower-confidence website hygiene issues were weighted more lightly than directly exploitable exposures.');
  }

  if (scanType === 'website' && websiteHygiene.length >= 3) {
    drivers.push('Routine header, cookie, and similar hygiene issues were softened so they do not dominate the score by themselves.');
  }

  if (repeatedTypeCount > 0) {
    drivers.push('Repeated similar findings were de-emphasized to reduce duplicate-noise in scoring.');
  }

  if (verifiedFindings.length === 0 && verifiedCritical.length === 0) {
    drivers.push('No verified critical findings were detected, which limited the severity of score reduction.');
  }

  const topDrivers = drivers.slice(0, 5);
  const summary = criticalSecretsOrExposure.length > 0
    ? 'This score is primarily driven down by severe verified exposure or secret findings.'
    : verifiedCritical.length > 0
    ? 'This score is primarily driven down by verified critical findings.'
    : dependencyFindings.length > 0 || confirmedExploitability.length > 0 || highSeverity.length > 0
    ? 'This score reflects the severity, confidence, and exploitability of the findings detected in this run.'
    : 'This score was influenced mostly by lower-severity or lower-confidence findings.';

  return {
    summary,
    drivers: topDrivers.length > 0 ? topDrivers : ['No major score drivers were identified beyond the persisted findings in this scan.'],
  };
}
