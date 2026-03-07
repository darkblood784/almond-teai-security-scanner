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

export interface VulnerabilityResult {
  type: string;
  severity: Severity;
  confidence: FindingConfidence;
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

interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
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

function scanFile(filePath: string, relPath: string, content: string): VulnerabilityResult[] {
  const results: VulnerabilityResult[] = [];
  const ext = path.extname(filePath).toLowerCase();
  const lines = content.split('\n');

  for (const pattern of SECURITY_PATTERNS) {
    if (pattern.fileTypes && !pattern.fileTypes.includes(ext)) continue;

    pattern.pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.pattern.exec(content)) !== null) {
      const upToMatch = content.slice(0, match.index);
      const lineNumber = upToMatch.split('\n').length;
      const lineContent = lines[lineNumber - 1]?.trim() ?? '';

      if (lineContent.startsWith('//') || lineContent.startsWith('#') || lineContent.startsWith('*')) {
        continue;
      }

      results.push({
        type: pattern.type,
        severity: pattern.severity,
        confidence: inferConfidence(pattern.type, pattern.severity),
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

function collectFiles(dir: string, collected: string[] = []): string[] {
  if (collected.length >= MAX_FILES) return collected;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return collected;
  }

  for (const entry of entries) {
    if (collected.length >= MAX_FILES) break;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.next', 'dist', 'build', '.cache', '__pycache__', '.venv', 'venv', 'coverage'].includes(entry.name)) {
        continue;
      }
      collectFiles(fullPath, collected);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SKIP_EXTENSIONS.has(ext)) continue;
      if (SKIP_FILES.has(entry.name)) continue;

      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }
      if (stat.size > MAX_FILE_SIZE) continue;

      collected.push(fullPath);
    }
  }

  return collected;
}

export async function scanDirectory(dir: string): Promise<ScanResult> {
  const allFiles = collectFiles(dir);
  const vulnerabilities: VulnerabilityResult[] = [];
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

    vulnerabilities.push(...scanFile(filePath, relPath, content));
  }

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

  return {
    score,
    totalFiles: allFiles.length,
    scannedFiles,
    linesScanned,
    vulnerabilities,
    summary,
  };
}
