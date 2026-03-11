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
  filesSkipped: number;
  filesSkippedBySize: number;
  filesSkippedByType: number;
  linesScanned: number;
  dependencyAnalysisComplete: boolean;
  dependencyWarning: string | null;
  coverageNotes: string[];
  safeVerificationOnly: boolean;
  networkChecksPartial: boolean;
  vulnerabilities: VulnerabilityResult[];
  summary: string;
}

export interface DependencyScanResult {
  vulnerabilities: VulnerabilityResult[];
  completed: boolean;
  warning: string | null;
}
