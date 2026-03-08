import fs from 'fs';
import path from 'path';
import type { Severity } from './patterns';
import type { VulnerabilityResult } from './types';

interface DependencyEntry {
  name: string;
  version: string;
  ecosystem: string;
  manifestPath: string;
}

interface OsvVulnerability {
  id?: string;
  summary?: string;
  details?: string;
  severity?: Array<{ type?: string; score?: string }>;
  database_specific?: {
    severity?: string;
  };
  affected?: Array<{
    ranges?: Array<{
      events?: Array<{
        fixed?: string;
      }>;
    }>;
  }>;
}

const DEPENDENCY_FILES = new Set([
  'package.json',
  'package-lock.json',
  'requirements.txt',
  'Pipfile',
  'poetry.lock',
  'pom.xml',
  'go.mod',
  'composer.json',
  'Cargo.toml',
  'Gemfile',
]);

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.cache',
  '__pycache__',
  '.venv',
  'venv',
  'coverage',
]);

function normalizeVersion(raw: string): string | null {
  const trimmed = raw.trim().replace(/^v/, '');
  const exact = trimmed.match(/^=?=?\s*([0-9]+(?:\.[0-9A-Za-z-]+){0,5})$/);
  if (exact) return exact[1];

  const simplified = trimmed.replace(/^[~^><=\s]+/, '');
  if (/^[0-9]+(?:\.[0-9A-Za-z-]+){0,5}$/.test(simplified)) {
    return simplified;
  }

  return null;
}

function collectDependencyFiles(dir: string, files: string[] = []): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectDependencyFiles(fullPath, files);
      continue;
    }

    if (entry.isFile() && DEPENDENCY_FILES.has(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function packageJsonDependencies(filePath: string): DependencyEntry[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(raw) as Record<string, Record<string, string> | undefined>;
  const sections = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];
  const results: DependencyEntry[] = [];

  for (const section of sections) {
    const deps = json[section];
    if (!deps) continue;
    for (const [name, versionRange] of Object.entries(deps)) {
      const version = normalizeVersion(versionRange);
      if (!version) continue;
      results.push({ name, version, ecosystem: 'npm', manifestPath: filePath });
    }
  }

  return results;
}

function packageLockDependencies(filePath: string): DependencyEntry[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(raw) as {
    packages?: Record<string, { version?: string }>;
    dependencies?: Record<string, { version?: string }>;
  };
  const results: DependencyEntry[] = [];

  if (json.packages) {
    for (const [pkgPath, pkg] of Object.entries(json.packages)) {
      if (!pkgPath || !pkg.version) continue;
      const parts = pkgPath.split('node_modules/');
      const name = parts[parts.length - 1];
      const version = normalizeVersion(pkg.version);
      if (!name || !version) continue;
      results.push({ name, version, ecosystem: 'npm', manifestPath: filePath });
    }
    return results;
  }

  if (json.dependencies) {
    for (const [name, pkg] of Object.entries(json.dependencies)) {
      const version = normalizeVersion(pkg.version ?? '');
      if (!version) continue;
      results.push({ name, version, ecosystem: 'npm', manifestPath: filePath });
    }
  }

  return results;
}

function requirementsDependencies(filePath: string): DependencyEntry[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.match(/^([A-Za-z0-9_.-]+)==([A-Za-z0-9_.+-]+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map(match => ({
      name: match[1],
      version: match[2],
      ecosystem: 'PyPI',
      manifestPath: filePath,
    }));
}

function pipfileDependencies(filePath: string): DependencyEntry[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const results: DependencyEntry[] = [];
  let currentSection = '';

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }
    if (!['packages', 'dev-packages'].includes(currentSection)) continue;

    const depMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=\s*["']([^"']+)["']/);
    if (!depMatch) continue;
    const version = normalizeVersion(depMatch[2]);
    if (!version) continue;
    results.push({
      name: depMatch[1],
      version,
      ecosystem: 'PyPI',
      manifestPath: filePath,
    });
  }

  return results;
}

