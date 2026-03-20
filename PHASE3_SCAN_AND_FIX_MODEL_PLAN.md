# Phase 3: Scan-and-Fix Model Architecture & Implementation Plan

**Document Purpose**: Detailed technical & strategic plan for selecting and deploying the code fix generation model  
**Status**: `planning` (For review before implementation)  
**Constraint**: Zero redesign — integrate with existing Prisma/API structure  

---

## 1. EXECUTIVE SUMMARY

### What We're Building
A **fix generation system** that:
- Takes a security finding (e.g., "Hardcoded secret") and codebase context
- Uses an LLM to generate a code patch showing how to fix it
- Stores the patch suggestion in database for display in Phase 4 UI
- Integrates with paid plan (pro users only)

### Model Choices (Analysis Below)

| Option | Model | Cost | Latency | Self-Hosted | Best For |
|--------|-------|------|---------|-------------|----------|
| **Option A** | Claude 3.5 Haiku (Anthropic API) | $$$ per call | 2-5s | ❌ No | Simplicity, high quality |
| **Option B** | Mistral (via NVIDIA NIM) | $$$ one-time | 3-8s | ✅ Yes | Cost control at scale |
| **Option C** | Llama 2 13B (via NVIDIA NIM) | $$$ one-time | 1-3s | ✅ Yes | Local deployment, privacy |
| **Option D** | Hybrid (Claude + Mistral) | $$ mixed | 1-5s | ✅ Partial | Best cost/quality ratio |

### Recommendation
**Option D (Hybrid)**: Use Claude for complex fixes (nested code patterns, multi-file changes), use local Mistral for simple fixes (headers, config changes). Optimizes for both cost and user experience.

### Practical Rollout Recommendation (Free-First)
Start with a **free-first hybrid** for Phase 3, then promote paid providers for paid users later:
- **Now (Free launch)**: Use free API providers for easy/simple tasks and keep deterministic template fallback.
- **Later (Paid launch)**: Keep same code path, only change routing policy + API keys for paid-tier traffic.
- **Always**: Keep free provider as fallback for low-risk/simple tasks.

---

## 1.1 FREE-FIRST → PAID MIGRATION PLAN (NO REWRITE)

### Core Principle
Build one provider-agnostic interface once, then switch behavior via config:

```typescript
interface FixProvider {
  name: string;
  generateFix(input: FixGenerationRequest): Promise<FixGenerationResult>;
  healthCheck(): Promise<boolean>;
}
```

Only these things change over time:
- API keys
- model IDs
- routing policy (which provider for free vs paid users)
- quota limits

### Environment-Driven Provider Switching

```bash
# global mode
FIX_GENERATION_MODE=free-first      # free-first | paid-first | hybrid

# provider order (left to right priority)
FREE_PROVIDER_CHAIN=openrouter,groq,github_models,template
PAID_PROVIDER_CHAIN=anthropic,nvidia_nim,template

# model mapping
MODEL_SIMPLE_FREE=qwen2.5-coder-32b-instruct
MODEL_COMPLEX_FREE=devstral-2-123b-instruct-2512
MODEL_SIMPLE_PAID=claude-3-5-haiku-20241022
MODEL_COMPLEX_PAID=claude-3-5-sonnet-20241022

# quotas / controls
MAX_FIXES_PER_SCAN=5
FREE_USER_MONTHLY_FIX_LIMIT=25
PAID_USER_MONTHLY_FIX_LIMIT=500
FIX_TIMEOUT_MS=9000
FIX_MAX_RETRIES=1
```

### Routing Policy (What Runs Where)

```text
If user.plan == free:
  simple findings   -> FREE_PROVIDER_CHAIN
  complex findings  -> FREE_PROVIDER_CHAIN (1 try) -> template fallback

If user.plan == paid:
  complex findings  -> PAID_PROVIDER_CHAIN
  simple findings   -> free provider first (cost-opt) -> paid fallback
```

This preserves your goal:
- paid users get reliability and quality
- free models remain active for easy tasks

### 4-Stage Migration Path

#### Stage A — Launch Free-First (Now)
- Implement provider abstraction + routing service.
- Integrate 2 free providers + template fallback.
- Add telemetry: provider, model, latency, success/failure, token/cost estimate.

#### Stage B — Add Plan-Aware Gates
- Add plan check (`free` vs `paid`) at fix-generation entrypoint.
- Enforce per-plan monthly quotas.
- Keep same API response format for both plans.

#### Stage C — Enable Paid Provider
- Add paid API key(s) in env.
- Set `PAID_PROVIDER_CHAIN` with paid provider first.
- No schema rewrite, no endpoint rewrite, no UI rewrite required.

