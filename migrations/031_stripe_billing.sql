-- migrations/031_stripe_billing.sql
-- Stripe ids and webhook idempotency (docs/stripe-billing-model.md).
-- Entitlement itself stays on elder_user (tier, tier_expires_at, migration
-- 023); nothing here is read on the reading path.
--
-- elder_billing: one row per user who has started checkout. user_id is
-- BIGINT because elder_user.id is BIGSERIAL.
-- stripe_event: processed-event ledger. A row with processed_at set means
-- skip; a row without it means an earlier attempt died and may be retried.
--
-- Idempotent. Run on a Neon DEV branch first, then npm run check:schema-drift.

BEGIN;

CREATE TABLE IF NOT EXISTS elder_billing (
  user_id                BIGINT      PRIMARY KEY REFERENCES elder_user(id),
  stripe_customer_id     TEXT        NOT NULL UNIQUE,
  stripe_subscription_id TEXT,
  plan_tier              TEXT        CHECK (plan_tier IN ('kept', 'council')),
  billing_interval       TEXT        CHECK (billing_interval IN ('month', 'year')),
  stripe_status          TEXT,
  cancel_at_period_end   BOOLEAN     NOT NULL DEFAULT false,
  current_period_end     TIMESTAMPTZ,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stripe_event (
  id           TEXT        PRIMARY KEY,
  type         TEXT        NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

COMMIT;
