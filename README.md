# Almond teAI

> **Enterprise Security Verification Platform** — A full-stack SaaS application for continuous security scanning, trust scoring, and public verification of repositories, codebases, and live websites.

Almond teAI goes beyond one-time vulnerability detection by combining **project-centric scan history**, **public verification pages**, **embeddable trust badges**, **exploit verification**, **regression intelligence**, and **professional PDF reporting** into a cohesive trust platform for modern AI-generated apps and software projects.

<img width="1036" height="756" alt="image" src="https://github.com/user-attachments/assets/bbecc786-ad29-4622-bd72-1891911dde7e" />

---

## 🚀 What This Project Demonstrates

- **Full-stack SaaS architecture** — Production-ready Next.js application with multi-tenant user model, Auth.js integration, and role-based project access
- **Multi-input security scanning** — GitHub repos, ZIP uploads, and live website scanning with pluggable scanner modules
- **Sophisticated threat detection** — Static code analysis, secret detection, dependency vulnerability aggregation, and safe exploit verification
- **Intelligent scoring system** — Weighted scoring algorithm with confidence levels, exploitability classifications, and category-aware findings
- **Public-facing trust signals** — Embeddable SVG badges, verification pages, and shareable reports for transparency and credibility
- **Regression intelligence** — Delta-based scan comparison with trend analysis and historical tracking
- **Professional reporting** — PDF generation with full styling, charts, and executive summaries
- **Plan-based feature gating** — Entitlement matrix, usage tracking, and quota enforcement for Free/Pro tiers

---

## 👨‍💻 My Contribution

- Designed the overall system architecture and data flow
- Built backend APIs, database schema, and core business logic
- Developed frontend UI with real-time features and responsive design
- Implemented AI-driven analysis components and data processing pipelines
- Integrated third-party APIs (market data, authentication, email services)
- Set up containerized deployment and environment configuration
- Led end-to-end development from concept to production-ready system

---

## 🏗️ Architecture Overview

**Frontend**: React + Next.js 14 (App Router) + Tailwind CSS
**Backend**: Next.js API Routes + Prisma ORM
**Database**: SQLite (with PostgreSQL ready)
**Auth**: Auth.js (NextAuth.js) with GitHub OAuth
**Key Libraries**: pdfmake, Claude API (optional), OSV APIs

**Core Modules**:
- **Scanner Orchestrator** — Multi-input scanning with dependency analysis, secret detection, and AST-based code rules
- **Scoring Engine** — Weighted vulnerability assessment with confidence and exploitability models
- **Regression Analyzer** — Scan delta calculation and trend intelligence
- **Badge Generator** — Dynamic SVG badge rendering with caching
- **PDF Reporter** — Professional report generation with full design
- **Entitlements Service** — Feature gating and usage quota enforcement

---

## 🎯 Why This Project Matters

**For Security Teams**: Move beyond one-time scans to continuous verification with historical context and regression intelligence.

**For Public Transparency**: Display security posture publicly without exposing internals, building trust with customers and partners.

**For SaaS/DevTools**: Full reference implementation of security scanning, entitlements, reporting, and plan-based feature gating—ready to adapt for your domain.

**For Portfolio**: Demonstrates full-stack expertise, architectural thinking, multi-layered authentication, complex data models, and polished UX for technical users.

---

## ⚡ Quick Highlights

- Full-stack SaaS platform (Next.js + FastAPI)
- Real-time system with WebSocket streaming
- AI-powered analysis and decision support
- Production-ready architecture (Docker, PostgreSQL)
- Secure authentication (JWT, OAuth)
---

## What Is Implemented

### 🔍 Core Scanning Capabilities

**Multi-Input Scanning**
- GitHub repository scanning with OAuth integration
- ZIP/codebase upload scanning with safe extraction
- Live website security scanning with header and config analysis
<img width="752" height="689" alt="image" src="https://github.com/user-attachments/assets/f9df1fc0-0a5f-44f9-9877-12b53913202e" />