#### Stage D — Cost Optimization
- Keep free provider first for low-risk/simple findings for paid users.
- Send complex/high-risk tasks to paid models.
- Tune routing with real telemetry weekly.

### Minimal Code Areas That Must Exist Once
- `lib/fix-generation/providers/*` (provider adapters)
- `lib/fix-generation/router.ts` (plan + complexity + fallback policy)
- `lib/fix-generation/types.ts` (normalized request/response)
- `app/api/generate-fix/route.ts` (single endpoint, stable contract)
- usage tracking persistence (already planned under paid integration)

### Success Criteria for This Strategy
- Switching free → paid requires only env/config changes + provider chain update.
- Free provider remains available for easy tasks in both plans.
- No breaking API contract between Phase 3 and Phase 4.
- Provider outages degrade gracefully to fallback templates instead of failing scans.

---

## 2. MODEL SELECTION ANALYSIS

### Option A: Claude 3.5 Haiku via Anthropic API

#### Pros ✅
- **Simplicity**: No infrastructure; just API calls
- **Quality**: Claude 3.5 Haiku excellent at code understanding
- **Reliability**: Anthropic handles scaling
- **No DevOps**: No docker, no GPU management

#### Cons ❌
- **Per-call cost**: ~$0.002-0.005 per generation request
- **Scale cost**: 1,000 users × 10 scans/month × 5 findings = 50,000 API calls/month = ~$100-250/month
- **Latency**: 2-5 seconds per fix (not ideal for real-time UI)
- **API dependency**: Downtime affects fix generation feature
- **Rate limits**: Anthropic has rate limits per account

#### Pricing Model for Paid Plan
```
Pro Plan: $29/month (includes 100 fix suggestions/month)
- Each additional fix suggestion: $0.50/suggestion
- Anthropic cost: ~$0.002 per call
- Margin: $0.5 - $0.002 = 99.6% gross margin per suggestion
```

#### Implementation Complexity
- **Low**: Just add API calls to fix generation
- **No infrastructure changes needed**
- **Can start with this immediately**

---

### Option B: Mistral via NVIDIA NIM (Container)

#### Pros ✅
- **One-time cost**: License/download model once
- **Self-hosted**: No API dependency
- **Privacy**: Code stays inside your infra
- **Scalability**: Can run multiple containers
- **Cost predictability**: No per-call fees

#### Cons ❌
- **Infrastructure cost**: Need GPU servers (A100: $1-3/hour on AWS, or own equipment)
- **DevOps burden**: Manage containers, scaling, failover
- **Latency**: 3-8 seconds per fix (depends on GPU)
- **Model updates**: Must manually upgrade Mistral versions
- **Capacity planning**: Need headroom for peak load

#### Pricing Model for Paid Plan
```
Pro Plan: $29/month (includes 100 fix suggestions/month)
- Infrastructure cost: $2,000-5,000/month (GPU servers for 1000 concurrent users)
- Cost per user: $2-5/month
- Margin: $29 - $3 = $26 gross per user
- Breakeven: ~100 Pro users minimum
```

#### Implementation Complexity
- **Medium-High**: Docker, Kubernetes, GPU management
- **DevOps expertise required**
- **Can take 2-3 weeks to fully operationalize**

---

### Option C: Llama 2 13B via NVIDIA NIM (Quantized)

#### Pros ✅
- **Open-source**: No licensing concerns
- **Smaller model**: 13B can run on mid-range GPUs (RTX 4090, RTX 6000)
- **Faster**: Quantized version ~1-3s latency
- **Cost-effective**: Lower compute cost than Mistral

#### Cons ❌
- **Lower quality**: 13B < 70B on code understanding
- **May hallucinate**: More prone to generating non-working code
- **Infrastructure cost**: Still need GPUs
- **Maintenance**: Community-driven model

#### Accuracy Concern
- Llama 2 13B: ~60-70% accuracy on code generation tasks
- Claude 3.5 Haiku: ~85-90% accuracy
- **Risk**: Users get broken code suggestions

#### Implementation Complexity
- **Medium**: Similar to Mistral, but more reliability concerns

---

### Option D: HYBRID (Recommended)

#### Architecture
```
User scans code → Finding detected
  ↓
Is finding "simple" (header, config, dependency)?
  → YES: Use local Mistral (fast, cheap)
  → NO: Use Claude API (high quality)
```

