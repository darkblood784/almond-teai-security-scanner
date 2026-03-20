# Phase 1: Adaptive Website Assessment — Complete Implementation Plan

**Status**: `in_progress` (Implementation ~90% complete; Validation pending)  
**Completion Criteria**: Website profile selected automatically and reflected in coverage notes  
**Constraint**: No redesign, no structural changes — implement on top of existing architecture  

---

## 1. PHASE 1 OVERVIEW

### Goal
Enable the scanner to automatically detect website characteristics and tailor analysis depth to target type, then expose this profile selection to users via coverage notes and reporting.

### Scope (Zero Redesign)
- ✅ Add profile detection logic (signals-based fingerprinting)
- ✅ Route to profile-specific scanning modules conditionally
- ✅ Persist profile metadata in scan records
- ✅ Display profile in existing UI/PDF surfaces
- ❌ No new database tables
- ❌ No new API routes beyond existing `/api/analyze`
- ❌ No layout changes to dashboard/report
- ❌ No component restructuring

### Why This Matters
Current website scans treat all targets identically. Phase 1 enables:
- **Login-protected apps**: Run auth-oriented heuristics (browser auth flow detection, credential stuffing vectors)
- **API-first services**: Run API-surface scanning (/graphql, /swagger.json probing, API documentation analysis)
- **CMS installations**: Emphasize CMS-specific exposure checks (WordPress plugin audit, admin panel enumeration)
- **Static landing pages**: Run baseline surface-level checks only
- **Transparency**: Coverage notes clearly state what profile was selected and why (i.e., "Selected scan profile: Web App Light because login form detected")

---

## 2. IMPLEMENTATION STATUS

### ✅ ALREADY IMPLEMENTED (No Changes Needed)

#### 2.1 Website Fingerprinting Module (`lib/scanner/website-profiler.ts`)
**Status**: Complete and functional

**What it does**:
- Normalizes input URL
- Fetches main page with `safeFetch()` (6s timeout, max 32KB)
- Extracts same-origin script URLs for runtime signal analysis
- Detects signals across multiple categories:
  - **Auth signals**: Login forms, password fields, "sign in" language, runtime auth markers
  - **SPA signals**: React/Vue/Angular markers (`__NEXT_DATA__`, `__INITIAL_STATE__`, webpack)
  - **API signals**: JSON outputs, Swagger/GraphQL references, endpoint probing (/graphql, /swagger.json, /api-docs)
  - **CMS signals**: WordPress/Drupal/Joomla markers, wp-content paths, WooCommerce references
- Probes 7 common endpoints in parallel (login, /admin, /login, /graphql, /swagger.json, /api-docs, /wp-login.php)
- Returns `WebsiteFingerprint` object with:
  - `profile`: enum ('surface' | 'webapp-light' | 'api-surface' | 'cms-exposure')
  - `signals`: string[] (list of detected signals for coverage notes)
  - `normalizedUrl`: sanitized URL
  - `pageBody`: HTML content for downstream modules
  - `pageContentType`: content-type header
  - `hasPasswordField`, `hasLoginForm`, `probableAuthSurface`: boolean flags

**Profile Selection Logic**:
```
if (CMS markers detected)           → 'cms-exposure'
else if (API markers detected)      → 'api-surface'
else if (Auth markers OR SPA)       → 'webapp-light'
else                               → 'surface'
```

**Why no changes needed**: All signal detection patterns are conservative (regex-based), URL probing is non-destructive GET requests, data extraction doesn't require schema changes.

---

#### 2.2 Adaptive Website Scanner (`lib/scanner/webapp-scanner.ts`)
**Status**: Complete and functional

**What it does**:
- Orchestrates entire website scan flow:
  1. **Profile detection**: Calls `profileWebsite()` to get fingerprint
  2. **Baseline scanning**: Calls `scanUrl()` for foundation findings (SSL/TLS, headers, secrets, exposed info)
  3. **Browser inspection** (always): Runs `runBrowserInspection()` on page body to detect XSS/CSRF/clickjacking
  4. **Conditional adaptive modules**:
     - If profile = `'webapp-light'`: Runs `runFrontendInspection()` + optionally `runAuthHeuristics()`
     - If profile = `'api-surface'`: Runs `runApiHeuristics()`
     - If profile = `'cms-exposure'`: Adds CMS-specific coverage note
  5. **Merge findings**: Dedupes baseline + adaptive results by type/category/file/line
  6. **Generate coverage notes**: Builds structured notes array with:
     - "Selected scan profile: [Label]."
     - "Profile signals: [signal1, signal2, ...]."
     - "Limited active validation: [performed/not performed]."
     - Module-specific notes from each heuristic

