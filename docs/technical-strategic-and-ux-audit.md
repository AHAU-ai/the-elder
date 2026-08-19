# The Elder — Technical, Strategic, and UX Audit

**Date:** 2026-07-19
**Auditor:** Claude Opus 4.8 (Claude Code)
**Repo:** `the-elder` · branch `main` · HEAD `5a78988`
**Scope:** Full codebase. Commissioned to identify constraints that block the system from doing what it was designed to do.

**Staleness flag (added 2026-08-19, not a re-audit):** this document is now a month old against a codebase that has moved substantially — confirmed stale on at least two points, encountered incidentally while correcting unrelated "Lintel" references elsewhere in `docs/`:
- **E-05 and the UI file inventory below both name `app/components/LintelGate.tsx` and `app/components/CrisisPage.tsx`. Neither file exists.** Both were removed in commit `86e276b` (2026-08-03), a deliberate friction-reduction decision, not a regression. Whatever E-05 describes needs re-diagnosis against the current entry flow (`BreathGate.tsx` onward) before its fix suggestion is actionable — the fix as written references a gate that no longer exists.
- **E-04 ("the dual-guardian gate is not on the runtime path") is fixed.** `app/api/divine/route.ts` wires `dualGuardReading` directly into the generation path as of 2026-08-17, per that route's own code comments — confirmed by reading the live route, not by re-running this audit's methodology.

No other finding in this document has been re-verified. Treat every **OPEN** status below as *last confirmed 2026-07-19*, not current, until someone actually re-runs this audit against HEAD.

---

## Executive summary

The Elder's constraint architecture is unusually well-designed on paper and substantially unbuilt in practice. The dominant finding is not that the constraints are too strict — it is that **the sophisticated layers are dormant and the crude layers are load-bearing.**

Four things are true at once:

1. **The depth architecture never runs.** `lib/psychopompLayer.ts` (1,284 lines of per-tradition descent stages) is imported by nothing. The welfare gate's `allowPsychopompLayer` flag gates a layer that has no call site.
2. **The quality gate never runs.** `lib/dualGuardian.ts` (two-judge consensus, lineage integrity, injection detection) is imported by nothing on the runtime path. The route's `guardReading` is a different function — a timeout wrapper from `src/resilience/failTowardSilence.ts`.
3. **The welfare gate — the one layer that does run — is calibrated to exclude the instrument's core use case.** Acute grief is classified as `crisis` and hard-blocked before the model is called.
4. **The CI harness that would have caught all of this reports green when it tests nothing.** Two of the three probe suites pass vacuously against an unreachable instrument. The one suite that notices reports the wrong cause.

The net effect at runtime: a seeker in grief gets a crisis hotline instead of a reading; a seeker in distress gets a shallow reading; and a seeker who is fine gets a reading with no lineage-integrity check. This is close to the inverse of the intended design.

The net effect in CI: nobody finds out. **This is why the release-lifecycle findings (CI-01 … CI-06) are ranked at the top of the table below.** Every other finding in this document is a thing the pipeline was supposed to catch and didn't — not because the probes are badly conceived (they are, in fact, the only lineage-integrity testing that exists) but because their failure modes resolve toward green. A false green on lineage purity is a worse outcome for this project than any single runtime defect, because it converts "we have not verified this" into "we have verified this."

**One correction to an earlier verbal finding:** `PRIMARY_MODEL = "claude-sonnet-4-6"` is a **valid, current model ID**, verified against the model catalog. It is previous-generation (Sonnet 5 is current) but it is not a bug. Disregard any earlier suggestion that it 404s.

---

## Immediate actions — blocking, do these first

These are not findings to schedule. Until they are done, **nothing in CI verifies anything**, and no change to safety-critical behavior can be validated.

### 1. Rotate `ANTHROPIC_API_KEY` (repository secret)

The secret is **present but rejected — HTTP 401 on every call.** Confirmed in runs `29715664515` and `29716303863` (2026-07-20).

It is used in two distinct places, and both are dead right now:

| Consumer | How it reads the key | Symptom when dead |
|---|---|---|
| The app under test (`npm run dev` in CI) | `process.env.ANTHROPIC_API_KEY` in `app/api/divine/route.ts` | route 500s, or generation fails into a `failTowardSilence` silence utterance |
| The red-team judge | `loadEnvLocalKey('ANTHROPIC_API_KEY')` in `scripts/drift-detect.mjs` | `judge call failed — HTTP 401`, which CI-04 then miscounts as drift |

**To fix:** mint a new key, set it at `Settings → Secrets and variables → Actions → ANTHROPIC_API_KEY`, re-run the workflow, and confirm the judge line no longer reads `HTTP 401`. Note the same variable name is also read from a local `.env.local` when running probes off-CI — rotate there too or local runs will disagree with CI.

**Then add a preflight step** so this failure mode can never again masquerade as a red-team verdict: one cheap authenticated call at job start that fails the job with an explicit "credentials invalid" message before any probe runs.