**Advanced Security Analysis**
- Static code-pattern scanning with AST-based rules for JavaScript/TypeScript
- Secret detection with pattern recognition for API keys, credentials, tokens
- Dependency vulnerability scanning via OSV integration
- Website exposure scanning (misconfigured endpoints, open APIs, CORS issues)
- Safe exploit verification for real-world exposure validation:
  - Environment file exposure (`/.env`, `/.git/HEAD`)
  - API documentation exposure (`/swagger.json`, `/api-docs`)
  - GraphQL introspection and CORS misconfiguration detection
<img width="1029" height="430" alt="image" src="https://github.com/user-attachments/assets/d690fbec-9922-42d5-ab55-14df6e5fd7b7" />

### 🎯 Trust & Scoring System

**Intelligent Scoring Algorithm**
- Weighted vulnerability assessment (v2)
- Grade derivation: `A` / `B` / `C` / `D` / `F`
- Three-tier confidence model: `detected` / `likely` / `verified`
- Exploitability classification: `none` / `possible` / `confirmed`
- Category-aware findings: `secret`, `dependency`, `code`, `exposure`, `configuration`

**Project-Centric Data Model**
- User-owned projects with OAuth-based access
- Per-project scan history and trend tracking
- Regression intelligence with delta analysis
- Multi-scan comparisons and trend visualization

<img width="1016" height="606" alt="image" src="https://github.com/user-attachments/assets/b0c6431a-b365-4445-8ba5-09d9f2c83ae7" />

### 🏆 Public Trust Platform

**Verification & Transparency**
- Public verification pages per project (customizable slug)
- Embeddable SVG trust badges with caching
- Project visibility controls (Public/Private)
- Badge eligibility toggles with plan-based gating

**Regression Intelligence v1**
- Previous vs current scan comparison
- Score delta calculation and trend analysis
- New / resolved / unchanged findings categorization
- Status summary: improved / stable / degraded

### 📄 Professional Reporting

- Full-featured PDF generation with pdfmake
- Executive summary with score, grade, and status
- Detailed vulnerability tables with severity and exploitability
- Category-aware findings visualization
- Badge embed UX on reports and scan detail pages

### 💼 SaaS Foundation

- Auth.js / NextAuth.js integration with GitHub OAuth
- User authentication and session management
- User-owned projects with sharing foundation
- Free/Pro feature gating with entitlements matrix
- Monthly scan quota enforcement
- Pro plan: fix suggestions, continuous monitoring, trust badges, PDFs

## Product Vision

**Almond teAI is not just a vulnerability scanner.**

It's a **trust platform** designed to shift security from reactive one-time scans to **continuous verification with public transparency**. Built specifically for modern AI-generated apps, SaaS products, and open-source projects that need to demonstrate security posture to customers, partners, and investors.

**Current Strategic Direction:**
- 🎯 Realistic threat scoring with exploitability verification
- 🔓 Public transparency through verification pages and embeddable badges
- 📈 Historical trend tracking and regression intelligence
- 🔐 Safe exploit verification to validate real-world exposure
- 🚀 Continuous monitoring automation (in development)
- 💳 Multi-tier SaaS model with plan-based feature gating

## Tech Stack

**Frontend & Full-Stack**
- Next.js 14 with App Router (production-ready modern framework)
- React 18 with TypeScript for type safety
- Tailwind CSS for responsive, accessible UI

**Backend & Data**
- Prisma ORM for database abstraction and migrations
- SQLite for local dev (PostgreSQL production-ready)
- Auth.js (NextAuth.js) for secure authentication
- GitHub OAuth for seamless sign-in

**Specialized Libraries**
- pdfmake for professional PDF generation
- Anthropic Claude API for AI-powered vulnerability summaries
- OSV API integration for dependency vulnerability data

**Architecture Decisions**
- Modular scanner design for easy extension
- Multi-tier entitlements system for feature gating
- Pluggable analysis modules (code, dependencies, secrets, websites)

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

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+** (18.17 or higher recommended)
- **GitHub OAuth app** (for authentication; follow [GitHub docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps))
- **Anthropic API key** (optional; enables AI vulnerability summaries)