**Key algorithm** (`mergeFindings` + `mergeCoverageNotes`):
- Prevents duplicate vulnerabilities using `type + category + file + line + code` as key
- Preserves order: baseline → adaptive findings → coverage notes
- Coverage notes include profile signal summary for user transparency

**Why no changes needed**: 
- Uses existing module APIs (`runBrowserInspection`, `runAuthHeuristics`, etc.)
- Leverages existing `scanUrl()` baseline
- Writes to existing Scan.coverageNotes field in Prisma schema
- No new database columns required

---

#### 2.3 Adaptive Modules (Profile-Specific Logic)
**Status**: Complete and functional

All modules exist in `lib/scanner/modules/`:

| Module | Trigger | Purpose | Coverage Signals |
|--------|---------|---------|------------------|
| `browser-inspection.ts` | Always (HTML) | XSS, CSRF, clickjacking, DOM issues | Runtime validation performed to detect XSS payloads |
| `frontend-inspection.ts` | webapp-light | SPA framework analysis, API endpoint discovery | Runtime framework detected via bundle analysis |
| `auth-heuristics.ts` | webapp-light (if no active browsing) | Credential testing, session handling, MFA gaps | Tested auth endpoints with non-destructive probes |
| `api-heuristics.ts` | api-surface | REST/GraphQL security, API documentation analysis | API framework fingerprinting performed |

Each module returns `WebsiteModuleResult`:
```typescript
{
  vulnerabilities: [],          // Findings specific to this module
  coverageNotes: string[],      // Module-specific coverage notes
  activeValidationPerformed: boolean,  // Did we do live testing?
  profileSignals: string[],     // Additional signals (e.g., "Framework: React detected")
  profileOverride?: WebsiteProfile,   // Can suggest different profile
}
```

**Why no changes needed**: All module interfaces already exist; modules are plugged into `scanWebsiteTarget()` conditional logic.

---

#### 2.4 API Integration (`app/api/analyze/route.ts`)
**Status**: Complete and functional

**What it does**:
- Website scan handler (lines ~140) calls `scanWebsiteTarget(normalizedUrl)`
- Result includes: vulnerabilities, score, summary, coverageNotes, safeVerificationOnly, networkChecksPartial
- Persists to Scan record:
  ```sql
  Scan.create({
    ...
    coverageNotes: result.coverageNotes.join('\n'),
    safeVerificationOnly: result.safeVerificationOnly,
    networkChecksPartial: result.networkChecksPartial,
  })
  ```

**Why no changes needed**: Already integrates Phase 1 output; no new endpoint needed.

---

#### 2.5 UI Integration — Scan Report (`components/ScanReportView.tsx`)
**Status**: Complete and functional

**What it does**:
- Parses `scan.coverageNotes` string array with:
  ```typescript
  const profileNote = notes.find(note => note.startsWith('Selected scan profile:'));
  const validationNote = notes.find(note => note.startsWith('Limited active validation:'));
  ```
- Extracts profile name: `"Web App Light"` (from "Selected scan profile: Web App Light.")
- Extracts validation status: `"Performed using non-destructive authentication heuristics only."`
- Renders two UI sections:
  1. **Coverage Notes header** (lines 441-449): Shows "Partial coverage notes present" alert if adaptive scanning was incomplete
  2. **Profile cards** (lines 462-481): Displays in grid:
     - "Selected profile" card with profile label
     - "Active validation" card with validation status

**Why no changes needed**: Parser and renderer already exist; no component changes required.

---

#### 2.6 PDF Export (`lib/pdf.ts`)
**Status**: Complete and functional

**What it does**:
- Extracts coverage note metadata:
  ```typescript
  const profileNote = scan.coverageNotes.find(n => n.startsWith('Selected scan profile:'));
  const validationNote = scan.coverageNotes.find(n => n.startsWith('Limited active validation:'));
  ```
- Includes in PDF context for rendering
- Renders "Coverage & Completeness" section in PDF with:
  - Selected profile label
  - Validation approach used
  - All coverage notes for transparency

**Why no changes needed**: Extraction logic already coded; PDF template already reserves space.

---

### 🟡 PARTIALLY COMPLETE (Final Validation Pending)

#### 3.1 Benchmark Validation
**Status**: Infrastructure exists, assertions incomplete

