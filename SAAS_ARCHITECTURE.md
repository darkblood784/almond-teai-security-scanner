# Almond teAI – SaaS Architecture Plan

## 1. Purpose

This document defines the next architecture phase for Almond teAI.

The project has already evolved from a simple scan-based MVP into a project-centric trust platform with:

- scan ingestion
- project grouping
- public verification pages
- score calculation
- embeddable trust badges

The next step is to evolve Almond teAI into a real multi-user SaaS product.

This means the platform must now support:

- user accounts
- sign in / sign up
- project ownership
- private vs public project control
- usage limits
- free vs paid plans
- paid continuous monitoring
- backend enforcement of limits
- protection against platform abuse

This document is the source of truth for that SaaS transition.

---

# 2. Product Direction

Almond teAI is not just a scanner.

It is a **security trust platform for AI-generated apps, websites, and software projects**.

In the SaaS phase, users should be able to:

- create an account
- sign in
- submit scans under their own account
- view and manage their own projects
- control whether projects are public or private
- enable public badges for eligible projects
- upgrade to paid plans
- unlock continuous monitoring and other premium features

The platform must prevent abuse by ensuring that free users cannot run unlimited scans.

---

# 3. Core SaaS Principles

When adding SaaS features, the system should follow these principles:

1. **Ownership**
   - Every project must belong to a user.
   - Every scan must be traceable to a project owner.

2. **Backend enforcement**
   - Limits and permissions must be enforced on the server.
   - UI-only restrictions are not sufficient.

3. **Simple MVP first**
   - Start with the smallest practical auth + quota system.
   - Avoid enterprise complexity early.

4. **Trust remains the product core**
   - Auth and billing are support systems.
   - The platform’s main value is still security verification and trust.

5. **Gradual evolution**
   - Build only what is needed for:
     - secure user ownership
     - scan limits
     - plan gating
     - monitoring eligibility

---

# 4. SaaS Goals

The SaaS architecture should enable the following:

## Immediate goals
- add sign in / sign up
- associate projects with users
- restrict access to private projects
- allow users to see only their own projects and scans
- enforce scan limits for free users
- prepare the platform for paid plans

## Short-term goals
- support a free plan and a paid plan
- enable continuous monitoring only for paid users
- show usage and limits in the dashboard
- allow users to manage trust features on owned projects

## Long-term goals
- support subscriptions and billing
- support organizations / teams
- support project collaborators
- support enterprise features
- support audit logs and team permissions

---

# 5. Recommended MVP SaaS Scope

The MVP SaaS phase should include only the following:

## Authentication
- sign in
- sign up
- session handling

## Ownership
- every Project belongs to one User

## Authorization
- users can only manage their own projects
- only owners can make a project public
- only owners can enable trust badges or monitoring

## Usage limits
- scan limits per user
- monthly usage tracking
- backend enforcement before starting a scan

## Plans
- at least:
  - free
  - pro

## Feature gating
- continuous monitoring only for paid users
- free users have limited scans
- future premium scan types can be gated later

This is enough to make the system a real SaaS without overbuilding.

---

# 6. Recommended Auth Strategy

## Preferred approach: Auth.js / NextAuth with Prisma

For the current stack (Next.js + Prisma), the best MVP auth solution is:

- Auth.js / NextAuth
- Prisma adapter
- OAuth-based login first

Recommended providers:
- GitHub
- Google

Why this is recommended:
- integrates well with Next.js
- integrates well with Prisma
- reduces risk compared to building auth manually
- fast to implement
- familiar SaaS pattern
- enough for MVP

## Why not build custom password auth first

Custom password auth introduces:
- password hashing flows
- reset flows
- verification emails
- security risk
- more implementation complexity

For MVP, OAuth login is enough.

Email/password can be added later if necessary.

---

# 7. Multi-User Domain Model

The platform should move from:

- Project
- Scan
- Vulnerability

to:

- User
- Project
- Scan
- Vulnerability
- Usage tracking / plan metadata

## Ownership model

- one User owns many Projects
- one Project has many Scans
- one Scan has many Vulnerabilities

This is the main relationship model.

---

# 8. Proposed Core Data Model

## User

Represents an authenticated platform account.

Suggested fields:

- `id`
- `name`
- `email`
- `image`
- `createdAt`
- `updatedAt`
- `plan`
- `monthlyScanLimit`
- `monthlyScansUsed`
- `monitoringProjectLimit`
- `isActive`

Purpose:
- identity
- billing tier / feature gating
- usage enforcement

---

## Project

Represents a stable trust object that belongs to a user.

Suggested fields:

- `id`
- `ownerId`
- `name`
- `projectType`
- `canonicalKey`
- `repoUrl`
- `websiteUrl`
- `sourceLabel`
- `visibility`
- `publicSlug`
- `verificationToken`
- `monitoringEnabled`
- `badgeEligible`
- `latestScanId`
- `createdAt`
- `updatedAt`

Purpose:
- trust identity
- public/private control
- badge eligibility
- monitoring eligibility
- ownership boundary

---

## Scan

Represents one execution result.

Suggested fields:

- `id`
- `projectId`
- `scanType`
- `status`
- `score`
- `summary`
- `totalFiles`
- `scannedFiles`
- `linesScanned`
- `errorMessage`
- `aiSummary`
- `createdAt`
- `updatedAt`

Optional later:
- `initiatedByUserId`
- `scanDurationMs`
- `billingCategory`

Purpose:
- immutable scan event
- historical trust record

---

## Vulnerability

Represents findings for a scan.

Suggested fields:

- `id`
- `scanId`
- `type`
- `severity`
- `confidence`
- `file`
- `line`
- `code`
- `description`
- `suggestion`
- `evidence`
- `createdAt`

Purpose:
- trust evidence
- reporting
- scoring inputs

---

## Usage Record (optional for MVP, recommended later)

For MVP, usage can start as counters on `User`.

Later, add a dedicated model:

- `id`
- `userId`
- `periodStart`
- `periodEnd`
- `scansUsed`
- `websiteScansUsed`
- `repoScansUsed`
- `zipScansUsed`
- `monitoringProjectsUsed`

Purpose:
- clearer billing logic
- auditability
- monthly resets
- better reporting

For MVP, counters on `User` are acceptable.

---

# 9. Suggested Prisma Direction

The MVP schema should add a `User` model and connect `Project.ownerId` to `User.id`.

If using Auth.js + Prisma, Auth.js may also add:

- `Account`
- `Session`
- `VerificationToken`

These should be treated as authentication infrastructure and not mixed with core product logic.

## Product-level fields recommended on User
- `plan`
- `monthlyScanLimit`
- `monthlyScansUsed`
- `monitoringProjectLimit`

This is enough for MVP gating.

---

# 10. Authorization Rules

The platform must enforce permissions on the backend.

## Rules

### Scan creation
A user must be authenticated to create a scan.

### Project ownership
A user may only:
- view their own private projects
- update their own project settings
- enable monitoring on their own projects
- make their own projects public

### Public project access
Public verification pages and badges can be viewed without login.

### Private project access
Private projects can only be viewed by the owner.

### Dashboard access
Dashboard data must be filtered by current authenticated user.

---

# 11. Plans

Start simple.

## Free plan
Suggested restrictions:
- limited scans per month
- no continuous monitoring
- limited number of public projects
- badge feature optional or restricted
- no smart contract audit
- no advanced scanning later

Example:
- `3` scans per month
- `0` monitoring projects

## Pro plan
Suggested capabilities:
- higher scan quota
- continuous monitoring enabled
- public badges
- trust pages
- larger project limits

Example:
- `50` scans per month
- `10` monitored projects

## Enterprise plan (later)
- custom limits
- organization/team support
- audit logs
- account management
- custom SLAs

---

# 12. Usage Limit Enforcement

Usage limits must be checked **before** a scan starts.

## Required backend checks before scan creation

When a user submits:
- GitHub repo
- website URL
- ZIP file

the backend should verify:

1. user is authenticated
2. user account is active
3. user has remaining scan quota
4. requested scan type is allowed by plan
5. user is not violating any relevant limits

If any check fails:
- reject the request
- return a clear error message
- do not begin the scan

## Important rule
Never depend on the frontend alone to enforce limits.

---

# 13. Continuous Monitoring Rules

Continuous monitoring is a paid feature.

## MVP gating logic
A user can only enable `monitoringEnabled = true` when:
- user is authenticated
- user owns the project
- user plan allows monitoring
- user has remaining monitoring project quota

If the project no longer qualifies:
- disable monitoring
- or prevent enabling it
- or require plan upgrade

Continuous monitoring should not be available on the free plan.

---

# 14. Public Trust Pages in SaaS Context

Public trust pages remain an important feature.

However, the owner must control whether a project is public.

## Public page rules
A public verification page can exist only if:
- project owner has enabled visibility = public
- project has a valid latest scan
- trust policy allows public display

## Badge rules
A badge can only be shown if:
- project is public
- latest scan exists
- project is marked badgeEligible
- owner has permission under their plan

This makes trust display an owner-controlled feature.

---

# 15. Suggested MVP User Flows

## User registration flow
1. user visits the site
2. user signs in with GitHub or Google
3. platform creates user account
4. default plan = free
5. default scan limit assigned

## Scan flow
1. authenticated user submits repo / website / ZIP
2. backend checks quota
3. project is created or resolved under that user
4. scan runs
5. scan is saved under the user-owned project
6. scan count increments

