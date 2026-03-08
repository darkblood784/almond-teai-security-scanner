# Almond teAI - SaaS Architecture Status

## 1. Purpose

This document describes the current SaaS architecture state of Almond teAI.

It is not just a future plan. It reflects:
- what is already implemented
- what is partially implemented
- what remains to be built next

Almond teAI is evolving from a scanner MVP into a security trust platform with public verification, trust badges, project ownership, and future monitoring.

---

## 2. Current Product Position

Almond teAI is a security verification and trust platform for:
- repositories
- uploaded codebases
- live websites

Current product capabilities already go beyond one-time scanning:
- project-centric scan history
- public verification pages
- embeddable trust badges
- exploit verification for selected website findings
- regression intelligence between scans
- professional PDF reporting

The SaaS transition adds:
- user identity
- project ownership
- access control foundations
- future quota and paid feature enforcement

---

## 3. What Is Already Implemented

### Authentication
Implemented:
- Auth.js / NextAuth
- GitHub OAuth login
- Prisma adapter
- database-backed sessions

Current files:
- [auth.ts](./auth.ts)
- [app/api/auth/[...nextauth]/route.ts](./app/api/auth/[...nextauth]/route.ts)

### User ownership
Implemented:
- `User` model
- `Project.ownerId`
- one user owns many projects
- scans are owned indirectly through projects

Current files:
- [prisma/schema.prisma](./prisma/schema.prisma)
- [lib/projects.ts](./lib/projects.ts)
- [app/api/analyze/route.ts](./app/api/analyze/route.ts)

### Project-centric trust model
Implemented:
- `Project` as the trust identity
- repeated scans grouped under the same project
- `latestScanId`
- `visibility`
- `publicSlug`
- `badgeEligible`
- `monitoringEnabled`

### Public trust features
Implemented:
- public verification pages
- public trust badge endpoint
- internal project settings UI for trust controls

Current files:
- [app/projects/[slug]/page.tsx](./app/projects/[slug]/page.tsx)
- [app/api/badge/[slug]/route.ts](./app/api/badge/[slug]/route.ts)
- [app/api/projects/[id]/settings/route.ts](./app/api/projects/[id]/settings/route.ts)

### Scoring and trust realism
Implemented:
- weighted scoring v2
- grade derivation
- confidence model
- exploitability model
- category-aware scoring

Current files:
- [lib/scoring.ts](./lib/scoring.ts)

### Regression intelligence
Implemented:
- previous-vs-current scan comparison for the same project
- `new`, `resolved`, `unchanged`
- score delta
- improved / stable / degraded summary
- scan detail regression UI

Current files:
- [lib/regression.ts](./lib/regression.ts)
- [components/ScanReportView.tsx](./components/ScanReportView.tsx)
- [app/api/analyze/route.ts](./app/api/analyze/route.ts)

### Advanced scanning foundations
Implemented:
- static code scanning
- secret detection
- dependency vulnerability scanning with OSV
- website exposure scanning
- safe exploit verification for selected website findings
- noise reduction / duplicate suppression

Current files:
- [lib/scanner/index.ts](./lib/scanner/index.ts)
- [lib/scanner/secret-scanner.ts](./lib/scanner/secret-scanner.ts)
- [lib/scanner/dependency-scanner.ts](./lib/scanner/dependency-scanner.ts)
- [lib/scanner/url-scanner.ts](./lib/scanner/url-scanner.ts)

---

## 4. Current Domain Model

The current effective SaaS domain model is:

- `User`
- `Project`
- `Scan`
- `Vulnerability`
- auth infrastructure tables
  - `Account`
  - `Session`
  - `VerificationToken`

### Ownership model

- one `User` owns many `Project`s
- one `Project` has many `Scan`s
- one `Scan` has many `Vulnerability` rows

### Current key product fields

#### User
- `plan`
- `monthlyScanLimit`
- `monthlyScansUsed`
- `monitoringProjectLimit`
- `isActive`

#### Project
- `ownerId`
- `projectType`
- `canonicalKey`
- `visibility`
- `publicSlug`
- `verificationToken`
- `monitoringEnabled`
- `badgeEligible`
- `latestScanId`