#### Simple vs Complex Classification
```
SIMPLE (Use Mistral):
  - Missing headers (HSTS, CSP, X-Frame-Options)
  - Outdated npm packages (auto-upgrade)
  - CORS configuration changes
  - TLS cipher modes
  - File permission issues
  Estimated: 40-50% of all findings
  Cost per fix: ~$0.001 (local inference)

COMPLEX (Use Claude):
  - SQL injection in custom queries (multi-line, depends on ORM)
  - Unsafe code execution (eval, Function, spawn)
  - Cryptographic algorithm replacement
  - Authentication logic fixes
  - Dependency injection patterns
  Estimated: 50-60% of all findings
  Cost per fix: ~$0.003 (API call)
```

#### Pros ✅
- **Cost optimized**: Simple fixes cheap via local, complex fixes high-quality via API
- **User satisfaction**: Quality fixes without breaking the bank
- **Scalability**: Can handle thousands of scans/month
- **Reliability**: Falls back to Claude if Mistral unavailable

#### Cons ❌
- **Operational complexity**: Run both systems
- **Monitoring**: Track which system generating which fixes
- **Latency variance**: Some fixes 1s, others 5s

#### Pricing Model for Paid Plan
```
Pro Plan: $29/month (includes 100 fix suggestions/month)

Cost breakdown per month:
  - Mistral (50% of 100 fixes = 50): 50 × $0.001 = $0.05
  - Claude (50% of 100 fixes = 50): 50 × $0.003 = $0.15
  - Total API cost: ~$0.20/month per active user
  - Infrastructure (GPU): $3-5/month per user
  - Total cost: ~$3.25/month per user
  
Margin: $29 - $3.25 = $25.75 per user (88% margin)
Breakeven: ~80 Pro users (feasible)
```

#### Recommendation Grade
⭐⭐⭐⭐⭐ **Strongly Recommended**

---

## 3. RECOMMENDED ARCHITECTURE (HYBRID)

### Infrastructure Stack

#### Production Environment
```
┌─────────────────────────────────────────────┐
│         Next.js API Route                    │
│    /api/generate-fix                        │
└────────┬────────────────────────────────────┘
         │
    ┌────┴────┐
    │          │
    ▼          ▼
┌─────────┐  ┌──────────────────────┐
│ Claude  │  │ NVIDIA NIM Container │
│ API     │  │ (Mistral)           │
│ ─────── │  │ ─────────────────── │
│ Pay per │  │ GPU: 1x A100 (16GB) │
│ call    │  │ Self-hosted onprem  │
└─────────┘  └──────────────────────┘
    │              │
    └──────┬───────┘
           │
     ┌─────▼──────┐
     │  Prisma    │
     │  SQLite    │
     │  FixSuggestion table
     └────────────┘
```

#### Directory Structure
```
app/
  api/
    generate-fix/           ← Phase 4 endpoint (not Phase 3)
      route.ts
lib/
  fix-generation/
    claude-client.ts        ← Claude API wrapper
    mistral-client.ts       ← NVIDIA NIM wrapper (local)
    fix-generator.ts        ← Hybrid orchestrator
    prompts/
      simple-fix.prompt.ts  ← Mistral prompts
      complex-fix.prompt.ts ← Claude prompts
    types.ts                ← FixSuggestion interface
docker/
  mistral-nim/
    Dockerfile
    .env.example
    docker-compose.yml
scripts/
  deploy-nim.sh             ← Setup NIM container
```

---

## 4. PAID PLAN INTEGRATION

### Prisma Schema Changes (What's New for Fix Generation)

```prisma
// Phase 3: Fixability Classification (existing)
model Vulnerability {
  // ... existing fields
  fixability    String    @default("uncategorized")
  fixLevel      Int       @default(0)
}

// Phase 3+: Fix Suggestion Storage (NEW)
model FixSuggestion {
  id                String      @id @default(cuid())
  vulnerabilityId   String
  vulnerability     Vulnerability @relation(fields: [vulnerabilityId], references: [id], onDelete: Cascade)
  
  // The suggested fix
  patchCode         String      // Before + after code
  description       String      // "Add HSTS header to..."
  generatedBy       String      @default("unknown")  // "claude" | "mistral"
  generatedAt       DateTime    @default(now())
  confidence        Int         @default(0)  // 0-100
  
  // Paid plan tracking
  createdByScan     String      // Link back to Scan for usage tracking
  consumedByUser    String?     // If user accepted the fix (populated in Phase 4)
  
  @@index([vulnerabilityId])
  @@index([createdByScan])
  @@index([generatedBy])
}

// Track usage for billing
model FixSuggestionUsage {
  id                String      @id @default(cuid())
  projectId         String
  project           Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  month              String      // "2026-03" for March 2026
  totalRequests      Int         @default(0)
  totalCost          Decimal     @default(0)  // Anthropic API cost in dollars
  
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  
  @@unique([projectId, month])
  @@index([projectId])
}
```

