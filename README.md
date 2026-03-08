# Almond teAI

Almond teAI is a security verification and trust platform for repositories, uploaded codebases, and live websites.

It goes beyond one-time vulnerability detection by combining project-centric scan history, public verification pages, trust badges, exploit verification, regression intelligence, and professional PDF reporting.

## What Is Implemented

### Core scan inputs
- GitHub repository scanning
- ZIP/codebase upload scanning
- Live website security scanning

### Security analysis
- Static code-pattern scanning
- Secret detection in repositories
- Dependency vulnerability scanning through OSV
- Website exposure and misconfiguration scanning
- Safe exploit verification for selected website findings
  - `/.env`
  - `/.git/HEAD`
  - `/swagger.json`
  - `/api-docs`
  - CORS misconfiguration
  - safe GraphQL exposure verification

### Trust and scoring
- Project-centric data model
- Weighted scoring v2
- Grade derivation (`A`/`B`/`C`/`D`/`F`)
- Confidence model (`detected`, `likely`, `verified`)
- Exploitability model (`none`, `possible`, `confirmed`)
- Category-aware findings
  - `secret`
  - `dependency`
  - `code`
  - `exposure`
  - `configuration`

### Trust platform features
- Public verification pages per project
- Embeddable SVG trust badges
- Project settings for:
  - public/private visibility
  - badge eligibility
  - monitoring enabled flag
- Security Regression Intelligence v1
  - previous vs current scan comparison
  - score delta
  - new / resolved / unchanged findings
  - improved / stable / degraded summary

### Reporting
- Professional Almond teAI PDF security reports
- Grade, score, status, exploitability, and category included in report findings
- Badge embed UX on the scan detail page

### SaaS foundation
- Auth.js / NextAuth integration
- GitHub OAuth sign-in
- user-owned projects
- project-level access foundation for SaaS transition

## Product Direction

Almond teAI is not just a scanner.

It is being built as a trust platform for modern AI-generated apps, websites, and software projects.

Current direction:
- stronger trust realism in scoring
- public transparency
- verification pages and badges
- exploit verification
- project-level history
- future continuous monitoring

## Tech Stack

- Next.js 14 (App Router)
- React
- Tailwind CSS
- Prisma
- SQLite by default
- Auth.js / NextAuth
- pdfmake
- Anthropic Claude API (optional)

## Project Structure

```text
app/
  api/
    analyze/                Scan execution
    auth/[...nextauth]/     Auth.js
    badge/[slug]/           Trust badge SVG
    projects/[id]/settings/ Internal project settings
    report/[id]/            PDF report
    scans/                  Scan APIs
  dashboard/                Dashboard
  projects/[slug]/          Public verification page
  scan/[id]/                Scan detail page

components/
  ScanReportView.tsx
  ScoreCard.tsx
  VulnerabilityTable.tsx
  CategoryBadge.tsx
  ExploitabilityBadge.tsx
  ProjectVerificationView.tsx

lib/
  ai.ts
  badge.ts
  pdf.ts
  projects.ts
  regression.ts
  safe-extract.ts
  scoring.ts
  scanner/
    dependency-scanner.ts
    secret-scanner.ts
    url-scanner.ts
    index.ts
    patterns.ts
    types.ts

prisma/
  schema.prisma
```

## Quick Start

### Prerequisites
- Node.js 18+
- GitHub OAuth app if you want sign-in
- optional Anthropic API key for AI summaries

### Install

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment Variables

Required or commonly used variables:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Default local database path |
| `NEXTAUTH_SECRET` | Yes for auth | Auth.js session secret |
| `NEXTAUTH_URL` | Yes for auth | Base app URL |
| `GITHUB_ID` | Yes for GitHub login | GitHub OAuth client id |
| `GITHUB_SECRET` | Yes for GitHub login | GitHub OAuth client secret |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public app URL used in badge/embed links |
| `ANTHROPIC_API_KEY` | No | Enables AI summary generation |
| `GITHUB_TOKEN` | No | Helps with GitHub API rate limits |
| `INTERNAL_ADMIN_TOKEN` | Internal MVP only | Used by the current internal project settings control |

## Local Development Notes

- If Prisma schema changes, run:

```bash
npx prisma generate
npx prisma db push
```

- On Windows, stop `next dev` before running `prisma generate` if Prisma engine files are locked.
- ZIP extraction now skips symlinks and `node_modules` to avoid Windows extraction failures during scanning.

## Current Detection Areas

Examples of what Almond teAI currently detects or verifies:

- hardcoded secrets
- insecure hashing
- insecure authentication patterns
- unsafe code execution
- SQL injection patterns
- dependency vulnerabilities
- missing headers and security misconfigurations
- exposed environment/config/git assets
- open API/docs endpoints
- CORS misconfiguration

## Current Limitations

This is still an evolving platform. Current limitations include:

- static repo scanning still uses pattern-based detection
- exploit verification is intentionally limited to safe, read-only checks
- continuous monitoring automation is not implemented yet
- notifications are not implemented yet
- public verification currently emphasizes project trust state, not full monitoring workflows

## Roadmap Themes

Near-term product themes already supported or underway:

- better trust realism in scoring
- regression intelligence
- exploit verification
- public transparency
- project trust history

Planned future expansion:

- automated continuous monitoring
- monitoring alerts
- richer regression visibility
- stronger SaaS limits and plan enforcement
- premium manual review and trust workflows

## Documentation

- [PROJECT_VISION.md](./PROJECT_VISION.md)
- [SAAS_ARCHITECTURE.md](./SAAS_ARCHITECTURE.md)

## Positioning

Almond teAI is designed to help teams move from one-time scanning toward ongoing security verification and public trust signaling.
