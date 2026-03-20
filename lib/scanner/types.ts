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
  line?: number | null;
  code?: string | null;
  description: string;
  suggestion: string;
  fixability?: 'auto-fixable' | 'auto-fix-risky' | 'manual-only' | 'review-required' | 'uncategorized';
  fixLevel?: number;
}

export type WebsiteProfile = 'surface' | 'webapp-light' | 'api-surface' | 'cms-exposure';

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

export interface WebsiteFingerprint {
  normalizedUrl: string;
  origin: string;
  hostname: string;
  profile: WebsiteProfile;
  signals: string[];
  hasLoginForm: boolean;
  hasPasswordField: boolean;
  hasSpaMarkers: boolean;
  hasApiMarkers: boolean;
  hasCmsMarkers: boolean;
  probableAuthSurface: boolean;
  pageContentType: string;
  pageBody: string;
}

export interface WebsiteModuleResult {
  vulnerabilities: VulnerabilityResult[];
  coverageNotes: string[];
  activeValidationPerformed: boolean;
  networkChecksPartial: boolean;
  profileSignals?: string[];
  profileOverride?: WebsiteProfile | null;
  authRouteHint?: {
    url: string;
    html: string;
  } | null;
}
