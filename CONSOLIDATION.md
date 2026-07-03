# The Elder — Consolidation Plan

**Version:** 1.0
**Date:** June 10, 2026
**Status:** Active
**Repo:** AHAU-ai/the-elder · Deployed via Vercel from `main`
**Accountability:** Jesse Barber (technical), Vincent James Stanzione (lineage)

---

## Purpose

The build phase is functionally complete: the Lintel Gate and Crisis Page are live, the
drift-detection red-team runs on every push, the model is pinned with a fallback ladder,
and the Council of Voices is architecturally stable. Consolidation is the phase in which
nothing new is added and everything existing is *proven* — tested, documented, observed
under real conditions, and signed off.

The exit condition of this plan is a tagged, attested release: **v1.0-consolidated**.

## Governing Rule: The Freeze

For the duration of consolidation, no new features enter `main`. Permitted changes:

- Bug fixes discovered during verification
- Documentation and governance artifacts
- Test coverage and tooling
- Copy corrections (subject to existing lineage-review rules)

Any proposed feature gets written into a `POST-CONSOLIDATION.md` backlog instead of
built. The discipline of the freeze *is* the consolidation mechanic — drift toward
"one more thing" is the same institutional drift Vulnerability #8 names, expressed
in the development process itself.

---

## Phase 1 — Close the Open Vulnerability (Developer-Facing)

**Goal:** Vulnerability #8 fully closed. The drift-detect script (16 probes, 7
categories) is the enforcement half; this phase delivers the governance half.

1.1. Finalize the **governance artifact** — the versioned founding epistemic stance
     document (working title: `GOVERNANCE.md` or `EPISTEMIC-STANCE.md`). It must state:
     no predictions, no metaphysical truth claims, lineage integrity of voice,
     non-displacement of living lineage holders, the Applied Mythopoetics framing,
     and the explicit exit conditions identified in the unknown-unknowns analysis.
1.2. Cross-reference: every drift-detect probe category maps to a named clause in the
     governance artifact, and every clause has at least one probe. Gaps in either
     direction get fixed (new clause or new probe).
