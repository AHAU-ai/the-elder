-- migrations/024_tester_account.sql
-- Testers Mode (specs/testers-mode-spec.md at design time; see
-- lib/tierLedger.ts's getEffectiveTier for the actual enforcement point).
--
-- is_tester: an ops-controlled QA override, set only via
-- app/api/admin/set-tester (ADMIN_SECRET-gated, no self-service path).
-- getEffectiveTier() reads this column and, if true, returns 'council'
-- unconditionally -- uncapped everywhere the tiered-membership system
-- already gates Kept/Council, without a new tier value or new
-- entitlement branching.
--
-- Deliberately does NOT touch welfare/consent/guardian/narrative-register
-- gating -- those are separate systems this column is never read by. See
-- the design note in lib/tierLedger.ts and app/api/divine/route.ts for
-- why that boundary is load-bearing (docs/handoff-2026-07-07.md already
-- records that lifting the *consent* gate for beta testers was requested
-- and declined; this is a distinct, narrower thing).
--
-- Idempotent. Run against a Neon DEV branch first.

BEGIN;

ALTER TABLE elder_user
  ADD COLUMN IF NOT EXISTS is_tester BOOLEAN NOT NULL DEFAULT false;

COMMIT;
