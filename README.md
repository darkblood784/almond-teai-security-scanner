# 🛡️ AI Code Security Scanner

A SaaS web application that analyzes AI-generated code repositories and automatically detects security vulnerabilities.

## Features

- 🔍 **20+ Security Patterns** — Hardcoded secrets, SQL injection, XSS, insecure auth, CORS misconfig, and more
- ⚡ **GitHub Integration** — Paste any public repo URL and scan instantly
- 📁 **ZIP Upload** — Upload your project as a .zip archive
- 🏆 **Security Score** — 0–100 score with severity breakdown
- 🤖 **AI Analysis** — Claude-powered executive summary (optional)
- 📄 **PDF Reports** — Downloadable professional security reports
- 📊 **Dashboard** — Track all your scans in one place

## Quick Start

### Prerequisites
- Node.js 18+
- (Optional) Anthropic API key for AI-enhanced analysis

### 1. Run setup script
```bash
chmod +x setup.sh && ./setup.sh
```

### 2. Or manual setup
```bash
npm install
cp .env.example .env      # edit .env as needed
npx prisma generate
npx prisma db push
npm run dev
```

### 3. Open the app
Visit [http://localhost:3000](http://localhost:3000)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | SQLite: `file:./dev.db` / PostgreSQL: `postgresql://...` |
| `ANTHROPIC_API_KEY` | No | Enables AI-powered security summary |
| `GITHUB_TOKEN` | No | Increases GitHub API rate limit (useful for many scans) |
| `NEXT_PUBLIC_APP_URL` | No | Public URL of your deployment |

## Switch to PostgreSQL

1. In `.env`, change `DATABASE_URL` to your PostgreSQL connection string
2. In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`
3. Run `npx prisma migrate dev`

## Detected Vulnerability Types

| Type | Severity |
|------|----------|
| AWS/Stripe/OpenAI API Keys | Critical |
| Database Credentials | Critical |
| SQL Injection (concat/template) | Critical |
| Private Keys | Critical |
| eval() / new Function() | Critical |
| JWT Algorithm: none | Critical |
| Hardcoded Admin Credentials | Critical |
| Weak Password Hashing (MD5) | High |
| dangerouslySetInnerHTML | High |
| Unprotected Admin Routes | High |
| Shell Command Injection | High |
| TLS Verification Disabled | High |
| CORS Wildcard (*) | Medium |
| Sensitive Data in Logs | Medium |
| Insecure Randomness | Medium |
| Prototype Pollution | Medium |
| Debug Routes Exposed | Medium |
| Env Var Hardcoded Fallback | Low |

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend**: Next.js API Routes (Node.js)
- **Database**: SQLite (dev) / PostgreSQL (prod) via Prisma
- **AI**: Anthropic Claude API
- **PDF**: pdfmake
- **Scanner**: Custom static analysis engine (regex + AST-aware)

## Project Structure

```
├── app/
│   ├── page.tsx               # Landing page
│   ├── new/page.tsx           # New scan form
│   ├── dashboard/page.tsx     # Scan history
│   ├── scan/[id]/page.tsx     # Scan report
│   └── api/
│       ├── analyze/route.ts   # POST: trigger scan
│       ├── scans/route.ts     # GET: list scans
│       ├── scans/[id]/route.ts# GET: single scan
│       └── report/[id]/route.ts # GET: PDF download
├── components/
│   ├── ScoreCard.tsx          # Circular score gauge
│   ├── VulnerabilityTable.tsx # Filterable vuln list
│   ├── ScanForm.tsx           # GitHub URL + zip upload
│   └── Navbar.tsx
├── lib/
│   ├── scanner/
│   │   ├── patterns.ts        # Security detection patterns
│   │   └── index.ts           # Scanner engine
│   ├── github.ts              # GitHub zip download
│   ├── ai.ts                  # Claude AI integration
│   └── pdf.ts                 # PDF generation
└── prisma/schema.prisma       # Database schema
```
