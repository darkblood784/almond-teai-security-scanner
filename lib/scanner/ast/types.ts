import type { FindingConfidence, FindingExploitability, FindingSeverity, FindingCategory } from '@/lib/scoring';

export interface AstScanFinding {
  type: string;
  category: FindingCategory;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  exploitability: FindingExploitability;
  line: number | null;
  code: string | null;
  description: string;
  suggestion: string;
}

export interface AstScanResult {
  findings: AstScanFinding[];
  parsed: boolean;
  parseError?: string | null;
}