### Usage Tracking Workflow

```
User submits code for scan
  ↓
Phase 2: Detect vulnerabilities
  ↓
Phase 3: Classify fixability
  ↓
Phase 3b: Generate fix suggestions (only for findings with fixability != "manual-only")
  ├─ Check: Is user on Pro plan? → Get usage quota
  ├─ Simple fix? → Call Mistral (track as $0.001 cost)
  ├─ Complex fix? → Call Claude (track as $0.003 cost)
  └─ Store suggestion in FixSuggestion table
  ↓
Phase 4 (future): UI shows "View fix suggestion" button
  ├─ User clicks to see patch
  ├─ User accepts fix? → Store in FixSuggestion.consumedByUser
  └─ Update usage metrics for billing
```

### Paid Plan Tiers

```
FREE PLAN: $0/month
├─ 1 scan/month
├─ No fix suggestions
├─ Report download: PDF only
└─ Support: Community

PRO PLAN: $29/month
├─ Unlimited scans
├─ 100 fix suggestions/month (overage: $0.50/suggestion)
├─ Fix suggestion details (before/after code)
├─ Advanced filtering by fixability
├─ Report features: PDF + JSON export
├─ Email reports
└─ Support: Email within 24h

ENTERPRISE PLAN: Custom
├─ Unlimited scans
├─ Unlimited fix suggestions
├─ Self-hosted option (deploy NIM locally)
├─ Custom integrations (Slack, Teams, GitHub)
├─ SSO + advanced security
└─ Support: 24/7 dedicated
```

### Quota Enforcement

```typescript
// In /api/generate-fix endpoint (Phase 4):
async function generateFix(scanId: string, vulnerabilityId: string) {
  // 1. Check user's paid plan status
  const user = await getCurrentUser();
  if (user.plan === 'free') {
    return { error: 'Fix suggestions not available on free plan. Upgrade to Pro.' };
  }
  
  // 2. Check monthly quota
  const usage = await prisma.fixSuggestionUsage.findUnique({
    where: { projectId_month: { projectId: user.projectId, month: '2026-03' } },
  });
  
  if (usage && usage.totalRequests >= 100) {
    return { error: 'Monthly quota reached. Add $0.50/suggestion.' };
  }
  
  // 3. Generate fix and track cost
  const fix = await generateFixSuggestion(vulnerability);
  
  // Track usage
  if (!usage) {
    await prisma.fixSuggestionUsage.create({
      data: { projectId, month: '2026-03', totalRequests: 1, totalCost: fix.cost }
    });
  } else {
    await prisma.fixSuggestionUsage.update({
      where: { id: usage.id },
      data: { 
        totalRequests: usage.totalRequests + 1,
        totalCost: { increment: fix.cost }
      },
    });
  }
  
  return { success: true, fix };
}
```

---

## 5. DETAILED IMPLEMENTATION PLAN

### Phase 3a: Fixability Classification (EXISTING PLAN)
See [PHASE3_PLAN.md](PHASE3_PLAN.md)

### Phase 3b: Fix Generation Infrastructure (NEW)

#### Week 1: Foundation Setup

**Day 1-2: Claude Integration**
```typescript
// lib/fix-generation/claude-client.ts
import Anthropic from '@anthropic-ai/sdk';

interface FixGenerationRequest {
  finding: VulnerabilityResult;
  codeContext: string;  // Snippet of vulnerable code
  language: string;     // 'javascript', 'python', 'go', etc.
  framework?: string;   // 'express', 'next', 'django', etc.
}

interface FixGenerationResult {
  patchCode: string;        // "- const hash = md5(data)\n+ const hash = sha256(data)"
  description: string;      // "Replace MD5 with SHA256"
  confidence: number;       // 0-100
  generatedBy: 'claude' | 'mistral';
  cost: number;             // In dollars
}

export async function generateFixWithClaude(req: FixGenerationRequest): Promise<FixGenerationResult> {
  const client = new Anthropic();
  
  const prompt = buildPrompt(req);
  
  const response = await client.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });
  
  const patchCode = response.content[0].type === 'text' ? response.content[0].text : '';
  
  return {
    patchCode,
    description: extractDescription(patchCode),
    confidence: 90,  // Claude is high quality
    generatedBy: 'claude',
    cost: 0.003,
  };
}

function buildPrompt(req: FixGenerationRequest): string {
  return `
You are a security expert code reviewer. A security finding has been detected:

