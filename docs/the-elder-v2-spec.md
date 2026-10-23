# The Elder — Generation 2 Architecture (V2.0)

**Status:** Proposal. Not ratified. No sign-off entered, technical or lineage.
**Owner:** To be assigned (see `docs/README.md`: a "not stated" owner is a request to assign one). Proposed for Jesse Barber (technical) and Vincent James Stanzione (lineage), per `CONSOLIDATION.md`.
**Authorship:** Drafted by Claude in a Claude Code session at Jesse Barber's request, then attacked and revised in the same session (§10). No human has reviewed it.
**Base commit:** `e47d840` on `main`. **Written:** 2026-10-10.
**Convention:** Files named below that do not exist yet are marked *(new)*.
**Verification:** Every file path named in backticks was checked against the base commit. Behavioral claims about the repo were checked by reading the code or the live GitHub ruleset on 2026-10-10; §13 lists exactly what was and was not checked.

**Naming note.** Three "v2" artifacts already exist (`docs/elder-ui-v2-architecture.md`, `the-elder-threshold-v2-witnessed-attestation.md`, and "Makeover v2 Appendix B" referenced in `config/returning-features.ts`). To avoid a fourth collision, this document calls the release **Generation 2 (G2)**. "V2.0" and "G2.0.0" mean the same thing here.

---

## 1. Thesis and boundary

V2.0 is not a bigger Elder. It is an Elder that can **tend itself** without being able to **rule itself**.

It adds three things, in this order of dependency:

1. **An infrastructure floor** that makes silent failure impossible to miss and unauthorized change impossible to merge (§7). Without this, the other two are unsafe.
2. **A generation system**: every release becomes a named, hash-pinned, human-ratified, reversible thing, and every reading says which generation produced it (§6).
3. **A Tending Loop**: a bounded agent that senses what is wrong or improvable, runs experiments on synthetic seekers in an isolated lane, and *proposes* changes as pull requests that humans accept or refuse (§5).

The boundary, stated once and enforced everywhere below:

> The loop may propose. It may not merge, deploy, promote, flip a flag, change a secret, edit a ruleset, sign for a human, or touch the sealed core. A generation is a release of this repository, not a self-replicating process.

"Growing itself" in V2.0 means: the *rate at which problems are found, tested, and fixed* compounds, under a ratification discipline that does not weaken as the rate rises. It does not mean autonomy over voices, lineage, safety, or consent. The project's own founding text rules that out (`GOVERNANCE.md` §II: no future version changes what an AI cannot be).

---

## 2. The pot of gold: what success looks like

**For the seeker.** Nothing about the fire becomes stranger. It becomes steadier: readings arrive when the fire is lit, a broken dependency is named and fixed in minutes instead of weeks, and no change to a voice has ever reached them that a human accountable for that lineage did not read first. Every reading carries the name of the generation that spoke it.

**For the maintainers.** Monday morning there is one digest: what the Tender sensed, what it tested, what it proposes, what it learned from last week's rejections. Each proposal arrives with machine-generated evidence, a blast-radius statement, and a one-command rollback. Accepting a good one takes minutes. Refusing a bad one teaches the loop not to ask again for 30 days. Nothing happened overnight that nobody saw.

**For the lineage holders.** A change that touches their field cannot ship without them, cannot be optimized past them, and can be withdrawn by one statement. The loop cannot count a typed or relayed signature as theirs.

**For the project.** Each generation is a line in an append-only ledger: what changed, why, on what evidence, who ratified it, and how to go back. The ADR discipline (`specs/adr/README.md`) extended from decisions to releases. The project stops having "a build gate for sacred text and no build gate for its own decisions" (v3 audit, quoted there) and also stops having one for its own releases.

---

## 3. Ground truth at `e47d840`

What the repo actually is today, including the parts that are not flattering. V2.0 is designed against these facts, not against the intended architecture.

