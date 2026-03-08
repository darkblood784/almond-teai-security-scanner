import type {
  FindingCategory,
  FindingConfidence,
  FindingExploitability,
  FindingSeverity,
} from '@/lib/scoring';

export interface VulnerabilityResult {
  type: string;
  category: FindingCategory;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  exploitability: FindingExploitability;
  file: string;
  line?: number;
  code?: string;
  description: string;
  suggestion: string;
}

export interface ScanResult {
  score: number;
  totalFiles: number;
  scannedFiles: number;
  linesScanned: number;
  vulnerabilities: VulnerabilityResult[];
  summary: string;
}
