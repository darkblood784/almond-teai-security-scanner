# Phase 2: Static Analysis Depth — Complete Implementation Plan

**Status**: `pending` (Infrastructure ~80% complete; Awaiting finalization & validation)  
**Completion Criteria**: JS/TS static depth lands with benchmark coverage and no major false positive spike  
**Constraint**: No redesign, no structural changes — implement on top of existing architecture  

---

## 1. PHASE 2 OVERVIEW

### Goal
Enable the scanner to perform deep static code analysis on JavaScript/TypeScript repositories using Abstract Syntax Tree (AST) parsing. Surface high-value security issues (code injection, insecure crypto, authentication flaws) with precision and confidence scores that distinguish verified issues from likely ones.

### Scope (Zero Redesign)
- ✅ Use Babel parser for JS/TS code (already integrated)
- ✅ Implement AST traversal rules for security patterns
- ✅ Integrate AST findings into existing repository scan results
- ✅ Track AST coverage metrics in existing coverageNotes field
- ✅ Display AST findings in existing scan report without layout changes
- ❌ No new database tables
- ❌ No new API routes beyond existing `/api/analyze`
- ❌ No component restructuring
- ❌ No changes to scoring formula (AST is content to the existing score calculation)

### Why This Matters
Current repository scans detect:
- **Secrets**: Hardcoded credentials via pattern matching (FAST but no context)
- **Dependencies**: Known vulnerable packages via CVE lookup
- **Config**: Basic security headers, TLS issues (website-only)

Phase 2 adds:
- **Code Injection Vectors**: Unsafe `eval()`, `Function()`, `child_process.exec()` with dynamic input
- **SQL/NOSQL Injection**: Query builders using unparameterized templates
- **Insecure Crypto**: Weak hash algorithms (MD5, SHA1), broken cipher modes (ECB, DES)
- **Auth Flaws**: JWT secrets hardcoded, password field comparisons with hardcoded values
- **Confidence Context**: "Verified" (pattern + runtime signatures) vs "Likely" (pattern only) vs "Possible" (weak signal)

---

## 2. IMPLEMENTATION STATUS

### ✅ ALREADY IMPLEMENTED (No Changes Needed)

#### 2.1 Babel Parser (`lib/scanner/ast/js-ts-parser.ts`)
**Status**: Complete and functional

**What it does**:
- Parses JS/TS source code into Babel AST using `@babel/parser`
- Supports full modern syntax: TypeScript, JSX, async/await, optional chaining, nullish coalescing, decorators
- Error recovery mode enabled — partial/malformed files produce best-effort AST
- Returns Babel File AST node (type: `@babel/types.File`)

**Supported file types** (via `lib/scanner/ast/index.ts`):
- `.js` — ES5 and modern JavaScript
- `.jsx` — JSX/React
- `.ts` — TypeScript
- `.tsx` — TSX/React with types

**Why no changes needed**: Babel is battle-tested; modern plugin set covers all common syntaxes; error recovery prevents single-file failures from blocking entire scan.

---

#### 2.2 AST Rule Engine (`lib/scanner/ast/js-ts-rules.ts`)
**Status**: 4 core detection functions implemented; Extensible framework

**Core Detection Functions**:

##### **1. Unsafe Code Execution** (`detectUnsafeExecution`)
Detects dynamic code evaluation and command execution with untrusted input.

**What it finds**:
- `eval()` with dynamic string: `eval(userInput)` ⚠️
- `Function()` constructor with dynamic code: `new Function(dynamicCode)` ⚠️
- `child_process.exec()` / `execSync()` / `spawn()` with dynamic command: `exec(command)` ⚠️

**Rule Logic**:
1. Track imports: `child_process`, `jsonwebtoken`, `crypto` (via alias mapping)
2. AST traverse → find CallExpression / NewExpression nodes
3. Match callee against known unsafe functions
4. Check if argument is dynamic (not a string literal)
5. If matched + dynamic → finding

