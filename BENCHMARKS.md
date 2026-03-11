# Benchmark Score Consistency

This file defines the MVP internal process for checking whether Almond teAI still produces expected findings, grades, and score ranges after scanner or scoring changes.

## Files

- `benchmarks/scan-benchmarks.json`
  Contains the benchmark target definitions and expected outcomes.
- `scripts/validate-benchmarks.mjs`
  Validates actual benchmark run results against the expected ranges and finding requirements.

## Why this exists

The scanner now has enough moving parts that score drift can happen for legitimate reasons or from regressions:

- secret detection changes
- dependency lookup behavior
- duplicate suppression changes
- website hygiene softening
- exploitability verification changes
- coverage/completeness handling

This benchmark set is meant to catch score changes that are surprising, misleading, or obviously inconsistent with prior behavior.

## Benchmark set

The current benchmark manifest includes:

- committed `.env`
- real hardcoded secret in source
- vulnerable dependency repo
- docs/examples fake secret repo
- repeated-pattern noise repo
- header-only weak website
- exposed `.env`
- exposed `.git/HEAD`
- wildcard CORS only
- wildcard CORS + credentials
- plain HTTP site

Each case defines:

- `mode`
- expected required finding types
- expected category/severity/confidence/exploitability where important
- expected score range
- acceptable grades

## Expected score ranges

Exact scores are intentionally not used as the primary contract.

Use bounded ranges instead:

- narrow enough to catch regressions
- wide enough to tolerate harmless tuning

Suggested interpretation:

- repo and website high-risk cases should usually land in `D/F`
- header-only hygiene cases should remain materially better than exposed-secret cases
- fake-secret/docs-noise cases should remain clean or near-clean

If a legitimate scoring-model change is intentional, update the benchmark ranges in the manifest in the same change set.

## Result file format

The validator expects a JSON file like:

```json
{
  "results": [
    {
      "id": "repo-committed-env",
      "mode": "github",
      "score": 42,
      "grade": "F",
      "findings": [
        {
          "type": "Exposed Secret",
          "category": "secret",
          "severity": "critical",
          "confidence": "verified",
          "exploitability": "confirmed"
        }
      ]
    }
  ]
}
```

Only the fields needed for validation are required.

You can start from:

- `benchmarks/benchmark-results.example.json`

Copy it and replace the example scores, grades, and findings with the real values from your manual benchmark scans.

## How to run

1. Run the benchmark scans manually in Almond teAI using the targets defined in `benchmarks/scan-benchmarks.json`.
2. Save the results in a JSON file using the same shape as `benchmarks/benchmark-results.example.json`.
3. Validate the results with:

```bash
node scripts/validate-benchmarks.mjs path/to/results.json
```

## Release-gate usage later

This MVP is documentation plus a validator, not a full benchmark runner.

Later it can support CI or release validation by:

- replacing fixture target placeholders with controlled test repos/sites
- adding a small runner that triggers scans and fetches the resulting scan details
- storing prior benchmark outputs for diffing over time
- failing a release if a critical benchmark falls outside its accepted range

## Current recommendation

Run this benchmark set before:

- changing `lib/scanner/*`
- changing `lib/scoring.ts`
- changing regression or dedupe behavior
- changing website verification rules
- changing coverage/completeness handling