1.3. Commit both together with a closing entry in `CHANGELOG.ceremonial.md`
     (create the changelog if not yet present — priority item #19).
1.4. Mark #8 closed in the priority matrix sheet.

**Exit check:** `node scripts/drift-detect.mjs` passes locally and in GitHub Actions
on the commit that adds the governance artifact.

## Phase 2 — Automated Verification Suite (Developer-Facing)

**Goal:** Every load-bearing mechanic has a test that runs without a human.

2.1. **Chol Q'ij cross-validation** (priority #10): script that runs 500+ dates through
     the TypeScript natal engine and the verified Python module, asserting identical
     nahual output. Anchor assertion: April 22, 2020 = 5 Kawoq. Include the Cruz Maya
     five-position derivation (Origin −8, Destiny +8, Paternal −6, Maternal +6) and
     Venus phase in the comparison.
2.2. **Lineage purity regression tests** (priority #11): automated cross-traditional
     probes per voice, asserting refusal. The drift-detect CROSS probes cover this
     partially; extend to all ten voices plus the default Keeper of the Fire.
2.3. **Signal-system test:** verify `⟡⟡READY⟡⟡` emission only when diagnostic markers
     are satisfied, never on raw turn count.
2.4. **CI consolidation:** all of the above wired into the GitHub Actions workflow so
     a single push exercises the full suite. Enable branch protection on `main`
     requiring the workflow to pass.

**Exit check:** A deliberately broken commit (e.g., perturbed day-count offset) is
blocked by CI; a clean commit passes.

## Phase 3 — Infrastructure & Repo Hygiene (Developer-Facing)

**Goal:** The repo state matches the deployed state, with no ghosts, no dead paths,
and recoverability if anything fails.

3.1. Repo sweep: remove dead files and stale references (prior Cyrillic-filename ghost
     class of error; any residual COSMO references — COSMO is retired).
3.2. Dependency audit: `npm audit`, pin versions, confirm clean `rm -rf .next &&
     npm run build` from a fresh clone.
3.3. Environment audit: document every required env var; confirm Vercel project
     settings match; confirm no secrets in repo history.
3.4. Model config verification: `lib/model.config.ts` pinned model and fallback ladder
     exercised — simulate primary-model failure and confirm graceful fallback.
3.5. localStorage schema versioning: natal cross data, Lintel Gate first-visit flag,
     and language preference get a schema version key so future migrations don't
     corrupt returning visitors' state.
3.6. Cold-start mitigation: warm-keep ping (Vercel cron) if response latency on first
     hit exceeds acceptable threshold.
3.7. README brought current: setup-from-clone instructions verified by actually
     following them.

**Exit check:** Fresh clone → install → build → drift-detect, all green, following
only the README.

## Phase 4 — Full Journey QA (User-Facing)

**Goal:** Every path a seeker can walk has been walked deliberately, on desktop and
mobile, before strangers walk it.

4.1. **First-visit path:** Lintel Gate consent flow → orientation → threshold →
     reading. Verify localStorage flag prevents re-gating on return.
4.2. **Crisis path:** trigger conditions route correctly to the Crisis Page; language
     and resources current; no dead ends back into the reading.
4.3. **All ten voices + default:** one full session per voice. Confirm canonical
     titles render correctly, each voice stays within its tradition, and the Babalawo
     voice clearly signals its scaffolding-only status pending initiated review.
4.4. **All ten languages:** toggle each; check layout integrity (diacritics, K'iche'
     apostrophes, RTL if applicable), and that consent/crisis copy is complete in
     every language — partial translation of safety copy is a release blocker.
4.5. **Natal injector:** enter edge-case birth dates (leap days, year boundaries,
     pre-anchor dates); confirm cross renders correctly and data never leaves the
     client.
4.6. **Atmosphere & performance:** fire cursor, embers, hearth audio on mobile Safari
     and Chrome; Lighthouse pass; audio autoplay policies handled gracefully.
4.7. **Feedback glyphs:** ⊕/◯ recorded to the Altar Record; verify anonymity of the
     session log end-to-end.
4.8. **Accessibility pass:** keyboard navigation through the Lintel Gate, reduced-
     motion preference respected by FireAtmosphere, contrast on obsidian/gold palette,
     screen-reader labels on the consent flow.

**Exit check:** A written QA log (one row per path tested, device, result) with zero
open blockers. Log lives in the repo under `docs/qa/`.

## Phase 5 — Burn-In & Witnessed Pilot

**Goal:** "Time-proven" made literal — a defined observation window under real use.

5.1. Declare a **14-day burn-in window**. During it: no commits to `main` except
     fixes for issues found during the window itself.
5.2. **Trusted-circle pilot:** 5–10 invited users across the voices and languages.
     Each completes at least one full session and reports via the ⊕/◯ mechanism plus
     a short written reflection.
5.3. **Dr. Stanzione's review:** a full session walkthrough of the Elder (K'iche')
     voice by the lineage accountability holder, with findings logged. Any K'iche'
     language issues flagged route to Ajq'ij review per existing protocol.
5.4. **Monitoring:** daily check of Vercel logs for errors, drift-detect scheduled run
     (nightly cron in Actions, not only on push), and Altar Record review for
     anomalous sessions.
5.5. Issues found are triaged: blockers fixed within the window (which restarts the
     7-day clock on the affected path), non-blockers go to `POST-CONSOLIDATION.md`.

**Exit check:** 14 consecutive days with zero blocker-class incidents and a green
nightly drift run.

## Phase 6 — Sign-Off & Tag

**Goal:** Consolidation has a verifiable end, not a fade-out.

6.1. Final entry in `CHANGELOG.ceremonial.md` summarizing the consolidation: dates,
     system prompt version, model version, probe count, pilot outcomes.
6.2. Attestation lines in the governance artifact: technical sign-off (Jesse),
     lineage sign-off (Dr. Stanzione).
6.3. `git tag -a v1.0-consolidated -m "Consolidation complete"` and push the tag.
6.4. Priority matrix sheet updated: all consolidated items marked, remaining items
     explicitly deferred to the post-consolidation backlog.
6.5. The freeze lifts. New work resumes from a proven foundation.

---

## Sequence at a Glance

| Phase | Track | Duration estimate |
|-------|-------|-------------------|
| 1. Close #8 (governance artifact) | Developer | 1–2 sessions |
| 2. Verification suite | Developer | 2–3 sessions |
| 3. Infra & repo hygiene | Developer | 1–2 sessions |
| 4. Full journey QA | User-facing | 2–3 sessions |
| 5. Burn-in & pilot | Both | 14 days (calendar) |
| 6. Sign-off & tag | Both | 1 session |

Phases 1–3 can interleave; Phase 4 should follow 3 (test what's final, not what's
about to change); Phase 5 requires 1–4 complete.