| # | Fact | Evidence | Why it matters to V2.0 |
|---|---|---|---|
| F1 | The repo is **public** and owned by a **user account**, not an organization. | `gh api repos/AHAU-ai/the-elder`: `owner.type = User`, `visibility = public` | No teams exist. Probes, prompts and governance files are readable by anyone, including anything the loop optimizes against. |
| F2 | The active ruleset (*GK-007 Covenant Integrity Gate*) requires a PR but **0 approvals**, has **code-owner review off**, and has one bypass actor with mode **always**. Required checks: `gk-007-static`, `gk-007-probes`. | Live API read, 2026-10-10 | CODEOWNERS is currently advisory. Any credential belonging to the bypass actor can merge anything. |
| F3 | Every sealed path in CODEOWNERS names the same single handle. | `.github/CODEOWNERS` | Even with code-owner review switched on, one person cannot be their own second reviewer. |
| F4 | **No git tags exist.** `CHANGELOG.ceremonial.md` Entry 001 declared "No new features to main until v1.0-consolidated tag." The tag was never created and no entry lifts the freeze. | `gh api …/tags` returns empty; `CHANGELOG.ceremonial.md:23` | The project has been shipping features under a freeze it never formally exited. V2.0 must start by deciding, not by ignoring. |
| F5 | CI jobs reach the **production** database. A dev-only ingest has already written to production once (2026-09-10). | `.github/workflows/drift-detect.yml` comments; `tests/support/devDatabaseGuard.ts` header | Synthetic probe traffic lands in the tables any learning signal would read. |
| F6 | `anomaly_record` is written through the public `/api/log` route. The `_source` field is self-declared. `divine/route.ts` calls that route over HTTP. The table held **0 rows from 2026-06-10 to 2026-08-20** because of a relative-URL bug nobody noticed. **Forgery confirmed:** on 2026-10-10 an unauthenticated `POST /api/log` with `_source:"divine_route"` against a local dev server was accepted and recorded with `source: "divine_route"`. | `app/api/log/route.ts`; comment block above `logAnomaly` in `app/api/divine/route.ts`; local test, §13 | The "what surprised us" signal is both forgeable and was silently dead for 2.5 months. |
| F7 | Flags are read from environment variables per request. `flags.ts` says Edge Config *should* back them in production; `@vercel/edge-config` is not a dependency. | `src/resilience/flags.ts`; `package.json` | Kill-switch latency today is "change an env var and redeploy". |
| F8 | `ANTHROPIC_FALLBACK_MODEL` and `resolveModel()` are referenced by **nothing** outside `lib/model.config.ts`. | `grep` across repo, 2026-10-10 | There is no model fallback. `CONSOLIDATION.md` §3.4 promised one that was "exercised". Single dependency on one pinned model string. |
| F9 | A rotated API key returned HTTP 401 on every judge call and CI scored it as drift; the pipeline "was verifying nothing at all" for a time. | `docs/technical-strategic-and-ux-audit.md` CI-02, CI-04 | Infra failure disguised as a verdict is a demonstrated failure mode, partly fixed by preflights. |
| F10 | `app/api/divine/route.ts` is **1,455 lines** (`docs/backend-profile.md` said ~1,200 on 2026-09-23). | `wc -l` | The center of gravity is growing and is the hardest file to reason about or test per stage. |
| F11 | The consent ledger is informational. A voice stops only when its flag is switched off. Several voices are live with placeholder grants. | `GOVERNANCE.md` Amendment 1; `src/resilience/flags.ts` comments | A generation system must snapshot authorization honestly, not imply a gate that does not exist. |
| F12 | `GOVERNANCE.md`'s attestation block records the technical name as entered by Claude at Jesse Barber's direction and the lineage sign-off as relayed, not signed by the lineage holder. Amendment 2 says "no sign-off entered". | `GOVERNANCE.md` §Attestation, Amendment 2 | The file is honest about it. V2.0 turns that honesty into a rule: relayed and tool-entered sign-offs are recorded as such and do not satisfy a ratification gate. |
| F13 | One scheduled job exists (`deliver-threshold-letters`). There is **no synthetic reading canary**. | `vercel.json`; `app/api/cron/` | Production health is inferred from user reports and CI, not measured. |
| F14 | Guardian judge prompts are hash-locked against the probe suite. The lockfile lives at `scripts/.guardian-prompts.lock`, but `.github/CODEOWNERS` lists `/.guardian-prompts.lock` (repo root), a path that matches no file. | `scripts/guardian-prompt-lock.mjs` (verified passing 2026-10-10); `.github/CODEOWNERS` | An existing change-control V2.0 reuses. Also proof that a sealed-path list can silently rot (AR-09). |
| F15 | Every reading already stamps `_provenance.contractVersion` (a SHA-256 over contract text). | `src/resilience/provenance.ts` | The hook where a generation stamp attaches. |
| F16 | The red-team probes live in the public repo (`scripts/drift-detect.mjs`, `scripts/welfare-gate-probes.data.mjs`). | Repo tree | An optimizer that sees the exam can overfit to it. |
| F17 | `docs/README.md` marks most documents "paths only" verified. Behavioral claims are mostly unverified. | `docs/README.md` | Docs can lie quietly. A loop that reads docs as ground truth would learn the lie. |
| F18 | `docs/axis-3-forward-architecture.md` excludes cross-seeker aggregation and autonomous trajectory-writing "on purpose". | That file, "What this doc deliberately does not propose" | A hard constraint on what the loop may learn from (§5.3). |
| F19 | `drift-detect.yml` runs a plain `npm ci` (lifecycle scripts enabled) in a job whose environment carries `ANTHROPIC_API_KEY` and the production `DATABASE_URL`. `figure-continuity.yml` has one plain `npm ci` too. `gk-007.yml` correctly uses `--ignore-scripts`. | `.github/workflows/drift-detect.yml:15-38`; `figure-continuity.yml:181`; `gk-007.yml:53,118` | Any dependency change that reaches a secret-bearing job can run code with those secrets. Matters most for loop-authored dependency bumps (AR-04). |
| F20 | The required gate `gk-007.yml` runs Node 18; the other workflows run Node 22; the installed Next.js (16.3.1) declares `engines.node >=20.9.0`. `gk-007` never starts Next, so it passes, but it verifies on a runtime production never uses. | `.github/workflows/*.yml`; `node_modules/next/package.json` | Low severity; caught by the H3 parity check. |

**Strengths to build on, not replace:** the "infra, not a verdict" preflight pattern in both workflows; best-of-N flake filing; append-only ADRs; the `tester_account` table (migration 024); fail-toward-restrictive welfare gate; `check-schema-drift`, `check-unwired-exports`, `guardian-prompt-lock`; telemetry forced off in classroom mode (`telemetryAllowed`).

---

## 4. Invariants

Rules that every part of V2.0 must satisfy. If a later design violates one, the design is wrong, not the rule.

| ID | Invariant |
|---|---|
| I1 | **Propose, never promote.** The loop opens PRs and issues. It cannot merge, deploy, promote, flip a flag, write an env var, edit a ruleset, or create a credential, repo, or deployment. |
| I2 | **The sealed core is out of reach** of the loop, by path and by credential (§5.2). |
| I3 | **Lineage purity is a veto, not a metric.** No improvement in any score can be traded against a lineage-purity failure. |
| I4 | **Safety paths are never experiments.** Welfare, crisis, guardian, and age-register behavior are never canaried, ablated live, or A/B tested on real seekers. |
| I5 | **A seeker's words are not data for the loop.** It never reads reading text, journals, letters, reshape text, or dedications, and never replays a real session. Experiments use synthetic seekers only. |
| I6 | **Single-seeker memory scope stays** (Axis 3 exclusion) unless a ratified decision changes it (D3). |
| I7 | **Evidence before assertion.** Every proposal carries machine-generated evidence (hashes, run URLs, metric deltas). The loop's own prose is never evidence. |
| I8 | **The judge is not the judged.** Evaluators, probes, budgets and gates sit outside anything a proposal can modify, or are held out entirely. The exam that gates a change is authored by humans, never by the loop. Held-out results return to the loop as a pass/fail veto bit only, never per-probe detail. |
| I9 | **No request-path dependency on the loop.** Every `/api/*` route works with the loop fully disabled or deleted. |
| I10 | **Every reading names its generation, and every generation can be rolled back without data loss.** |
| I11 | **Silence may be the right outcome (ADR-0009). Invisible silence is never acceptable.** Operators must see every silence and its cause. |
| I12 | **Absence of data is a signal.** Every sense has a freshness check. "No anomalies" with no heartbeat means "blind". |
| I13 | **Humans sign with their own hands.** A ratification gate accepts a signature or GitHub approval from the named human's own identity. Relayed or tool-entered sign-offs are recorded as `relayed` and satisfy nothing. |
| I14 | **No actor enforces its own limits.** Every limit on the loop is enforced by something the loop cannot edit, run, or influence: a ruleset, a required check running from the default branch, a credential scope. The loop's own tripwire is defense in depth, never the control. |

---

## 5. The Tending Loop

### 5.1 Anatomy

