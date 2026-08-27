# Z-CRM Audit & Improvement Plan

**Date:** 2026-08-28
**Auditor:** Senior Product Engineer / Full Stack Review
**Repo:** github.com/dev-nayanray/zcrm

---

## Executive Summary

Z-CRM is a genuinely capable business system (68 models, ~106 API routes, 27 service files) with strong security fundamentals: PBKDF2-600k password hashing, HMAC-signed sessions, server-side RBAC on nearly every endpoint, constant-time webhook verification, and a well-designed inventory ledger. The core architecture is sound.

However, the project has grown fast without matching process hygiene. The urgent risks are:
1. **Credential leak** — live MongoDB URI and AUTH_SECRET in `.env.example` (a tracked file)
2. **Two latent bugs** in financial code (expense date filter, wallet negative balance)
3. **Documentation that lies** — claims 29 models, SQLite/PostgreSQL, Decimal money; reality is 68 models, MongoDB, Float money
4. **No CI, no pre-commit hooks, no secrets scanning**

---

## Phase 0 — Immediate (Security & Hygiene)

### 0.1 Rotate credentials and scrub tracked files
- [ ] Rotate MongoDB Atlas password (Database Access → Edit User)
- [ ] Generate new `AUTH_SECRET`: `openssl rand -hex 32`
- [ ] Replace real values in `.env.example` with placeholders
- [ ] Replace real values in `docs/mongodb-atlas.md` with placeholders
- [ ] Verify `.gitignore` ignores `.env*` (currently does)
- [ ] Check git history for `.env` commits: `git log --all --full-history -- .env`

### 0.2 Add pre-commit secrets scanning
- [ ] Add `.husky/pre-commit` hook running `gitleaks` or similar
- [ ] Block commits containing patterns like `mongodb+srv://`, `AUTH_SECRET=`, API keys

### 0.3 Stand up CI
- [ ] Add `.github/workflows/ci.yml` running:
  - `npx tsc --noEmit`
  - `npx eslint .`
  - `npx prisma validate`
  - `bun test`

---

## Phase 1 — High Value, Quick Wins

### 1.1 Fix accounting date filter bug
**File:** `src/lib/services/accounting.ts:79-80`
**Issue:** Expense filtering by date range uses `createdAt` (record creation) instead of `expenseDate` (when the expense actually occurred). This silently produces wrong P&L reports when expenses are backdated or entered late.

### 1.2 Fix wallet negative balance bug
**File:** `src/lib/services/billing.ts:122-140`
**Issue:** Subscription payment via wallet deducts balance without checking sufficient funds. Can drive wallet balance negative.

### 1.3 Rewrite documentation
- [ ] `README.md` — update to reflect 68 models, MongoDB, Float money (with migration plan)
- [ ] `docs/architecture.md` — align with actual stack
- [ ] `docs/database.md` — align with actual schema
- [ ] `docs/mongodb-atlas.md` — scrub credentials, align with `.env`
- [ ] Delete redundant/conflicting docs

### 1.4 Add account lockout and session revocation
- [ ] Add `failedLoginAttempts` and `lockedUntil` fields to User model
- [ ] Lock account after 5 failed attempts for 15 minutes
- [ ] Add session revocation via token version field on User
- [ ] Add "force logout everywhere" admin action

---

## Phase 2 — Financial Integrity (Requires Migration)

### 2.1 Replace Float money with integer minor units
**Problem:** All 68 money fields use `Float`. While `decimal.ts` wraps arithmetic in `Prisma.Decimal`, values still round-trip through Float on every read/write. Decimal→Float→Decimal conversions across thousands of transactions accumulate drift.

**Solution:** Store money as `Int` (minor units, e.g. 1/100 of a taka). MongoDB has no Decimal type; integer minor units are the industry standard.

**Migration plan:**
1. Add new `Int` fields (e.g. `amountInt`) alongside existing `Float` fields
2. Backfill: `amountInt = Math.round(amount * 100)`
3. Update services to write both fields
4. Switch reads to new fields
5. Remove old `Float` fields in a later release

### 2.2 Add idempotency keys to order/payment creation
- [ ] Add `idempotencyKey` field to Order and Payment models
- [ ] Check for existing record by key before creating
- [ ] Return existing record on duplicate key submission

---

## Phase 3 — Maintainability

### 3.1 Adopt React Query
**Problem:** 42 view files hand-roll `useState` + `useEffect` + `fetch` with duplicated pagination, search-debouncing, and error handling. `@tanstack/react-query` is already a dependency but unused.

**Impact:** Eliminates ~2000 lines of boilerplate, fixes 58 ESLint `set-state-in-effect` errors, provides caching and stale-while-revalidate out of the box.

### 3.2 Reduce `: any` usage
**Current:** 182 occurrences concentrated in view-layer API response handling.
**Approach:** Define proper TypeScript interfaces for API responses, starting with the most-used endpoints.

### 3.3 Enable stricter ESLint rules
**Current:** ESLint config disables almost all rules (effectively a no-op).
**Approach:** Gradually enable rules:
- Phase 3a: `@typescript-eslint/no-unused-vars`, `prefer-const`
- Phase 3b: `@typescript-eslint/no-explicit-any`: `warn`
- Phase 3c: `react-hooks/exhaustive-deps`

### 3.4 Add automated inventory reconciliation
**Current:** `stock-reconciliation.ts` exists but is only triggered manually via API or Telegram.
**Solution:** Add Vercel Cron job or scheduled worker to run reconciliation weekly.

---

## Phase 4 — Test Coverage

### 4.1 Unit tests for financial services
**Current:** 7 test files, 851 lines. No dedicated tests for `AccountingService` or `InventoryService`.
**Priority:**
1. `AccountingService` — P&L formula, COGS snapshotting, outstanding clamping
2. `InventoryService` — stock movement invariants, reservation/release, ledger consistency
3. `BillingService` — wallet deposit/withdrawal, payout workflow

### 4.2 API route tests
**Current:** ~106 routes, integration tests cover only a few flows.
**Approach:** Add tests for permission boundaries (RBAC), webhook signature rejection, and edge cases.

---

## Validation Checklist (Run After Each Phase)

- [ ] `npx prisma generate` — client generated
- [ ] `npx tsc --noEmit` — types pass
- [ ] `npm run build` — production build succeeds
- [ ] `bun test` — tests pass
- [ ] No credentials in tracked files: `git grep -E 'mongodb\+srv|AUTH_SECRET=' --name-only`

---

## What NOT to Change

- **Webhook signature verification** — all four integrations (WooCommerce, Meta, WhatsApp, Telegram) correctly verify HMAC signatures and reject unsigned requests. This is done right.
- **Password hashing** — PBKDF2-600k with transparent rehashing is OWASP-compliant.
- **COGS snapshotting** — historical cost on OrderItem is immune to later price changes. Good design.
- **Inventory ledger** — append-only StockMovement with distinct movement types is correct.
- **Order status machine** — terminal states protected, same-status transitions idempotent.