**Finding**: ${req.finding.type}
**Category**: ${req.finding.category}
**Severity**: ${req.finding.severity}
**Description**: ${req.finding.description}

**Vulnerable Code** (${req.language}${req.framework ? ` / ${req.framework}` : ''}):
\`\`\`${req.language}
${req.codeContext}
\`\`\`

**Task**: Generate a fix for this vulnerability. Return ONLY a unified diff patch. Do not explain. Format:

\`\`\`diff
- old line
+ new line
\`\`\`
`;
}
```

**Day 3: NVIDIA NIM Setup**
```yaml
# docker-compose.yml for Mistral via NIM
version: '3.8'

services:
  mistral-nim:
    image: nvcr.io/nvidia/nim:mistral-7b-instruct-v0.2-openai
    container_name: mistral-nim
    runtime: nvidia
    shm_size: 16gb
    ports:
      - "8000:8000"
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
      - NIM_LOG_LEVEL=INFO
    volumes:
      - ./models:/root/.cache/nim  # Cache models locally
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/v1/models"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Deploy:
```bash
docker-compose -f docker-compose.yml up -d
# Wait for health check to pass
curl http://localhost:8000/v1/models
```

**Day 4-5: Mistral Integration**
```typescript
// lib/fix-generation/mistral-client.ts
import OpenAI from 'openai';

export async function generateFixWithMistral(req: FixGenerationRequest): Promise<FixGenerationResult> {
  const client = new OpenAI({
    baseURL: process.env.MISTRAL_NIM_BASE_URL || 'http://localhost:8000/v1',
    apiKey: process.env.MISTRAL_NIM_API_KEY || 'not-needed',
  });
  
  const prompt = buildSimpleFixPrompt(req);
  
  const response = await client.chat.completions.create({
    model: 'mistral-7b-instruct-v0.2',  // Model name from NIM
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });
  
  const patchCode = response.choices[0].message?.content || '';
  
  return {
    patchCode,
    description: extractDescription(patchCode),
    confidence: 70,  // Mistral is good but not Claude-level
    generatedBy: 'mistral',
    cost: 0.001,  // Approximation for tracking
  };
}

function buildSimpleFixPrompt(req: FixGenerationRequest): string {
  return `Fix this security issue. Return ONLY the fixed code as a diff:

Issue: ${req.finding.type}
Code:
\`\`\`${req.language}
${req.codeContext}
\`\`\`

Return ONLY diff format, nothing else.`;
}
```

#### Week 2: Intelligent Routing & Storage

**Day 6: Build Hybrid Router**
```typescript
// lib/fix-generation/fix-generator.ts
export class FixGenerator {
  async generateFix(vulnerability: VulnerabilityResult, codeContext: string): Promise<FixGenerationResult> {
    // Decide: Simple or Complex?
    const category = classifyComplexity(vulnerability);
    
    if (category === 'simple') {
      // Use local Mistral (fast & cheap)
      return this.generateFixWithMistral(vulnerability, codeContext);
    } else {
      // Use Claude (high quality for complex cases)
      return this.generateFixWithClaude(vulnerability, codeContext);
    }
  }
  
  private classifyComplexity(vuln: VulnerabilityResult): 'simple' | 'complex' {
    const simplePatterns = [
      'Missing HSTS Header',
      'Missing Content-Security-Policy',
      'Missing X-Frame-Options Header',
      'CORS Wildcard',
      'Vulnerable Dependency',
    ];
    
    return simplePatterns.includes(vuln.type) ? 'simple' : 'complex';
  }
  
  private async generateFixWithMistral(...): Promise<FixGenerationResult> {
    // ... implementation
  }
  