```
 SENSES (read-only, content-free, trusted)         HUMAN INPUT
 CI results · flake log · signed anomaly shapes    maintainer issues
 reading_metric counters · repo scans · model      lineage-holder notes
 lifecycle probe · control-plane checker                   |
        |                                                  |
        +----------------------+---------------------------+
                               v
                      STRATEGY LIBRARY (§5.6)
          hypothesis · signal · experiment · class ceiling · kill criterion
                               |
                               v
                 EXPERIMENT LANE (isolated)
     Neon lane branch · Vercel preview · synthetic seekers only
     frozen suite + held-out suite · paired against parent generation
                               |
                               v
                     PROPOSAL (PR or issue)
        bot identity, no bypass · evidence.json · class label · rollback plan
                               |
                               v
   GATES:  sealed-path check -> full suite + vetoes -> HUMAN MERGE -> generation pipeline (§6)
```

The loop is a scheduled workflow (`.github/workflows/tending.yml` *(new)*, itself sealed) running an agent. Production never calls it (I9). Strategy files live in `tending/strategies/` *(new)*.

### 5.2 Change classes

| Class | What it covers | Loop may | Required to land |
|---|---|---|---|
| **0 — Sealed** | `src/resilience/**`, `lib/dualGuardian.ts`, `scripts/.guardian-prompts.lock`, `lib/welfareGate.ts`, `lib/welfareForbidden.ts`, the safety-floor carve-out (H14), `lib/consentLedger.ts`, `lib/traditions.ts`, `lib/narrativeRegister.ts`, `lib/compliance/**`, `governance/**`, `attestations/**`, `GOVERNANCE.md`, `specs/adr/**`, `.github/**`, `vercel.json`, `config/returning-features.ts`, `tending/**` *(new)*, `generations/**` ratification fields *(new)*, **identity and money:** `lib/auth.ts`, `app/api/auth/**`, `app/api/admin/**`, `lib/tierEntitlement.ts`, `lib/tierLedger.ts`, `middleware.ts`, and any future billing or webhook route. **Plus, computed:** every file transitively executed by a job that holds a secret (probe and eval harnesses, the `scripts` block of `package.json`). H3's checker derives this set from the workflows so it cannot rot. | **Open an issue only.** | Two distinct humans, one of them non-author, plus a public ceremonial changelog entry. **Interim, until D2 yields a second human:** the author, a 24-hour cooling-off period, and a public changelog entry. This is a weaker control and is labeled as such wherever it is used. |
| **1 — Ratified** | Voice prompt bodies, system-prompt narrative clauses, reading-shape and segmented-delivery text, any seeker-facing copy, returning/figure/trajectory behavior, entitlements and pricing, migrations, **`package.json` dependencies and `package-lock.json`** | Draft a PR | A named human merges. A lineage reviewer signs for anything touching a voice or lineage field. Never canaried to real seekers (§6.3). |
| **2 — Proposed** | Work that changes **no words said to a seeker, nothing stored, nothing gated, and no data flow**: performance with output-equivalence evidence, tests, doc corrections, refactors with characterization tests, ambient audio/visual polish | Draft a PR | Full suite green, evidence attached, one human merge |

Path-based sealing only works if sealed code lives in sealed paths. Today the ceiling and out-of-scope blocks share a file with ordinary clauses (`lib/system-prompt-builder.ts`). H14 moves them.

**Enforcement is external (I14).** The sealed list is enforced by four things the loop can neither edit nor run: (1) a required `sealed-paths` check *(new)* that runs from the **default branch's** workflow, reads only the PR's changed-file list, executes no PR code, and holds no secrets; (2) code-owner review on sealed paths; (3) the bot's credential lacks the `workflows` scope and may push only to `tending/**`; (4) secret-bearing jobs wait on `sealed-paths` and on an environment approval. A prompt-injected or compromised loop cannot talk its way past any of them.

### 5.3 Data diet

| Allowed | Conditions | Forbidden |
|---|---|---|
| CI and probe results; flake log; repo scans; model-lifecycle checks | — | Seeker text of any kind (readings, journals, letters, reshape text, dedications, free-text inquiry) |
| Server-signed anomaly **shapes** (kind, voice, bucket, never text) | Only after H2 ships, read through a content-free view that filters `traffic_class = real`. Forgeable client posts never count (F6) | Per-seeker profiles or any cross-seeker pooling for personalization |
| Latency, cost, token, silence-cause counters (`reading_metric`) | No text, user, or session columns; hour-bucketed timestamps; excluded for classroom and child-register sessions | Emails, IPs, device identifiers |
| Maintainer- and lineage-holder-authored notes and issues | Only events whose `author_association` is `OWNER`, `MEMBER` or `COLLABORATOR`; bodies are data, never instructions; PR-comment commands are disabled | Anything from classroom mode (telemetry is forced off) or minors' sessions |
| A seeker's *own* landed / did-not-land signals steering *that seeker's* next reading | Already exists (`lib/feedbackLedger.ts`); not a loop input | Traffic not tagged `synthetic` by H1 |
| *(Conditional)* Content-free cross-seeker counters, e.g. weekly landed-rate per lineage | **Off by default.** Needs D3 ratified, a k≥50 floor, updated consent copy, flags a human to review, never edits voice content | Web pages, search results, or repo content treated as instructions |

### 5.4 Identity and authority

- **Machine identity.** A dedicated GitHub App or machine user (`elder-tender`). Never the owner's token, because the owner's credential is the bypass actor today (F2).
- **Permissions.** `pull_requests: write`, `issues: write`, `checks: read`. No `workflows` scope, no admin, never in any bypass list. A ruleset covering every branch **except** `tending/**` restricts creation and update to humans, so the bot can push only to `tending/**` (H3).
- **Secrets.** Its own Anthropic key (`ANTHROPIC_API_KEY_TENDING`) with its own spend cap. No Vercel token. No write credential to any production database.
- **Database access.** Two credentials, no more. (1) A **lane-branch** connection string with full rights on the lane branch only. (2) A **read-only Postgres role** (`tending_ro` *(new)*) on production, granted `SELECT` on exactly two content-free views: the signed-anomaly view and the `reading_metric` view. No grant on any user-bearing table.
- **Runtime.** A GitHub Actions environment (`tending-lane`) with required reviewers on first run and on any change to its workflow, and an egress allowlist.

### 5.5 Brakes

