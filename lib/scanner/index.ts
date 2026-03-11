import fs from 'fs';
import path from 'path';
import {
  SECURITY_PATTERNS,
  SKIP_EXTENSIONS,
  SKIP_FILES,
  MAX_FILE_SIZE,
  MAX_FILES,
  type Severity,
} from './patterns';
import { calculateScore, type FindingConfidence } from '@/lib/scoring';
import { scanSecrets } from './secret-scanner';
import { scanDependencies } from './dependency-scanner';
import type { DependencyScanResult, ScanResult, VulnerabilityResult } from './types';

interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

interface FileCollectionStats {
  files: string[];
  filesSkippedByType: number;
  filesSkippedBySize: number;
  filesSkippedByLimit: number;
}

const HIGH_VALUE_TYPES = new Set([
  'Hardcoded Secret',
  'SQL Injection',
  'Unsafe Code Execution',
  'Insecure Authentication',
]);

const GENERIC_SECRET_PLACEHOLDERS = [
  'example',
  'sample',
  'changeme',
  'dummy',
  'test',
  'xxx',
];

function isScannerInternal(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/').toLowerCase();
  return normalized.startsWith('lib/scanner/');
}

function isLowValueContext(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/').toLowerCase();
  const base = path.basename(normalized);

  if (base.startsWith('readme')) return true;
  if (normalized.endsWith('.md')) return true;
  if (normalized.startsWith('docs/')) return true;
  if (normalized.startsWith('examples/')) return true;
  if (normalized.includes('/examples/')) return true;
  if (normalized.startsWith('fixtures/')) return true;
  if (normalized.includes('/fixtures/')) return true;
  if (normalized.includes('/__fixtures__/')) return true;
  if (normalized.includes('/test-fixtures/')) return true;
  if (normalized.startsWith('samples/')) return true;
  if (normalized.includes('/samples/')) return true;

  return false;
}

function shouldSuppressPattern(relPath: string, patternType: string, severity: Severity): boolean {
  if (HIGH_VALUE_TYPES.has(patternType)) return false;
  if (!isLowValueContext(relPath)) return false;
  return severity === 'low' || severity === 'medium' || severity === 'info';
}

