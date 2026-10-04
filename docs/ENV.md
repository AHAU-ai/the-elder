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
| MYTH_FIRST_ENABLED | No (default off) | Myth-first Readings (docs/myth-first-spec.md): a new seeker's first Reading is told as the myth, then the figure, then their own story; returning seekers keep the story-first Reading. **Governance action, not an engineering one**: do not set without the pre-flip checklist in the spec (MF-8), and set it for a single test account first. Must be exactly `true`. |
| MYTH_FIRST_ALL_SEEKERS | No (default off) | Stage 2 of the myth-first rollout (decision D10, testers first). With `MYTH_FIRST_ENABLED` on, only tester accounts get myth-first until this is also `true`. **Governance action**, set after the stage 1 review in MF-8. Must be exactly `true`. |
| ELDER_LETTER_STOP_SECRET | Recommended | HMAC secret for the one-click stop link in letter emails. Falls back to `ELDER_SESSION_SECRET`. Those links are opened months later (400-day TTL): rotating this secret invalidates every stop link already sent, so set it once and do not rotate casually. |

## Saved-myth accounts

Optional, offered only after a reading (`SaveMythPrompt`) — the app stays anonymous and frictionless without it. Requires `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, and `ELDER_SESSION_SECRET` all set; if any are missing, sign-in and myth persistence silently no-op rather than erroring (see `lib/auth.ts`, `lib/mythLedger.ts`). Run `DATABASE_URL=<url> node scripts/migrate-phase2-myth-accounts.mjs` once to create the tables.
