// config/entitlements.ts
// Tiered Membership catalog (specs/tiered-membership-spec.md).
//
// Pure constants only -- no DB access, no request context. lib/tierLedger.ts
// and lib/tierEntitlement.ts read these; nothing here should import either
// of them back, to keep the catalog independently testable.

export type Tier = 'seeker' | 'kept' | 'council';

export const TIER_RANK: Record<Tier, number> = {
  seeker: 0,
  kept: 1,
  council: 2,
};

export function meetsTier(tier: Tier, minimum: Tier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[minimum];
}

// Seeker's daily primary-reading cap. Resets daily (reuses the same
// rate_limit_bucket mechanism as the anonymous IP cap in app/api/divine,
// migrations/019) -- see SEEKER_READING_RATE_LIMIT_KEY_PREFIX in
// lib/tierEntitlement.ts for the per-user key shape.
export const SEEKER_DAILY_READINGS = 3;

// Kept's caps.
export const KEPT_MAX_THRESHOLD_LETTERS = 20; // matches thresholdLetterLedger.ts's existing MAX_LETTERS_PER_USER
export const KEPT_COUNCIL_PAIRINGS_PER_WEEK = 5;
export const KEPT_MARKER_APPEARANCE_FLOOR = 3; // marker must appear this many times before it surfaces

// Council has no cap on Threshold Letters (spec: "Higher/no cap"). null
// means unbounded to callers that branch on it explicitly rather than
// treating a numeric cap as universal.
export const COUNCIL_MAX_THRESHOLD_LETTERS: number | null = null;

// Pricing -- cents, to avoid float arithmetic on money anywhere in this
// codebase. Council's annual price is explicitly undecided (spec "Open
// item to leave configurable, not hardcoded") -- default is the
// project-owner's stated candidate midpoint, but every deploy should set
// COUNCIL_ANNUAL_PRICE_CENTS explicitly once a figure is chosen rather than
// relying on this fallback.
export const KEPT_MONTHLY_PRICE_CENTS = 800;
export const KEPT_ANNUAL_PRICE_CENTS = 5000; // founding-member rate
export const COUNCIL_MONTHLY_PRICE_CENTS = 1600;
export const COUNCIL_ANNUAL_PRICE_CENTS = parseInt(
  process.env.COUNCIL_ANNUAL_PRICE_CENTS || '9900',
  10
);
