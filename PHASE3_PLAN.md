# Phase 3: Scan-and-Fix Foundations — Complete Implementation Plan

**Status**: `pending` (Awaiting implementation)  
**Completion Criteria**: Supported finding types can be classified as fixable/non-fixable  
**Constraint**: No redesign, no structural changes — implement on top of existing architecture  

---

## 1. PHASE 3 OVERVIEW

### Goal
Establish a reliable **fixability classification model** that determines which security findings have automated remediation capabilities (fixable), which require manual intervention (manual-only), and which lack sufficient context for safe fixes (review-required).

This foundation enables Phase 4 (Paid Scan-and-Fix MVP) to surface fix suggestions to pro users with appropriate guidance about fixability levels.

### Why This Matters
Current system:
- ✅ Detects findings with high precision
- ✅ Provides remediation guidance (text suggestions)
- ❌ Doesn't classify which findings can be **automatically remediated** with confidence
- ❌ No infrastructure for surfacing fix suggestions in UI

Phase 3 adds:
- **Fixability Classification**: Every finding gets a `fixability` score: `auto-fixable`, `auto-fix-risky`, `manual-only`, or `review-required`
- **Confidence Metrics**: Whether the fix is safe, requires testing, or needs expert review
- **Foundation for Phase 4**: All data/classification ready to support fix suggestion UI
- **Database Hygiene**: No new tables; uses new Vulnerability model fields