| Brake | Rule |
|---|---|
| B1 | At most 3 open tending PRs. |
| B2 | One strategy per PR; diff capped at 400 changed lines. |
| B3 | Per-run token cap and a weekly spend cap enforced at the key, not by the loop's own accounting. |
| B4 | A rejected (strategy, target) pair is blocked for 30 days. |
| B5 | **Tripwire (defense in depth only, I14).** Any attempted write to a Class 0 path, any edit to `tending/**` outside the strategy-add template, or any call to a forbidden capability aborts the run, sets `TENDING_ENABLED=false` (a repo variable only a human can re-enable), and opens a `tending-incident` issue. The real enforcement is external (§5.2). |
| B6 | Weekly digest issue: sensed, tested, proposed, rejected-and-why. |
| B7 | Random audit: every 5th merged proposal gets a second human review after the fact. |
| B8 | **Earned autonomy is out of scope for V2.0.** Auto-merge of any class is not offered. Revisiting it requires an ADR after at least 12 weeks and zero incidents (D9). |
| B9 | **Backlog brake.** The loop pauses when more than 5 of its proposals are unreviewed, or when any is older than 14 days. A tending loop that outpaces its reviewers is the failure, not the goal. |
| B10 | **No strategy may use seeker-reported resonance (landed / did-not-land) as an objective.** Optimizing for resonance is how traditions get blended into whatever pleases (the anti-pattern `GOVERNANCE.md` names). Resonance may be *reported* to humans, never *optimized*. |

### 5.6 Strategy library

Each strategy is a file under `tending/strategies/` with a hypothesis, a sense, an experiment, a ship gate, a kill criterion, and a **class ceiling the loop cannot raise**.

| ID | Hypothesis | Sense | Experiment | Ceiling |
|---|---|---|---|---|
| S1 | Docs drift from code (F17). | Doc scan | Extract backticked paths and tagged claims; verify against the tree; propose doc fixes; compute the `docs/README.md` "last verified" column instead of hand-typing it | 2 |
| S2 | New jailbreak shapes appear that the probes miss. | Signed anomaly shapes (post-H2) | Generate candidate probes from *shapes*, never from seeker text; route to the **held-out** set via human review | Issue only |
| S3 | Flaky probes hide a real, nondeterministic weakness. | `flaky-probes.jsonl` issues | Classify variance vs. prompt weakness; draft a clause fix | 1 |
| S4 | Dead and unwired code adds risk. | `check-unwired-exports` | Remove or wire, with characterization tests | 2 |
| S5 | Some pipeline stages can overlap or cache without changing output. | `reading_metric` stage latencies | Paired output-equivalence test on synthetic seekers, then propose. The welfare gate still runs before generation. | 2 |
| S6 | Some system-prompt clauses carry no measurable load, while interactions between ~8 sources add risk. | Paired eval | Ablate non-sealed clauses one at a time on synthetic seekers; report marginal effect on shape, purity, and register checks; propose trims | 1 |
| S7 | The pinned model will be deprecated or surpassed. | Model-lifecycle probe | Shadow-run a candidate model on frozen + held-out suites; emit a **generation candidate manifest**. Promotion is a ratified event. | 1 |
| S8 | Ambient experience has rough edges (autoplay policy, loudness, reduced motion, mobile Safari). | Manual and automated audio/visual checks | Normalize loudness across the hearth bus; honor `prefers-reduced-motion`; verify resume-on-gesture. The hearth crackle rework is the template: no text changes, no safety path touched. | 2 |
| S9 | Dependencies carry known vulnerabilities, and this Next.js has breaking changes (`AGENTS.md`). | `npm audit`, release notes | Bumps with build and suite; the agent reads `node_modules/next/dist/docs/` before touching framework code. Any lockfile change is **Class 1** (a human reads the resolved-package diff), because a dependency change can run code in a secret-bearing job (F19, AR-04). | 1 |
| S10 | The most important learning about seekers does not belong in telemetry. | Maintainer-authored interview notes | Synthesize **maintainer-written** notes into proposals. No data pipeline from seekers. | 1 |
| S11 | Failure handling works on paper only. | Game-day in the lane | Kill the lane DB, revoke the lane key, slow the model, flip flags; assert silence is *visible* (I11) and alarms fire | 2 |
| S12 | Flags, signoffs, voice evidence, and the withdrawal list disagree. | Governance cross-check | Compare `flags.ts` ↔ `governance/voice-evidence.json` ↔ `governance/signoffs/` ↔ withdrawal records; **file an issue** on any mismatch | Issue only |

---

## 6. Generations

### 6.1 What a generation is

A **generation** is a numbered, immutable, hash-pinned release of the whole instrument: `G<major>.<minor>.<patch>`.

| Part | Meaning | Who must ratify |
|---|---|---|
| Major | Voice text, ceiling, register tiers, a new inference mechanism, a model change | Lineage reviewer for any voice or lineage change, plus the technical owner and a second human |
| Minor | Seeker-visible behavior changes inside already-ratified bounds (Class 1) | A named human (not the author) |
| Patch | Changes no words said, nothing stored, nothing gated, no data flow (Class 2) | One human merge |

**G1.0.0** is retroactive: the baseline manifest for the commit at which the consolidation freeze is formally exited (D1). It attests only what the repo actually enforces (F11, F12). **G2.0.0** is the generation that ships the infrastructure floor, the generation system, and the Tending Loop in *shadow mode* (§8). Loop-authored proposals begin landing in G2.x.

### 6.2 The manifest

Each generation has `generations/G<version>.json`, written by a script and countersigned by humans:

```json
{
  "generation": "2.0.0",
  "parent": "1.0.0",
  "commit": "<sha>",
  "genome": {
    "voices": { "<voiceKey>": "<sha256 of voice spec bytes>" },
    "systemPromptClauses": "<sha256>",
    "safetyFloor": {
      "welfareGate": "<sha256>",
      "guardianLock": "<contents of .guardian-prompts.lock>",
      "ceiling": "<sha256>"
    },
    "models": { "primary": "<pinned id>", "welfare": "<pinned id>", "fallback": null },
    "flagDefaults": "<sha256>",
    "evalSuites": { "frozen": "<sha256>", "heldOutDigest": "<sha256 of private manifest>" },
    "schemaHead": "030_figure_mapping",
    "contractVersion": "<existing provenance CONTRACT_HASH>"
  },
  "voiceAuthorization": {
    "<voiceKey>": { "flagDefault": true, "namedBearerOnRecord": false, "withdrawalOnRecord": false }
  },
  "evidence": {
    "run": "<workflow run url>",
    "pairedVsParent": { "...": "..." },
    "vetoes": { "lineagePurity": "pass", "welfareProbes": "pass", "crisisDirective": "pass", "guardianLock": "pass" }
  },
  "ratifications": [
    { "role": "technical", "signer": "<own GitHub login>", "method": "ed25519|github-approval", "at": "<iso>", "status": "signed|relayed|pending" }
  ],
  "status": "candidate|ratified|live|retired|rolled-back"
}
```

