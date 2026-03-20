// Quick test script to validate Phase 2 AST rules
import fs from 'fs';
import path from 'path';
import { scanJsTsAst } from '../lib/scanner/ast/index';

const testFixturePath = 'test-fixtures/phase2-ast-rules';
const testFiles = [
  'unsafe-exec-vulnerable.ts',
  'sql-injection-vulnerable.ts',
  'crypto-vulnerable.ts',
  'auth-vulnerable.ts',
  'legitimate-code.ts',
];

console.log('=== Phase 2 AST Rules Validation ===\n');

for (const file of testFiles) {
  const filePath = path.join(testFixturePath, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  
  console.log(`\n📄 Testing: ${file}`);
  console.log('-'.repeat(60));
  
  const result = scanJsTsAst(file, content);
  
  if (!result.parsed) {
    console.log(`❌ Parse Error: ${result.parseError}`);
    continue;
  }
  
  if (result.findings.length === 0) {
    console.log(`✅ No findings (as expected or legitimate code)`);
  } else {
    console.log(`✅ Found ${result.findings.length} issue(s):\n`);
    for (const finding of result.findings) {
      console.log(`  • ${finding.type}`);
      console.log(`    Severity: ${finding.severity} | Confidence: ${finding.confidence}`);
      console.log(`    Line ${finding.line}: ${finding.code}`);
      console.log(`    Description: ${finding.description}\n`);
    }
  }
}

console.log('\n=== Summary ===');
console.log('Run this script with: npx ts-node scripts/validate-phase2-ast.ts');