function isCommentLine(lineContent: string): boolean {
  const trimmed = lineContent.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*') || trimmed.startsWith('/*');
}

function isInstructionalLine(lineContent: string): boolean {
  const normalized = lineContent.toLowerCase();
  return (
    normalized.includes('example') ||
    normalized.includes('sample') ||
    normalized.includes('tutorial') ||
    normalized.includes('demo') ||
    normalized.includes('placeholder') ||
    normalized.includes('replace this')
  );
}

function isGenericHardcodedSecretPattern(patternId: string, patternName: string): boolean {
  return patternId === 'HC_GENERIC_SECRET' || patternName === 'Hardcoded Secret/Token';
}

function extractAssignedSecretValue(lineContent: string): string {
  const match = lineContent.match(/[:=]\s*['"`]?([^'"`\s,;]+(?:\s[^'"`]+)?)['"`]?/);
  return (match?.[1] ?? '').trim().toLowerCase();
}

function looksLikePlaceholderSecret(value: string): boolean {
  if (!value) return true;
  if (value.length < 8) return true;
  return GENERIC_SECRET_PLACEHOLDERS.some(placeholder => value.includes(placeholder));
}

function shouldSuppressHardcodedSecretMatch(
  relPath: string,
  lineContent: string,
  patternId: string,
  patternName: string,
): boolean {
  if (!isGenericHardcodedSecretPattern(patternId, patternName)) return false;
  if (isLowValueContext(relPath)) return true;
  if (isCommentLine(lineContent)) return true;
  if (isInstructionalLine(lineContent)) return true;

  const assignedValue = extractAssignedSecretValue(lineContent);
  return looksLikePlaceholderSecret(assignedValue);
}

function normalizedCode(code?: string): string {
  return (code ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function dedupeVulnerabilities(vulnerabilities: VulnerabilityResult[]): VulnerabilityResult[] {
  const exactSeen = new Set<string>();
  const fileTypeCounts = new Map<string, number>();
  const kept: VulnerabilityResult[] = [];

  for (const vulnerability of vulnerabilities) {
    const exactKey = [
      vulnerability.category,
      vulnerability.type,
      vulnerability.file,
      vulnerability.line ?? 0,
      normalizedCode(vulnerability.code),
    ].join('|');

    if (exactSeen.has(exactKey)) continue;
    exactSeen.add(exactKey);

    const preserveNearLine =
      vulnerability.category === 'secret' ||
      vulnerability.category === 'dependency' ||
      HIGH_VALUE_TYPES.has(vulnerability.type);

    if (!preserveNearLine) {
      const nearDuplicate = kept.find(existing =>
        existing.type === vulnerability.type &&
        existing.file === vulnerability.file &&
        Math.abs((existing.line ?? -9999) - (vulnerability.line ?? 9999)) <= 3,
      );
      if (nearDuplicate) continue;
    }

    const countKey = `${vulnerability.file}|${vulnerability.type}`;
    const currentCount = fileTypeCounts.get(countKey) ?? 0;
    const cap = preserveNearLine ? 5 : 3;
    if (currentCount >= cap) continue;
    fileTypeCounts.set(countKey, currentCount + 1);

    kept.push(vulnerability);
  }

  return kept;
}

function inferConfidence(type: string, severity: Severity): FindingConfidence {
  if (severity === 'critical' && (
    type === 'Hardcoded Secret' ||
    type === 'SQL Injection' ||
    type === 'Unsafe Code Execution' ||
    type === 'Insecure Authentication'
  )) {
    return 'likely';
  }

  if (severity === 'high') {
    return 'likely';
  }

  return 'detected';
}

function inferCategory(type: string): VulnerabilityResult['category'] {
  if (type === 'Misconfiguration') return 'configuration';
  if (type === 'Open Admin Route') return 'exposure';
  return 'code';
}

function scanFile(filePath: string, relPath: string, content: string): VulnerabilityResult[] {
  const results: VulnerabilityResult[] = [];
  const ext = path.extname(filePath).toLowerCase();
  const lines = content.split('\n');

  for (const pattern of SECURITY_PATTERNS) {
    if (pattern.fileTypes && !pattern.fileTypes.includes(ext)) continue;
    if (shouldSuppressPattern(relPath, pattern.type, pattern.severity)) continue;

    pattern.pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.pattern.exec(content)) !== null) {
      const upToMatch = content.slice(0, match.index);
      const lineNumber = upToMatch.split('\n').length;
      const lineContent = lines[lineNumber - 1]?.trim() ?? '';

      if (isCommentLine(lineContent)) {
        continue;
      }

      if (pattern.type === 'Hardcoded Secret' && shouldSuppressHardcodedSecretMatch(relPath, lineContent, pattern.id, pattern.name)) {
        continue;
      }

      results.push({
        type: pattern.type,
        category: inferCategory(pattern.type),
        severity: pattern.severity,
        confidence: inferConfidence(pattern.type, pattern.severity),
        exploitability: 'none',
        file: relPath,
        line: lineNumber,
        code: lineContent.slice(0, 200),
        description: pattern.description,
        suggestion: pattern.suggestion,
      });

      const samePattern = results.filter(
        result => result.file === relPath && result.description === pattern.description,
      );
      if (samePattern.length >= 3) break;
    }

    pattern.pattern.lastIndex = 0;
  }

  return results;
}

function collectFiles(dir: string, stats: FileCollectionStats = {
  files: [],
  filesSkippedByType: 0,
  filesSkippedBySize: 0,
  filesSkippedByLimit: 0,
}): FileCollectionStats {
  if (stats.files.length >= MAX_FILES) return stats;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return stats;
  }

  for (const entry of entries) {
    if (stats.files.length >= MAX_FILES) {
      stats.filesSkippedByLimit += 1;
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.next', 'dist', 'build', '.cache', '__pycache__', '.venv', 'venv', 'coverage'].includes(entry.name)) {
        continue;
      }
      collectFiles(fullPath, stats);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SKIP_EXTENSIONS.has(ext) || SKIP_FILES.has(entry.name)) {
        stats.filesSkippedByType += 1;
        continue;
      }

      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.size > MAX_FILE_SIZE) {
        stats.filesSkippedBySize += 1;
        continue;
      }

      stats.files.push(fullPath);
    }
  }

  return stats;
}

export async function scanDirectory(dir: string): Promise<ScanResult> {
  const fileStats = collectFiles(dir);
  const allFiles = fileStats.files;
  const codeVulnerabilities: VulnerabilityResult[] = [];
  let linesScanned = 0;
  let scannedFiles = 0;

  for (const filePath of allFiles) {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const relPath = path.relative(dir, filePath);
    linesScanned += content.split('\n').length;
    scannedFiles++;

    if (!isScannerInternal(relPath)) {
      codeVulnerabilities.push(...scanFile(filePath, relPath, content));
    }
  }

  const [secretVulnerabilities, dependencyResult] = await Promise.all([
    scanSecrets(allFiles, dir),
    scanDependencies(dir),
  ]);

  const dependencyScan = dependencyResult as DependencyScanResult;

  const vulnerabilities = dedupeVulnerabilities([
    ...codeVulnerabilities,
    ...secretVulnerabilities,
    ...dependencyScan.vulnerabilities,
  ]);

  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const vulnerability of vulnerabilities) counts[vulnerability.severity]++;

  const score = calculateScore(vulnerabilities, 'code').score;

  const total = vulnerabilities.length;
  const summary =
    total === 0
      ? `No vulnerabilities detected across ${scannedFiles} files. Great security posture!`
      : `Found ${total} issue${total !== 1 ? 's' : ''} across ${scannedFiles} files - ` +
        [
          counts.critical && `${counts.critical} critical`,
          counts.high && `${counts.high} high`,
          counts.medium && `${counts.medium} medium`,
          counts.low && `${counts.low} low`,
        ].filter(Boolean).join(', ') + '.';

  const finalSummary = dependencyScan.warning
    ? `${summary}\n\nDependency scan note: ${dependencyScan.warning}`
    : summary;
  const filesSkipped = fileStats.filesSkippedByType + fileStats.filesSkippedBySize + fileStats.filesSkippedByLimit;
  const coverageNotes: string[] = [];

  coverageNotes.push(`Scanned ${scannedFiles} file${scannedFiles === 1 ? '' : 's'} out of ${allFiles.length + filesSkipped} collected candidate file${allFiles.length + filesSkipped === 1 ? '' : 's'}.`);

  if (fileStats.filesSkippedByType > 0) {
    coverageNotes.push(`${fileStats.filesSkippedByType} file${fileStats.filesSkippedByType === 1 ? '' : 's'} were skipped because their type is excluded from static scanning (for example binary, archive, lock, media, or database files).`);
  }

  if (fileStats.filesSkippedBySize > 0) {
    coverageNotes.push(`${fileStats.filesSkippedBySize} file${fileStats.filesSkippedBySize === 1 ? '' : 's'} were skipped for exceeding the current size limit of ${Math.round(MAX_FILE_SIZE / 1024)} KB.`);
  }

  if (fileStats.filesSkippedByLimit > 0) {
    coverageNotes.push(`${fileStats.filesSkippedByLimit} file${fileStats.filesSkippedByLimit === 1 ? '' : 's'} were not scanned because the repository exceeded the current per-scan file limit of ${MAX_FILES}.`);
  }

  if (!dependencyScan.completed && dependencyScan.warning) {
    coverageNotes.push(dependencyScan.warning);
  }

  return {
    score,
    totalFiles: allFiles.length,
    scannedFiles,
    filesSkipped,
    filesSkippedBySize: fileStats.filesSkippedBySize,
    filesSkippedByType: fileStats.filesSkippedByType,
    linesScanned,
    dependencyAnalysisComplete: dependencyScan.completed,
    dependencyWarning: dependencyScan.warning,
    coverageNotes,
    safeVerificationOnly: false,
    networkChecksPartial: false,
    vulnerabilities,
    summary: finalSummary,
  };
}