`voiceAuthorization` is an honest snapshot, not a gate (F11). It is also what a fork carries under `docs/fork-contract.md`.

`_provenance` gains a `generation` field alongside `contractVersion` (F15). Because `src/resilience/` is sealed, that change is a human-authored Class 0 PR.

### 6.3 Life cycle

| Stage | What happens | Gate |
|---|---|---|
| **Conception** | A human or the loop opens `gen/<version>` with a changelist | Class label present; no Class 0 diff unless humans authored it |
| **Gestation** | Lane: Neon branch + Vercel preview. The human-authored **frozen** suite and the **held-out** suite run, paired against the parent generation. The held-out suite runs at most 3 times per candidate and returns only a pass/fail bit to the loop (I8). LLM-generated "exploratory" seekers may inform a proposal but never gate it. | **Vetoes** (any failure ends gestation): lineage purity, welfare probes, crisis directive, guardian lock, migration compatibility (the parent must still boot against the child's schema). Deterministic checks (shape, length, term lists) run before any LLM judge; judged output is passed to the judge as quoted data. |
| **Ratification** | Humans review the manifest and the evidence | Per §6.1. `relayed` or `pending` signatures do not pass (I13) |
| **Birth** | Promote. Stamp `_provenance.generation` | Parent deployment kept warm |
| **Maturity** | 7-day watch window: canary, silence-rate SLO, cost and latency budgets | Any breach sets status `rolled-back` and rolls back |
| **Retirement** | Parent kept warm 14 days, then archived. Manifest kept forever | Append-only ledger entry; human-written ceremonial changelog entry |

**Exposure rule.** A reading cannot be un-said. So **Class 1 changes never canary on real seekers**: they go to `tester_account` holders first, then to everyone only after ratification. Only Class 2 patches may roll out by percentage. Welfare, crisis, guardian and age-register paths are never staged (I4).

### 6.4 Rollback

1. Instant rollback to the parent deployment (Vercel supports this natively).
2. A withdrawn voice stays off across rollbacks: withdrawals are honored by a compiled deny list in `governance/` (H4), so a cold start cannot resurrect a voice.
3. Migrations follow **expand / contract**: a column is never dropped in the same generation that stops using it. Gestation proves rollback by booting the parent against the child's schema.
4. Rollback is drilled quarterly, not first attempted in an incident.

### 6.5 Emergency path

The ceremony must not block a security patch or a kill switch.

- **Kill switches are not generations.** Flipping a voice off or setting `ELDER_SAFETY_LOCKDOWN` happens immediately, by any maintainer, and is logged with who, when, and why.
- **Break-glass fixes** merge through the bypass-with-PR route (H3 changes bypass from `always` to `pull_request`, so a PR still exists), labeled `emergency`. Within 24 hours the fix gets a retroactive manifest and a written postmortem. An emergency generation that lacks either is flagged by the daily control-plane check.
- The loop cannot invoke either path (I1).

### 6.6 Generations and forks

A generation is **not** a fork. `docs/fork-contract.md` applies unchanged: a fork carries the attestation capsule, authorization state, safety floor and corpus pointer; it does not re-attest, and it does not write back here. The loop cannot create repositories, deployments, or credentials, so it cannot spawn a fork by any route (I1).

---

## 7. Infrastructure floor

All items are Class 0 or touch Class 0, so **humans author them**. The loop may file issues against them but not fix them.

| ID | Workstream | Today (evidence) | Acceptance test |
|---|---|---|---|
| **H1** | **CI isolation.** CI uses a dedicated Neon branch, never the production URL. Extend `devDatabaseGuard` to every workflow preflight. Add a `traffic_class` (`real`/`synthetic`/`canary`) on telemetry-bearing writes. The Vercel **Preview** and **Development** environments get their own `DATABASE_URL` pointing at the lane branch; the production URL exists only in the Production scope (a preview built from `gen/*` must never write to production). | F5: CI reaches production; one dev ingest already did | Every workflow's `DATABASE_URL` host is absent from `KNOWN_PRODUCTION_HOSTS`. Preview-scope variables inspected and clean. Zero synthetic rows in production tables for 30 days. |
| **H2** | **Telemetry integrity.** `divine` records anomalies in-process, using the framework's after-response hook so latency is unchanged (confirm the API in `node_modules/next/dist/docs/`, per `AGENTS.md`). `/api/log` writes only a separate `client_beacon` table. No public path can write `anomaly_record`. | F6 | Integration test: `POST /api/log {kind:"near_miss", _source:"divine_route"}` leaves `anomaly_record` unchanged. |
| **H3** | **Control plane.** Ruleset: ≥1 approval, code-owner review **on** for sealed paths, `require_last_push_approval`, bypass mode `pull_request` (not `always`), required checks that exist as workflows on the default branch (the CI-00 failure class), required `sealed-paths` check *(new)* from the default branch's workflow (§5.2), and a second ruleset restricting branch creation and update outside `tending/**` to humans. Secret-bearing jobs on same-repo PRs run in an environment with required reviewers (RT-1 in `CODEOWNERS`). A daily `scripts/check-control-plane.mjs` *(new)* asserts all of it, plus: every `CODEOWNERS` pattern matches at least one tracked file (AR-09); the computed sealed set equals the declared one; Node versions agree across workflows (F20); every Class 0 emergency has its retro manifest. | F2, F3, F14, F20, `CODEOWNERS` header | The checker is green for 14 consecutive days and fails loudly when any setting is reverted or any pattern goes dead. |
| **H4** | **Flag plane.** Flags in an external store with a ≤60 s propagation target, a last-known-good cache, and an audit trail. A compiled `governance/withdrawn.json` *(new)* deny list overrides the store on cold start. This is consistent with `GOVERNANCE.md` Amendment 1: withdrawal is honored by flag plus signoff, not by the ledger. | F7 | Drill: flipping a voice off disables it in production within 60 s, measured. A cold start with the store unreachable does not re-enable a withdrawn voice. |
| **H5** | **Canary and SLOs.** A synthetic reading every 15 minutes via a tester account held at the `seeker` tier (so nothing persists; `traffic_class=canary`), asserting: not silent, provenance present, latency in budget. A per-day cost cap applies to the canary itself. Silence-rate SLO with operator alerts. Freshness checks on every sense (I12). If the hosting plan limits cron frequency, run it from a scheduled Actions workflow. | F6, F9, F13 | Induced key revocation is detected in <20 minutes in a drill. Every sense has a "no data in N hours" alarm. |
| **H6** | **Model lifecycle.** Decide the fallback honestly: either wire it (labeled in provenance, allowed only if it passes lineage-purity in gestation, D5) or delete the dead scaffolding and its claim. Scheduled check that pinned model IDs still resolve. The welfare model never silently changes. | F8 | Chaos test: blocking the primary model yields a labeled fallback reading or a named silence, never an unlabeled one. |
| **H7** | **Data durability.** Verify the point-in-time-recovery window. Quarterly restore drill into a Neon branch. A `schema_migration` ledger with checksums replacing ad hoc `migrate-*.mjs` runs. `check-schema-drift` strict on all paths. | `backend-profile.md`: 25+ hand-run migrations | A drill restores to a branch and passes the suite. A tampered migration fails its checksum. |
| **H8** | **Key hygiene.** Separate Anthropic keys for production, CI, and the Tender, each with its own spend cap. Rotation runbook. Secret scanning in CI (the repo is public). **`npm ci --ignore-scripts` in every workflow**, and secrets scoped to the single step that needs them, never job-level `env`. | F9, F1, F19 | A leaked-key tabletop shows blast radius bounded to one key's cap. A test dependency with a malicious `postinstall` cannot read any secret in CI. |
| **H9** | **Pipeline modularization.** Split `divine/route.ts` into typed stages behind one `finalize()` that stamps provenance (and generation) on every terminal branch. Characterization tests first, no behavior change. | F10; the provenance-drift bug in `backend-profile.md` | Test: no response leaves the divine path except through `finalize()`. Byte-identical output on a fixed synthetic corpus before and after. |
| **H10** | **Reading metrics.** `reading_metric`: generation, lineage, tier bucket, register bucket, stage latencies, guardian outcome, silence cause, token counts. No text, no user or session id, hour-bucketed timestamps, and no dashboard slice with fewer than k=20 rows (a low-volume system re-identifies easily). 90-day retention. Excluded for classroom and child-register sessions. | `lib/observability.ts` (Sentry only) | Schema review confirms no free-text or identifier column. Retention job verified. |
| **H11** | **Cost governor.** Key-level hard caps plus alerts at 50% and 80%. Documented degradation order: pause the Tender first, then non-essential batch work, then tighten free-tier caps. **Never** the welfare gate or the guardian. | No budget controls found in repo | Drill: hitting a cap degrades in the documented order and the safety path stays up. |
| **H12** | **Doc truth.** S1 runs in CI. The `docs/README.md` verification column is generated, with claim-level verification where tagged. | F17 | A deliberately wrong path or tagged claim fails CI. |
| **H13** | **Public-repo disclosure review.** Scan sealed and public files for named living people without a recorded consent in `governance/signoffs/`, personal emails, and internal hostnames. | `devDatabaseGuard.ts` lists a production endpoint fragment; `flags.ts` comments name individuals | Scan is clean or each hit has a recorded decision. |
| **H14** | **Safety-floor carve-out.** Move `CEILING_PROTOCOL`, `OUT_OF_SCOPE_HANDOFF` and equivalents into a sealed directory so sealing is by path, not by text match. | `docs/fork-contract.md` §3 names them inside `lib/system-prompt-builder.ts` | Prompt output hash is byte-identical before and after the move. |

---

## 8. Phases

| Phase | Work | Exit criterion | Blocked on |
|---|---|---|---|
| **P0 — Decide** (days; no code) | Exit the consolidation freeze formally; tag the G1.0.0 baseline; assign owners; settle D1–D6 | A `CHANGELOG.ceremonial.md` entry and a tag exist | Humans |
| **P1 — Trust the inputs** | H1, H2, H3, H8 | Control-plane checker green 14 days; zero synthetic rows in production tables | D2 (second human) |
| **P2 — See everything** | H4, H5, H6, H10, H11 | Canary live; kill-switch drill ≤60 s; key-revocation drill <20 min | D5, D7, D8 |
| **P3 — Name every release** | Manifest, ledger, `_provenance.generation`, H7, H9, H14; retro-manifest G1.0.0; one **human-run** G1.x through the full ceremony | Rollback drill passes; every reading carries a generation | P1, P2 |
| **P4 — Tend in shadow** | Loop runs S1, S4, S9, S11 and files **issues only** for 4 weeks | Zero tripwire events; maintainers rate ≥50% of findings useful | P3, D6, D10 |
| **G2.0.0 declared** | All of the above in production | §12 exit criteria met | — |
| **P5 — Tend in proposal mode** (G2.x) | Bot PRs for Class 2 first; then S2, S3, S5, S6, S7 | First loop-authored proposal merged, rolled out, and observed through a full maturity window | G2.0.0 |

---

## 9. Carry-ins: decided elsewhere, not re-decided here

V2.0 provides the vehicle for these. It does not reopen them.

| Item | Where it stands |
|---|---|
| Segmented delivery | `docs/segmented-delivery.md` |
| Figure continuity | `docs/figure-continuity-*.md`; behind `figureContinuityEnabled()`, a governance flip |
| Axis 2 marker trajectory | `docs/axis-2-marker-trajectory.md`; implemented, gated off |
| Axis 3 near-term (retrieval beyond one voice, rerank) | `docs/axis-3-forward-architecture.md`; proposal, unratified |
| Subscriptions | `docs/stripe-billing-model.md` |
| Child-register tier, crisis-copy review | `lib/compliance/signoff-status.json`, `docs/signoff/`; hard blockers the loop cannot touch (Class 0) |
| Myth-first readings, episode selection, fireside chat, inquiry-driven lineage select | Referenced in project notes, **not found on `main` at the base commit**. Confirm where these specs live before sequencing them. |

---

## 10. Adversarial review

The first draft of this document was attacked before this version was written. Method: read the code, workflows and live repository settings; run one empirical test; reason about the rest. Each finding is marked **verified** (observed in code, settings or a test) or **reasoned** (argued, not observed). All were folded into the sections cited. Findings the draft got wrong are included, including its own contradictions.

### 10.1 Findings

| ID | Sev | Attack | Basis | Resolution |
|---|---|---|---|---|
| AR-01 | Critical | Whoever holds the owner's credential is the *always*-bypass actor and can merge anything, including the loop if it borrows that token. | verified (live ruleset) | Separate machine identity (§5.4). H3 changes bypass from `always` to `pull_request`. |
| AR-02 | Critical | A two-person rule is impossible today: user-owned repo, one handle on every CODEOWNERS line, 0 required approvals, code-owner review off. | verified | H3, D2. The interim single-author control is labeled weaker wherever used (§5.2). |
| AR-03 | Critical | The draft's tripwire had the loop police itself. A prompt-injected or compromised loop would ignore it. | reasoned | I14. Enforcement moved outside the loop (§5.2). Tripwire demoted to defense in depth (B5). |
| AR-04 | Critical | Secret-bearing jobs execute PR-head code, and `drift-detect.yml` runs `npm ci` with lifecycle scripts while the API key and production DB URL are in the job environment. A dependency or script change can exfiltrate both. | verified (workflow text) | Sealed set is computed from the workflows. Lockfile changes are Class 1. S9 ceiling lowered. H8: `--ignore-scripts` and step-scoped secrets. Secret jobs wait on `sealed-paths`. |
| AR-05 | High | Telemetry forgery: anyone can write the "what surprised us" signal. | verified (local test, 2026-10-10) | H2. S2 cannot run until H2 ships. Senses read content-free views filtered to `traffic_class = real`. |
| AR-06 | High | Probe and canary traffic land in the tables the loop senses, so it would learn from its own tests. | verified (F5) | H1, `traffic_class`, view filters. |
| AR-07 | High | Eval overfitting: the probes are public; repeated held-out runs leak per-probe signal; a loop that writes its own exam grades itself. | reasoned | I8. §6.3 run cap and veto-bit-only return. Frozen suite human-authored. D6. |
| AR-08 | High | Prompt injection into the loop through public issues and comments. | reasoned | `author_association` filter, bodies treated as data, comment commands disabled, egress allowlist (§5.3, §5.4). |
| AR-09 | High | Sealed-path rot: CODEOWNERS lists `/.guardian-prompts.lock`, which matches no file; the real lockfile is `scripts/.guardian-prompts.lock`. The draft of this document repeated the wrong path. | verified | H3 asserts every pattern matches at least one tracked file; the sealed set is computed. Paths corrected here. |
| AR-10 | High | No emergency route. A ceremony that blocks a security patch or kill switch teaches people to bypass the ceremony. | reasoned | §6.5. |
| AR-11 | High | The draft omitted identity and money from the sealed core: auth, admin routes, entitlements, middleware, billing. | verified (files exist; draft omitted them) | Added to Class 0 (§5.2). |
| AR-12 | High | One maintainer, plus a loop that adds review load, equals rubber-stamping. | reasoned | B9 backlog brake, B7 audit, P4 usefulness gate before any PR. |
| AR-13 | Medium | The draft contradicted itself: "no production credential" for the Tender, yet its Senses read production metrics. | verified (draft) | §5.4: lane credential plus a read-only role on two content-free views. |
| AR-14 | Medium | "Behavior-preserving" Class 2 let seeker-visible polish through. | reasoned | Redefined: no words said, nothing stored, nothing gated, no data flow (§5.2, §6.1). |
| AR-15 | Medium | LLM-judge manipulation: a changed prompt can produce text that steers the judge. | reasoned | Deterministic checks first, judged output passed as quoted data, dual judges (§6.3). Residual R1. |
| AR-16 | Medium | The canary account could persist rows and burn budget. | reasoned | H5: `seeker` tier, `canary` class, daily cost cap. |
| AR-17 | Medium | Vercel Preview builds from `gen/*` may inherit the production database URL. | reasoned; not checkable from the repo | H1 Preview-scope rule. Listed as unchecked in §13. |
| AR-18 | Medium | `reading_metric` could re-identify people in a low-volume system. | reasoned | H10: no ids, hour buckets, k≥20 per slice. |
| AR-19 | Medium | ADR-0009 (fail toward silence, constitutional) and the project owner's stated aim to "fail toward honesty" point in different directions. The draft would have silently picked one. | verified (ADR index; owner's stated principle in project notes) | I11 keeps ADR-0009 and requires operator visibility. Decision D4. |
| AR-20 | Low | The required gate runs Node 18; Next 16.3.1 needs ≥20.9. | verified | H3 parity check (F20). |
| AR-21 | Low | An in-process telemetry write can be frozen when a serverless function returns. | reasoned | H2 uses the framework's after-response hook. |