### 2. Restore consent-ledger (Neon) reachability

`DATABASE_URL` is set, but `checkConsent()` **throws** on every request — the `'error'` path, not `'no_grant'`, so this is a connection/driver failure rather than missing grant rows. Because consent fails closed, every voice is blocked and no probe reaches the model.

Most likely cause is Neon free-tier auto-suspend: the last green run was 2026-07-19 10:41Z, roughly 17 hours before the failures. **To fix:** confirm the branch/endpoint is awake and that `consent_grant` rows survive suspend/resume, then decide whether CI needs a wake-and-retry step or a non-suspending plan. Add the same preflight treatment as the key.

### 3. Do **not** restore the previous branch-protection configuration

`main protection` (ruleset `18127251`) is currently **suspended**, deliberately. The prior configuration was not a working safety control and should not be reinstated as-is — see **CI-00**. What replaces it needs to be designed, not restored. Backups exist (`gk007-backup.json`, `mainprot-backup.json`) purely as a record of what was there, not as a target state.

---

## Prioritized findings

Severity: **P0** blocks the core purpose · **P1** major functional or safety gap · **P2** meaningful defect · **P3** hygiene.
Status: **OPEN** · **FIXED** (this session) · **DECISION** (needs a human owner, not a code change).

IDs are stable across revisions: `E-` = engine/runtime, `CI-` = release lifecycle. The table is ordered by severity, not by ID.

