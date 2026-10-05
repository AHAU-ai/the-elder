# The Elder: Stripe Tier Model

Proposal. Drafted 2026-10-04, revised 2026-10-05. Nothing in this document has been built. Source of truth for the working copy is the shared doc; this file is the repo copy.

## Summary

The Elder already has a tier system in code, so Stripe only has to write to it. `elder_user` holds `tier` and `tier_expires_at`, `deriveEffectiveTier()` turns them into what a seeker may do right now, and `setTier()` was left as the entry point for a billing webhook. The repo has no Stripe code yet, and the only Stripe account this session can see is in test mode: two products, four prices, no webhook endpoint.

This is the second version. The first proposed a separate entitlement table and microdollar budgets, which would have duplicated what the repo already does. Four things to know before building:

1. **Do not sell Council yet.** As far as I found, nothing in the code produces a Council Mode pairing: the divine route never requests that action, so Council differs from Kept only by having no cap on saved letters. Launch Kept, and make Council purchasable when the feature exists.
2. **The paywall can pre-empt crisis routing.** By my reading of `app/api/divine/route.ts`, the tier check (about line 615) and the IP daily limit (about line 213) return before the crisis hard block (about line 817). A seeker who is over a cap and writes something in crisis would get cap copy, not 988. Fix this before anything is charged.
3. **A webhook must be able to fail loudly.** `setTier()` swallows database errors, so a failed write would still return 200 to Stripe and leave a paying seeker on Seeker. The webhook needs a strict setter that throws.
4. **The repo and Stripe disagree.** Council's price constants say $16 and $99 while the filed price and the Stripe test prices say $20 and $120; the Stripe product copy promises "uncapped" and "unlimited" with no cost ceiling; and the repo logs no token usage, so cost per reading is unknown.

Sources: the repo at main (commit 9403819), Stripe's documentation, and read-only calls to the test-mode account. Nothing was created or changed in Stripe or in the repo's code.

## What the repo already does

Billing plugs into these pieces; it should not replace any of them.

| Piece | Where | What it means for billing |
| --- | --- | --- |
| Tier columns on `elder_user`: `tier`, `tier_expires_at`, `seeker_deepen_used`, `seeker_council_used`, `is_tester` | `migrations/023`, `024` | Billing writes `tier` and `tier_expires_at` only. It never touches the taste flags or `is_tester`. |
| Effective tier | `lib/tierLedger.ts`, `deriveEffectiveTier()` | A lapse is `tier_expires_at` passing; there is no "cancelled" value. A tester always reads as Council. |
| Entitlement gate | `lib/tierEntitlement.ts`, `checkTierEntitlement()` | Count-based and fail-closed. Reasons `daily_cap`, `weekly_cap`, `taste_used`, `error` already exist. |
| Caps | `config/entitlements.ts` | Seeker 3 readings a day. Kept 20 letters and 5 Council pairings a week. Council no letter cap. |
| Operator grant | `app/api/admin/set-tier` | Calls `setTier()`. Its header names a billing webhook as the intended second caller. |
| Session identity | `lib/auth.ts`, `getSessionUserId()` | A numeric user id from a signed cookie. Checkout must use it and never trust the request body. |
| Middleware | `middleware.ts` | Excludes `/api`, so a webhook route is not intercepted. |
| Cron | `vercel.json` | One daily cron exists; a reconcile job fits the same pattern. |
| Missing | none | No Stripe SDK, webhook, checkout or portal route; no token or cost logging; and `specs/tiered-membership-spec.md`, which the tier files cite, is not in the repo. |

## Tiers

These are the caps the code enforces today. Seeker is not a Stripe object: no billing row means Seeker.

| Tier | Price | In code today | What they notice |
| --- | --- | --- | --- |
| Seeker | Free | 3 primary readings a day; one deepen and one Council pairing as a taste; nothing persists | The Elder answers, but does not remember them |
| Kept | $8/month or $50/year (founding-member rate) | No daily limit; full deepen; journal auto-save; 20 saved letters; marker trajectory after 3 appearances; 5 Council pairings a week | The Elder remembers them and continues where they left off |
| Council | $20/month or $120/year | Everything in Kept; no letter cap; unlimited Council pairings, though no pairing feature exists yet | Today, only that the letter cap is gone. The multi-voice pairing is the intended difference. |

Three conflicts to settle before a price appears on any page:

