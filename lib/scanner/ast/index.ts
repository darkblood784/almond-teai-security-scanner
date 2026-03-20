import path from 'path';
import type { VulnerabilityResult } from '../types';
import type { AstScanResult } from './types';
import { parseJsTsAst } from './js-ts-parser';
import { runJsTsRules } from './js-ts-rules';

const SUPPORTED_AST_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);

export function supportsAstFile(filePath: string): boolean {
  return SUPPORTED_AST_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function scanJsTsAst(relPath: string, content: string): AstScanResult {
  try {
    const ast = parseJsTsAst(content);
    return {
      parsed: true,
      findings: runJsTsRules(ast, content, relPath),
      parseError: null,
    };
  } catch (error) {
    return {
      parsed: false,
      findings: [],
      parseError: error instanceof Error ? error.message : 'Unknown AST parse failure',
    };
  }
}

export function toVulnerabilityResults(relPath: string, findings: AstScanResult['findings']): VulnerabilityResult[] {
  return findings.map(finding => ({
    ...finding,
    file: relPath,
  }));
}