#### Scan
- `score`
- `summary`
- `aiSummary`
- regression fields:
  - `previousScanId`
  - `previousScore`
  - `scoreDelta`
  - `regressionStatus`
  - `regressionSummary`
  - `newFindingsCount`
  - `resolvedFindingsCount`
  - `unchangedFindingsCount`

#### Vulnerability
- `category`
- `severity`
- `confidence`
- `exploitability`
- `file`
- `line`
- `description`
- `suggestion`

---

## 5. Current Authorization State

### Already enforced

- scan creation requires authentication
- new projects are created under the authenticated user
- project identity is resolved within the owner namespace

### Still incomplete

The codebase has the SaaS ownership foundation, but authorization is not yet fully tightened everywhere.

Still needed:
- fully owner-filtered dashboard queries
- full owner-only access for all private scan/project views
- replacing all temporary internal-only controls with ownership-only controls where still applicable

This is the next security hardening step for the SaaS layer.

---

## 6. What Is Partially Implemented

### Usage limits
Partially implemented:
- user plan and quota fields exist in schema

Not yet complete:
- scan quota enforcement before scan creation
- monthly usage increment/reset logic
- plan-aware monitoring quota enforcement
- dashboard usage display

### Monitoring
Partially implemented:
- `monitoringEnabled` exists on `Project`
- projects maintain scan history
- regression engine now supports future monitoring logic

Not yet complete:
- scheduled rescans
- cron or worker execution
- monitoring alerts
- score-change notifications

### Plan gating
Partially implemented:
- `plan` exists on `User`
- architecture is prepared for free/pro logic

Not yet complete:
- actual feature gating by plan
- enforcement for premium capabilities
- upgrade flow

---

## 7. What Is Not Implemented Yet

These are still future phases:

- Stripe / billing integration
- subscription lifecycle management
- organizations / teams
- collaborator roles
- audit logs
- enterprise RBAC
- notifications for regressions or monitoring alerts
- scheduled continuous monitoring workers
- advanced usage records beyond simple counters

---

## 8. Current SaaS Priorities

The next safest implementation sequence is:

### Phase 1
- tighten ownership and authorization everywhere
- ensure dashboard and scan access are owner-correct

### Phase 2
- enforce usage limits on the backend
- free plan vs pro plan behavior

### Phase 3
- gate monitoring and premium trust features by plan

### Phase 4
- add scheduled rescans and monitoring automation

### Phase 5
- add billing and subscription infrastructure

This keeps the system practical and avoids premature billing complexity.

---

## 9. Recommended SaaS MVP Rules

### Authentication
- required for scan creation
- GitHub OAuth is the current MVP provider

### Ownership
- every project belongs to a user
- projects are the trust boundary

### Visibility
- public trust artifacts should remain owner-controlled

### Backend enforcement
- usage and permission checks must happen server-side

### Trust-first product logic
- auth and SaaS controls support the trust platform
- they should not replace the trust-product direction

---

## 10. Environment Variables

Current relevant variables include:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GITHUB_ID`
- `GITHUB_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `ANTHROPIC_API_KEY`
- `GITHUB_TOKEN`
- `INTERNAL_ADMIN_TOKEN`

Note:
- `INTERNAL_ADMIN_TOKEN` is still a temporary internal MVP control and should eventually be replaced by full ownership-based trust settings control.

---

## 11. Current Risks / Gaps

The main SaaS risks at the current stage are:

1. Ownership model exists, but authorization is not yet fully complete across all surfaces
2. User quota fields exist, but usage enforcement is not yet active
3. Monitoring toggles exist, but no actual monitoring scheduler exists
4. Public trust features exist, but plan-based gating is not yet enforced

These are the correct next architecture priorities.

---

## 12. Current Success State

Almond teAI already has a strong SaaS foundation compared with the original MVP:

- authenticated users
- user-owned projects
- project-centric trust model
- public verification pages
- trust badges
- exploit verification
- regression intelligence
- professional reporting

This means the platform has already moved beyond a simple scanner and into a real trust-platform architecture.

---

## 13. Next Implementation Target

The next practical SaaS milestone should be:

- complete owner-based authorization
- quota enforcement
- plan-aware monitoring eligibility
- user-specific dashboard usage visibility

That is the smallest correct step before billing or full continuous monitoring automation.