**What exists**:
- Test cases in `benchmarks/scan-benchmarks.json`:
  - `website-exposed-env`: Static site, should detect exposed environment variables
  - `website-header-only-weak`: Weak security headers only, should trigger 'surface' profile
  - `website-graphql-exposed`: GraphQL endpoint publicly accessible, should trigger 'api-surface' profile
  - Additional website mode test cases with various characteristics

**What's missing**:
- No explicit assertions on profile selection
- No assertions on coverage notes content
- Benchmark validator (`scripts/validate-benchmarks.mjs`) needs profile-aware checks

**Expected behavior to validate**:
```
Test: website-header-only-weak
  Input: Static landing page (no auth, no API, no CMS)
  Expected Profile: 'surface'
  Expected Note: "Selected scan profile: Surface."
  Expected Finding Count: >= 1 (at least header weakness)

Test: website-graphql-exposed
  Input: Page with /graphql endpoint returning 200
  Expected Profile: 'api-surface'
  Expected Note: "Selected scan profile: API Surface."
  Expected Modules Run: apiHeuristics (should detect GraphQL schema)

Test: website-wordpress-exposed
  Input: WordPress site (wp-login.php accessible)
  Expected Profile: 'cms-exposure'
  Expected Note: "Selected scan profile: CMS Exposure."
```

---

### 🔄 PENDING (Workflow Steps)

#### 4.1 Manual QA Checklist
**Purpose**: Confirm Phase 1 integration works end-to-end without breakage

**Checklist**:
```
[ ] Scan static HTML landing page
    → Expect 'surface' profile in coverage notes
    → Expect minimal findings (<5)
    
[ ] Scan page with login form
    → Expect 'webapp-light' profile
    → Expect auth-oriented coverage notes
    → Expect browser-inspection findings (XSS, CSRF)
    
[ ] Scan page with exposed GraphQL endpoint
    → Expect 'api-surface' profile
    → Expect API heuristic findings
    → Expect "API-surface" label in coverage
    
[ ] Scan WordPress site
    → Expect 'cms-exposure' profile
    → Expect CMS-specific coverage note
    
[ ] View scan report in dashboard
    → Verify "Coverage Notes" section displays
    → Verify profile label appears
    → Verify validation status displays
    
[ ] Download PDF report
    → Verify coverage section includes profile
    → Verify validation note appears
    
[ ] Test error handling
    → Invalid URL → graceful error
    → Timeout → partial result with coverage note
    → CMS detection with broken wpLogin probe → still profiles correctly
    
[ ] Run production build
    → npm run build succeeds
    → No TypeScript errors
    → No console warnings related to coverage
```

---

## 3. TECHNICAL ARCHITECTURE

### Data Flow Diagram
```
Website Scan Initiated
        ↓
   [website-profiler.ts]
   ├─ Fetch main page (GET, 6s timeout)
   ├─ Probe 7 common endpoints (parallel GET)
   ├─ Analyze HTML for signals
   └─ Return WebsiteFingerprint { profile, signals, pageBody, ... }
        ↓
   [webapp-scanner.ts]
   ├─ Run scanUrl (baseline findings)
   ├─ Run runBrowserInspection (always, for XSS/CSRF/clickjacking)
   ├─ Determine effectiveProfile (from fingerprint + browser results)
   ├─ Conditionally run adaptive modules:
   │  ├─ webapp-light → runFrontendInspection + runAuthHeuristics
   │  └─ api-surface → runApiHeuristics
   ├─ Merge findings (dedupe by type/category/file/line)
   ├─ Build profileNotes array:
   │  ├─ "Selected scan profile: [Label]."
   │  ├─ "Profile signals: [list]."
   │  └─ "Limited active validation: [status]."
   └─ Return UrlScanResult { vulnerabilities, coverageNotes, score, ... }
        ↓
   [app/api/analyze/route.ts]
   └─ Persist to Scan record:
      ├─ coverageNotes (array joined with \n)
      ├─ safeVerificationOnly (boolean)
      └─ networkChecksPartial (boolean)
        ↓
   [ScanReportView.tsx]
   ├─ Parse coverageNotes for "Selected scan profile: ..."
   ├─ Extract profile label and validation status
   └─ Render in coverage section of report
        ↓
   [PDF export lib/pdf.ts]
   └─ Include coverage section with profile + validation in PDF

```

### No Changes to Existing Paths
- Scan model schema: **unchanged** (coverageNotes already exists)
- API contract: **unchanged** (/api/analyze already returns full result)
- UI components: **unchanged** (ScanReportView already parses + renders coverage)
- Database migrations: **none required**

---

## 4. PROFILE DEFINITIONS & SIGNAL MAPPING