function poetryLockDependencies(filePath: string): DependencyEntry[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const results: DependencyEntry[] = [];
  const packageBlocks = raw.split('[[package]]');

  for (const block of packageBlocks) {
    const name = block.match(/name\s*=\s*"([^"]+)"/)?.[1];
    const version = block.match(/version\s*=\s*"([^"]+)"/)?.[1];
    if (!name || !version) continue;
    const normalized = normalizeVersion(version);
    if (!normalized) continue;
    results.push({ name, version: normalized, ecosystem: 'PyPI', manifestPath: filePath });
  }

  return results;
}

function pomDependencies(filePath: string): DependencyEntry[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const dependencyBlocks = raw.match(/<dependency>[\s\S]*?<\/dependency>/g) ?? [];
  const results: DependencyEntry[] = [];

  for (const block of dependencyBlocks) {
    const groupId = block.match(/<groupId>([^<]+)<\/groupId>/)?.[1]?.trim();
    const artifactId = block.match(/<artifactId>([^<]+)<\/artifactId>/)?.[1]?.trim();
    const version = block.match(/<version>([^<]+)<\/version>/)?.[1]?.trim();
    const normalized = version ? normalizeVersion(version) : null;
    if (!groupId || !artifactId || !normalized) continue;
    results.push({
      name: `${groupId}:${artifactId}`,
      version: normalized,
      ecosystem: 'Maven',
      manifestPath: filePath,
    });
  }

  return results;
}

function goModDependencies(filePath: string): DependencyEntry[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const results: DependencyEntry[] = [];
  const lines = raw.split(/\r?\n/);
  let inRequireBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;
    if (trimmed === 'require (') {
      inRequireBlock = true;
      continue;
    }
    if (inRequireBlock && trimmed === ')') {
      inRequireBlock = false;
      continue;
    }

    const match = (inRequireBlock ? trimmed : trimmed.startsWith('require ') ? trimmed.slice(8).trim() : '')
      .match(/^([^\s]+)\s+v?([0-9][^\s]*)/);
    if (!match) continue;
    const normalized = normalizeVersion(match[2]);
    if (!normalized) continue;
    results.push({
      name: match[1],
      version: normalized,
      ecosystem: 'Go',
      manifestPath: filePath,
    });
  }

  return results;
}

function composerDependencies(filePath: string): DependencyEntry[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(raw) as Record<string, Record<string, string> | undefined>;
  const results: DependencyEntry[] = [];

  for (const section of ['require', 'require-dev']) {
    const deps = json[section];
    if (!deps) continue;
    for (const [name, versionRange] of Object.entries(deps)) {
      const version = normalizeVersion(versionRange);
      if (!version) continue;
      results.push({ name, version, ecosystem: 'Packagist', manifestPath: filePath });
    }
  }

  return results;
}

function cargoDependencies(filePath: string): DependencyEntry[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const results: DependencyEntry[] = [];
  let currentSection = '';

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }
    if (!currentSection.includes('dependencies')) continue;

    const stringMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=\s*"([^"]+)"/);
    if (stringMatch) {
      const version = normalizeVersion(stringMatch[2]);
      if (version) {
        results.push({ name: stringMatch[1], version, ecosystem: 'crates.io', manifestPath: filePath });
      }
      continue;
    }

    const tableMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\s*=\s*\{[^}]*version\s*=\s*"([^"]+)"/);
    if (tableMatch) {
      const version = normalizeVersion(tableMatch[2]);
      if (version) {
        results.push({ name: tableMatch[1], version, ecosystem: 'crates.io', manifestPath: filePath });
      }
    }
  }

  return results;
}

