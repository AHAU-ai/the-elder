-- migrations/025_referral_attribution.sql
-- Acquisition-channel attribution (first pass: partner orgs + tracked shares).
--
-- elder_user.referral_source: a free-text label naming what brought this
-- account in -- 'share-<share_card.id>' for a share-driven signup,
-- 'partner-<name>' for a partner-org link (see docs/referral-attribution.md
-- for how a partner code is issued and tracked), or NULL for organic/direct.
-- Set ONLY at account creation (app/api/auth/verify/route.ts's INSERT) --
-- first-touch attribution, never overwritten on a later sign-in, matching
-- lib/referral.ts's cookie being read once at that one insert point.
--
-- elder_user.referred_at: when that first-touch attribution was recorded --
-- NULL alongside referral_source for organic/direct accounts.
--
-- share_card.open_count: how many times a share's public /share/[id] page
-- was loaded -- tracks REACH (did anyone see this), distinct from
-- share_response (an explicit glyph reaction) and distinct from whether
-- that open went on to become a new elder_user row (that correlation is
-- referral_source = 'share-<this id>' on some later account, queried by
-- scripts/referral-report.mjs, not stored as a foreign link here).
--
-- Idempotent. Run against a Neon DEV branch first.

BEGIN;

ALTER TABLE elder_user
  ADD COLUMN IF NOT EXISTS referral_source TEXT;

ALTER TABLE elder_user
  ADD COLUMN IF NOT EXISTS referred_at TIMESTAMPTZ;

ALTER TABLE share_card
  ADD COLUMN IF NOT EXISTS open_count INTEGER NOT NULL DEFAULT 0;

COMMIT;