- **Council's price.** `COUNCIL_MONTHLY_PRICE_CENTS` is 1600 and the annual figure defaults to 9900 in `config/entitlements.ts`, while the filed pricing and all four Stripe test prices say 2000 and 12000. Make the Stripe price ids the runtime source of truth and delete the price constants, or correct them.
- **Council has no feature behind it.** The divine route's own comment says no multi-lineage pairing exists, and it never requests the `council_pairing` action. Selling Council now sells a promise. Hold it behind a flag, in the way the repo already holds features behind governance flags, until the pairing ships.
- **The product copy over-promises.** The Stripe product descriptions, which Checkout and the portal display, say "uncapped primary readings" and "unlimited Council Mode". That matches the code today but carries no cost ceiling. Either keep it and add fair-use language, or change it to "no daily limit".

## Economics

Budgets are sized from the annual plans, the lowest net revenue per month, and serve here as ceilings to check against, not as enforced caps. Fees assume Stripe's standard US card rate of 2.9% + $0.30; check your actual rate.

| Billing option | Charge (USD) | Stripe fee (USD) | Net (USD) | Net per month (USD) |
| --- | --- | --- | --- | --- |
| Kept, monthly | 8.00 | 0.53 | 7.47 | 7.47 |
| Kept, annual | 50.00 | 1.75 | 48.25 | 4.02 |
| Council, monthly | 20.00 | 0.88 | 19.12 | 19.12 |
| Council, annual | 120.00 | 3.78 | 116.22 | 9.69 |

The first draft proposed enforced monthly and weekly microdollar budgets. I have withdrawn them: the shipped design caps by count, Kept has no daily limit by decision, and nothing measures cost per reading, so any dollar budget would be invented. What the numbers can do is show how much room each plan leaves. Under the OpenCosmos rule that no more than half of net goes to marginal cost:

| Plan | Net per month (USD) | Ceiling at 50% of net (USD) | Readings a month at $0.01 | at $0.03 | at $0.05 | at $0.10 |
| --- | --- | --- | --- | --- | --- | --- |
| Kept monthly | 7.47 | 3.73 | 373 | 124 | 74 | 37 |
| Kept annual | 4.02 | 2.01 | 201 | 67 | 40 | 20 |
| Council monthly | 19.12 | 9.56 | 956 | 318 | 191 | 95 |
| Council annual | 9.69 | 4.84 | 484 | 161 | 96 | 48 |

The per-reading costs are illustrative, not measured. The repo logs no token usage. The divine route's own note puts readings at about 900 to 1,200 output tokens on `claude-sonnet-4-6` with a 2,048 cap, and a Council pairing would multiply that by the number of voices. Price it from Anthropic's current price list once usage is logged.

A free account is also a cost. A signed-in Seeker can take 3 readings a day, 90 a month, and each costs money whether or not the seeker ever pays. At $0.03 a reading that is $2.70 a month for a maxed-out free account, more than Kept annual's $2.01 ceiling.

What to do: log tokens in and out, cached reads, tier and mode on every generation, and read a week of real data before deciding on a backstop. If one is needed, make it a generous monthly count per account through the existing `checkRateLimitDB(key, limit, windowMs)`, which already accepts any window, with a new `fair_use` reason, rather than a dollar meter.

## Stripe objects and calls

The test-mode account holds two Products (The Elder — Kept, The Elder — Council) and four recurring USD Prices: $8 and $50 for Kept, $20 and $120 for Council. It has no webhook endpoint. This connection shows no live-mode account, so I could not see any live objects; test objects do not carry over, so live mode needs its own price ids and signing secret.

