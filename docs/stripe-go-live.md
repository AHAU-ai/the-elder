# Stripe: test mode and go-live swap

Updated 2026-11-09. Replaces the earlier standalone swap scripts. Billing code is
already in the repo (`lib/stripeClient.ts`, `lib/stripeSync.ts`, `app/api/stripe/*`,
`app/api/webhooks/stripe`, `app/api/cron/reconcile-billing`); going from test to
live is **environment variables only**. `scripts/stripe-env-swap.sh` sets them.

## What changes between modes

| Variable | Preview (test) | Production (live) |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_` / `rk_test_` | `sk_live_` / `rk_live_` |
| `STRIPE_WEBHOOK_SECRET` | signing secret of the **test** endpoint | signing secret of the **live** endpoint |
| `STRIPE_PRICE_*` (4) | test price ids | live price ids |
| `STRIPE_CHECKOUT_ENABLED` | `true` | `false` until the live purchase test passes |
| `COUNCIL_PURCHASABLE` | `true` (to exercise the flow) | `false` until Council Mode ships |

`lib/stripeClient.ts` refuses a live key outside `VERCEL_ENV=production` and a test
key inside it, so a swapped scope fails loudly instead of charging real cards.

## Price ids

| Plan | Test | Live |
| --- | --- | --- |
| Kept monthly $8 | `price_1UApz9QivRu0hLGsFfkuLz7Y` | `price_1UApokQivRu0hLGs7UCt967r` |
| Kept annual $50 | `price_1UApzDQivRu0hLGsUP5mbxms` | `price_1UApooQivRu0hLGs6Jyp20X1` |
| Council monthly $20 | `price_1UApzGQivRu0hLGsRMOAz8fD` | `price_1UAporQivRu0hLGsPw6t7Iiq` |
| Council annual $120 | `price_1UApzJQivRu0hLGsf0kYC3gL` | `price_1UApovQivRu0hLGsWTknW87l` |

## Test mode dry run (Preview)

1. Run migration `031_stripe_billing.sql` against the **dev** Neon branch.
2. In Stripe (test mode) create a webhook endpoint at `https://<preview-url>/api/webhooks/stripe`
   with five events: `checkout.session.completed`, `invoice.paid`,
   `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. `scripts/stripe-env-swap.sh test` (add `--dry` first to see what it will set), then redeploy the Preview.
4. Walk it through: buy Kept with `4242 4242 4242 4242`; tier flips to Kept; save a Threshold Letter and a guided-journal entry (both persist).
5. Failing renewal: use `4000 0000 0000 0341`. On `past_due` the member is a Seeker immediately (decided 2026-11-09); saved rows stay readable; a later successful payment restores access.
6. Cancel in the Portal; confirm access ends at the period end.
7. A sandbox retries failed webhooks only a few times, so run `/api/cron/reconcile-billing` (with `CRON_SECRET`) to catch any missed event.

## Go live (Production)

Blockers first; do not enable checkout until these are done:

- [ ] **Crisis first, IP-limit half.** The tier-gate half is fixed (crisis turns skip the entitlement check). The IP daily limit in `app/api/divine/route.ts` still returns before the welfare result exists, so a crisis message from a seeker at the daily limit gets limit copy, not 988. Move it after the hard block or add the 988 / Crisis Text Line line to that response. Add a test: crisis message from a seeker at the cap.
- [ ] Migration `031` (and any later ones) applied to the **production** Neon branch.
- [ ] Stripe account activated, bank added, live Customer Portal configured (`STRIPE_PORTAL_CONFIGURATION` if you use a saved configuration).
- [ ] `CRON_SECRET` set in Production and the reconcile cron scheduled.
- [ ] Live webhook endpoint created with the same five events.

Then:

1. `scripts/stripe-env-swap.sh live` (keys at a hidden prompt; checkout stays off). Redeploy Production.
2. `scripts/stripe-env-swap.sh enable`. Redeploy Production.
3. Make one real purchase of the cheapest plan, confirm the tier flips, refund it in the Dashboard.
4. Leave it enabled, or `scripts/stripe-env-swap.sh disable` and redeploy if anything looks wrong. `disable` is the kill switch; it sells nothing and breaks nothing.

Council stays unpurchasable in Production until Council Mode exists.