  private async generateFixWithClaude(...): Promise<FixGenerationResult> {
    // ... implementation
  }
}
```

**Day 7: Database & Storage**
```typescript
// lib/fix-generation/store-fix.ts
export async function storeFix(
  vulnerabilityId: string,
  fix: FixGenerationResult,
  scanId: string
): Promise<void> {
  await prisma.fixSuggestion.create({
    data: {
      vulnerabilityId,
      patchCode: fix.patchCode,
      description: fix.description,
      generatedBy: fix.generatedBy,
      confidence: fix.confidence,
      createdByScan: scanId,
    },
  });
  
  // Track usage for billing
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    select: { projectId: true },
  });
  
  const month = new Date().toISOString().slice(0, 7);  // "2026-03"
  
  await prisma.fixSuggestionUsage.upsert({
    where: { projectId_month: { projectId: scan.projectId, month } },
    create: {
      projectId: scan.projectId,
      month,
      totalRequests: 1,
      totalCost: fix.cost,
    },
    update: {
      totalRequests: { increment: 1 },
      totalCost: { increment: fix.cost },
    },
  });
}
```

#### Week 3: Integration & Validation

**Day 8-9: Hook into Scanner**
```typescript
// lib/scanner/index.ts (after finding creation)
async function scanDirectory(targetPath: string) {
  // ... existing scanning logic
  
  let allFindings: VulnerabilityResult[] = [];
  
  // Add fixability classification (Phase 3a)
  for (const finding of allFindings) {
    const fixability = classifyFinding(finding);
    finding.fixability = fixability.fixability;
    finding.fixLevel = fixability.fixLevel;
  }
  
  // Generate fix suggestions (Phase 3b)
  // Only for findings that are NOT manual-only
  const fixableFindings = allFindings.filter(f => f.fixability !== 'manual-only');
  
  for (const finding of fixableFindings) {
    try {
      const codeContext = extractCodeSnippet(finding);
      const fix = await fixGenerator.generateFix(finding, codeContext);
      await storeFix(finding.id, fix, scan.id);
    } catch (error) {
      logger.error(`Failed to generate fix for ${finding.type}:`, error);
      // Don't fail scan if fix generation fails
    }
  }
  
  return allFindings;
}
```

**Day 10: Testing & Validation**
```typescript
// tests/fix-generation.test.ts
describe('Fix Generation', () => {
  it('should generate fix for missing HSTS header (Mistral)', async () => {
    const vulnerability: VulnerabilityResult = {
      type: 'Missing HSTS Header',
      category: 'configuration',
      severity: 'medium',
      // ...
    };
    
    const fix = await fixGenerator.generateFix(vulnerability, 'app.use(cors())');
    
    expect(fix.generatedBy).toBe('mistral');
    expect(fix.patchCode).toContain('Strict-Transport-Security');
    expect(fix.confidence).toBeGreaterThan(60);
  });
  
  it('should generate fix for SQL injection (Claude)', async () => {
    const vulnerability: VulnerabilityResult = {
      type: 'Potential SQL Injection',
      category: 'code',
      severity: 'high',
      // ...
    };
    
    const fix = await fixGenerator.generateFix(vulnerability, 'const result = db.query(`SELECT * FROM users WHERE id = ${id}`)');
    
    expect(fix.generatedBy).toBe('claude');
    expect(fix.confidence).toBeGreaterThan(80);
  });
  
  it('should not generate fix for manual-only findings', async () => {
    const vulnerability: VulnerabilityResult = {
      type: 'Hardcoded Secret',
      category: 'secret',
      // ...
    };
    
    const fixability = classifyFinding(vulnerability);
    expect(fixability.fixability).toBe('manual-only');
    
    // Scanner should skip fix generation
  });
});
```

#### Week 4: Monitoring & Cost Control

**Day 11-12: Cost Tracking Dashboard**
```typescript
// app/api/admin/fix-generation-metrics/route.ts
export async function GET() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  
  const usage = await prisma.fixSuggestionUsage.findMany({
    where: { month: currentMonth },
    include: { project: { select: { name: true, subscriptionTier: true } } },
  });
  
  const metrics = {
    totalCost: usage.reduce((sum, u) => sum + u.totalCost, 0),
    totalRequests: usage.reduce((sum, u) => sum + u.totalRequests, 0),
    averageCostPerRequest: usage.reduce((sum, u) => sum + u.totalCost, 0) / usage.reduce((sum, u) => sum + u.totalRequests, 0),
    byProject: usage.map(u => ({
      projectId: u.projectId,
      projectName: u.project.name,
      requests: u.totalRequests,
      cost: u.totalCost,
    })),
  };
  
  return Response.json(metrics);
}
```

**Day 13-14: Performance Tuning**
- Monitor Mistral latency (target: <3 seconds)
- Monitor Claude latency (target: <5 seconds)
- Implement caching for identical findings
- Add circuit breaker if services fail

---

## 6. INFRASTRUCTURE REQUIREMENTS

### For Local Mistral Deployment

#### Hardware
```
GPU: 1x NVIDIA A100 (40GB) or 1x RTX 6000 (48GB) minimum
  - Mistral 7B: ~10GB VRAM
  - Headroom for concurrent requests: 20GB
  - Total needed: ~16-20GB VRAM

CPU: 8+ vCPU
RAM: 32GB system RAM
Storage: 100GB SSD (for model cache + logs)
Network: 1Gbps for API calls to main app
```

#### Docker Image Size
```
Base: nvidia/cuda:12.2.0-devel-ubuntu22.04 (5GB)
NIM Package: ~15GB
Total: ~20GB
```

#### Deployment Options

**Option 1: On Your Own Hardware**
```bash
# Prerequisites
- NVIDIA GPU with CUDA 12.0+
- Docker + NVIDIA Container Toolkit
- 32GB RAM available