Environment variables, set on Vercel and in `docs/ENV.md`: `STRIPE_SECRET_KEY` (a restricted key is better), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_KEPT_MONTHLY`, `STRIPE_PRICE_KEPT_ANNUAL`, `STRIPE_PRICE_COUNCIL_MONTHLY`, `STRIPE_PRICE_COUNCIL_ANNUAL`, `BILLING_SLACK_DAYS` (default 3) and `COUNCIL_PURCHASABLE` (default off).

| Step | Stripe call or event | What The Elder does |
| --- | --- | --- |
| Subscribe | `checkout.sessions.create` (subscription mode) from `POST /api/stripe/checkout` | Needs a session and reads the user id from the cookie. Refuses any register other than adult. Refuses if the user already has an active subscription and sends them to the portal. Creates or reuses one Stripe Customer per user and passes `customer`, not `customer_email`. Sets `client_reference_id` and `subscription_data.metadata.user_id` server-side. |
| Link | `checkout.session.completed` | Links customer to user only. It does not grant, because payment can still be pending for delayed payment methods. |
| Grant and renew | `invoice.paid` | Grants or extends access. This is the signal for money received. |
| Change | `customer.subscription.updated` | Re-reads the subscription and rewrites tier and expiry: price change, cancel-at-period-end flipped. |
| Payment trouble | `invoice.payment_failed` | Writes no new expiry and logs it. Stripe's retry rules decide what happens next. |
| End | `customer.subscription.deleted` | Sets expiry to now. |
| Manage | `billingPortal.sessions.create` from `POST /api/stripe/portal` | The seeker cancels, switches plan, changes card and downloads invoices there. |

Portal configuration, from Stripe's docs:

- Switch plan is off by default. Turn it on with both products and all four prices (at most 10 products).
- Prorate subscription updates is off by default. Turn it on.
- "Manage downgrades" (change at period end) works only between prices on the same product, so Council to Kept applies immediately. Switching monthly to annual resets the billing date to the day of the switch.
- Cancellation is on by default; set it to cancel at period end.
- A subscription with a schedule attached cannot be changed or cancelled in the portal, and the portal cannot be shown in an iframe.
- The prices were created with tax behavior unspecified and the products have no tax code. Set both before turning on Stripe Tax.

Since the 2025-03-31 (basil) API version, `current_period_end` lives on subscription items, not on the subscription, so read `items.data[0].current_period_end`. Pin the SDK's API version on purpose. The repo is on Next.js 16 and its `AGENTS.md` says to read `node_modules/next/dist/docs` before writing route code; I installed nothing and ran no code, so the sketch below is untested.

```ts
// config/billing.ts: maps Stripe price ids onto the existing Tier type
import type { Tier } from '@/config/entitlements';

export type Interval = 'month' | 'year';
export type PaidTier = Exclude<Tier, 'seeker'>;

const PLANS = [
  { env: 'STRIPE_PRICE_KEPT_MONTHLY', tier: 'kept', interval: 'month' },
  { env: 'STRIPE_PRICE_KEPT_ANNUAL', tier: 'kept', interval: 'year' },
  { env: 'STRIPE_PRICE_COUNCIL_MONTHLY', tier: 'council', interval: 'month' },
  { env: 'STRIPE_PRICE_COUNCIL_ANNUAL', tier: 'council', interval: 'year' },
] as const;