**Finding Details**:
- **Type**: "Unsafe Code Execution"
- **Severity**: High
- **Confidence**: Likely (pattern matched + dynamic input confirmed)
- **Exploitability**: Possible (depends on input source)
- **Example**:
  ```javascript
  const cmd = getUserInput(); // untrusted
  child_process.exec(cmd);    // FINDING: Command injection vector
  ```

---

##### **2. SQL Injection** (`detectSqlPattern`)
Detects dynamically constructed SQL with untrusted input.

**What it finds**:
- `query()` / `execute()` / `queryRaw()` with dynamic SQL template
- ORMs (Prisma, Sequelize, TypeORM) using template strings
- Custom query builders concatenating user input

**Rule Logic**:
1. Find CallExpression nodes matching `/query|execute|queryraw|executeraw/i`
2. Check if first argument is dynamic (not a string literal)
3. If matched + dynamic → finding

**Finding Details**:
- **Type**: "Potential SQL Injection"
- **Severity**: High
- **Confidence**: Likely (pattern matched + dynamic input)
- **Exploitability**: Possible
- **Example**:
  ```javascript
  const userId = req.query.id;           // untrusted
  const result = db.query(                // FINDING: SQL injection
    `SELECT * FROM users WHERE id = ${userId}`
  );
  ```

---

##### **3. Insecure Cryptography** (`detectInsecureCrypto`)
Detects weak hash algorithms and broken cipher modes.

**What it finds**:
- `crypto.createHash('md5')` / `crypto.createHash('sha1')` (weak hashing)
- `crypto.createCipher()` / `crypto.createCipheriv()` with ECB/DES/RC4 modes (weak encryption)

**Rule Logic**:
1. Track crypto module imports/requires
2. Find CallExpression nodes matching crypto methods
3. Extract algorithm from first argument (must be string literal)
4. Check against weak algorithm patterns
5. If matched → finding

**Finding Details**:
- **Hash weakness**:
  - **Type**: "Insecure Cryptographic Usage"
  - **Severity**: Medium
  - **Confidence**: Verified (algorithm name is literal)
- **Cipher weakness**:
  - **Type**: "Insecure Cryptographic Usage"
  - **Severity**: High
  - **Confidence**: Likely

- **Example**:
  ```javascript
  const crypto = require('crypto');
  const hash = crypto.createHash('md5');     // FINDING: Weak hash
  const cipher = crypto.createCipher('des'); // FINDING: Broken cipher
  ```

---

##### **4. Authentication Flaws** (`detectAuthLogic`)
Detects multiple authentication vulnerabilities: hardcoded secrets, insecure JWT, hardcoded password comparisons.

**What it finds**:

**4a. Hardcoded JWT Secrets**:
- `jwt.sign()` / `jwt.verify()` with hardcoded secret in code
- Example: `jwt.sign(payload, 'super-secret-key')`

**4b. Hardcoded Password Comparisons**:
- Direct string comparison with credential-like variables
- Example: `if (password === 'admin123') { ... }`

**4c. Credential Variable Assignments**:
- Assignment of hardcoded values to credential-named variables
- Example: `const apiKey = 'sk_live_abc123...'`

**Rule Logic**:
1. For JWT: Track `jsonwebtoken` imports, find jwt.sign/verify calls with 2nd arg = hardcoded value
2. For password: Find BinaryExpression nodes with operators `==` / `===` comparing credential names
3. For variables: Find VariableDeclarator/AssignmentExpression with credential-named identifiers and hardcoded values
4. Use `looksLikeHardcodedSecret()` heuristic (minimum 8 chars, not generic placeholder)

**Finding Details**:
- **Type**: "Insecure Authentication" or "Hardcoded Secret"
- **Severity**: High
- **Confidence**: Verified (hardcoded secret detected in code path)
- **Exploitability**: Possible

---

#### 2.3 AST Orchestration (`lib/scanner/ast/index.ts`)
**Status**: Complete and functional