### 10.2 Attacks the design survived

| Attack | Why it held |
|---|---|
| "Spawn a new generation" read as self-replication or forking | No capability exists to create repos, deployments, or credentials (I1, §6.6). |
| Rollback broken by forward-only migrations | Expand/contract rule, and gestation boots the parent on the child's schema (§6.3, §6.4). |
| A withdrawn voice resurrected by a cold start | Compiled deny list overrides the flag store (H4). |
| Lineage leakage by optimizing for resonance | I3 veto and B10. |
| Cross-seeker pooling | Off by default; D3 (I6). |
| The loop editing its own gates, evaluator or budget | Sealed `tending/**` and `.github/**`, enforced externally (I14). |
| Un-sayable readings staged onto unwitting seekers | Class 1 never canaries to real seekers (§6.3). |

### 10.3 Residual risks (accepted, not closed)

| ID | Risk | Mitigation |
|---|---|---|
| R1 | LLM-judge manipulation cannot be eliminated. | Layered checks (AR-15). Human review of any proposal that changes judged behavior. |
| R2 | GitHub approvals are only as strong as the reviewer's account, and a user-owned repo cannot enforce organization-wide 2FA. | Signed commits; ed25519 signatures (`scripts/attest-sign.mjs` exists) for voice-touching majors. |
| R3 | Provider concentration: Vercel, Neon and Anthropic fail together or separately. | V2.0 detects and names failure honestly (H5, H6, H7). It does not claim to remove the dependency. |
| R4 | Human bandwidth is the real limit on everything above. | The loop is rate-limited by reviewer capacity (B9), not the other way around. |
| R5 | Until H14 lands, the ceiling and hand-off blocks are guarded only by existing tests, not by path. | H14 early in P3. |