# Deploy
git clone https://github.com/your-org/nim-deployment
cd nim-deployment
docker-compose up -d

# Verify
curl http://localhost:8000/v1/models
```

**Option 2: AWS EC2 (g4dn.2xlarge)**
```
Instance: g4dn.2xlarge (1x NVIDIA T4 GPU, 32GB RAM)
Cost: ~$1.50/hour = ~$1,080/month
Good for: Dev/staging or small production

Recommended for ~100-500 concurrent users
```

**Option 3: AWS ECS + GPU (Production)**
```
Cluster: 3x g4dn.12xlarge (3 x A100, auto-scaling)
Cost: ~$5-8/hour = ~$3,600-5,760/month
Good for: 1000+ concurrent users with high availability

Auto-scaling: Trigger on queue depth
Failover: Multiple replicas across AZs
```

---

## 7. COST ANALYSIS (12-MONTH PROJECTION)

### Scenario A: Claude Only (Simplest)
```
Month 1-3: Early access
  - 50 Pro users × 10 scans/month × 5 fixes = 2,500 API calls
  - Cost: 2,500 × $0.003 = $7.50/month
  - Revenue: 50 × $29 = $1,450/month
  - Margin: 99.5%

Month 6: Growth phase
  - 200 Pro users × 10 scans/month × 5 fixes = 10,000 API calls
  - Cost: 10,000 × $0.003 = $30/month
  - Revenue: 200 × $29 = $5,800/month
  - Margin: 99.5%

Month 12: Scale
  - 500 Pro users × 10 scans/month × 5 fixes = 25,000 API calls
  - Cost: 25,000 × $0.003 = $75/month
  - Revenue: 500 × $29 = $14,500/month
  - Margin: 99.5%

Annual Cost: $75 × 12 = $900
Annual Revenue (500 users): $14,500 × 12 = $174,000
### Scenario B: Hybrid (Claude + Local Mistral)
```
Month 1-3: Setup + initial deployment
  - Infrastructure: $0 (use existing servers, add GPU)
  - API calls (Claude 50% of fixes): 1,250 × $0.003 = $3.75
  - Total monthly: $3.75
  - Revenue: $1,450/month
  - Margin: 99.7%

Month 6: Running lean
  - Infrastructure: $2,000/month (1x A100 server)
  - API calls (Claude): 5,000 × $0.003 = $15
  - Total: $2,015/month
  - Revenue: $5,800/month
  - Margin: 65.3%

Month 12: Scaled
  - Infrastructure: $5,000/month (3x A100 servers for HA)
  - API calls (Claude): 12,500 × $0.003 = $37.50
  - Total: $5,037.50/month
  - Revenue: $14,500/month
  - Margin: 65.3%

Annual Cost (avg): $3,000 × 12 = $36,000
Annual Revenue: $174,000
Profit: $138,000
```

### Scenario C: All Open-Source (Full Local)
```
Month 12: Full scale
  - Infrastructure: $5,000/month (3x A100 + networking)
  - API calls: $0 (all local)
  - Total: $5,000/month
  - Revenue: $14,500/month
  - Margin: 65.5%

Annual Cost: $60,000
Annual Revenue: $174,000
Profit: $114,000

BUT RISK: Lower fix quality (~70% vs 90%), requires DevOps to maintain
```

### Recommendation
**Start with Scenario A (Claude only)** for first 3 months. At month 6 when users > 200 and API costs exceed infrastructure costs, switch to Scenario B (Hybrid).

---

## 8. API & DATABASE CHANGES SUMMARY

### New Prisma Models
```prisma
model FixSuggestion {
  id                String      @id @default(cuid())
  vulnerabilityId   String
  vulnerability     Vulnerability @relation(fields: [vulnerabilityId], references: [id], onDelete: Cascade)
  patchCode         String      
  description       String      
  generatedBy       String      
  generatedAt       DateTime    @default(now())
  confidence        Int         @default(0)
  createdByScan     String      
  consumedByUser    String?     
  @@index([vulnerabilityId])
  @@index([createdByScan])
  @@index([generatedBy])
}

model FixSuggestionUsage {
  id                String      @id @default(cuid())
  projectId         String
  project           Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  month              String      
  totalRequests      Int         @default(0)
  totalCost          Decimal     @default(0)  
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
  @@unique([projectId, month])
  @@index([projectId])
}
```