// Read at call time, not module scope, so a missing variable cannot break the build.
export function planFromPriceId(
  priceId: string,
): { tier: PaidTier; interval: Interval } | null {
  for (const p of PLANS) {
    const id = process.env[p.env];
    if (id && id === priceId) return { tier: p.tier, interval: p.interval };
  }
  return null; // the caller must log this loudly; an unknown price is never silent
}
```

## Data model on Neon

Entitlement stays in the two existing `elder_user` columns, so the divine route and the letters route need no change. Two small tables hold what only billing code reads. `elder_user.id` is a `BIGSERIAL`, so the foreign key is `BIGINT`, not text as the first draft had it.

```sql
-- migrations/031_stripe_billing.sql
-- Stripe ids and idempotency. Entitlement itself stays on elder_user
-- (tier, tier_expires_at); nothing here is read on the reading path.
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
```

- **Strict setter.** Add `setTierStrict(userId, tier, expiresAt)` to `lib/tierLedger.ts`: the same UPDATE as `setTier()`, but it throws on a database error and when no row was updated. Leave `setTier()` as it is for the admin route.
- **Event bookkeeping.** Insert the event id with `ON CONFLICT DO NOTHING`. A row with `processed_at` set means skip. A row without it means an earlier attempt died, so process it again. Prune rows older than 30 days.
- **Manual grants.** An operator grant on an account that also has a billing row is overwritten by the next Stripe event. Grant manually only to accounts that do not subscribe.
- **Account deletion.** No deletion path exists in the repo today. When one is added it must cancel the Stripe subscription first, because deleting rows does not stop billing.

## Webhook and access check

**Webhook handler**, `POST /api/webhooks/stripe`:

1. Read the raw body with `req.text()` and verify it with `webhooks.constructEvent`. A bad signature returns 400 before any database work.
2. Insert the event id into `stripe_event`. If it is already processed, return 200.
3. Take the subscription id from the event object and retrieve the subscription from Stripe. Current state wins, so duplicate and out-of-order events cannot leave stale state; Stripe does not guarantee order.
4. Resolve the user: `elder_billing` by customer id, else `subscription.metadata.user_id`, which checkout set server-side. Confirm the `elder_user` exists, then upsert `elder_billing`. This is why `invoice.paid` arriving before `checkout.session.completed` is harmless. No user found: log `[stripe/unlinked]` and return 200.
5. If the account already has a different, still-active subscription, change nothing and log `[stripe/second-subscription]`.
6. Map the price with `planFromPriceId`. An unknown price changes nothing and logs `[stripe/unknown-price]`.
7. Work out tier and expiry from the table below, write with `setTierStrict`, update `elder_billing`, set `processed_at`, return 200.
8. Any database failure returns 500 so Stripe retries. Live mode retries for up to three days; a sandbox retries three times over a few hours, so test data needs the reconcile job below.

| Stripe status | Tier and expiry written |
| --- | --- |
| active | Plan tier; expiry is the item's `current_period_end` plus `BILLING_SLACK_DAYS` |
| past_due | Plan tier; expiry left as last written, never extended |
| incomplete, incomplete_expired | Nothing granted |
| unpaid, paused | Expiry set to now |
| canceled (the deleted event) | Expiry set to now |
| trialing | Treated as active; no trials are configured, so log it if seen |

The slack covers webhook delay and slow renewals; it is not an advertised grace period. The deleted event tightens the expiry to the real end, so a seeker who cancels at period end does not keep the extra days. A renewal that fails is frozen out after the slack, not deleted: the freeze rule keeps their journal and letters, and a later `invoice.paid` restores access.

A daily cron, `/api/cron/reconcile-billing`, next to the existing one, lists subscriptions from Stripe and re-applies each through the same function. It catches missed events, including a Neon suspension during delivery. Add a preflight that fails loudly at start if `DATABASE_URL` or the Stripe keys are missing, so an infrastructure failure never looks like a processed payment.

**Access check.** The hot path is unchanged: `divine` already reads the tier record once and derives the effective tier, and billing adds no Stripe call there. Two things in the current order need a decision before anything is charged:

1. **Crisis first.** The IP daily limit (about line 213) runs before the welfare result exists, and the tier check (about line 615) returns before the crisis hard block (about line 817). Welfare is already resolved by the time of the tier check, so that branch can be skipped when `welfare.surfaceResources` is true. The IP limit needs either a move after the hard block or the 988 and Crisis Text Line line added to its response.
2. **Minors skip the gate.** As written, a resolved register of `child` or `young_adult` skips `checkTierEntitlement` entirely. If that is deliberate, because a minor should never meet a paywall, accept the cost. But the register is self-attested, so any signed-in Seeker who picks the 14-to-17 option also skips their per-account daily cap and the deepen taste limit. Gating `young_adult` like adults and skipping only `child`, which is session-only and flag-disabled, closes that.

The over-cap response today says "a Seeker's share". A Kept seeker at a weekly cap needs different copy, keyed on `tierReason` and written in the Elder's register, so nobody feels snubbed.

## Guardrails specific to The Elder

Billing must not change what the Elder is. These follow from decisions already filed and from what the code does today.

- **Tier stays out of the prompt.** No subscription tier appears in `system-prompt-builder.ts` today; its "tier" means the age register. Keep it that way: tier controls capacity and persistence, never the voice, the safety floor or the quality of a reading.
- **Crisis is never gated.** This is the target, not today's behavior; see the access check above. Any cap response must skip crisis turns or carry the 988 and Crisis Text Line line.
- **Over-limit names itself.** The existing `paywalled: true` response with a `tierReason` is already a separate path from `guardReading`'s silence. Keep it separate, so a cap never reads as a broken fire.
- **Adult purchase only.** Checkout reads the register on the server with `getNarrativeRegister` and refuses anything but `adult`. The `child` register never persists and stays flag-disabled pending COPPA sign-off.
- **A downgrade can delete.** The freeze rule protects a lapse to Seeker, which keeps everything already written. But a Council seeker with more than 20 letters who drops to Kept loses the oldest ones on the next save, because `saveThresholdLetter` evicts down to the cap. Make saving above the cap refuse instead of evict, and say so to the seeker.
- **Testers and billing never mix.** The webhook never writes `is_tester`, and a tester reads as Council whatever Stripe says.
- **Revenue and lineage.** Only one voice has confirmed lineage authorization, and charging raises the stakes of the pending lineage conversations. Whether any acknowledgment or revenue arrangement belongs with lineage holders is yours to decide; I have modeled nothing for it.

## Edge cases

Proposed defaults, shaped by what Stripe's portal can and cannot do. Change any of them.

| Case | Default | Constraint |
| --- | --- | --- |
| Upgrade, Kept to Council | Immediate, prorated | Needs portal proration turned on |
| Downgrade, Council to Kept | Immediate, with a prorated credit | The portal can defer a downgrade only between prices on the same product; deferring this one needs a custom schedule flow |
| Monthly to annual | Billing date resets to the day of the switch | Stripe behavior |
| Cancellation | Access to the end of the paid period, then freeze | Cancel at period end; the deleted event tightens expiry |
| Failed renewal | Access through the slack, then freeze; `invoice.paid` restores it | Stripe's retry settings decide how long it keeps trying; check them |
| After a lapse | New saving stops; existing journal and letters stay readable and releasable | Except the Council-to-Kept letter eviction above |
| Second subscription | Blocked at checkout; logged if one slips through | Entitlement follows one subscription id |
| Refund | Yours to write | A refund does not cancel the subscription; pair it with a cancel |
| Dispute | Alert only for now | Add `charge.dispute.created` if you want to react to it |
| Resubscribe after a lapse | Same Customer, new subscription | `elder_billing` is updated in place |

## Review record

Three passes ran on the first draft before this rewrite: an adversarial read, a steelman, and a red-team and blue-team pass over the design.

**Adversarial pass: what was wrong in the first draft.**

| Finding | Severity | Resolution |
| --- | --- | --- |
| Proposed a second entitlement table beside the existing tier columns | High | Entitlement stays on `elder_user`; billing writes through a strict setter |
| Typed the user id as text; `elder_user.id` is a `BIGSERIAL` | High | `BIGINT` |
| Enforced microdollar budgets with no cost data and no usage logging | High | Withdrawn; ceilings kept only as a check, backstop deferred until cost is measured |
| Granted on `checkout.session.completed` and mapped every non-active status to past_due | High | `invoice.paid` drives money; full status table |
| Said crisis is never gated, but the code returns the cap response first | High | Flagged with line references; fix before charging |
| Sold Council with no feature behind it | High | Hold it behind a flag |
| Assumed a deferred downgrade and a 7-day grace | Medium | The portal cannot defer a cross-product downgrade; grace became a slack on expiry |
| Said a lapse never deletes | Medium | A Council-to-Kept save evicts the oldest letters; refuse instead |
| `customer_email` creates a new Customer on every checkout | Medium | Create or reuse one Customer per user |
| Treated period end as a subscription field | Medium | It is on the item since the basil API version |
| Missed that `setTier()` swallows errors | Medium | Strict setter |
| Missed the stale price constants, the over-promising product copy, the missing spec file and the minors' bypass | Medium | Recorded under Tiers and the access check |
| Fee, net and break-even arithmetic | Checked | Recomputed in code; the figures stand |

**Steelman: the strongest case for this design.** One read path already serves the whole app, so billing's blast radius is two columns and no Stripe call on the hot path. It fails closed to Seeker and freezes rather than deletes, which protects trust. Count-based caps are legible to a seeker and to the founder, and are already shipped; dollar meters would add an opaque subsystem before cost is known. Stripe-hosted Checkout and the portal keep card data off the Elder and need almost no interface, which serves the stated goal of subscriptions and onboarding running without the founder. Re-reading the subscription from Stripe on every event makes duplicates and reordering harmless. The weak point the steelman cannot repair: the economics rest on an unmeasured cost, and Kept annual leaves about $2 a month of room.

**Red team and blue team.**

| Attack | Defense | Where |
| --- | --- | --- |
| Forged or replayed webhook | Signature check on the raw body; event-id table | Webhook steps 1 and 2 |
| Client chooses its own tier or price | Price ids come from environment variables; tier comes from Stripe, never from the request | Checkout, webhook |
| Checkout for someone else's account | User id from the signed cookie only; metadata set on the server | Checkout |
| Paying for two subscriptions | Blocked at checkout; second-subscription rule | Webhook step 5 |
| Old event arrives after a newer one | Re-read from Stripe on every event | Webhook step 3 |
| Neon suspended during delivery | 500 so Stripe retries; daily reconcile; preflight | Webhook step 8, cron |
| A missed renewal downgrades a paying seeker | Slack on expiry; `invoice.paid` restores; reconcile | Status table |
| Refund or dispute leaves access on | Policy: refund together with cancel; optional dispute alert | Edge cases |
| A minor buys a subscription | Checkout refuses any non-adult register | Checkout |
| Self-attested register skips the caps | Gate `young_adult` like adults | Access check, item 2 |
| A tester or manual grant is overwritten | Webhook never writes `is_tester`; grant manually only to non-subscribers | Data model |
| Secret leak | Restricted key on Vercel only; no keys in chat or logs; log ids, never emails | Environment variables |
| Account deleted while subscribed | Deletion must cancel the subscription first | Data model |
| Test objects mistaken for live | Separate ids and secret per mode; one real purchase, then refund | Yours to do |

## Build order and what is yours

Each step is one pull request.

1. **Before anything is charged.** Crisis-first ordering in the divine route; gate `young_adult`; correct or remove the Council price constants; refuse instead of evict on letter saves above the cap; add this document to `docs/`. Check: a test with a crisis message from a seeker at a cap, plus the existing build and CI.
2. **Measure.** One log line per generation: tokens in and out, cached reads, tier, mode. Read a week of it, then decide on a backstop.
3. **Data.** Migration 031 on a Neon dev branch, `setTierStrict`, and a pure status-to-entitlement function with a unit test for every row of the status table.
4. **Webhook.** The route, `stripe_event`, `planFromPriceId`, and fixture-event tests: duplicate, out-of-order, unknown price, and a database failure returning 500.
5. **Checkout and portal.** Both routes, an account link, cap-response copy keyed on `tierReason`, and `COUNCIL_PURCHASABLE` left off.
6. **Reconcile.** The daily cron and the startup preflight.
7. **Test-mode lifecycle.** With the Stripe CLI: checkout, update, delete, failed payment, upgrade, downgrade, cancel at period end, and one event delivered twice. Confirm the entitlement after each.
8. **Live.** Rebuild the objects in live mode, swap the secrets yourself, make one real purchase and refund it.

The full list of what only you can do:

- [ ] Settle the open decisions below.
- [ ] In Stripe test mode, create the webhook endpoint with five events (`checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`) and put its signing secret in Vercel.
- [ ] Configure the Customer Portal as listed under Stripe objects: switch plan, proration on, cancel at period end, payment method, invoices.
- [ ] Check the failed-payment settings: retry window and what happens after the final retry.
- [ ] Set tax behavior on the four prices and a tax code on both products, decide on Stripe Tax, and review your tax registration obligations.
- [ ] Correct the product descriptions to match decisions D1 and D2.
- [ ] Set the four price ids and the other Stripe variables on Vercel for preview and production, using a restricted key; redeploy; add them to `docs/ENV.md`.
- [ ] Write the refund policy and publish terms and privacy pages.
- [ ] Get legal sign-off for charging adults only, and decide whether it changes the child-register timeline.
- [ ] Install the Stripe CLI and run `stripe listen` with triggered events.
- [ ] Run migration 031 on a Neon dev branch first, then production through the unpooled URL, then `npm run check:schema-drift`.
- [ ] Decide whether lineage holders are acknowledged in the revenue arrangement.
- [ ] For live mode: activate the account, add the bank, recreate the objects, swap the secrets, make one real purchase and refund it.

**Open decisions.**

- D1. Keep "unlimited" and "uncapped" with fair-use language, or change the copy to "no daily limit".
- D2. Hold Council behind a flag until pairing ships, or sell it now as Kept plus no letter cap.
- D3. Slack days (default 3) against Stripe's retry window.
- D4. Gate `young_adult` like adults, or accept the bypass.
- D5. Council to Kept above 20 letters: refuse new saves, or evict with a warning.
- D6. Price source of truth: Stripe ids or code constants.
- D7. Whether a monthly count backstop is needed, after a week of usage data.
- D8. Refund and dispute policy.
- D9. Immediate downgrade through the portal, or a custom schedule flow that defers it.

**Not checked by me.** The live Stripe account, which this connection cannot see. Any code: I ran no tests, installed nothing, and the line numbers cited are approximate, from main at commit 9403819. Next.js 16 route-handler conventions and the Stripe SDK version.
