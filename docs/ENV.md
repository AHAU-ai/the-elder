# Environment Variables

Copy .env.example to .env.local and fill in values.

| Variable | Required | Description |
|---|---|---|
| ANTHROPIC_API_KEY | Yes | Anthropic API key. Set in Vercel and GitHub Actions secrets. |
| DATABASE_URL | If logging | Altar record persistence. Omit to disable. |
| ELDER_LOG_WEBHOOK | Optional | Webhook for anomaly alerts. |
| LLM_PROVIDER | Optional | Defaults to anthropic. |
| MAX_TOKENS | Optional | Defaults to model config. |
| RATE_LIMIT_PER_DAY | Optional | Daily divination limit. |