### Scope (Zero Redesign)
- ✅ Add `fixability` and `fixLevel` fields to Vulnerability model (Prisma schema change)
- ✅ Implement fixability classification logic for all finding types
- ✅ Integrate fixability into scanner results
- ✅ Update Vulnerability creation to populate fixability
- ✅ Display fixability status in PDF/report (context-aware)
- ❌ No new API routes
- ❌ No UI component restructure
- ❌ No dashboard layout changes
- ❌ No fix suggestion rendering yet (that's Phase 4)

---

## 2. FINDING TYPES & FIXABILITY MATRIX

### Current Finding Types (by source)

#### **Pattern-Based Findings** (lib/scanner/secret-scanner.ts)
| Finding Type | Category | Fixability | Why | Phase 3 Action |
|--------------|----------|-----------|-----|----------------|
| **Hardcoded Secret** | secret | manual-only | Must determine if credentials were exposed to other systems; rotate first | Add metadata |
| **Exposed Secret** | secret | manual-only | Same as above; requires rotation & potentially incident response | Add metadata |

#### **Dependency Findings** (lib/scanner/dependency-scanner.ts)
| Finding Type | Category | Fixability | Why | Phase 3 Action |
|-------------|----------|-----------|-----|----------------|
| **Vulnerable Dependency** | dependency | auto-fixable | Package manager auto-update (npm, pip, etc.) can fix | Implement auto-fix classifier |
| **High-Risk Dependency** | dependency | auto-fixable | Upgrade to newer version | Implement auto-fix classifier |

#### **Website Configuration Findings** (lib/scanner/url-scanner.ts + webapp-scanner.ts modules)
| Finding Type | Category | Fixability | Why | Phase 3 Action |
|-------------|----------|-----------|-----|----------------|
| **Missing HSTS Header** | configuration | auto-fixable | Add one header line | Implement auto-fix classifier |
| **Missing CSP Header** | configuration | auto-fixable | Add header with sensible defaults | Implement auto-fixable classifier |
| **Missing X-Frame-Options** | configuration | auto-fixable | Add one header line | Implement auto-fix classifier |
| **CORS Wildcard Origin** | configuration | auto-fix-risky | Fix is simple (remove `*`) but impact depends on API contract | Implement with caution flag |
| **No HTTPS** | configuration | manual-only | Requires infrastructure change (cert + redirect) | Add metadata |
| **Weak TLS** | configuration | auto-fix-risky | Disable weak ciphers, but requires full TLS reconfig | Implement with caution flag |

#### **Code Findings (AST-Based)** (lib/scanner/ast/js-ts-rules.ts)
| Finding Type | Category | Fixability | Why | Phase 3 Action |
|-------------|----------|-----------|-----|----------------|
| **Unsafe Code Execution** | code | review-required | eval/Function/exec patterns have many contexts; auto-fix is risky | Add metadata |
| **Potential SQL Injection** | code | review-required | Depends on ORM choice, query pattern, input validation; risky auto-fix | Add metadata |
| **Insecure Cryptographic Usage** | code | auto-fixable | Replace weak algo with strong one (MD5→SHA256, ECB→GCM) | Implement auto-fix classifier |
| **Insecure Authentication** | code | review-required | JWT secret rotation or password comparison fix depends on broader auth model | Add metadata |

---

## 3. FIXABILITY CLASSIFICATION MODEL

### Fixability Levels

#### **auto-fixable** ✅
- **Definition**: Finding can be fixed automatically with high confidence; minimal side effects
- **Criteria**:
  - No ambiguity about correct behavior (e.g., headers are missing, add them)
  - Fix doesn't break existing functionality
  - No business logic implications
  - Safe to auto-apply without human review
- **Examples**:
  - Missing HSTS header → Add `Strict-Transport-Security: max-age=31536000`
  - MD5 usage → Replace with SHA256
  - Outdated npm package → `npm update package-name`
- **Phase 4 UI Behavior**: Show "Fix available" button; apply fix on demand

#### **auto-fix-risky** ⚠️
- **Definition**: Fix can be automated but has potential side effects; needs testing before production
- **Criteria**:
  - Fix is technically correct but depends on broader context
  - May require testing or validation
  - Low risk but not zero risk
  - Recommend testing in staging before production
- **Examples**:
  - CORS wildcard removal (`*` → specific origin) — may break legitimate cross-origin requests
  - Weak cipher mode change (ECB → GCM) — requires key rotation
  - TLS version upgrade — requires infrastructure validation
- **Phase 4 UI Behavior**: Show "Fix available (requires testing)" button; 2-step apply (preview + confirm)

#### **manual-only** 🔧
- **Definition**: Fix requires human judgment or infrastructure changes; cannot automate safely
- **Criteria**:
  - Requires business decision (cost, breach impact, scope)
  - Involves external systems or infrastructure
  - Fix context is unknown (rotation vs. re-architecture)
  - Requires team coordination
- **Examples**:
  - Exposed secrets → Need to determine if exposed to other systems; rotate credentials
  - No HTTPS → Infrastructure change (certificate, DNS, redirects)
  - Insecure authentication → May require complete auth system redesign
- **Phase 4 UI Behavior**: Show remediation guidance; no "Fix" button; link to manual steps

#### **review-required** 👨‍💻
- **Definition**: Finding is valid but fix depends on specific codebase context; requires code review
- **Criteria**:
  - Multiple valid fix strategies exist
  - Context-dependent (ORM choice, input validation, error handling)
  - Auto-fix could miss edge cases
  - Requires developer judgment
- **Examples**:
  - SQL injection in custom query → Fix depends on ORM (Prisma? SQLite? Mongoose?)
  - eval() usage → Replace with safer alternative (depends on what was being evaluated)
  - Hardcoded JWT secret → Fix depends on auth architecture (env var? secret manager? rotation strategy?)
- **Phase 4 UI Behavior**: Show "Code review recommended" badge; show multiple fix strategies as guidance

#### **uncategorized** ❓
- **Definition**: Finding type not yet classified or new finding type
- **Criteria**:
  - Fallback for findings without explicit fixability rules
  - Prevents crashes; defaults to safe option
- **Phase 4 UI Behavior**: Show "Fixability unknown" badge; don't offer auto-fix options

---

## 4. IMPLEMENTATION STRATEGY

### Step 1: Database Schema Changes (Prisma)

Add two new fields to Vulnerability model:

```prisma
model Vulnerability {
  // ... existing fields
  fixability    String    @default("uncategorized")  // auto-fixable, auto-fix-risky, manual-only, review-required, uncategorized
  fixLevel      Int       @default(0)                 // 0-100 confidence score for the fixability classification
  
  @@index([fixability])
}
```

**Why this design**:
- `fixability` = human-readable category
- `fixLevel` = numerical confidence (0-100) for ranking fix priority in Phase 4 UI

### Step 2: Create Fixability Classifier Module

New file: `lib/fixability.ts`

```typescript
interface FixabilityClassification {
  fixability: 'auto-fixable' | 'auto-fix-risky' | 'manual-only' | 'review-required' | 'uncategorized';
  fixLevel: number;  // 0-100 confidence
  rationale: string;  // Why this classification (for Phase 4 UI tooltips)
}

export function classifyFinding(finding: VulnerabilityResult): FixabilityClassification {
  // Implementation: Match finding.type to classification rules
  // Return fixability + fixLevel + rationale
}

export const FIXABILITY_RULES: Map<string, FixabilityClassification> = new Map([
  // Pattern-based findings
  ['Hardcoded Secret', {
    fixability: 'manual-only',
    fixLevel: 30,
    rationale: 'Requires credential rotation and potentially incident response.',
  }],
  
  // ... more rules for each finding type
]);
```

### Step 3: Integrate Classifier into Scanner

Modify `lib/scanner/index.ts` and all scanner entry points to apply fixability after creating findings:

```typescript
// In scanDirectory() and scanUrl()
const vulnerabilities = [...allFindings];
const vulnerabilitiesWithFixability = vulnerabilities.map(finding => ({
  ...finding,
  fixability: classifyFinding(finding).fixability,
  fixLevel: classifyFinding(finding).fixLevel,
}));
```

### Step 4: Update API Routes to Persist Fixability

Modify `app/api/analyze/route.ts` to store fixability in database:

```typescript
// When creating Vulnerability records:
await prisma.vulnerability.create({
  data: {
    // ... existing fields
    fixability: result.fixability,
    fixLevel: result.fixLevel,
  },
});
```

### Step 5: Display Fixability in PDF/Report (Optional for Phase 3)

Update `lib/pdf.ts` to show fixability badge in findings table:

```typescript
// In finding row rendering:
const fixabilityBadge = {
  'auto-fixable': { text: 'Auto-fix', color: '#10b981' },
  'auto-fix-risky': { text: 'Needs testing', color: '#f59e0b' },
  'manual-only': { text: 'Manual fix', color: '#ef4444' },
  'review-required': { text: 'Code review', color: '#8b5cf6' },
  'uncategorized': { text: 'Review', color: '#6b7280' },
};
```

---

## 5. FIXABILITY RULES BY FINDING TYPE

### Hardcoded/Exposed Secrets
```typescript
{
  type: 'Hardcoded Secret|Exposed Secret',
  fixability: 'manual-only',
  fixLevel: 30,
  rationale: 'Requires credential rotation, potentially incident response, and external system updates.',
}
```

### Vulnerable Dependencies
```typescript
{
  type: 'Vulnerable Dependency',
  fixability: 'auto-fixable',
  fixLevel: 90,
  rationale: 'Package manager can automatically upgrade to patched version. Verify no major version breaking changes.',
}
```

### HSTS / Security Headers
```typescript
{
  type: 'Missing HSTS Header|Missing Content-Security-Policy|Missing X-Frame-Options',
  fixability: 'auto-fixable',
  fixLevel: 95,
  rationale: 'Headers can be added with standard safe values. No side effects.',
}
```

### CORS Wildcard
```typescript
{
  type: 'CORS Wildcard Origin|CORS Wildcard + Credentials',
  fixability: 'auto-fix-risky',
  fixLevel: 70,
  rationale: 'Removing wildcard is technically correct but may break legitimate cross-origin requests. Test in staging first.',
}
```

### No HTTPS
```typescript
{
  type: 'No HTTPS / Unencrypted Connection',
  fixability: 'manual-only',
  fixLevel: 20,
  rationale: 'Requires infrastructure change: SSL certificate, redirects, DNS configuration.',
}
```

### Weak Cryptography (Code)
```typescript
{
  type: 'Insecure Cryptographic Usage',
  fixability: 'auto-fixable',  // For algorithm replacement
  fixLevel: 85,
  rationale: 'Weak algorithm can be replaced (MD5→SHA256, DES→AES). Verify no key expectations.',
}
```

### Unsafe Code Execution
```typescript
{
  type: 'Unsafe Code Execution',
  fixability: 'review-required',
  fixLevel: 40,
  rationale: 'Multiple safe alternatives exist (child_process alternatives, safe templating). Requires code review.',
}
```

### SQL Injection
```typescript
{
  type: 'Potential SQL Injection',
  fixability: 'review-required',
  fixLevel: 45,
  rationale: 'Fix depends on ORM/driver choice. Query parameterization patterns vary by framework.',
}
```

### Authentication/JWT Flaws
```typescript
{
  type: 'Insecure Authentication',
  fixability: 'manual-only',
  fixLevel: 35,
  rationale: 'JWT secret rotation requires coordinated deployment and potentially secret manager change.',
}
```

---

## 6. IMPLEMENTATION CHECKLIST

### Phase 3 Core Tasks ✅
- [ ] **Database Schema**: Add `fixability` + `fixLevel` to Vulnerability model
- [ ] **Classifier Module**: Create `lib/fixability.ts` with classification rules
- [ ] **Finding Type Rules**: Define fixability for all ~25 finding types
- [ ] **Scanner Integration**: Apply classifier after finding creation
- [ ] **API Integration**: Persist fixability in Vulnerability records
- [ ] **Query Builders**: Add `fixability IN ('auto-fixable', ...)` filters for Phase 4

### Phase 3 Optional (Polish)
- [ ] **PDF Display**: Show fixability badges in report (cosmetic, not functional)
- [ ] **Dashboard**: Show fixability stats (e.g., "3 auto-fixable findings available")
- [ ] **Benchmark Tests**: Ensure fixability classifier is deterministic and correct

### NOT in Phase 3 (Phase 4)
- ❌ Fix suggestion UI (buttons, preview, apply)
- ❌ Actual fix code generation
- ❌ Fix testing/validation
- ❌ Subscription checking

---

## 7. NO BREAKING CHANGES GUARANTEE

| Component | Change? | Why Safe? |
|-----------|---------|-----------|
| Vulnerability schema | ✅ Adds 2 fields | New fields with defaults; existing records unaffected |
| API contract | ❌ No | /api/analyze returns same response + new fields |
| Scoring formula | ❌ No | Fixability doesn't affect score |
| Dashboard UI | ❌ No | Existing components work unchanged; fixability info optional |
| PDF export | ✅ Minor | Adds fixability badge (cosmetic); layout unchanged |
| Scanner behavior | ❌ No | Same findings; classified after creation |
| Database | ✅ Adds 2 columns | Migration + defaults handle it |

**Backward Compatibility**:
- Old Vulnerability records lack fixability but default to 'uncategorized' + fixLevel=0
- Migration script sets reasonable defaults based on finding type
- Phase 4 queries can filter for only classified findings

---

## 8. FIXABILITY CLASSIFIER ALGORITHM

**Input**: VulnerabilityResult (type, category, severity, file, code snippet)  
**Output**: FixabilityClassification

```typescript
function classifyFinding(vuln: VulnerabilityResult): FixabilityClassification {
  // Step 1: Exact match by finding type
  const rule = FIXABILITY_RULES.get(vuln.type);
  if (rule) return rule;
  
  // Step 2: Category-based fallback
  if (vuln.category === 'secret') return { fixability: 'manual-only', fixLevel: 30 };
  if (vuln.category === 'dependency') return { fixability: 'auto-fixable', fixLevel: 80 };
  if (vuln.category === 'configuration') return { fixability: 'auto-fixable', fixLevel: 70 };
  
  // Step 3: Severity heuristic
  if (vuln.severity === 'critical') return { fixability: 'review-required', fixLevel: 50 };
  if (vuln.severity === 'high') return { fixability: 'review-required', fixLevel: 45 };
  
  // Step 4: Default (never seen before)
  return { fixability: 'uncategorized', fixLevel: 0 };
}
```

**Why this design**:
- Deterministic: Same input always produces same output
- Extensible: New finding types add to FIXABILITY_RULES map
- Graceful degradation: Unknown types get reasonable defaults
- Confidence-scored: fixLevel can drive UI ranking in Phase 4

---

## 9. PHASE 4 PREVIEW (Not Phase 3)

Once Phase 3 is done, Phase 4 can:

```typescript
// Get all auto-fixable findings for a project
const findings = await db.vulnerability.findMany({
  where: {
    scan: { projectId },
    fixability: 'auto-fixable',
  },
  orderBy: { fixLevel: 'desc' },
});

// UI shows: "3 auto-fixable findings available for project X"
// Clicking → shows fix preview and "Apply fix" button
```

---

## 10. VALIDATION & SIGN-OFF

### Step 1: Schema Migration (5 mins)
```bash
npx prisma migrate dev --name add_fixability_classification
```
Expected: Two new columns on Vulnerability table

### Step 2: Classifier Testing (30 mins)
- Test fixability classification on all ~25 finding types
- Verify determinism: same finding type always gets same classification
- Test fallback rules for unknown types

### Step 3: Integration Test (30 mins)
- Run full repository scan
- Verify all Vulnerability records have fixability populated
- Query: `SELECT fixability, COUNT(*) FROM Vulnerability GROUP BY fixability`
- Expected: Reasonable distribution (majority auto-fixable/auto-fix-risky, some manual-only)

### Step 4: Schema Validation (5 mins)
```bash
npm run build  # TypeScript check
npx prisma validate  # Schema consistency
```

### Step 5: Sign-Off (5 mins)
- Mark Phase 3 `completed` in ROADMAP_PROGRESS.md
- Commit Phase 3 work

---

## 11. SUCCESS CRITERIA

Phase 3 is complete when:
1. ✅ Vulnerability model has `fixability` + `fixLevel` fields
2. ✅ Fixability classifier implements rules for all ~25 finding types
3. ✅ Scanner applies classifier to all findings
4. ✅ API persists fixability in database
5. ✅ Queries can filter by fixability (`auto-fixable`, `manual-only`, etc.)
6. ✅ No new findings introduced (same vulnerabilities, just classified)
7. ✅ Classification is deterministic (same input → same output)
8. ✅ Production build succeeds with zero regressions
9. ✅ Fixability scores align with severity (lower severity ≈ higher fixability)
10. ✅ Phase 1 & 2 benchmarks still pass (data-only change)

---

## 12. NEXT STEPS AFTER PHASE 3

**Phase 4: Paid Scan-and-Fix MVP**
- Add fix suggestion UI (buttons, modals, preview)
- Integrate with subscription/entitlements
- Show fix previews for auto-fixable findings
- Add "Apply fix" workflow
- Track applied fixes in new FixApplication model

---

## APPENDIX: FILE INVENTORY

### Files to Create
- ✅ `lib/fixability.ts` — Classifier logic + rules map

### Files to Modify
- ✅ `prisma/schema.prisma` — Add fixability + fixLevel fields
- ✅ `lib/scanner/index.ts` — Apply classifier in scanDirectory()
- ✅ `app/api/analyze/route.ts` — Persist fixability in Vulnerability records
- ✅ `lib/scanner/types.ts` — Update VulnerabilityResult interface (optional)
- ✅ `ROADMAP_PROGRESS.md` — Mark Phase 3 completed

### Files Unchanged (for Phase 3)
- ❌ UI components (Phase 4)
- ❌ API routes (no new endpoints)
- ❌ Scoring formula
- ❌ Scanner core logic

---

**Last Updated**: 2026-03-20  
**Status**: Ready for implementation
**Estimated Effort**: 4-6 hours (schema, classifier, integration, testing, validation)

