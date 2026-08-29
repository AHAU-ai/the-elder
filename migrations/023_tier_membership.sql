-- migrations/023_tier_membership.sql
-- Tiered Membership (specs/tiered-membership-spec.md).
--
-- Adds tier state to elder_user, following the same column-on-elder_user
-- shape as narrative_register (007) and letters_by_email (016).
--
-- tier: the seeker's current subscription tier. Always one of the three
-- catalog values below -- there is no "cancelled" tier value; cancellation
-- is represented by tier_expires_at passing, not by writing back to
-- 'seeker'. This lets tierLedger.ts distinguish "never subscribed" from
-- "subscribed, now lapsed" if that distinction is ever needed, without a
-- second migration.
--
-- tier_expires_at: NULL for 'seeker' (no subscription to expire) and for
-- any tier not on a fixed term. Set to the current billing period's end
-- for an active Kept/Council subscription. The freeze rule (spec
-- cross-cutting rule 2) reads this column, not the raw `tier` value, to
-- decide effective entitlement -- see lib/tierLedger.ts.
--
-- seeker_deepen_used / seeker_council_used: the one-time "taste" grants
-- for the free tier (spec: "1 free deepen continuation", "1 free Council
-- Mode pairing", each explicitly one-time, not recurring). Booleans, not
-- counters -- there is nothing to reset, unlike the daily reading cap
-- (which reuses rate_limit_bucket, migrations/019, keyed per user; see
-- lib/tierEntitlement.ts).
--
-- Idempotent. Run against a Neon DEV branch first.

BEGIN;

ALTER TABLE elder_user
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'seeker';

ALTER TABLE elder_user
  ADD COLUMN IF NOT EXISTS tier_expires_at TIMESTAMPTZ;

ALTER TABLE elder_user
  ADD COLUMN IF NOT EXISTS seeker_deepen_used BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE elder_user
  ADD COLUMN IF NOT EXISTS seeker_council_used BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'elder_user_tier_check'
  ) THEN
    ALTER TABLE elder_user
      ADD CONSTRAINT elder_user_tier_check
      CHECK (tier IN ('seeker', 'kept', 'council'));
  END IF;
END $$;

COMMIT;