**What it does**:
- Exposes `supportsAstFile(filePath: string): boolean` — checks `.js/.jsx/.ts/.tsx`
- Exposes `scanJsTsAst(relPath: string, content: string): AstScanResult` — orchestrates parse + rules
- Handles parse errors gracefully; returns `{ parsed: false, findings: [], parseError: "..." }`
- Converts findings to `VulnerabilityResult` format matching existing schema

**Integration Pattern** (already used):
```typescript
import { scanJsTsAst, supportsAstFile, toVulnerabilityResults } from './ast';

if (supportsAstFile(filePath)) {
  const astResult = scanJsTsAst(relPath, content);
  if (astResult.parsed) {
    vulnerabilities.push(...toVulnerabilityResults(relPath, astResult.findings));
  } else {
    // Track parse failure in coverage notes
  }
}
```

**Why no changes needed**: API is complete and matches existing `VulnerabilityResult` schema; error handling is solid.

---

#### 2.4 Scanner Integration (`lib/scanner/index.ts`)
**Status**: Complete and functional

**What it does** (lines ~306-331):
- Collects JS/TS files during directory scan
- For each supported file: calls `scanJsTsAst()` in parallel with pattern-based scanning
- Dedupes findings by type/category/file/line
- Tracks AST metrics: `astFilesSupported`, `astFilesParsed`, `astParseFailures`
- Adds coverage notes (lines ~392):
  - "Language-aware JS/TS AST analysis ran on X of Y supported source files."
  - "[N] supported JS/TS files could not be parsed for AST analysis and were scanned with pattern-based rules only."

**Why no changes needed**: Metrics and coverage tracking already wired; findings flow through existing deduplication.

---

#### 2.5 Benchmark Coverage Tracking
**Status**: Partial (infrastructure exists; assertions pending)

**What exists** in `benchmarks/scan-benchmarks.json`:
- Test cases for GitHub repository scans with expected findings/score ranges
- Example repo test cases: `repo-committed-env`, `repo-hardcoded-secret`, `repo-vulnerable-dependency`, `repo-js-unsafe-exec`
- Validator in `scripts/validate-benchmarks.mjs` checks score, grade, required findings

**What's there for Phase 2**:
- `repo-js-unsafe-exec`: Tests "Unsafe Code Execution" finding
- Test expects score in range 0-80, grade D/F, minimum 1 "Unsafe Code Execution" finding
- Minimal coverage (1 AST finding type tested)

**What needs explicit Phase 2 assertions**:
- Test cases for "Potential SQL Injection" AST finding
- Test cases for "Insecure Cryptographic Usage" (weak hashes, broken ciphers)
- Test cases for "Insecure Authentication" (hardcoded JWT secrets, password comparisons)
- Coverage expectations: at least 80% of AST rules should be represented in benchmarks

---

### 🟡 PARTIALLY COMPLETE (Final Polish Pending)

#### 2.6 Advanced AST Rules (Optional Improvements)
**Status**: Foundation ready; additional detections scoped for Phase 2 enhancement

**Potential additions** (not critical for MVP):

| Rule | Detection | Added Value | Effort |
|------|-----------|------------|--------|
| **DOM-based XSS** | `innerHTML`, `appendChild` with dynamic HTML | Detect client-side injection vectors | Medium |
| **Prototype Pollution** | `Object.assign()`, spread operator usage patterns | Detect object property override vectors | Medium |
| **Regex DoS** | Unbounded quantifiers in user-provided regexes | Detect ReDoS attack surface | Low |
| **Insecure RNG** | `Math.random()` for security purposes | Detect weak random generation | Low |
| **Null Byte Injection** | String concatenation with `\0` | Detect path traversal vectors | Low |
| **XXE (XML Parsing)** | XML parser usage without DTD disabling | Detect XML external entity attacks | Medium |

**Current implementation suffices for Phase 2 MVP**: 4 core rules (code injection, SQL injection, crypto, auth) cover ~80% of high-value findings.