### Modified Vulnerability Model
```prisma
model Vulnerability {
  // ... existing fields
  
  // Phase 3a: Fixability
  fixability    String    @default("uncategorized")
  fixLevel      Int       @default(0)
  
  // Phase 3b: Suggested Fixes
  fixSuggestions FixSuggestion[]
  
  @@index([fixability])
}
```

### Environment Variables
```bash
# .env.local (Phase 3b)

# Claude API
ANTHROPIC_API_KEY=sk-ant-...

# Mistral NIM (local)
MISTRAL_NIM_BASE_URL=http://localhost:8000/v1
MISTRAL_NIM_API_KEY=not-required-for-local

# Feature flags
FEATURE_FIX_GENERATION=true
FIX_GENERATION_MODEL=hybrid  # Options: claude, mistral, hybrid
MAX_FIXES_PER_SCAN=10

# Rate limiting
FIX_GENERATION_RATE_LIMIT=100  # Per month for Pro users
```

---

## 9. IMPLEMENTATION TIMELINE

| Week | Task | Effort | Dependency |
|------|------|--------|-----------|
| **W1** | Claude API integration | 2 days | - |
| **W1** | NVIDIA NIM Docker setup | 2 days | - |
| **W1** | Mistral integration | 1 day | Docker setup |
| **W2** | Hybrid router logic | 1 day | Claude + Mistral |
| **W2** | Database schema & storage | 2 days | Router logic |
| **W2** | Billing/usage tracking | 1 day | Database |
| **W3** | Scanner integration | 2 days | Storage logic |
| **W3** | End-to-end testing | 2 days | Integration |
| **W4** | Monitoring & dashboards | 1 day | E2E testing |
| **W4** | Load testing & tuning | 2 days | Monitoring |
| **W4** | Documentation | 1 day | All |
| **TOTAL** | | **18 days** | |

**Estimated Duration**: 3.5-4 weeks for full implementation

---

## 10. RISK MITIGATION

### Risk 1: Fix Quality Issues
```
Problem: Generated fixes may be incorrect or incomplete

Mitigation:
- Always test fixes in automated CI/CD before suggesting to users
- Show confidence scores (60-100%)
- Phase 4 UI shows "⚠️  Code review recommended" for <80% confidence
- Require manual approval for auto-fix-risky and review-required fixes
```

### Risk 2: API Dependency (Claude)
```
Problem: Claude API downtime → fix generation fails

Mitigation:
- Implement retry logic (3 attempts with exponential backoff)
- Fall back to pre-generated templates for common issues
- Store templates in database for offline fixes
- Monitor Claude API status + send alerts
```

### Risk 3: GPU Resource Exhaustion (Mistral)
```
Problem: High-concurrency requests queue on local Mistral

Mitigation:
- Implement request queuing with max queue size
- Process fixes asynchronously (return "fix pending" response)
- Auto-scale to 2-3 replicas during peak load
- Fall back to Claude if Mistral overwhelmed
```

### Risk 4: Cost Overruns
```
Problem: Unexpectedly high Claude API costs

Mitigation:
- Implement monthly budget limits in code
- Alert when month reaches 75% of expected cost
- Disable fix generation if over budget (graceful degradation)
- Implement fix caching to avoid duplicate API calls
```

---

## 11. PHASE 4 HANDOFF

Once Phase 3 is complete, Phase 4 (Paid Scan-and-Fix MVP) will:

1. **Create UI endpoint**: `/api/generate-fix` (lazy generation if not already done)
2. **Add dashboard button**: "View Fix Suggestion" in findings table
3. **Show diff viewer**: Side-by-side before/after code
4. **Track acceptance**: Did user think fix was helpful?
5. **Integrate Stripe**: Bill Pro users for overages
6. **Add job queue**: Background workers for large processing (optional)

Phase 3 completes **all backend infrastructure**, so Phase 4 is purely UI work.

---

## DECISION MATRIX

**Choose your path:**

| Decision | If Simplicity is Priority | If Cost Control is Priority | If Both Matter |
|----------|---------------------------|-----------------------------|-----------------| 
| Model | Claude only | Llama 2 (open-source) | Hybrid (Claude + Mistral) |
| Infrastructure | None (SaaS) | AWS GPU instance + Docker | Shared server + Docker |
| Timeline | 1 week | 3 weeks | 3.5 weeks |
| Cost (first year) | $1,000 + $0 infra | $0 API + $60,000 infra | $500 API + $36,000 infra |
| Breakeven users | None (profitable immediately) | 100+ Pro users | 80+ Pro users |
| **Recommendation** | ✅ Start here | ❌ Too expensive to start | ⭐⭐⭐ BEST OPTION |

