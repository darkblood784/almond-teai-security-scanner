# PROJECT_VISION.md

```markdown
# Almond teAI – Project Vision

## 1. Overview

Almond teAI is a security evaluation and trust platform designed for modern AI-generated applications, web apps, and open-source software projects.

The goal of the platform is to provide **automated security scanning, risk scoring, and transparency** for software projects. Developers can submit their code or live applications to receive a security evaluation and generate a public trust record.

The platform focuses on improving **security awareness and trust** in the rapidly growing ecosystem of AI-generated software.

---

# 2. Problem Statement

With the rise of AI-assisted development tools such as ChatGPT, Claude, and other code generation systems, the number of applications being created daily has increased dramatically.

However, many of these applications are developed by individuals or small teams who may lack deep security knowledge.

Common problems include:

- exposed API keys
- insecure configurations
- outdated dependencies
- missing security headers
- sensitive data exposure
- weak authentication logic
- vulnerable smart contracts

Currently:

- many developers launch applications without performing a security review
- investors and users cannot easily assess the security risk of a new application
- there is no simple trust indicator for software security

Almond teAI aims to address this gap.

---

# 3. Product Vision

Almond teAI aims to become a **security trust layer for modern AI-generated software**.

The platform will allow developers, companies, and investors to verify the security posture of applications before deployment or investment.

In the long term, Almond teAI aims to become:

> A trusted security verification platform for AI applications and web software.

The platform will focus on:

- automated scanning
- vulnerability detection
- transparent reporting
- public trust verification
- continuous monitoring

---

# 4. Target Users

Primary users include:

### Developers
- Indie hackers
- Startup founders
- Open-source maintainers
- AI application builders

### Organizations
- SaaS companies
- Web3 projects
- AI startups
- technology investors

### Security-conscious users
- auditors
- investors
- enterprise partners

---

# 5. Current MVP Scope

The current project is an **MVP (Minimum Viable Product)**.

It currently supports three main scan types:

### 1. GitHub Repository Scan

Users can submit a GitHub repository URL.

The system will:

- download the repository
- scan files locally
- detect common security issues
- generate a vulnerability report

---

### 2. ZIP Repository Upload

Users can upload a `.zip` file containing a codebase.

The system will:

- extract the archive
- scan the project files
- detect risky patterns
- generate a report

---

### 3. Website Security Scan

Users can submit a live website URL.

The system performs basic dynamic checks such as:

- exposed files
- insecure configurations
- missing security headers
- common misconfigurations

---

# 6. Current System Architecture

The project currently uses:

Frontend
- Next.js 14
- React
- Tailwind CSS

Backend
- Next.js API routes
- Node.js runtime

Database
- Prisma ORM
- SQLite (default)

Scanning Engine
- file system scanning
- regex-based vulnerability detection
- lightweight website checks

Reporting
- vulnerability list
- severity classification
- security score
- PDF report generation

Optional
- AI-generated summary using Claude (Anthropic API)

---

# 7. Current Limitations

The current scanner is intentionally lightweight and designed for rapid analysis.

Limitations include:

- detection based mainly on regex patterns
- limited vulnerability verification
- scoring system needs improvement
- false positives may occur
- no long-term monitoring yet
- limited trust features

These limitations are expected for an early MVP.

---

# 8. Core Product Philosophy

Almond teAI is not just a vulnerability scanner.

It aims to be a **trust platform**.

Key principles:

1. Transparency
2. Verifiable security results
3. Continuous monitoring
4. Trust signals for developers and users

---

# 9. Innovative Features (Key Differentiators)

The platform will include several innovative features beyond typical scanners.

## 9.1 Attack Simulation (Automated Exploitation Tests)

Traditional scanners only detect potential vulnerabilities.

Almond teAI will attempt **safe automated exploitation tests** to verify whether vulnerabilities are actually exploitable.

Examples:

- XSS payload testing
- exposed environment file verification
- exposed git repository extraction
- open API endpoint probing

This helps reduce false positives and increases trust in scan results.

---

## 9.2 Continuous Security Monitoring

Most scanners perform a one-time scan.

Almond teAI aims to support **continuous monitoring**.

Possible triggers include:

- repository updates
- dependency changes
- scheduled scans
- configuration changes

Users will receive alerts if their security score changes or new vulnerabilities appear.

---

## 9.3 Public Security Trust Badges

Projects that pass security checks can receive a **public verification badge**.

Example:

```

Verified by Almond teAI
Security Score: A
Last Scan: YYYY-MM-DD

```

Developers can embed this badge in:

- websites
- GitHub READMEs
- documentation

Clicking the badge links to a **public verification page** on the platform.

This helps build trust and increases platform visibility.

---

## 9.4 Scan History & Transparency

Each project will maintain a **security history timeline**.

Example:

- previous scores
- vulnerability history
- remediation progress
- last scan date

This allows users and investors to see how security evolves over time.

---

# 10. Future Features

## Smart Contract Security Audit

Future versions may support Web3 projects.

Tools may include:

- Slither
- Mythril
- Echidna

These scanners can detect:

- reentrancy vulnerabilities
- integer overflows
- unsafe external calls
- access control flaws

---

# 11. Product Roadmap

## Phase 1 – MVP Stabilization

Focus on improving the current system.

Tasks:

- improve scoring algorithm
- reduce false positives
- improve reporting clarity
- improve scanning performance

---

## Phase 2 – Trust Infrastructure

Introduce transparency features.

Tasks:

- scan history tracking
- public verification pages
- embeddable trust badges
- better score explanation

---

## Phase 3 – Advanced Security Features

Introduce deeper security capabilities.

Tasks:

- attack simulation engine
- continuous monitoring
- improved scanning engines
- dependency vulnerability detection

---

## Phase 4 – Web3 Security

Introduce smart contract analysis.

---

# 12. Success Criteria

The platform will be considered successful if it achieves:

- accurate and trusted security reports
- adoption by developers
- usage as a pre-launch security check
- public trust indicators (badges)

---

# 13. Development Guidelines

When contributing to this project:

- prioritize simplicity
- avoid unnecessary complexity
- focus on reliability and trust
- maintain clear reporting for users

This project should evolve gradually while maintaining a stable and understandable architecture.

---

# 14. Long-Term Vision

In the long term, Almond teAI aims to become:

A **trusted verification layer for AI-built software**.

Developers will use the platform before launching applications, and users or investors will use it to evaluate security risk.

The ultimate goal is to create a **transparent ecosystem where software security is visible and verifiable.**
```