---

## 3. TECHNICAL ARCHITECTURE

### Data Flow
```
Repository Scan Initiated (GitHub/ZIP)
        ↓
[collectFiles()] Recursively walk directory, apply include/exclude patterns
        ↓
For each file:
  ├─ Check size / extension / exclusion patterns
  ├─ Read file content
  ├─ [Pattern-based scanning] Run existing regex+secret scanners
  ├─ Is JS/TS file?
  │  └─ Yes: Call scanJsTsAst()
  │     ├─ [Babel Parse] Parse source → AST
  │     ├─ [AST Traverse] Walk AST nodes
  │     ├─ [Detect Rules]
  │     │  ├─ detectUnsafeExecution()
  │     │  ├─ detectSqlPattern()
  │     │  ├─ detectInsecureCrypto()
  │     │  └─ detectAuthLogic()
  │     └─ Return findings[] + parseError info
  └─ Dedupe all findings (pattern + AST + secrets + dependencies)
        ↓
[Calculate Score] Apply existing scoring formula
        ↓
[Build Summary] Findings counts + coverage notes + AST metrics
        ↓
Return ScanResult { vulnerabilities, score, summary, coverageNotes }
        ↓
[API Route] Persist to Scan record (existing)
        ↓
[Dashboard] Display findings (existing)
```

### No Schema Changes
- Scan.findings → uses existing VulnerabilityResult schema
- Scan.coverageNotes → already includes AST metrics
- Scan.score → same scoring function (content-neutral)

---

## 4. AST RULE DETAILS & PATTERNS

### Rule 1: Unsafe Code Execution

**Detection Patterns**:
```typescript
// Pattern A: eval() with dynamic input
const userInput = req.body.code;
eval(userInput);                    // ❌ FINDING

// Pattern B: Function constructor
const dynamicFunc = new Function(userInput);  // ❌ FINDING

// Pattern C: child_process.exec()
const command = `rm -rf ${userId}`;
exec(command);                      // ❌ FINDING

// Pattern D: spawn() with dynamic args
spawn('ls', ['-la', userPath]);     // ✅ Safe (command is literal)
spawn('cmd', [input]);              // ❌ FINDING (array contains dynamic)
```

**Alias Tracking**:
```typescript
// Handles import variations
import cp from 'child_process';
cp.exec(cmd);                       // ❌ FINDING (aliases tracked)

const { exec } = require('child_process');
exec(cmd);                          // ❌ FINDING (method aliases tracked)
```

---

### Rule 2: SQL Injection

**Detection Patterns**:
```typescript
// Pattern A: Template strings
const userId = req.query.id;
db.query(`SELECT * FROM users WHERE id = ${userId}`);  // ❌ FINDING

// Pattern B: String concatenation
const sql = "SELECT * FROM users WHERE id = " + userId;
db.execute(sql);                    // ❌ FINDING

// Pattern C: Safe (parameterized)
db.query('SELECT * FROM users WHERE id = ?', [userId]);  // ✅ Safe
db.query('SELECT * FROM users WHERE id = $1', [userId]); // ✅ Safe (Prisma)
```

**ORM Detection**:
```typescript
// Prisma (actually safe, but pattern matches)
const user = await prisma.user.findUnique({
  where: { id: userId }             // ✅ Safe (Prisma parameterizes)
});

// But would flag if done manually:
const result = db.query(`SELECT * FROM user WHERE id = ${userId}`);  // ❌ FINDING
```

---

### Rule 3: Insecure Cryptography

**Weak Hashing**:
```typescript
const crypto = require('crypto');
crypto.createHash('md5');           // ❌ FINDING (Medium severity, weak)
crypto.createHash('sha1');          // ❌ FINDING (Medium severity, weak)
crypto.createHash('sha256');        // ✅ Safe
crypto.createHash('sha512');        // ✅ Safe
```