### Profile: `'surface'` (Default)
**When Selected**: No auth, API, or CMS markers detected  
**Analysis Depth**: Baseline only (SSL/TLS, headers, URL reachability)  
**Modules Run**: Browser inspection only (if HTML)  
**Use Case**: Static landing pages, documentation sites, status pages  
**Coverage Note Example**:
```
Selected scan profile: Surface.
Profile signals: baseline surface indicators only.
Limited active validation: Not performed in this run.
```

---

### Profile: `'webapp-light'`
**When Selected**: Login form OR password field OR SPA markers detected  
**Analysis Depth**: Baseline + frontend + auth heuristics  
**Modules Run**:
1. Browser inspection
2. Frontend inspection (SPA framework, API endpoint discovery)
3. Auth heuristics (credential flow analysis, session handling)

**Use Case**: Web applications with authentication (React, Vue, Angular, traditional forms)  
**Coverage Note Example**:
```
Selected scan profile: Web App Light.
Profile signals: Login form detected, React framework detected.
Limited active validation: Performed using non-destructive authentication heuristics only.
Detected SPA framework and potential auth routes via static analysis.
Tested auth endpoints with non-destructive probes.
```

---

### Profile: `'api-surface'`
**When Selected**: /graphql endpoint OR /swagger.json OR JSON content-type OR API markers detected  
**Analysis Depth**: Baseline + API-specific heuristics  
**Modules Run**:
1. Browser inspection
2. API heuristics (GraphQL introspection, Swagger parsing, endpoint testing)

**Use Case**: REST APIs, GraphQL servers, API-first applications  
**Coverage Note Example**:
```
Selected scan profile: API Surface.
Profile signals: /graphql endpoint accessible, Swagger documentation found.
Limited active validation: Not performed in this run.
API surface analysis performed via static endpoint probing.
```

---

### Profile: `'cms-exposure'`
**When Selected**: WordPress/Drupal/Joomla markers OR wp-login.php status 200  
**Analysis Depth**: Baseline + CMS-focused checks  
**Modules Run**:
1. Browser inspection
2. (CMS-specific coverage note added)

**Use Case**: CMS installations (WordPress, Drupal, Joomla, Shopify)  
**Coverage Note Example**:
```
Selected scan profile: CMS Exposure.
Profile signals: WordPress installation detected.
Limited active validation: Not performed in this run.
CMS-oriented exposure checks were emphasized because the target showed CMS markers.
```

---

## 5. IMPLEMENTATION CHECKLIST

### Already Done ✅
- [x] Website fingerprinting module (website-profiler.ts) — all signal detection patterns
- [x] Adaptive scanner orchestration (webapp-scanner.ts) — profile selection + conditional module routing
- [x] Adaptive modules (browser-inspection, frontend-inspection, auth-heuristics, api-heuristics)
- [x] API integration (app/api/analyze/route.ts) — persist coverageNotes
- [x] Scan model schema — coverageNotes field exists in Prisma
- [x] UI parsing (ScanReportView.tsx) — extract and display profile
- [x] PDF integration (lib/pdf.ts) — include coverage + profile in export
- [x] Badge system (lib/badge.ts) — updated subtitle to "Latest scan posture"
- [x] i18n messaging (lib/i18n.ts) — all copy aligned to Phase 0 standards (point-in-time, evidence-driven)
- [x] Production build — successful with all Phase 0-1 changes

### Pending (Final Validation) 🟡
- [ ] **Benchmark validation**: Add explicit profile-selection assertions to scan-benchmarks.json test cases
- [ ] **Manual QA checklist**: Test all 4 profiles with real targets
- [ ] **Regression testing**: Run full benchmark suite; ensure no FP spike or score deviation
- [ ] **Documentation**: Update ROADMAP_PROGRESS.md to mark Phase 1 `completed`
- [ ] **Git commit**: Tag Phase 1 work once all QA passes

---

## 6. NO BREAKING CHANGES GUARANTEE

### Why Phase 1 is Zero-Risk
| Component | Change? | Why Safe? |
|-----------|---------|-----------|
| Database schema | ❌ No | `coverageNotes` field already exists |
| API contract | ❌ No | `scanWebsiteTarget()` returns same shape, more filled in |
| UI layout | ❌ No | `ScanReportView` already has coverage section |
| Scanner entry point | ❌ No | `scanWebsiteTarget()` still returns UrlScanResult |
| Scoring formula | ❌ No | Same `calculateScore()` used; profile doesn't change score |
| Report PDF schema | ❌ No | Coverage section already reserved in template |
| Badge generation | ❌ No | Same SVG schema; subtitle already updated in Phase 0-B |
| Messaging/i18n | ✅ Improved | Phase 0 already aligned; Phase 1 adds transparency, no overclaim |

