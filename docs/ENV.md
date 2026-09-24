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

## Saved-myth accounts

Optional, offered only after a reading (`SaveMythPrompt`) — the app stays anonymous and frictionless without it. Requires `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, and `ELDER_SESSION_SECRET` all set; if any are missing, sign-in and myth persistence silently no-op rather than erroring (see `lib/auth.ts`, `lib/mythLedger.ts`). Run `DATABASE_URL=<url> node scripts/migrate-phase2-myth-accounts.mjs` once to create the tables.
