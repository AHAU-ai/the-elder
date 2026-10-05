# Environment Variables

Copy .env.example to .env.local and fill in values.

| Variable | Required | Description |
|---|---|---|
| ANTHROPIC_API_KEY | Yes | Anthropic API key. Set in Vercel and GitHub Actions secrets. |
| DATABASE_URL | If logging or saved myths | Altar record persistence, plus saved-myth accounts (§ below). Omit to disable both. |
| ELDER_LOG_WEBHOOK | Optional | Webhook for anomaly alerts. |
| LLM_PROVIDER | Optional | Defaults to anthropic. |
| MAX_TOKENS | Optional | Defaults to model config. |
| RATE_LIMIT_PER_DAY | Optional | Daily divination limit. |
| RESEND_API_KEY | If saved myths | Sends magic-link sign-in emails via Resend. |
| EMAIL_FROM | If saved myths | Verified sender address for magic-link emails. |
| ELDER_SESSION_SECRET | If saved myths | HMAC secret signing the session cookie. |
| FIGURE_CONTINUITY_ENABLED | No (default off) | Figure Continuity (docs/figure-continuity-spec.md): lets a returning seeker continue as their confirmed figure and pair people in their life with that myth's characters. **Governance action, not an engineering one**: do not set without the pre-flip checklist in docs/figure-continuity-build-plan.md. All three of this, `MARKER_CONFIRMATION_READY` and `FIGURE_CONTINUITY_RELEASE_VERIFIED` must be exactly `true`. |
| FIGURE_CONTINUITY_RELEASE_VERIFIED | No (default off) | Third Figure Continuity gate: set only after the pairing release and removal paths (spec G12) are verified end to end on a deployment. |
| ELDER_LETTER_STOP_SECRET | Recommended | HMAC secret for the one-click stop link in letter emails. Falls back to `ELDER_SESSION_SECRET`. Those links are opened months later (400-day TTL): rotating this secret invalidates every stop link already sent, so set it once and do not rotate casually. |
| STRIPE_SECRET_KEY | For billing | Stripe API key (a restricted key is better). Test and live modes use different keys. See docs/stripe-billing-model.md. |
| STRIPE_WEBHOOK_SECRET | For billing | Signing secret (`whsec_...`) of the Stripe webhook endpoint pointing at `/api/webhooks/stripe`. Test and live endpoints have different secrets. Without it the webhook returns 503 so Stripe retries. |
| STRIPE_PRICE_KEPT_MONTHLY / STRIPE_PRICE_KEPT_ANNUAL / STRIPE_PRICE_COUNCIL_MONTHLY / STRIPE_PRICE_COUNCIL_ANNUAL | For billing | Stripe price ids for the four plans. Ids differ between test and live mode. A subscription on any other price changes nothing and logs `[stripe/unknown-price]`. |
| STRIPE_CHECKOUT_ENABLED | No (default off) | Must be exactly `true` for `/api/stripe/checkout` to start a checkout. Leave off until the pre-charge fixes in docs/stripe-billing-model.md (build order step 1) have shipped. |
| COUNCIL_PURCHASABLE | No (default off) | Must be exactly `true` for checkout to sell Council; Council has no feature behind it yet. |
| BILLING_SLACK_DAYS | Optional | Days added after the paid period end before access freezes (default 3, range 0-14). Covers webhook delay; not an advertised grace period. |
| STRIPE_PORTAL_CONFIGURATION | Optional | Stripe Customer Portal configuration id (`bpc_...`). Unset uses the account's default configuration. |

## Saved-myth accounts

Optional, offered only after a reading (`SaveMythPrompt`) — the app stays anonymous and frictionless without it. Requires `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, and `ELDER_SESSION_SECRET` all set; if any are missing, sign-in and myth persistence silently no-op rather than erroring (see `lib/auth.ts`, `lib/mythLedger.ts`). Run `DATABASE_URL=<url> node scripts/migrate-phase2-myth-accounts.mjs` once to create the tables.
