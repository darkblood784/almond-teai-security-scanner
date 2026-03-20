import type { VulnerabilityResult } from '@/lib/scanner/types';

export type Fixability =
  | 'auto-fixable'
  | 'auto-fix-risky'
  | 'manual-only'
  | 'review-required'
  | 'uncategorized';

export interface FixabilityClassification {
  fixability: Fixability;
  fixLevel: number;
  rationale: string;
}

const RULES: Record<string, FixabilityClassification> = {
  'Hardcoded Secret': {
    fixability: 'manual-only',
    fixLevel: 30,
    rationale: 'Credentials should be rotated and potentially replaced across external systems before code edits.',
  },
  'Exposed Secret': {
    fixability: 'manual-only',
    fixLevel: 25,
    rationale: 'Exposed secrets require incident-response style rotation and access review.',
  },
  'Vulnerable Dependency': {
    fixability: 'auto-fixable',
    fixLevel: 90,
    rationale: 'Dependency versions can usually be upgraded with package manager updates.',
  },
  'High-Risk Dependency': {
    fixability: 'auto-fix-risky',
    fixLevel: 75,
    rationale: 'Dependency upgrades are often automatic but may include compatibility impact.',
  },
  'Missing HSTS Header': {
    fixability: 'auto-fixable',
    fixLevel: 95,
    rationale: 'Adding strict transport security header is a well-defined low-risk configuration change.',
  },
  'Missing CSP Header': {
    fixability: 'auto-fix-risky',
    fixLevel: 70,
    rationale: 'CSP defaults can be generated but may require tuning to avoid blocking existing assets.',
  },
  'Missing X-Frame-Options': {
    fixability: 'auto-fixable',
    fixLevel: 95,
    rationale: 'Adding frame protection header is typically safe and deterministic.',
  },
  'CORS Wildcard Origin': {
    fixability: 'auto-fix-risky',
    fixLevel: 70,
    rationale: 'Restricting wildcard origins is important but requires validation against client integrations.',
  },
  'No HTTPS': {
    fixability: 'manual-only',
    fixLevel: 20,
    rationale: 'HTTPS remediation depends on infrastructure and certificate deployment outside source code.',
  },
  'Weak TLS': {
    fixability: 'auto-fix-risky',
    fixLevel: 65,
    rationale: 'TLS hardening is partially automatable but operational testing is required.',
  },
  'Unsafe Code Execution': {
    fixability: 'review-required',
    fixLevel: 45,
    rationale: 'Execution patterns are context dependent and replacement strategy requires developer review.',
  },
  'Potential SQL Injection': {
    fixability: 'review-required',
    fixLevel: 40,
    rationale: 'SQL query construction differs by stack and needs contextual code refactoring.',
  },
  'Insecure Cryptographic Usage': {
    fixability: 'auto-fix-risky',
    fixLevel: 80,
    rationale: 'Algorithm replacement is possible but compatibility and key handling should be verified.',
  },
  'Insecure Authentication': {
    fixability: 'review-required',
    fixLevel: 35,
    rationale: 'Authentication fixes often require broader architecture and secret management decisions.',
  },
};

export function classifyFinding(finding: Pick<VulnerabilityResult, 'type' | 'category' | 'severity'>): FixabilityClassification {
  const direct = RULES[finding.type];
  if (direct) return direct;

  if (finding.category === 'secret') {
    return {
      fixability: 'manual-only',
      fixLevel: 30,
      rationale: 'Secret findings typically require credential lifecycle and operational response.',
    };
  }

  if (finding.category === 'dependency') {
    return {
      fixability: 'auto-fix-risky',
      fixLevel: 70,
      rationale: 'Dependency findings can often be upgraded automatically with regression testing.',
    };
  }

  if (finding.severity === 'critical' || finding.severity === 'high') {
    return {
      fixability: 'review-required',
      fixLevel: 35,
      rationale: 'Higher-severity findings default to review-required when no deterministic rule exists.',
    };
  }

  return {
    fixability: 'uncategorized',
    fixLevel: 0,
    rationale: 'No explicit fixability rule matched this finding type yet.',
  };
}

export function isSimpleFixableType(findingType: string): boolean {
  return new Set([
    'Missing HSTS Header',
    'Missing CSP Header',
    'Missing X-Frame-Options',
    'CORS Wildcard Origin',
    'Vulnerable Dependency',
    'High-Risk Dependency',
  ]).has(findingType);
}
