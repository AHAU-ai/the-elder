# Backend Profile

**As of:** 2026-09-23, read directly from `main` (`app/api`, `lib/`, `src/resilience/`, `migrations/`). Not a design doc — a snapshot of what's actually running.

## Stack

- **Runtime:** Next.js 16 App Router API routes (`app/api/**/route.ts`), Node runtime explicitly (`export const runtime = 'nodejs'` on the heavy routes), deployed on Vercel.
- **DB:** Neon serverless Postgres (`@neondatabase/serverless`), accessed via tagged-template `sql` from a single `lib/returning/db.ts` export, reused by every `*Ledger.ts` file. No ORM — hand-written SQL throughout, 25 sequential migrations (`migrations/001`–`025`).
- **LLM:** Anthropic SDK direct (`@anthropic-ai/sdk`), no LangChain/framework layer. `LLM_PROVIDER` env var can switch to Gemini/OpenAI fallback models (`lib/model.config.ts`), but the primary generation call in `app/api/divine/route.ts` is hardcoded to `PRIMARY_MODEL` (Anthropic) regardless — the provider switch exists in config but isn't actually wired into the main route.
- **Observability:** Sentry (`@sentry/nextjs`), wrapped through `lib/observability.ts` (`captureGuardianRejection`, `trackReadingLatency`, `captureBankedFire`, `captureReadingError`).
- **Email:** Resend (`RESEND_API_KEY`), for Threshold Letters.
- **Auth:** no library — a hand-rolled stateless HMAC-signed cookie (`lib/auth.ts`).

## The core request: `POST /api/divine`

This is the center of gravity — everything else in the backend either feeds it or persists what it produced. `app/api/divine/route.ts` is ~1200 lines and runs, per request, in roughly this order:

1. **Tester-bypass + rate limit.** Session resolved first (stateless cookie, no DB round-trip to verify) so a tester account can skip the anonymous IP-keyed daily cap. Rate limiting is Neon-backed with an in-memory fallback on DB absence/error (`lib/rate-limit.ts`).
2. **Voice-enabled + consent check.** `loadFlags()` gates which lineages are live at all; `checkConsent()` (`lib/consentLedger.ts`) is now informational-only per an explicit 2026-08-20 decision — a lineage generates regardless of grant status, the ledger just keeps recording.
3. **Corpus retrieval** (`lib/corpusRetrieval.ts`) — real RAG against a lineage-approved passage table, currently only populated for one voice (mekubal). Fails soft to `[]`.
4. **Jailbreak-shape signal logging**, non-blocking.
5. **Welfare gate** (`lib/welfareGate.ts`) — synchronous, runs *before* prompt assembly, on every turn not just the first. Combines a Haiku-class model judge with a deterministic lexical floor; takes whichever is more severe; fails toward the more restrictive tier (`distress`) if the classifier itself is unreachable, and logs that failure so it isn't silently invisible. A `crisis` verdict hard-blocks — no generation call happens at all, a fixed register-aware crisis message returns directly.
6. **Tiered entitlement check** (`lib/tierEntitlement.ts` / `lib/tierLedger.ts`) — paywalls `seeker`-tier requests for adult-register primary readings/deepens; child/young_adult registers are exempt from monetization entirely.
7. **Chain continuity** — a `deepen` request re-fetches the seeker's own most recent reading chain server-side (`lib/returning/visit.ts`); the client can request a deepen but never supplies the chain content or id — it's derived from the session owner's own DB rows, gated on same-lineage-only continuation.
8. **Trajectory context** — `lib/returning/trajectoryContext.ts`, `markerTrajectory.ts`, `trajectory.ts`. This is the "Axis 2" personalization layer: depth-stage proposals, pending marker stage-ups, and a 5-visit movement classifier (Arriving/Descending/Circling/Ranging/Crossing) that tones the system prompt's register without ever being shown to the seeker as a label or persisted anywhere. Gated behind `tierIsKeptPlus`, non-crisis welfare, and `config/returning-features.ts`'s flags.
9. **System prompt assembly** (`lib/system-prompt-builder.ts` + composed narrative/movement/distress/corpus blocks) — one big string built fresh per request from ~8 independent contributing sources.
10. **Generation**, wrapped in `guardReading()` (`src/resilience/failTowardSilence.ts`) with a 36s timeout, up to 2 attempts.
11. **Dual Guardian review** (`lib/dualGuardian.ts`) — two independent LLM judges with orthogonal framing (a "Threshold Keeper" who knows the ceremonial frame, a "Lineage Examiner" who doesn't), consensus required to pass. A rejection retries once only if every violation category is in an allow-listed "plausibly stochastic" set (`LINEAGE_BREACH`, `VOICE_BOUNDARY`, `REGISTER_BREAK`, `REGISTER_VIOLATION`, `MALFORMED`) — prompt-leak/injection and severe governance violations (`RETIRED_REFERENCE`, `DESECRATION`) decline immediately, never retried.
12. **Persistence** — on a signed-in, Kept+-tier, successful reading/council turn: myth-signature extraction, myth ledger upsert, reading log, marker extraction, and a new/continued visit row. All failures here are swallowed (logged as anomalies, never surfaced to the seeker) — `seeker` tier is architecturally inert at this step by design (no journal auto-save, no trajectory accrual), not by omission.
13. Final response carries `_provenance` (a single canonical shape from `src/resilience/provenance.ts`, reused across the JSON response, the share-card PNG embed, and `renderProvenanceBlock`).

Every terminal branch (crisis hard-block, infra silence, guardian decline, success) stamps `_provenance` the same way — this was a real, fixed bug (camelCase/missing-fields drift across three hand-rolled copies), not original design.

## Safety/governance layers, as actually wired

| Layer | File | Runs | Can it block generation? |
|---|---|---|---|
| Welfare gate | `lib/welfareGate.ts` | Before prompt build, every turn | Yes — hard blocks at crisis tier |
| Consent ledger | `lib/consentLedger.ts` | After voice-enabled check | No (informational only since 2026-08-20) |
| Dual Guardian | `lib/dualGuardian.ts` | After generation, per attempt | Yes — declines to a fixed ceremonial-decline utterance |
| Rate limit | `lib/rate-limit.ts` / `rateLimitLedger.ts` | First, before anything else | Yes — 429, bypassed for testers |
| Tier entitlement | `lib/tierEntitlement.ts` | After welfare, before generation | Yes — paywall response, adult-register only |

## Data model (Neon, 25 migrations)

Notable tables by area (exact names not all confirmed from migration filenames alone, but the domains are clear from call sites):
- **Identity/session:** `user_record`, `visit_record` (004), stateless cookie auth layered on top, no session table.
- **Anonymous divination log:** `altar_record` — deliberately kept anonymous, untouched by the returning-visitor migration (004's own commit message calls this out explicitly).
- **Myth ledger:** per-user archetype/summary rows (`lib/mythLedger.ts`), reading log (`lib/mythReadingLog.ts`).
- **Marker/trajectory:** `009_marker_trajectory`, `020`/`021_marker_depth_stage[_pending]` — the Axis 2 personalization spine.
- **Threshold Letters:** `010`, `016` (email delivery), delivered via `app/api/cron/deliver-threshold-letters` (Vercel Cron, `CRON_SECRET`-gated).
- **Sharing:** `017_share_card_provenance`, `app/api/share/**` (create, respond, list mine).
- **Guided journaling:** `018_guided_journal_entry`.
- **Rate limiting:** `019_rate_limit_bucket` — DB-backed, not just in-memory.
- **Tiered membership:** `023_tier_membership`, `024_tester_account`, `025_referral_attribution` — most recent additions, monetization layer.
- **Corpus/RAG:** `011`–`012` (embedding dims, voice_key on `corpus_passage`), consumed by `lib/corpusRetrieval.ts` (Voyage embeddings, `VOYAGE_API_KEY`).

## API surface (`app/api/`)

Grouped by function:
- **Core:** `divine` (the reading engine, above), `threshold`, `altar`.
- **Auth:** `auth/request`, `auth/verify`, `auth/logout`, `auth/me` — presumably email-link/magic-code based given no password field anywhere in `lib/auth.ts`.
- **Elder/marker:** `elder/marker-offer`, `elder/confirm-marker`, `elder/confirm-depth-stage`, `elder/core-myth-statement[/dismiss]`.
- **Myth:** `myth`, `myth/arc`, `myth/lineage-recall`, `myth/patterns`.
- **Journal:** `journal`, `guided-journal`.
- **Sharing:** `share`, `share/mine`, `share/[id]`, `share/[id]/respond`.
- **User:** `user/history`, `user/preferences`, `user/tree-state`.
- **Threshold Letters:** `threshold-letters`, `threshold-letter-content`, `cron/deliver-threshold-letters`.
- **Admin:** `admin/set-tester`, `admin/set-tier` (`ADMIN_SECRET`-gated, presumably).
- **Infra:** `log` (the anomaly-write endpoint every `logAnomaly()` call across the codebase POSTs to), `register`.

## Notable characteristics of this backend specifically

- **Fail-open on ancillary systems, fail-closed on safety.** Rate limiting, consent checks, feedback steer, trajectory context, myth persistence — all swallow their own errors and degrade to inert/empty rather than breaking the reading. The welfare gate and dual guardian are the opposite: unreachable welfare classifier escalates to `distress`, not to "skip the check."
- **Server derives what the client claims.** Chain id, tier, register (for signed-in users), and rate-limit identity are all re-resolved server-side from the DB/session even when the request body includes its own version of that data — several inline comments document this as a direct response to a found bug (e.g. an anonymous seeker's `narrativeRegister: 'child'` being trusted unconditionally from the client body before a 2026-08-17 fix).
- **Heavy in-file audit trail.** Almost every non-trivial branch in `divine/route.ts` carries a dated comment describing the bug it fixes and how it was found (live reproduction, Playwright test, CI catch) — this route's history is unusually legible from the code alone.
- **The provider abstraction is partial.** `model.config.ts` supports Gemini/OpenAI as configured fallback providers, but `divine/route.ts`'s actual generation and welfare-judge calls are hardcoded to the Anthropic client — switching `LLM_PROVIDER` would not currently change what the main route does.