| # | Sev | Finding | Root cause | Fix | Status |
|---|---|---|---|---|---|
| CI-00 | **P0** | **The merge gate was structurally unsatisfiable — every PR to `main` was permanently unmergeable.** Ruleset *GK-007 Covenant Integrity Gate* required status check `gk-007.yml`, but that workflow exists **only on the unmerged `feat/returning-visitor` branch**, never on `main`. A required check whose workflow is absent from the target branch's tree never reports — it sits pending forever. Compounded by two things that made it invisible: the classic branch-protection API returns `404 Branch not protected` for a repo governed by rulesets, and `gh pr checks` lists only checks that *started*, so a never-started requirement is silently omitted. | Branch policy was authored as if `gk-007.yml` were on `main`. Nothing validates that a required check context corresponds to a workflow reachable from the protected branch — GitHub will happily accept a requirement that can never be met. | **Do not restore the prior config.** Redesign the gate — see *Release-gating design* below. Interim state: the `required_status_checks` rule was removed from GK-007 (deletion / non-fast-forward / PR-required retained), and `main protection` is suspended. | **OPEN — redesign** |
| CI-01 | **P0** | **CI reports green on untested safety properties.** In run `29715664515`, `signal-system-test` logged `SKIP -- server unavailable` for *both* tests and then printed `Signal system: PASS` (exit 0). `lineage-purity` returned 15/15 PASS in ~450ms total (~30ms/voice — far too fast for model calls); it asserts "no cross-traditional leakage," which is trivially true of a block message. Neither suite reached the model. | Both suites treat *absence of a violation* as *proof of compliance*. A skip, an HTTP error page, and a clean reading are scored identically. | Fail (or error) when no reading was obtained. A skip must never exit 0. This inverts a currently-inverted signal and is the single highest-value CI fix. | **OPEN** |
| CI-02 | **P0** | **The pipeline is currently verifying nothing at all.** Two independent environment failures: `ANTHROPIC_API_KEY` is present but returns **HTTP 401** on every judge call, and the consent ledger **throws** on every request. Combined with CI-01, the job's green checks are meaningless and its red check is misattributed. | Secret rotation/expiry, plus a Neon DB that is unreachable (free-tier auto-suspend is the likeliest cause; the last green run was ~17h earlier). | Rotate `ANTHROPIC_API_KEY`; confirm `DATABASE_URL` reachability and that `consent_grant` rows survive suspend/resume. Add a preflight step that fails loudly on either, *before* any probe runs. | **OPEN** |
| E-01 | **P0** | **Acute grief is hard-blocked.** The welfare classifier lists "acute grief in the immediate aftermath of a death" under `crisis`; `crisis` short-circuits before the model call and returns only the 988 text. A bereaved seeker cannot receive a reading at all. | Welfare taxonomy conflates *risk to self* with *intensity of feeling*. A psychopomp instrument built on katabasis treats grief as its central subject; the gate treats it as disqualifying. | Split grief out of `crisis` into a distinct tier that permits the reading with a grounding-forward register. Keep self-harm/psychosis in `crisis`. Requires lineage + welfare sign-off — see Governance. | **DECISION** |
| E-02 | **P0** | **Distress disables the depth layer.** `distress` sets `allowPsychopompLayer: false`. Combined with bare-substring lexical triggers (`'overwhelmed'`, `'hopeless'`, `'falling apart'`) and a judge instructed to "bias toward the MORE severe tier," most seekers in genuine need get the shallow path. | Design treats distress as a reason to withhold the instrument. The architecture's own premise (Kerényi's `sent` posture — pushed to the threshold by loss) is exactly this population. | Redefine `distress` as *modulate*, not *suppress*: keep the mythic register, soften the closing question (the current `DISTRESS_DIRECTIVE` already does this well), and allow the depth layer. | **DECISION** |
| CI-03 | **P1** | **Consent blocks are not recognized as gates.** `isGatedResponse()` matches one hardcoded prose string — `'does not sit at the fire tonight'` ([drift-detect.mjs:209](../scripts/drift-detect.mjs#L209)) — which is the *voice-flag* message only. All three consent-ledger block messages fall through and are graded as drift. This is the direct cause of the 10 probe failures on PR #8. | The harness knows the concept "never reached the model" (it applies it correctly to gated `sufi`/`mekubal`) but the detector is keyed to prose rather than to a machine-readable field. | Emit a structured block reason from the route and key the detector off that. Prose matching is inherently fragile — a copy edit to a user-facing message silently changes CI semantics. | **OPEN** |
| CI-04 | **P1** | **Judge infrastructure failure is scored as a red-team verdict.** `gradeProbe()` maps `verdict === null` (i.e. `judge call failed — HTTP 401`) to `status: 'FAIL'` ([drift-detect.mjs:296](../scripts/drift-detect.mjs#L296)). A dead API key is reported as epistemic drift. | Fail-closed reasoning correctly applied to a runtime gate, incorrectly applied to a test harness. For a gate, ambiguity → block. For a harness, ambiguity → "harness broken," which is a different remedy. | Route `verdict === null` to the existing `ERROR` status and exit with a distinct code/message so "instrument drifted" and "harness broken" are never confused. | **OPEN** |
| E-03 | **P1** | **The psychopomp layer has no call site.** 1,284 lines defining descent stages, seeker postures, and per-voice forbidden moves for 13 traditions. `getPsychopompContext` / `formatPsychopompAnnotation` are exported and never imported. | Built ahead of integration; the wiring step was never done. The welfare gate's flag implies it exists at runtime. | Wire into `buildSystemPrompt` behind the welfare tier. This is the single highest-leverage unlock in the repo — the depth content already exists. | **OPEN** |
| E-04 | **P1** | **The dual-guardian gate is not on the runtime path.** `dualGuardReading` (lineage integrity, voice boundary, injection compliance, two-judge consensus) is imported only by `lib/observability.ts` comments and `scripts/*probe*.mjs`. No reading is ever judged. | Name collision: the route imports `guardReading` from `src/resilience/failTowardSilence.ts` (a timeout wrapper), not from `lib/guardian.ts`. Easy to read as wired when it isn't. | Add `dualGuardReading` after generation, before response. Budget ~14s; the route's `maxDuration` is 30s and generation already uses 28s — the timeout budget needs rebalancing first. | **OPEN** |
| E-05 | **P1** | **The crisis UI is unreachable when it matters.** `CrisisPage.tsx` is a purpose-built crisis surface, but `phase === 'crisis'` is only ever set by `LintelGate`'s `onCrisis` — the pre-entry gate. A mid-conversation `ceilingCategory: 'welfare_crisis'` is stored in a ref for telemetry only; the 988 text renders as an ordinary message bubble in the ceremonial frame. | The runtime welfare path and the UI crisis path were built separately and never joined. | In `Threshold.tsx`, branch on `data.ceilingCategory === 'welfare_crisis'` → `setPhase('crisis')`. Small change, large safety impact. | **OPEN** |
| E-06 | **P1** | **Welfare telemetry is hardcoded off.** `crisisFlag: false` is a literal in both altar-record payloads (`page.tsx:47`, `Threshold.tsx:201`). The Altar Record can never report a welfare event, so nobody can measure how often E-01/E-02 fire. | Placeholder never replaced. | Thread the real welfare tier from the API response into the altar payload. Needed *before* re-tuning E-01/E-02, or the change is unmeasurable. | **OPEN** |
| CI-05 | **P2** | **Probes run before the app is ready.** `wait-on http://localhost:3000` returns as soon as the port answers, but Next dev compiles routes lazily — the first probes receive an HTML compile/error page, which is what produced the `Unexpected token '<'` skips in CI-01. | Readiness is checked at the transport layer, not the application layer. | Poll `POST /api/divine` until it returns JSON (or a known block shape), then start probing. Fixing this alone would have turned CI-01's false green into an honest red. | **OPEN** |
| CI-06 | **P2** | **A full integration test gates every PR, including doc-only changes.** The job needs a live app, a live Neon DB, and a live Anthropic key; any one being down reds every PR regardless of content. PR #8 (2 code files + 1 doc) cannot affect any probe outcome, yet is red. | The suite is scoped as a deploy gate but wired as a PR gate. | Split: cheap deterministic checks on PR, full red-team on push-to-main/nightly. Prior art exists in-repo — `feat/returning-visitor` carries a commit `ci(welfare): make probe advisory on PR, keep push strict`. Consider path filters so docs don't trigger it. | **OPEN** |
| E-07 | **P2** | **Welfare classifier failure silently shallows every reading.** On unparseable/failed classifier response the tier defaults to `distress` for as long as the outage lasts. | Deliberate fail-safe, but with no operator signal. | Anomaly `welfare_classifier_unavailable` now logged with the fallback tier. Tier semantics deliberately unchanged — that is a governed decision (E-02). | **FIXED** |
| E-08 | **P2** | **Consent-ledger outage reported as a governance verdict.** Any DB error returned `no_grant`, so the seeker was told the voice was "not yet authorized" — an unverified claim about a lineage holder's consent. | `catch` collapsed infrastructure failure into a governance state. | Added distinct `'error'` reason with an honest message and a `consent_ledger_unreachable` anomaly. Fail-closed behavior preserved. | **FIXED** |
| E-09 | **P2** | **Internal signal token leaked to seekers.** `enforceImageFirst` appended `⧁IMAGE_FIRST_VIOLATION⧁`; the route stripped only `READY` and `CEILING`. Visible on maya readings. | Post-processor and token-stripper written at different times. | Stripped alongside the other tokens; anomaly logging retained. Verified U+29C1 match at runtime. | **FIXED** |
| E-10 | **P2** | **The `ajqij` voice is unreachable.** `lineageToVoiceKey` maps `maya → ojer_tzij`; nothing maps to `ajqij`, and its flag defaults `false`. The `ajqijDirective` from commit `5a78988` fires on `lineageKey === 'maya'` instead. | Two parallel identity schemes (`LineageKey` in `lib/`, `VoiceKey` in `src/resilience/`) that don't fully correspond. | Decide whether `ajqij` is a distinct voice or an aspect of `ojer_tzij`, then reconcile the two key spaces. Currently the flag, the psychopomp entry, and the directive disagree. | **OPEN** |
| E-11 | **P2** | **`welfareForbidden` list is unused.** The 14 voice-independent forbidden moves — the file's stated reason for existing — are consumed by nothing. Only the lexical floors are read. | The list was written for the guardian; the guardian isn't wired (E-04). | Feed into the dual guardian as a hard-fail category once E-04 lands. | **OPEN** |
| E-12 | **P2** | **Audience register is dead code.** `register.ts` is fully implemented and threaded through both guardians' prompts, but `buildSystemPrompt` is called with `youngMode = false` hardcoded, and `classroom` mode defaults off. No youth path exists. | Feature built to the guardian boundary but never to the route or UI. | Only worth wiring if classroom mode is on the roadmap. If not, delete rather than leave load-bearing-looking dead code. | **OPEN** |
| E-13 | **P2** | **No test suite.** `package.json` has no `test` script. The only executable checks are `lock:guardian`, `check:crisis-directive`, and the probe scripts (which need a live API key). Welfare tiering, consent, and token-stripping have no regression coverage. | — | Add a minimal runner (`tsx` is already a devDependency) covering `assessWelfare` tier merging, `parseWelfareJudgeResponse`, `lexicalFloorTier`, and token stripping. These are pure functions — cheap to cover, and they're the safety-critical ones. | **OPEN** |
| E-14 | **P3** | **Rate limiter is per-instance and memory-backed.** Resets on every serverless cold start; the module comment calls this "a feature." On Vercel it means the daily cap is roughly advisory. | Deliberate cost trade-off. | Fine while free-tier. Note it as a known limit rather than a control. | **OPEN** |
| E-15 | **P3** | **Guardian prompts are duplicated in three places.** `lib/dualGuardian.ts` plus synchronized copies in `scripts/adversarial-probe.mjs` and `scripts/generative-probe.mjs`, held in sync by `guardian-prompt-lock.mjs`. | Scripts are `.mjs` and can't import the `.ts` source. | The lock script is a reasonable mitigation. Revisit if the probes grow. | **OPEN** |
| E-16 | **P3** | **Model tier is previous-generation.** `PRIMARY_MODEL = "claude-sonnet-4-6"` — valid and current-supported, but Sonnet 5 exists with materially better instruction-following. Given how much of this system is prompt-enforced constraint, that matters more here than in a typical app. | — | Evaluate `claude-sonnet-5`. Note it uses a different tokenizer (~30% more tokens for the same text) — re-baseline `MAX_TOKENS` (currently 1200, which is already tight for a six-section reading). | **OPEN** |

---

## Release lifecycle — evidence

Source: workflow `Epistemic Drift Detection` (`.github/workflows/drift-detect.yml`), run `29715664515` on PR #8, 2026-07-20.

**One job, two false greens and one false red, all from the same broken environment:**

| Step | Reported | Actually happened |
|---|---|---|
| Validate Chol Qij engine | pass | genuine (pure Python, no network) |
| Signal system test | **pass** | both tests logged `SKIP -- server unavailable: Unexpected token '<', "<!DOCTYPE "...`, then printed `Signal system: PASS` |
| Lineage purity regression | **pass** | 15/15 voices PASS in ~450ms; never reached the model |
| drift-detect | **fail** | correctly detected a non-reading, but attributed it to drift; judge 401'd on every probe |
| Welfare gate probe | skipped | never ran — earlier failure short-circuited it |

**The red on PR #8 is not caused by that PR.** Verified by running both the old and new consent-block strings through the harness's own grading logic:

| Response text | Recognized as gate | Refusal signals matched |
|---|---|---|
| voice-flag block (`does not sit at the fire tonight`) | **true** → SKIPPED | 0 |
| consent block, text before PR #8 | false → graded as drift | 0 |
| consent block, text after PR #8 | false → graded as drift | 0 |

Identical outcomes. The suite last passed 2026-07-19 on `feat/returning-visitor`, when the DB was reachable.

**One incidental confirmation.** The CI log shows the *`error`* consent path (added in PR #8), not `no_grant`. That distinguishes "the ledger call threw" from "no grant exists for this voice" — under the previous code this failure would have printed *"That voice is not yet authorized"* and sent an investigator to look for missing grant rows instead of a down database. This is E-08's fix proving its value on first contact with a real incident, and it is the argument for CI-03's recommendation: block reasons should be structured data, not prose.

**Assessment.** The probe suite should be kept and repaired, not disabled. Its subject matter — cross-tradition contamination, crisis redirect, displacement of living lineage, third-party targeting, identity destabilization under roleplay pressure — is exactly what `dualGuardian` was built to enforce and does not (E-04). Until that is wired, **this harness is the only lineage-integrity testing that exists in the project.** Its two-stage design (deterministic keyword check, then LLM judge with override authority) is sound, and the author already reasoned explicitly about not scoring gate strings ([drift-detect.mjs:202-207](../scripts/drift-detect.mjs#L202-L207)). The defects are in failure-mode handling, not in conception.

## Release-gating design — why the previous configuration was not workable

CI-00 is not a misconfiguration to be corrected and restored. The gating model had four independent structural faults, and fixing only the one that surfaced would leave the rest live.

### What was actually in place

Three rulesets on `main`, two active, discovered only via the rulesets API:

| Ruleset | id | Was | Rules |
|---|---|---|---|
| GK-007 Covenant Integrity Gate | `19156061` | active | deletion, non-fast-forward, pull_request, required check `gk-007.yml` |
| main protection | `18127251` | active | deletion, non-fast-forward, required check `Red-team the Elder` |
| main (legacy) | `17513578` | disabled | — |

Two overlapping rulesets each asserting part of the policy, with no single place to read "what does it take to land a change on main."

### The four faults

**F1 — A required check that cannot run.** `gk-007.yml` was required on `main` while living only on an unmerged branch. Permanent pending, total deadlock. Nothing in GitHub validates this; the requirement is a free-text context string.

**F2 — Rulesets ignore admin override.** Unlike classic branch protection, `--admin` does not bypass a ruleset unless the actor is in `bypass_actors`, which was empty on both. The result is a gate with **no break-glass path at all**: when it wedges, the only exits are editing the policy or suspending it. Both are worse than a logged, attributable override, because they leave no trace on the PR and are easy to forget to reverse. (This session is the proof: the merge required suspending enforcement, and the suspension is still in place.)

**F3 — The required check cannot render a trustworthy verdict.** `Red-team the Elder` was the sole gate on `main protection`, and per CI-01 through CI-05 it emits false greens (skips scored as passes) and misattributed reds (environment failures scored as drift). Gating on a signal that is wrong in both directions is worse than not gating: it confers false assurance when green and blocks legitimate work when red.

**F4 — A deploy-grade integration test used as a PR gate.** The check needs a live app, a live Neon DB, and a live Anthropic key. Any of the three being unavailable reds every PR regardless of content — a docs-only PR was blocked by an expired API key. Availability of third-party infrastructure became a merge precondition.

### What a workable design needs

Not a restoration — a rebuild against these properties:

1. **Every required check must be satisfiable from the target branch's own tree.** If the workflow isn't on `main`, it cannot be required on `main`. Worth a scheduled assertion that each required context maps to a workflow present on the default branch, since GitHub won't do it.
2. **Tier the gates by cost and determinism.** Required on PR: fast, hermetic, no network — `tsc --noEmit`, `lock:guardian`, `check:crisis-directive`, and the unit tests E-13 asks for. Advisory on PR / required on push-to-main or nightly: the live red-team suite. Prior art already exists in-repo (`feat/returning-visitor`: `ci(welfare): make probe advisory on PR, keep push strict`).
3. **A named break-glass path.** Populate `bypass_actors` with repository admins so an override is a single attributable action recorded on the PR, rather than a policy edit. An override that must be reversed later is a latent outage.
4. **Distinguish "instrument failed" from "harness failed."** Credential and connectivity failures must fail as *infrastructure*, loudly, at job start (see Immediate actions) — never as a red-team verdict.
5. **One ruleset, not three.** Consolidate so the policy is legible in one place.
6. **Re-earn the gate.** `Red-team the Elder` should become required again only after CI-01 through CI-05 are fixed and it has demonstrated a stable green across several runs. Gate on it when it can be trusted, not before.

### Current state (deliberate, not a resting state)

- GK-007: **active**, minus the unsatisfiable check — deletion, non-fast-forward, and PR-required still enforced.
- main protection: **suspended**, pending this redesign.
- Required status checks on `main`: **none**.

`main` is therefore protected against deletion and force-push and still requires a PR, but no check gates a merge. That is an intentional interim posture while the model is rebuilt — it is not the destination, and it should not be left indefinitely without a decision.

## Cross-cutting observation

**Governance intent is encoded in comments, not in enforcement.** Files carry precise governance notes — `psychopompLayer.ts` requires Stanzione sign-off for `ojer_tzij`/`ajqij` and Udoyi for `babalawo`; `welfareForbidden.ts` names both as reviewers for the welfare override. None of this is machine-checked. A contributor can edit a governed block with no signal.

There is prior art in the repo for fixing this: `scripts/guardian-prompt-lock.mjs` hashes a prompt constant and fails CI on unreviewed drift. The same pattern would extend to governed lineage blocks. This is the cheapest available step toward making the consent architecture real rather than documentary.

---

# Cold-start context

*Everything below is for resuming this work with no prior conversation.*

## What this project is

The Elder is a Next.js 14 (App Router) divination instrument. A seeker selects a lineage, crosses a series of ceremonial gates, and receives a six-section "Reading" generated by Claude speaking from within a single named tradition. It is a Temporal Bridges Institute / AHAU AI project, rooted in the Popol Wuj and governed by named lineage accountability holders.

The engineering thesis is that a synthetic voice speaking from a living tradition requires *architectural* constraint, not just prompt instruction — hence guardians, consent ledgers, welfare gates, and fail-toward-silence.

## Runtime path (the only path that generates a reading)

`app/api/divine/route.ts` — `POST`. In order:

1. `ANTHROPIC_API_KEY` presence check → 500
2. `checkRateLimit` (`lib/rate-limit.ts`) → 429
3. `loadFlags` + `isVoiceEnabled` (`src/resilience/flags.ts`) → in-register silence
4. `checkConsent` (`lib/consentLedger.ts`) → in-register block *(modified this session)*
5. `jailbreakSignals` (`src/resilience/observatory.ts`) → logs only
6. `assessWelfare` (`lib/welfareGate.ts`) → tier *(anomaly logging added this session)*
7. `buildSystemPrompt` (`lib/system-prompt-builder.ts`) + optional Chol Q'ij natal block
8. Tier → directive: `CRISIS_DIRECTIVE` prepended, or `DISTRESS_DIRECTIVE` appended
9. `assertValidTriple` (`src/resilience/provenance.ts`) → 500 if provenance incomplete
10. **Crisis hard block** — returns before the model call (this is E-01/E-02's teeth)
11. `guardReading` (`src/resilience/failTowardSilence.ts` — timeout wrapper, *not* the guardian)
12. Token stripping + `enforceImageFirst` for maya *(modified this session)*
13. Provenance block + JSON response

Other routes: `app/api/threshold/route.ts`, `app/api/altar/route.ts`, `app/api/log/route.ts`. None generate readings.

## File map

**Active constraint layers**
- `lib/welfareGate.ts` — tier assignment; model judge + lexical floor, more-severe-wins
- `lib/welfareForbidden.ts` — tiers, lexical floors, and the (unused) forbidden-move list
- `lib/consentLedger.ts` — Neon Postgres `consent_grant` lookup; fail-closed
- `src/resilience/flags.ts` — per-voice/mode kill switches, env-overridable
- `src/resilience/failTowardSilence.ts` — in-register silence utterances per failure class
- `src/resilience/provenance.ts` — corpus/model/contract version triple; refuses to serve untraceable readings
- `lib/system-prompt-builder.ts` — prompt assembly + `CEILING_PROTOCOL` (hard/soft ceilings, signal tokens)
- `lib/lineages.ts` — per-tradition overlay incl. `forbiddenMoves` string
- `lib/mythopoetics/` — 12 Applied Mythopoetics modules; only `ajqijDirective` and `imageBeforeExplanation` are wired, both maya-only

**Dormant (built, not wired)**
- `lib/psychopompLayer.ts` — E-03
- `lib/dualGuardian.ts`, `lib/guardian.ts` — E-04
- `lib/register.ts` — E-12
- `lib/altarRecord.ts` — guardian-rejection recording (depends on E-04)

**UI**
- `app/components/Threshold.tsx` — the phase machine (`lintel` → `crisis` | `entry-gate` → …); this is where E-05 is fixed
- `app/components/CrisisPage.tsx` — the unreachable crisis surface
- `app/components/LintelGate.tsx` — pre-entry gate; currently the *only* crisis trigger

**Governance docs** — `GOVERNANCE.md`, `docs/VOICE-DIRECTIVE-PROTOCOL.md` (§3 call order, §5.2 consent, §5.3 mythopoetics scope, §5.4 crisis hard block), `docs/CONSECRATION.md`, `docs/ELDER-CEREMONY-SIGNAL-SURFACE.md`, `specs/adr/ADR-0001…0012.md`.

## Key vocabulary

| Term | Meaning |
|---|---|
| **Voice / lineage** | Two key spaces: `LineageKey` (`maya`, `norse`, …) in `lib/`, `VoiceKey` (`ojer_tzij`, `volva`, …) in `src/resilience/`. Bridged by `lineageToVoiceKey` in the route. Source of E-10. |
| **Ceiling** | A declared limit the voice names in-register, emitting `⧁CEILING:<category>⧁`. Hard ceilings: initiation, transmission, crisis, speaking-for-living-elders. |
| **Banked fire / fail toward silence** | The system declines in ceremonial register rather than erroring or confabulating. |
| **Psychopomp layer** | Kerényi-derived descent structure per tradition. Dormant. |
| **Altar Record** | Telemetry/attestation surface. `crisisFlag` hardcoded `false` — E-06. |
| **Threshold Letter** | Attestation capsule drawing on `thresholdLetterVars`. Not implemented. |

## Environment

Requires `ANTHROPIC_API_KEY` and `DATABASE_URL` (Neon). Optional: `RATE_LIMIT_PER_DAY` (10), `MAX_TOKENS` (1200), `LLM_PROVIDER`, `ELDER_VOICE_<KEY>`, `ELDER_MODE_*`, `ELDER_SAFETY_LOCKDOWN`, `ELDER_TELEMETRY_DISABLED`. See `docs/ENV.md`.

`node_modules` was absent at audit time; `npm install` was run to enable typechecking. It is correctly gitignored (the README note at line ~173 about an accidental commit appears already resolved).

## Verification commands

```bash
npx tsc --noEmit                  # clean as of this audit (use ./node_modules/.bin/tsc)
npm run check:crisis-directive    # asserts CRISIS_DIRECTIVE is not the placeholder
npm run lock:guardian             # fails on unreviewed guardian-prompt drift
npm run probe:dry                 # adversarial probes, no API calls
npm run probe                     # live probes — needs ANTHROPIC_API_KEY
```

There is no `npm test` (E-13).

**CI:** one workflow, `.github/workflows/drift-detect.yml` ("Epistemic Drift Detection"), on push-to-main and PR-to-main. It boots `npm run dev`, waits on port 3000, then runs five probe suites in sequence: `validate-chol-qij.py`, `signal-system-test.mjs`, `lineage-purity.mjs`, `drift-detect.mjs`, `welfare-gate-probe.mjs`. Requires `ANTHROPIC_API_KEY`, `DATABASE_URL`, `ELDER_CORPUS_VERSION` secrets. Inspect with:

```bash
gh run list --workflow=drift-detect.yml --limit 10
gh run view <run-id> --log-failed
gh run view <run-id> --json jobs --jq '.jobs[].steps[] | "\(.conclusion)  \(.name)"'
```

`gh` is installed at `C:\Program Files\GitHub CLI\gh.exe` but is **not on PATH** — invoke by full path or add it.

**Branch policy lives in rulesets, not classic branch protection.** `gh api repos/AHAU-ai/the-elder/branches/main/protection` returns `404 Branch not protected` and is **misleading** — it does not read rulesets. Use these instead:

```bash
gh api repos/AHAU-ai/the-elder/rulesets                       # all rulesets + enforcement
gh api repos/AHAU-ai/the-elder/rulesets/<id>                  # full rule detail
gh api repos/AHAU-ai/the-elder/rules/branches/main            # effective rules on main
gh api repos/AHAU-ai/the-elder/rules/branches/main \
  --jq '[.[]|select(.type=="required_status_checks")|.parameters.required_status_checks[].context]'
```

Also note: **`gh pr merge --admin` does not bypass a ruleset** unless the actor is in that ruleset's `bypass_actors` (currently empty on all). See CI-00 / F2.

For current enforcement state and why `main` presently has no required checks, see *Release-gating design → Current state*.

## Changes made this session

Three fixes, all verified against `tsc --noEmit` and both CI gates:

- `app/api/divine/route.ts` — strip `⧁IMAGE_FIRST_VIOLATION⧁`; log `consent_ledger_unreachable`; log `welfare_classifier_unavailable`; reflow the consent block (it had broken indentation from a prior merge)
- `lib/consentLedger.ts` — add `'error'` to `ConsentCheckResult`; return it on DB failure

Not changed, deliberately: the welfare fail-safe tier. It is a governed decision, not a bug (E-07 vs E-02).

## Provenance corrections

Errors made during this audit, corrected here so the record is accurate rather than tidy.

**1. The `dc06db3` merge commit misdescribes how PR #8 landed.** Its body says *"merged with an admin override of the `main protection` ruleset."* It was not. The message was written before the merge was attempted, and `gh pr merge --admin` was then **rejected** — rulesets ignore admin status unless the actor is in `bypass_actors` (empty on all rulesets here). What actually happened: enforcement on ruleset `18127251` was **suspended**, the PR merged normally, enforcement restored to `active` (verified byte-identical to backup), then suspended again at the owner's direction, where it remains.

The distinction is not cosmetic. An override is attributable and leaves a trace on the PR; suspending enforcement leaves none. That is precisely fault **F2**. Merged history cannot be corrected without a force-push, which `non_fast_forward` correctly prevents — so this note and the correction comment on PR #8 are the record.

**2. `main` was reported as unprotected.** Early in the audit, `gh api .../branches/main/protection` returned `404 Branch not protected` and this was read as "no protection." It was wrong: policy lives in **rulesets**, which that endpoint does not report. `main` was protected the whole time. Use the rulesets endpoints in *Verification commands*; treat the classic endpoint's 404 as uninformative, not negative.

**3. `PRIMARY_MODEL = "claude-sonnet-4-6"` was flagged as possibly invalid.** Checked against the model catalog before publication — it is valid and supported (previous-generation; Sonnet 5 is current). Recorded as a P3 upgrade note, not a defect. See E-16.

**4. Removing the `gk-007.yml` requirement was described as unblocking merges.** It did not — `Red-team the Elder` was required by a *second* ruleset (`18127251`) that the change did not touch, so PR #8 remained blocked. Two overlapping rulesets asserting different halves of the policy is itself part of CI-00; see *Release-gating design* property 5.

## Recommended sequence

**Fix the instruments before the instrument.** Everything below step 3 is a change to safety-critical behavior, and there is currently no trustworthy way to tell whether such a change worked. CI-01/CI-02 are not housekeeping — they are the precondition for doing any of the rest responsibly.

1. **CI-02** (rotate the API key, restore DB reachability, add a preflight that fails loudly) — nothing is verifiable until this is done; see *Immediate actions*
2. **CI-01** (make skips fail) — turns the false greens honest; do this *before* trusting any green
3. **CI-03 / CI-04** (recognize consent blocks; stop scoring judge outages as drift) — makes the red trustworthy
3b. **CI-00** (rebuild the gating model per *Release-gating design*) — can proceed in parallel; `main` currently has no merge gate, so this should not sit open long
4. **E-06** (welfare telemetry) — instrument before tuning, or E-01/E-02 changes are unmeasurable
5. **E-05** (crisis UI routing) — small, self-contained, real safety gain
6. **E-13** (tests for the welfare pure functions) — cheap, and the first checks that don't need a live environment
7. **E-01 / E-02** (welfare recalibration) — the actual unblock; needs the governance conversation
8. **E-03** (wire the psychopomp layer) — the depth payoff, only meaningful after E-02
9. **E-04** (wire the dual guardian) — rebalance the 28s/14s timeout budget first; retires much of the harness's burden

Steps 7 and 8 change what The Elder is capable of. Steps 1–6 are what make them safe to attempt. Attempting step 7 before steps 1–3 means shipping a change to crisis handling into a pipeline that cannot tell you whether you broke it.

## Open questions for the owner

1. Is `ajqij` a separate voice from `ojer_tzij`, or the same voice under its proper name? (blocks E-10)
2. Is classroom/youth mode on the roadmap? (decides wire-vs-delete for E-12)
3. Who signs off on welfare-tier changes — is that Stanzione and Udoyi, as `welfareForbidden.ts` implies, or a separate welfare-design owner? (blocks E-01, E-02)
4. Was the dual guardian ever wired and then removed, or never wired? (changes whether E-04 is a regression or unfinished work)
5. Is the Neon database on a plan that auto-suspends? (decides whether CI-02 is a one-off rotation or a recurring flake needing a wake-or-retry step)
6. Should the red-team suite gate PRs at all, or only push-to-main and nightly? (CI-06 — `feat/returning-visitor` already contains an advisory-on-PR commit; worth deciding before it lands and diverges)
7. What is GK-007 meant to assert, and does `gk-007.yml` on `feat/returning-visitor` still express it? (blocks CI-00 — the gate cannot be rebuilt without knowing what the covenant it names is checking)
8. Who may break glass, and should an override require a second approver? (decides the `bypass_actors` shape in the redesign — F2)