**Broken Cipher Modes**:
```typescript
crypto.createCipher('des');         // ❌ FINDING (High severity, broken)
crypto.createCipheriv('aes-128-ecb', key, iv);  // ❌ FINDING (ECB mode unsafe)
crypto.createCipheriv('aes-128-cbc', key, iv);  // ✅ Safe (CBC/GCM ok)
crypto.createCipheriv('aes-256-gcm', key, iv);  // ✅ Safe
```

---

### Rule 4: Authentication Flaws

**Hardcoded JWT Secrets**:
```typescript
const jwt = require('jsonwebtoken');
const token = jwt.sign(payload, 'super-secret-key');     // ❌ FINDING
jwt.verify(token, 'hardcoded-secret');                   // ❌ FINDING
jwt.sign(payload, process.env.JWT_SECRET);               // ✅ Safe (env var)
```

**Hardcoded Password Comparisons**:
```typescript
if (password === 'admin123') {      // ❌ FINDING (hardcoded password)
  // ...
}

if (apiKey === 'sk_live_secret') {  // ❌ FINDING (hardcoded API key)
  // ...
}

// Safe comparison:
if (await bcrypt.compare(password, hashFromDB)) {  // ✅ Safe
```

**Credential Variable Assignments**:
```typescript
const apiKey = 'sk_live_abc123...'; // ❌ FINDING (hardcoded in code)
const dbPassword = 'root';          // ❌ FINDING
const jwtSecret = 'my-secret';      // ❌ FINDING

// Safe:
const apiKey = process.env.API_KEY; // ✅ Safe (env var)
const creds = {
  username: process.env.DB_USER,    // ✅ Safe
};
```

---

## 5. IMPLEMENTATION CHECKLIST

### Already Done ✅
- [x] Babel parser with full TS/JSX support (js-ts-parser.ts)
- [x] AST rule engine framework (js-ts-rules.ts)
- [x] Unsafe code execution detection
- [x] SQL injection detection
- [x] Insecure crypto detection
- [x] Authentication flaw detection
- [x] AST scanner orchestration (ast/index.ts)
- [x] Scanner integration (index.ts) — AST runs in parallel with pattern scans
- [x] Coverage metrics tracking in coverageNotes
- [x] Error recovery for unparseable files
- [x] Finding deduplication (AST + pattern + secrets + dependencies)

### Pending (Final Validation) 🟡
- [ ] **Benchmark expansion**: Add explicit test cases for each AST rule (SQL, crypto, auth)
- [ ] **Baseline false positive check**: Run AST on known-good codebases (node_modules mock, popular OSS projects) to validate precision
- [ ] **Integration test**: End-to-end scan of test repo with known AST findings
- [ ] **Manual QA checklist**: Verify coverage notes accuracy, score stability
- [ ] **Regression test**: Ensure no major FP spike on Phase 1 benchmarks
- [ ] **Documentation**: Update ROADMAP_PROGRESS.md with Phase 2 completion signal

---

## 6. AST COVERAGE METRICS

Phase 2 tracks these coverage notes automatically:

```
"Language-aware JS/TS AST analysis ran on X of Y supported source files."
"[N] supported JS/TS files could not be parsed for AST analysis and were 
scanned with pattern-based rules only."
```

**What these mean**:
- If AST parsing fails on a file → it falls back to pattern-based scanning
- Pattern-based scanning is still effective (secrets, dependencies)
- AST parsing failure should be <5% (most code is valid JavaScript)

---

## 7. NO BREAKING CHANGES GUARANTEE

| Component | Change? | Why Safe? |
|-----------|---------|-----------|
| ScanResult schema | ❌ No | VulnerabilityResult already supports code findings |
| Scoring formula | ❌ No | Score calculated on merged findings (AST is just content) |
| API contract | ❌ No | /api/analyze returns same shape, more findings |
| Database schema | ❌ No | coverageNotes field already exists |
| Dashboard UI | ❌ No | ScanReportView already supports finding rendering |
| PDF export | ❌ No | Coverage section already in template |
| Existing pattern scans | ❌ No | AST runs in parallel, dedupes at the end |

