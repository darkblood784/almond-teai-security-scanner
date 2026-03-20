# Phase 10 Billing Readiness Checklist

Purpose: make Stripe/billing integration mostly plug-and-play later, without doing full billing now.

## 1) Current readiness snapshot (already in place)

- Plan normalization and entitlement matrix exist in `lib/entitlements.ts`.
- Fix generation is server-gated by plan in `app/api/fixes/generate/route.ts`.
- Free-plan test override exists and is ignored in production (`ALLOW_FIXES_FOR_FREE`).
- Pro fix quota usage model exists (`FixSuggestionUsage`) and request counting is active.
- Pro usage remaining is visible in report UI.

## 2) What to finish now (pre-Phase-10 hardening)

### A. Entitlement contract freeze
- [ ] Freeze one source of truth for all feature flags in `lib/entitlements.ts`.
- [ ] Confirm final names/behavior for `free` and `pro` (no hidden feature differences in route handlers).
- [ ] Document entitlement matrix in README or architecture docs.

### B. API error contract stabilization
- [ ] Standardize paid-required responses (`403`) with stable `code` values.
- [ ] Standardize quota-limit responses (`429`) with stable `code` + optional retry metadata.
- [ ] Ensure UI handles these codes with clear upgrade/limit messages.

### C. Usage accounting consistency
- [ ] Decide if cached fix returns should count against monthly quota (currently they do not increment usage).
- [ ] Add one helper for period key generation to avoid duplicated logic across routes.
- [ ] Add an admin/internal query view (or lightweight endpoint) to inspect monthly usage rows.

### D. Operational safeguards
- [ ] Add logging for denied-by-plan and denied-by-quota events.
- [ ] Add provider failure logging with minimal sensitive data.
- [ ] Add a documented runbook for toggles:
  - `ALLOW_FIXES_FOR_FREE`
  - `PRO_MONTHLY_FIX_LIMIT`

### E. QA checklist for paid behavior
- [ ] Free user sees locked fix action (when override off).
- [ ] Pro user can generate and persist fix suggestions.
- [ ] Pro monthly limit enforces `429` once reached.
- [ ] Production ignores free override.

## 3) What to do in Phase 10 (billing itself)

- [ ] Add Stripe customer + subscription linkage fields on `User`.
- [ ] Add Stripe webhook endpoint to sync plan state and subscription lifecycle.
- [ ] Add checkout + billing portal endpoints/pages.
- [ ] Map Stripe product/price to `User.plan` and entitlements.
- [ ] Add grace-period handling for failed/canceled payments.
- [ ] Backfill/migrate existing users safely.

## 4) Definition of “Billing-Ready Before Phase 10”

You are billing-ready when:
- plan gating is fully server-authoritative,
- API/UI contracts for paid-required and quota-required are stable,
- usage accounting is trustworthy,
- test-mode flags are controlled and documented,
- and no major refactor is needed to connect Stripe webhooks to `User.plan`.

## 5) Recommended immediate order

1. Freeze entitlement + API response contract.
2. Add logging + runbook for plan/quota toggles.
3. Complete QA pass and mark readiness complete.
4. Continue Phase 5–9 product work.
5. Implement Stripe in Phase 10 using the frozen contracts.