### Install & Run

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your GitHub OAuth credentials and database URL

# Initialize database
npx prisma generate
npx prisma db push

# Start development server
npm run dev
```

Open your browser to:
```
http://localhost:3000
```

**You're ready to scan!** Sign in with GitHub, create a project, and run your first security scan.

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
| `ALLOW_FIXES_FOR_FREE` | No | Set to `true` for temporary internal testing to allow fix generation on free plan (ignored in production) |
| `PRO_MONTHLY_FIX_LIMIT` | No | Monthly fix generation request limit for Pro users (default: `100`) |
| `INTERNAL_ADMIN_TOKEN` | Internal MVP only | Used by the current internal project settings control |

## Local Development Notes

- If Prisma schema changes, run:

```bash
npx prisma generate
npx prisma db push
```

- On Windows, stop `next dev` before running `prisma generate` if Prisma engine files are locked.
- ZIP extraction now skips symlinks and `node_modules` to avoid Windows extraction failures during scanning.

## 🎯 Current Detection Areas

Almond teAI currently detects and verifies:

- **Secrets & Credentials**: API keys, tokens, private keys, database passwords
- **Authentication Issues**: Weak hashing, hardcoded credentials, insecure session handling
- **Code Vulnerabilities**: SQL injection patterns, unsafe code execution, command injection
- **Dependency Risks**: Known CVEs via OSV database, unmaintained packages
- **Web Exposure**: Missing security headers, misconfigured CORS, open API endpoints
- **Configuration Issues**: Exposed git directories, environment files, debug endpoints
- **Exploit Verification**: Real-world validation of exposure risks (safe, read-only checks)

## 📋 Current Scope & Roadmap

### Current Focus
- Pattern-based static code analysis (evolving toward semantic analysis)
- Safe, read-only exploit verification (intentionally limited for responsible disclosure)
- Post-scan regression intelligence and trend analysis
- Plan-based feature gating and usage quota enforcement
- Public transparency through verification pages and embeddable badges

### Planned Enhancements
- **Continuous Monitoring Automation** — Scheduled scans and watch-based project updates
- **Smart Notifications** — Real-time alerts for new findings, regressions, or threshold breaches
- **Enhanced Regression Analysis** — Richer trend visualization with predictive insights
- **Advanced SaaS Features** — Team collaboration, custom policies, advanced reporting
- **SBOM Generation** — Software Bill of Materials for supply chain transparency

## 💡 Why This Project Matters

**For Engineering Portfolios:**
This project demonstrates full-stack SaaS expertise across multiple dimensions:
- Modern framework mastery (Next.js 14, React, TypeScript)
- Database design and schema migrations (Prisma, SQLite/PostgreSQL)
- Secure authentication and OAuth integration (Auth.js)
- Complex business logic (entitlements, scoring algorithms, regression analysis)
- Polished UX for technical users (React components, Tailwind, responsive design)
- API design and backend architecture
- PDF generation and advanced reporting

**For Companies Building Security Products:**
A production-ready reference architecture for:
- Multi-input vulnerability scanning (repos, uploads, websites)
- SaaS feature gating and usage quota enforcement
- Plan-based entitlements and monetization models
- User authentication and project access control
- Public transparency mechanisms (verification pages, badges, reports)

**For Understanding Modern Security:**
Real-world patterns for:
- Secret detection algorithms
- Dependency vulnerability aggregation
- Safe exploit verification practices
- Security scoring and grading methodologies
- Regression intelligence and trend analysis

---

## 📖 Documentation

- [PROJECT_VISION.md](./PROJECT_VISION.md) — Detailed vision, use cases, and market positioning
- [SAAS_ARCHITECTURE.md](./SAAS_ARCHITECTURE.md) — Technical architecture, scalability considerations
- [ROADMAP_PROGRESS.md](./ROADMAP_PROGRESS.md) — Phase-by-phase implementation status

---

## 🎯 Positioning

Almond teAI is designed to help teams move from one-time vulnerability detection toward **continuous security verification with public trust signaling**. Built for modern development workflows where transparency builds credibility.
#
