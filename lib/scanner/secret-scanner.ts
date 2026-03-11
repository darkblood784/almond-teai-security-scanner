import fs from 'fs';
import path from 'path';
import type { VulnerabilityResult } from './types';

interface SecretPattern {
  id: string;
  label: string;
  pattern: RegExp;
  description: string;
  suggestion: string;
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    id: 'ALM-SEC-AWS-001',
    label: 'AWS Access Key',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    description: 'An AWS Access Key appears to be committed in the repository.',
    suggestion: 'Remove the key from the repository, rotate it immediately, and move credentials into a secret manager or environment variable.',
  },
  {
    id: 'ALM-SEC-GH-001',
    label: 'GitHub Token',
    pattern: /\bghp_[A-Za-z0-9]{36}\b/g,
    description: 'A GitHub personal access token appears to be committed in the repository.',
    suggestion: 'Revoke the token immediately and replace it with a securely managed secret.',
  },
  {
    id: 'ALM-SEC-STRIPE-001',
    label: 'Stripe Live Key',
    pattern: /\bsk_live_[0-9A-Za-z]{16,}\b/g,
    description: 'A Stripe live secret key appears to be present in repository content.',
    suggestion: 'Revoke and rotate the live key, then move it into a secure secret store.',
  },
  {
    id: 'ALM-SEC-KEY-001',
    label: 'Private Key Material',
    pattern: /-----BEGIN PRIVATE KEY-----/g,
    description: 'Private key material appears to be present in the repository.',
    suggestion: 'Remove the private key, rotate affected credentials, and store key material outside the repository.',
  },
  {
    id: 'ALM-SEC-JWT-001',
    label: 'JWT Token',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/g,
    description: 'A JWT-like token appears to be committed in the repository.',
    suggestion: 'Remove the token from source control and rotate or invalidate it if it was active.',
  },
  {
    id: 'ALM-SEC-GOOGLE-001',
    label: 'Google API Key',
    pattern: /\bAIza[0-9A-Za-z-_]{35}\b/g,
    description: 'A Google API key appears to be present in the repository.',
    suggestion: 'Rotate the key, restrict it by referrer/IP where possible, and store it securely outside the repository.',
  },
];

const ENV_FILE_EXCLUSIONS = new Set([
  '.env.example',
  '.env.sample',
  '.env.template',
  '.env.test.example',
  '.env.local.example',
]);

const ENV_ASSIGNMENT_PATTERN = /(?:^|\n)\s*[A-Z0-9_]+\s*=\s*.+/m;

function lineNumberFromIndex(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function isSensitiveEnvFile(relPath: string): boolean {
  const base = path.basename(relPath).toLowerCase();
  if (ENV_FILE_EXCLUSIONS.has(base)) return false;
  return base === '.env' || (base.startsWith('.env.') && !base.includes('.example'));
}

function firstEnvAssignmentLine(lines: string[]): { line: number; code: string } | null {
  for (let index = 0; index < lines.length; index++) {
    const code = lines[index].trim();
    if (!code || code.startsWith('#')) continue;
    if (/^[A-Z0-9_]+\s*=/.test(code)) {
      return { line: index + 1, code: code.slice(0, 200) };
    }
  }

  return null;
}

export async function scanSecrets(files: string[], rootDir: string): Promise<VulnerabilityResult[]> {
  const results: VulnerabilityResult[] = [];

  for (const filePath of files) {
    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const relPath = path.relative(rootDir, filePath);
    const lines = content.split('\n');

    if (isSensitiveEnvFile(relPath) && ENV_ASSIGNMENT_PATTERN.test(content)) {
      const firstAssignment = firstEnvAssignmentLine(lines);
      results.push({
        type: 'Committed Environment File',
        category: 'secret',
        severity: 'critical',
        confidence: 'verified',
        exploitability: 'confirmed',
        file: relPath,
        line: firstAssignment?.line,
        code: firstAssignment?.code,
        description: 'A committed environment file was detected in the repository. Environment files commonly contain secrets and should not be committed to source control.',
        suggestion: 'Remove the .env file from the repository, rotate any exposed credentials, add .env* to .gitignore, and keep secrets in environment variables or a secret manager.',
      });
    }

    for (const pattern of SECRET_PATTERNS) {
      pattern.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      let matchCount = 0;

      while ((match = pattern.pattern.exec(content)) !== null) {
        const line = lineNumberFromIndex(content, match.index);
        const code = lines[line - 1]?.trim()?.slice(0, 200) ?? '';

        results.push({
          type: 'Exposed Secret',
          category: 'secret',
          severity: 'critical',
          confidence: 'verified',
          exploitability: 'confirmed',
          file: relPath,
          line,
          code,
          description: `${pattern.label} detected in repository content (${pattern.id}). ${pattern.description}`,
          suggestion: pattern.suggestion,
        });

        matchCount += 1;
        if (matchCount >= 3) {
          break;
        }
      }

      pattern.pattern.lastIndex = 0;
    }
  }

  return results;
}