## Public trust flow
1. user completes scan
2. user opens scan detail
3. user enables:
   - public visibility
   - badgeEligible
4. public page becomes available
5. badge becomes available

## Upgrade flow (later)
1. user hits free limit or wants monitoring
2. user sees upgrade prompt
3. user upgrades to pro
4. plan and limits update

---

# 16. Abuse Prevention Requirements

Auth alone is not enough. The platform should also include basic abuse prevention.

## Recommended MVP controls

### Rate limiting
- per IP
- per authenticated user
- especially on scan submission routes

### File size limits
- ZIP uploads must have a max size

### Repo size / scan duration limits
- avoid giant repository abuse

### Website scan limits
- prevent repeated abusive scanning
- enforce scan concurrency limits later

### Monitoring limits
- cap monitored projects by plan

---

# 17. Background Jobs and Cost Control

Currently scans may run inline or synchronously.

As the SaaS grows, scanning should eventually move to background workers.

But for MVP, do not overbuild this unless scan load becomes a problem.

## Recommended phased approach

### MVP
- keep current scan flow
- enforce auth + quotas first

### Next phase
- add async job queue
- add rescan scheduling
- add worker timeouts
- add scan concurrency limits

The first priority is not queue architecture.
The first priority is ownership and cost control.

---

# 18. Dashboard Requirements for SaaS

The dashboard should eventually become user-specific.

## Dashboard should show
- user’s projects
- user’s recent scans
- user’s current plan
- monthly scans used / limit
- monitored projects used / limit
- public projects
- badge-enabled projects

This helps users understand value and usage.

---

# 19. MVP Implementation Order

This is the recommended implementation sequence.

## Phase 1 – Auth Foundation
- integrate Auth.js / NextAuth
- add OAuth login
- add User model
- confirm sessions work

## Phase 2 – Ownership
- add `ownerId` to Project
- require authenticated user for scan creation
- attach all new projects to current user
- filter dashboard/views to owned projects

## Phase 3 – Usage Limits
- add plan + quota fields to User
- check usage before scan creation
- increment usage after successful scan
- show limits in UI

## Phase 4 – Trust Controls Under Ownership
- only owners can change:
  - visibility
  - badgeEligible
  - monitoringEnabled

## Phase 5 – Paid Feature Gating
- restrict monitoring to paid plans
- restrict premium features by plan

## Phase 6 – Billing
- integrate Stripe later
- sync plan changes
- manage upgrades/downgrades

This is the safest MVP path.

---

# 20. What Not to Build Yet

To avoid overengineering, do **not** build these yet unless absolutely needed:

- organizations / teams
- collaborator roles
- invite systems
- fine-grained RBAC
- audit log systems
- usage billing per scan
- complex subscription lifecycle logic
- DNS/domain verification ownership proofs
- multi-tenant enterprise admin systems

These are later-phase concerns.

---

# 21. Initial Product Constraints

For the SaaS MVP, assume:

- one user owns one or more projects
- one project has one owner
- scans are owned indirectly through projects
- public trust pages are optional per project
- monitoring is premium
- free users are limited

This keeps the mental model simple.

---

# 22. Recommended Environment Variables

Likely environment variables needed in this phase:

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GITHUB_ID`
- `GITHUB_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Later:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

---

# 23. Suggested Engineering Guidelines

When implementing the SaaS phase:

1. prefer the smallest stable auth solution
2. keep ownership checks server-side
3. keep plan logic centralized
4. keep scan quota checks reusable
5. do not scatter billing logic across many files
6. preserve current trust-platform behavior while adding auth
7. avoid breaking the current public verification page and badge behavior

---

# 24. Success Criteria

The SaaS architecture phase is successful if:

- users can sign in
- each project belongs to a user
- scan creation requires auth
- free users cannot scan infinitely
- private/public trust pages are owner-controlled
- monitoring is gated to paid plans
- the platform is protected from obvious free-tier abuse

---

# 25. Long-Term SaaS Vision

Long term, Almond teAI should become:

- a multi-user security verification platform
- a trust layer for AI-built software
- a subscription SaaS business
- a platform with public trust records and premium monitoring

In that future state:
- developers use Almond teAI before launch
- teams use it continuously
- users and investors rely on the trust record
- public badges spread Almond teAI across the web

---

# 26. Summary

The current system is already a strong trust-platform MVP.

The next architecture phase is to make it a real SaaS by adding:

- authentication
- user ownership
- quota enforcement
- paid feature gating

The MVP goal is not full enterprise infrastructure.

The MVP goal is:

> secure ownership + limited free usage + paid monitoring eligibility

This is the next foundation required for Almond teAI to become a real product.