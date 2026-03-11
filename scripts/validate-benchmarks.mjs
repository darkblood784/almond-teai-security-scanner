import fs from 'fs';
import path from 'path';

const cwd = process.cwd();
const benchmarksPath = path.join(cwd, 'benchmarks', 'scan-benchmarks.json');

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalize(value) {
  return String(value ?? '').toLowerCase();
}

function matchesExpectedFinding(finding, expected) {
  if (expected.type && finding.type !== expected.type) return false;
  if (expected.category && normalize(finding.category) !== normalize(expected.category)) return false;
  if (expected.severity && normalize(finding.severity) !== normalize(expected.severity)) return false;
  if (expected.confidence && normalize(finding.confidence) !== normalize(expected.confidence)) return false;
  if (expected.exploitability && normalize(finding.exploitability) !== normalize(expected.exploitability)) return false;
  return true;
}

function severityCounts(findings) {
  return findings.reduce((acc, finding) => {
    const key = normalize(finding.severity);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function validateBenchmark(definition, result) {
  const failures = [];
  const findings = result.findings ?? [];
  const expected = definition.expected;
  const foundTypes = new Set(findings.map(finding => finding.type));

  if (result.mode !== definition.mode) {
    failures.push(`Expected mode "${definition.mode}" but got "${result.mode}".`);
  }

  if (typeof result.score !== 'number') {
    failures.push('Missing numeric score.');
  } else if (result.score < expected.scoreRange.min || result.score > expected.scoreRange.max) {
    failures.push(`Score ${result.score} is outside expected range ${expected.scoreRange.min}-${expected.scoreRange.max}.`);
  }

  if (!expected.acceptableGrades.includes(result.grade)) {
    failures.push(`Grade "${result.grade}" is outside acceptable grades: ${expected.acceptableGrades.join(', ')}.`);
  }

  const requiredTypes = expected.requiredFindingTypes ?? [];
  if (requiredTypes.length > 0 && !requiredTypes.some(requiredType => foundTypes.has(requiredType))) {
    failures.push(`Missing any required finding type. Expected one of: ${requiredTypes.join(', ')}.`);
  }

  for (const forbiddenType of expected.forbiddenFindingTypes ?? []) {
    if (foundTypes.has(forbiddenType)) {
      failures.push(`Found forbidden finding type "${forbiddenType}".`);
    }
  }

  for (const requiredFinding of expected.requiredFindings ?? []) {
    if (!findings.some(finding => matchesExpectedFinding(finding, requiredFinding))) {
      failures.push(`Missing expected finding match: ${JSON.stringify(requiredFinding)}.`);
    }
  }

  if (typeof expected.maximumFindings === 'number' && findings.length > expected.maximumFindings) {
    failures.push(`Finding count ${findings.length} exceeds maximum ${expected.maximumFindings}.`);
  }

  if (expected.minimumSeverityCounts) {
    const counts = severityCounts(findings);
    for (const [severity, minCount] of Object.entries(expected.minimumSeverityCounts)) {
      const actual = counts[normalize(severity)] ?? 0;
      if (actual < minCount) {
        failures.push(`Expected at least ${minCount} ${severity} finding(s), found ${actual}.`);
      }
    }
  }

  return failures;
}

function main() {
  const resultsPath = process.argv[2];
  if (!resultsPath) {
    console.error('Usage: node scripts/validate-benchmarks.mjs <results.json>');
    process.exit(1);
  }

  const benchmarkSpec = loadJson(benchmarksPath);
  const results = loadJson(path.resolve(cwd, resultsPath));
  const resultMap = new Map(results.results.map(result => [result.id, result]));
  let hasFailures = false;

  for (const benchmark of benchmarkSpec.benchmarks) {
    const result = resultMap.get(benchmark.id);
    if (!result) {
      console.error(`FAIL ${benchmark.id}: missing benchmark result.`);
      hasFailures = true;
      continue;
    }

    const failures = validateBenchmark(benchmark, result);
    if (failures.length === 0) {
      console.log(`PASS ${benchmark.id}`);
      continue;
    }

    hasFailures = true;
    console.error(`FAIL ${benchmark.id}`);
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
  }

  if (hasFailures) {
    process.exit(1);
  }
}

main();