---

## 11. Open decisions for humans

None of these is decided by this document. Defaults are what the spec assumes until a human says otherwise.

| ID | Decision | Default in this spec | Who decides |
|---|---|---|---|
| D1 | Formally exit the consolidation freeze and tag a G1.0.0 baseline (F4). | Yes, at a commit humans choose; record it in `CHANGELOG.ceremonial.md`. | Jesse Barber and Vincent J. Stanzione, per `CONSOLIDATION.md` |
| D2 | A second human for Class 0 changes, and the mechanism (move the repo to an organization with a team, or add a collaborator). | Interim: author + 24-hour cooling-off + public entry, labeled weaker. | Jesse Barber. Who the second person is is his call. |
| D3 | Content-free cross-seeker counters (§5.3 conditional row). | **Off.** Axis 3 says such questions go to lineage holders before any schema work. | Lineage holders and governance reviewers |
| D4 | ADR-0009 (fail toward silence) versus failing toward named honesty. | ADR-0009 stands; I11 adds operator visibility. A superseding ADR if changed. | Founders (ADR authority: Constitutional) |
| D5 | Model fallback (F8): wire it, allowed only if it passes lineage-purity in gestation, or delete the dead scaffolding. | No fallback; named silence. | Jesse Barber with lineage input |
| D6 | Custody and curation of the held-out probe set. | A private repo or secret store outside this public repo, human-curated, with lineage input. | Jesse Barber, lineage holders |
| D7 | Flag store (H4): vendor edge store versus database-backed. | Vendor edge store plus compiled deny list. | Jesse Barber |
| D8 | Canary cadence and daily cost cap (H5). | 15 minutes, `seeker` tier, cap set by Jesse. | Jesse Barber |
| D9 | Earned-autonomy ladder. | Not in V2.0. Revisit after 12 weeks with zero incidents. | Founders, via ADR |
| D10 | Tender runtime, agent runtime, and monthly budget ceiling. | Scheduled GitHub Actions job, its own key and spend cap. The amount is Jesse's. | Jesse Barber |
| D11 | Naming. | "Generation 2 / G2" in code and file names, "V2.0" in prose. | Jesse Barber |