### Backward Compatibility
- Existing scans without coverageNotes: Display "No notable coverage limits" (safe default)
- Existing scans with bare findings: No profile label appears (degrades gracefully)
- Mixed old/new scans: Both render correctly; only new scans show profile

---

## 7. WHAT I'M NOT CHANGING

### Out of Scope for Phase 1
- ❌ **Dashboard layout** — coverage section already exists
- ❌ **Scan model migrations** — coverageNotes already in schema
- ❌ **New API endpoints** — everything flows through existing /api/analyze
- ❌ **Scoring formula** — profiles inform module selection, not score calculation
- ❌ **Component structure** — zero refactoring
- ❌ **Database indexes** — no new columns to optimize
- ❌ **Messaging/copy** — Phase 0 already completed this; Phase 1 just fills in profile metadata
- ❌ **Authentication** — no auth changes; modules use non-destructive probes only

---

## 8. FINAL VALIDATION & SIGN-OFF PROCESS

### Step 1: Benchmark Validation (30 mins)
```bash
# Run existing benchmarks with profile assertions
npm run validate-benchmarks

# Expected: All test cases pass with correct profile selected
# Example assertion in validate-benchmarks.mjs:
if (result.coverageNotes.includes('Selected scan profile: API Surface')) {
  ✓ Test passed
} else {
  ✗ Test failed: Expected 'api-surface' profile
}
```

### Step 2: Manual QA (1 hour)
Test each profile on real targets:
1. Static site → Surface profile
2. SPA with login → Web App Light
3. API service → API Surface
4. WordPress → CMS Exposure

Verify:
- Profile appears in dashboard report
- Coverage notes section is populated
- PDF export includes profile
- No console errors

### Step 3: Regression Testing (20 mins)
```bash
npm run build          # Full production build
npm run type-check     # TypeScript validation
npm run test           # Run test suite if available
```

### Step 4: Sign-Off (5 mins)
Update `ROADMAP_PROGRESS.md`:
```markdown
| 1 | Adaptive Website Assessment | completed | Add profile-driven website assessment | Website profile selected automatically and reflected in coverage notes |
```

---

## 9. SUCCESS CRITERIA

Phase 1 is complete when:
1. ✅ Website fingerprinting detects all 4 profile types correctly
2. ✅ Adaptive modules run conditionally (only appropriate modules for each profile)
3. ✅ Coverage notes include profile label + signal summary
4. ✅ Coverage notes appear in dashboard scan report
5. ✅ Coverage notes appear in PDF export
6. ✅ No new database tables/migrations required
7. ✅ No new API routes required
8. ✅ No UI component restructuring
9. ✅ Production build passes with no errors
10. ✅ Benchmark validation shows correct profile for test cases
11. ✅ Manual QA checklist passes on real targets

---

## 10. NEXT STEPS AFTER PHASE 1

Once Phase 1 is complete:
- **Phase 2 (Static Analysis Depth)**: Add JS/TS AST parsing for code repository analysis
- **Phase 3 (Scan-and-Fix)**: Add remediation suggestion foundation
- **Beyond**: Monitoring, workflow integration, finding management, etc.

---

## APPENDIX: FILE INVENTORY

### Core Phase 1 Files (No Changes Needed)
- `lib/scanner/website-profiler.ts` — Fingerprinting logic
- `lib/scanner/webapp-scanner.ts` — Orchestration + adaptive flow
- `lib/scanner/modules/browser-inspection.ts` — XSS/CSRF detection
- `lib/scanner/modules/frontend-inspection.ts` — SPA framework analysis
- `lib/scanner/modules/auth-heuristics.ts` — Auth flow testing
- `lib/scanner/modules/api-heuristics.ts` — API endpoint analysis
- `app/api/analyze/route.ts` — Website scan handler
- `components/ScanReportView.tsx` — Coverage notes rendering
- `lib/pdf.ts` — PDF export with coverage section
- `prisma/schema.prisma` — Scan model (coverageNotes field)

### Related Files
- `lib/i18n.ts` — Messaging (updated in Phase 0)
- `lib/badge.ts` — Badge generation (updated in Phase 0-B)
- `ROADMAP_PROGRESS.md` — Tracked by Phase 1 completion

---

**Last Updated**: 2026-03-20  
**Status**: Implementation 90% complete; awaiting validation gate execution