**Backward Compatibility**:
- Old repository scans (pre-Phase 2): No AST findings, but pattern + dependency findings unchanged
- New scans: AST findings added alongside pattern findings
- Mixed display: Dashboard gracefully shows both types of findings

---

## 8. POTENTIAL FALSE POSITIVE SCENARIOS

**Scenario 1: Safe SQL Parameterization Flagged**
```javascript
// Using parameterized query but pattern isn't recognized
const result = await client.query(preparedStatement, params);
```
**Mitigation**: Rule explicitly checks for dynamic VALUE, not function name. Parameterized query patterns should not trigger since first arg is array of params, not template.

**Scenario 2: String Literal Algorithm Name**
```javascript
const algo = 'sha256';
crypto.createHash(algo);           // Should NOT flag (variable, not literal)
```
**Mitigation**: Rule checks `literalText()` which only extracts string literals. Variables return `null`, so no finding.

**Scenario 3: Test/Example Code in Live Repo**
```javascript
// In __tests__ or example/ directory
const testToken = jwt.sign(payload, 'test-secret');  // Would flag
```
**Mitigation**: Use `isLowValueContext()` check (Phase 1 pattern) to suppress low-confidence findings in test/example directories.

---

## 9. FINAL VALIDATION & SIGN-OFF PROCESS

### Step 1: Benchmark Validation (1 hour)
Create Phase 2 specific test repo fixture with:
- 1 file with unsafe `eval()` call with dynamic input
- 1 file with SQL injection via template string
- 1 file with MD5 hashing
- 1 file with hardcoded JWT secret

Expected: All 4 AST findings detected with correct type/severity.

```bash
npm run validate-benchmarks results.json
# Expected output:
# PASS repo-js-unsafe-exec
# PASS repo-sql-injection-template
# PASS repo-insecure-hash-md5
# PASS repo-hardcoded-jwt-secret
```

### Step 2: False Positive Baseline (45 mins)
Scan known-good codebases to establish baseline FP rate:
- Sample legitimate npm package (e.g., lodash)
- Sample honest GitHub repo (e.g., small OSS project)
- Internal test fixtures

Expected: <2% false positive rate on pattern matches (most should be legitimate crypto usage).

### Step 3: Integration Test (30 mins)
End-to-end repository scan with mixed findings:
1. Run on test repo with secrets + dependencies + AST findings
2. Measure score impact (should be reasonable, not inflated)
3. Verify coverage notes are populated
4. Check deduplication: same finding from pattern + AST should dedupe

### Step 4: Manual QA (1 hour)
```
[ ] Scan repo with eval() vulnerability
    → AST detects "Unsafe Code Execution"
    → Coverage notes show "...ran on X of Y files"
    → Score degraded appropriately

[ ] Scan repo with SQL injection
    → AST detects "Potential SQL Injection"
    → Severity and confidence match expected

[ ] Scan repo with MD5 usage
    → AST detects "Insecure Cryptographic Usage"
    → Severity: Medium (not critical, just discouraged)

[ ] Scan repo with hardcoded JWT
    → AST detects "Insecure Authentication"
    → Suggestion mentions moving to env vars

[ ] Test parse error handling
    → Invalid TS file → graceful degradation
    → Error logged in coverage notes
    → File still scanned with pattern rules

[ ] View in dashboard
    → AST findings render with line numbers
    → Code snippets display correctly
    → No layout breakage

[ ] Download PDF
    → Coverage section includes AST metrics
    → Findings list includes both pattern + AST
```

### Step 5: Regression Testing (30 mins)
```bash
npm run build              # Production build
npm run lint               # Linter pass
npm run benchmarks:validate benchmarks/results.json  # Phase 1 benchmarks still pass
```