---

## 12. Exit criteria for G2.0.0

G2.0.0 is declared when each of these has been **measured**, not asserted. Evidence for each lives in the generation manifest.

| ID | Criterion |
|---|---|
| E1 | `scripts/check-control-plane.mjs` green for 14 consecutive days, including zero dead CODEOWNERS patterns and bypass mode ≠ `always`. |
| E2 | No workflow or Preview-scope `DATABASE_URL` host is in `KNOWN_PRODUCTION_HOSTS`. A 30-day scan finds no probe traffic in real-class rows. |
| E3 | The forged-telemetry test (§13) fails to write `anomaly_record`, and runs in CI. |
| E4 | Kill-switch drill: a voice flipped off is off in production within 60 seconds, measured. A cold start with the flag store unreachable does not re-enable a withdrawn voice. |
| E5 | Key-revocation drill: the canary detects it in under 20 minutes. |
| E6 | Rollback drill: the parent generation is restored in under 5 minutes, boots against the child's schema, and passes smoke. |
| E7 | Over a 7-day window, 100% of readings carry `_provenance.generation`. |
| E8 | A G1.0.0 baseline manifest exists, and at least one **human-run** G1.x has gone through the full ceremony with a ledger entry. |
| E9 | The Tender has run 4 weeks in shadow mode with zero tripwire events and zero `sealed-paths` violations. Maintainers rated at least 50% of its findings useful. At least one paired evaluation against the parent completed with a held-out veto bit. |
| E10 | S1 runs in CI, the `docs/README.md` verification column is generated, and a planted wrong path or tagged claim fails CI. |
| E11 | `npm ci --ignore-scripts` in every workflow. A planted `postinstall` canary cannot read any secret. |

**What this does not promise.** V2.0 does not promise better readings. It promises better stewardship: faster detection, safer change, and an honest record. Whether the readings improve remains a judgment for seekers and lineage holders, and the loop is forbidden from optimizing it (B10).

---

## 13. Verification log

**Checked, 2026-10-10, against `e47d840`:**

| What | How | Result |
|---|---|---|
| Cited file paths | Extracted 88 backticked path-like tokens and tested each | 4 are intentional *(new)* files. 12 are short names, URLs, or deliberate quotations that resolve by hand: `backend-profile.md`, `AXIS-MUNDI-ARCHITECTURE.md` and `WHITE-PAPER.md` (in `docs/`), `devDatabaseGuard.ts` (in `tests/support/`), `flags.ts` (in `src/resilience/`), `divine/route.ts` (under `app/api/`), the three workflow files (under `.github/workflows/`), the `/api/log` route, the `@vercel/edge-config` package name, and `.guardian-prompts.lock`, quoted on purpose as the wrong CODEOWNERS path (F14, AR-09). **One real error found and fixed:** the first draft cited `.guardian-prompts.lock` at the repo root; it is at `scripts/.guardian-prompts.lock`. |
| Live ruleset, tags, repo type | `gh api repos/AHAU-ai/the-elder{,/rulesets,/rulesets/19156061,/tags}` | F1, F2, F4 as stated. Bypass actor id 256476542, mode `always`. |
| Guardian prompt lock | `node scripts/guardian-prompt-lock.mjs` | Passes (locked 2026-08-30). |
| Forged telemetry (F6, AR-05) | Local `next dev` with no database configured. `POST /api/log` with `{"kind":"near_miss","_source":"divine_route",…}` and no credentials | HTTP 200. The record was accepted and logged with `source: "divine_route"`. With a database configured, the same request reaches the `INSERT INTO anomaly_record` branch. |
| Model fallback unused (F8) | `grep` for `ANTHROPIC_FALLBACK_MODEL` and `resolveModel` outside `lib/model.config.ts` | No references. |
| Workflow exposure (F19, F20) | Read the three workflows | As stated. |
| Type check | `npx tsc --noEmit` on this branch | Passes. The change in this branch is documentation only. |

**Not checked. Treat as unverified:**

- Vercel environment scopes (Preview versus Production variables), plan limits on cron frequency, and whether Edge Config is available on the current plan.
- The Neon plan, its point-in-time-recovery window, and whether auto-suspend is still on.
- Whether bypass actor 256476542 is Jesse Barber's account (assumed to be the owner; not confirmed).
- Whether any billing or webhook route exists on `main` (none found under `app/api/`; `docs/stripe-billing-model.md` exists).
- Model deprecation status for the pinned model IDs.
- `governance/checklist.yaml` (1,210 lines), ADR-0013 and the bodies of ADR-0001 to ADR-0012, `WHITE-PAPER.md`, `AXIS-MUNDI-ARCHITECTURE.md`, and the figure-continuity documents were not read in full. Claims about them are limited to what `docs/README.md` states.
- The full test suite, the build, and the red-team probes were not run.
- Where the myth-first, episode-selection, fireside, and inquiry-lineage specs live. They are not on `main` at the base commit.
