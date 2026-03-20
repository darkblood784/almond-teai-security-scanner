# Almond teAI Roadmap Progress

This file tracks the implementation roadmap phase by phase without disrupting the current platform baseline.

## Baseline

- Baseline date: 2026-03-11
- Baseline branch: `main`
- Baseline purpose: freeze the current MVP trust stack before deeper AppSec engine work

## Status Legend

- `pending`: not started
- `in_progress`: active implementation
- `completed`: implemented and manually validated
- `blocked`: cannot proceed until a dependency is resolved

## Phase Tracker

| Phase | Name | Status | Goal | Completion Signal |
| --- | --- | --- | --- | --- |
| 0 | Scope Honesty | completed | Make product wording match actual scan depth | Website scan wording, PDF wording, and public wording all clearly describe current scope |
| 1 | Adaptive Website Assessment | completed | Add profile-driven website assessment | Website profile selected automatically and reflected in coverage notes |
| 2 | Static Analysis Depth | completed | Add AST/language-aware repo scanning for high-value languages | JS/TS static depth lands with benchmark coverage and no major FP spike |
| 3 | Scan-and-Fix Foundations | completed | Add reliable fixability model and remediation suggestion foundation | Supported finding types can be classified as fixable/non-fixable |
| 4 | Paid Scan-and-Fix MVP | completed | Ship reviewable fix suggestions for supported repo findings | Pro users can view fix suggestions for supported findings |
| 5 | Real Monitoring | pending | Turn monitoring into scheduled recurring scans | Monitored projects are rescanned automatically and create new Scan records |
| 6 | Developer Workflow Integration | pending | Add GitHub/PR-oriented workflow hooks | Repo scans can be triggered or surfaced in GitHub workflow context |
| 7 | Finding Management | pending | Add suppression / accepted-risk workflow | Findings can be triaged without mutating historical scan data |
| 8 | Trust Evidence Hardening | pending | Strengthen report/certificate verification story | Certificate export and stronger verification references exist |
| 9 | Prioritization Layer | pending | Improve prioritization beyond current scoring | Score reasoning is more stable and benchmark ranges tighten |
| 10 | Billing / Stripe | pending | Add subscription plumbing after product value is stronger | Stripe updates `User.plan` and entitlements cleanly |

## Phase Execution Rules

1. Only one roadmap phase should be `in_progress` at a time.
2. A phase is not `completed` until:
   - code is implemented
   - type check passes
   - the relevant manual QA checklist is run
   - benchmark impact is reviewed if scanner/scoring behavior changed
3. If a phase creates a new product claim, coverage notes and report wording must be updated in the same phase.
4. Each phase should land in its own git branch or tightly grouped commit series.

## Recommended Workflow

1. Create a new branch for the next phase.
2. Mark the phase as `in_progress`.
3. Implement only that phase's scoped work.
4. Run type check and targeted manual QA.
5. Update benchmark expectations if behavior changed intentionally.
6. Mark the phase `completed` only after validation.
7. Start the next phase.