### Step 6: Sign-Off (5 mins)
Update `ROADMAP_PROGRESS.md`:
```markdown
| 2 | Static Analysis Depth | completed | Add AST/language-aware repo scanning for high-value languages | JS/TS static depth lands with benchmark coverage and no major FP spike |
```

---

## 10. SUCCESS CRITERIA

Phase 2 is complete when:
1. ✅ Unsafe code execution detected (eval, Function, child_process + dynamic input)
2. ✅ SQL injection detected (dynamic query templates)
3. ✅ Insecure cryptography detected (MD5, SHA1, ECB, DES)
4. ✅ Authentication flaws detected (hardcoded JWT secrets, password comparisons)
5. ✅ AST findings integrated into scan results (ScanResult.vulnerabilities)
6. ✅ Coverage notes track AST parse success/failure rates (coverageNotes)
7. ✅ No false positive spike on legitimate codebases (<2% FP rate)
8. ✅ Benchmark validation covers all 4 AST rule types
9. ✅ Manual QA checklist passes
10. ✅ Production build succeeds with zero regressions
11. ✅ Phase 1 benchmarks still pass (no scoring regression)

---

## 11. NEXT STEPS AFTER PHASE 2

Once Phase 2 is complete:
- **Phase 3 (Scan-and-Fix Foundations)**: Add fixability classification for findings
- **Phase 4 (Paid Scan-and-Fix MVP)**: Surface fix suggestions to pro users
- **Phase 5 (Real Monitoring)**: Turn monitoring into scheduled recurring scans

---

## APPENDIX: FILE INVENTORY

### Core Phase 2 Files (Status)
- ✅ `lib/scanner/ast/js-ts-parser.ts` — Babel parser with TS/JSX/modern syntax support
- ✅ `lib/scanner/ast/js-ts-rules.ts` — 4 core AST detection rules (unsafe exec, SQL, crypto, auth)
- ✅ `lib/scanner/ast/types.ts` — AstScanFinding + AstScanResult types
- ✅ `lib/scanner/ast/utils.ts` — Helper functions (line snippets, secret detection heuristics)
- ✅ `lib/scanner/ast/index.ts` — AST orchestration & error handling
- ✅ `lib/scanner/index.ts` — Integration into main scanner with coverage tracking
- ✅ `lib/scanner/types.ts` — VulnerabilityResult schema (used by AST findings)
- ✅ `benchmarks/scan-benchmarks.json` — Reference test cases (expand for Phase 2)
- ✅ `scripts/validate-benchmarks.mjs` — Benchmark validator (works with Phase 2)

### Related Files
- `app/api/analyze/route.ts` — Scan API endpoint (uses existing scanRepository)
- `components/ScanReportView.tsx` — Finding display (works with AST findings)
- `lib/pdf.ts` — PDF export (includes AST findings)
- `ROADMAP_PROGRESS.md` — Track Phase 2 status

---

**Last Updated**: 2026-03-20  
**Status**: Implementation ~80% complete; awaiting benchmark expansion & validation gate execution

---

## QUICK START: WHAT TO DO NOW

### To Complete Phase 2:

1. **Expand benchmarks** (30 mins):
   - Add test case: repo with SQL injection
   - Add test case: repo with MD5 usage
   - Add test case: repo with hardcoded JWT secret
   - Update `scan-benchmarks.json` with expected findings for each

2. **Baseline FP check** (1 hour):
   - Create test fixture with legitimate code using eval, cryptography, JWT
   - Run AST scanner
   - Manually review findings to ensure they're accurate

3. **Run validation** (30 mins):
   - `npm run build` — ensure production build passes
   - Test end-to-end repository scan with known AST findings
   - Verify coverage notes populate correctly

4. **Manual QA** (1 hour):
   - Follow the QA checklist in Section 9
   - Verify all 4 AST rule types work end-to-end
   - Check dashboard & PDF rendering

5. **Sign off** (5 mins):
   - Mark Phase 2 `completed` in ROADMAP_PROGRESS.md
   - Commit Phase 2 work