function gemfileDependencies(filePath: string): DependencyEntry[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .map(line => line.match(/^gem\s+["']([^"']+)["']\s*,\s*["']([^"']+)["']/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map(match => {
      const version = normalizeVersion(match[2]);
      return version
        ? { name: match[1], version, ecosystem: 'RubyGems', manifestPath: filePath }
        : null;
    })
    .filter((entry): entry is DependencyEntry => Boolean(entry));
}

function parseDependencyFile(filePath: string): DependencyEntry[] {
  const fileName = path.basename(filePath);

  switch (fileName) {
    case 'package.json':
      return packageJsonDependencies(filePath);
    case 'package-lock.json':
      return packageLockDependencies(filePath);
    case 'requirements.txt':
      return requirementsDependencies(filePath);
    case 'Pipfile':
      return pipfileDependencies(filePath);
    case 'poetry.lock':
      return poetryLockDependencies(filePath);
    case 'pom.xml':
      return pomDependencies(filePath);
    case 'go.mod':
      return goModDependencies(filePath);
    case 'composer.json':
      return composerDependencies(filePath);
    case 'Cargo.toml':
      return cargoDependencies(filePath);
    case 'Gemfile':
      return gemfileDependencies(filePath);
    default:
      return [];
  }
}

function mapCvssToSeverity(score: number): Severity {
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  if (score > 0) return 'low';
  return 'info';
}

function deriveSeverity(vuln: OsvVulnerability): Severity {
  const dbSeverity = vuln.database_specific?.severity?.toLowerCase();
  if (dbSeverity === 'critical' || dbSeverity === 'high' || dbSeverity === 'medium' || dbSeverity === 'low') {
    return dbSeverity;
  }

  const numericScore = vuln.severity
    ?.map(item => item.score?.trim() ?? '')
    .map(score => (/^\d+(\.\d+)?$/.test(score) ? Number(score) : NaN))
    .find(score => Number.isFinite(score));

  if (numericScore !== undefined && Number.isFinite(numericScore)) {
    return mapCvssToSeverity(numericScore);
  }

  return 'high';
}

function findSafeVersion(vuln: OsvVulnerability): string | null {
  for (const affected of vuln.affected ?? []) {
    for (const range of affected.ranges ?? []) {
      for (const event of range.events ?? []) {
        if (event.fixed) {
          return event.fixed;
        }
      }
    }
  }
  return null;
}

function dependencyDescription(entry: DependencyEntry, vuln: OsvVulnerability, safeVersion: string | null): string {
  const summary = vuln.summary?.trim() || 'Dependency reported by OSV as vulnerable.';
  const safeText = safeVersion ? ` Safe version: >=${safeVersion}.` : '';
  return `Dependency: ${entry.name}. Installed version: ${entry.version}.${safeText} ${summary}`.trim();
}

async function queryOsv(entry: DependencyEntry): Promise<OsvVulnerability[]> {
  try {
    const response = await fetch('https://api.osv.dev/v1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        package: {
          name: entry.name,
          ecosystem: entry.ecosystem,
        },
        version: entry.version,
      }),
    });

    if (!response.ok) return [];
    const json = await response.json() as { vulns?: OsvVulnerability[] };
    return json.vulns ?? [];
  } catch {
    return [];
  }
}

function dedupeDependencies(entries: DependencyEntry[]): DependencyEntry[] {
  const map = new Map<string, DependencyEntry>();
  for (const entry of entries) {
    const key = `${entry.ecosystem}:${entry.name}:${entry.version}`;
    if (!map.has(key)) {
      map.set(key, entry);
    }
  }
  return Array.from(map.values());
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = items[index++];
      results.push(await mapper(current));
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, () => worker()));
  return results;
}

export async function scanDependencies(rootDir: string): Promise<VulnerabilityResult[]> {
  const dependencyFiles = collectDependencyFiles(rootDir);
  const parsed = dependencyFiles.flatMap(parseDependencyFile);
  const dependencies = dedupeDependencies(parsed).slice(0, 120);

  const resultGroups = await mapWithConcurrency(dependencies, 5, async entry => {
    const vulns = await queryOsv(entry);
    return vulns.map<VulnerabilityResult>(vuln => {
      const safeVersion = findSafeVersion(vuln);
      const severity = deriveSeverity(vuln);
      const relPath = path.relative(rootDir, entry.manifestPath);
      return {
        type: 'Vulnerable Dependency',
        category: 'dependency',
        severity,
        confidence: 'verified',
        exploitability: 'possible',
        file: relPath,
        description: dependencyDescription(entry, vuln, safeVersion),
        suggestion: safeVersion
          ? `Upgrade ${entry.name} from ${entry.version} to ${safeVersion} or later, then rerun dependency verification.`
          : `Review advisory ${vuln.id ?? 'OSV'} for ${entry.name} and upgrade to a safe version as soon as possible.`,
        code: `${entry.name}@${entry.version}${safeVersion ? ` -> >=${safeVersion}` : ''}${vuln.id ? ` (${vuln.id})` : ''}`,
      };
    });
  });

  return resultGroups.flat();
}
