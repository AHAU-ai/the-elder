# Sign-Off — GK-007 Exception for CEILING_RATIFIED

**Signer:** Jesse Barber (founder, frame accountability holder)
**Date:** 2026-08-19
**Scope:** Of the three named conditions for `CEILING_RATIFIED=true` (Appendix B ratification, §1.5 marker-confirmation live, GK-007 CI green — see `2026-06-30-appendix-b-synthetic-intimacy-ceiling-ormsby.md`), the third is currently unmeetable: `docs/technical-strategic-and-ux-audit.md` finding CI-00 documents that the `gk-007.yml` workflow required by the GK-007 ruleset exists only on the unmerged `feat/returning-visitor` branch, never on `main` — a required check that can never report, marked OPEN — redesign. This sign-off rules that GK-007's brokenness is a merge-gate infrastructure defect, unrelated to whether the trajectory layer itself is safe to light, and does not block `CEILING_RATIFIED` on the merits.

**Gate:** The third of three conditions for `CEILING_RATIFIED=true`. With Appendix B ratified (Ormsby, 2026-06-30) and §1.5 live (Stanzione register review, 2026-06-30), this closes the set — `ELDER_TRAJECTORY_ENABLED`, `MARKER_CONFIRMATION_READY`, and `CEILING_RATIFIED` were set to `true` in `.env.local` (local dev only; gitignored, not deployed) following this decision, and subsequently mirrored to Vercel Production via `vercel env add` (see Deploy-side note below).

## Deploy-side note (2026-08-19, same session)

All three vars were found to already exist in Vercel Production, created 2026-08-17 — two days before this decision, by a prior/unidentified action outside this session. Their values were hidden (Vercel marks them Sensitive) and unrecoverable without a full `env pull`, which was not performed. Jesse confirmed, when told of the pre-existing values, to overwrite to `true` regardless of what was there before. All three were removed and re-added as `true` in Production via `vercel env rm` + `vercel env add`. The existing Production deployment was then rebuilt via `vercel redeploy` (source deployment `dpl_8U3jScgeGdCPTXcbBb6pctqTy3tK`, redeployed as `the-elder-rieur7qpb-yes-is-projects.vercel.app`, aliased to `the-elder.dev`, Ready in 48s) so the new values take effect — Vercel does not hot-reload env vars into an already-running deployment. Build output confirms `/api/elder/marker-offer` and `/api/elder/confirm-marker` are present as dynamic (`ƒ`) routes in the rebuilt deployment.

## Repo-integrity note (2026-08-19, same session)

This artifact and the corresponding `governance/checklist.yaml` row (`ELD-074`) were first written earlier in this session, then found missing from disk on a later check — `git status` showed a clean tree matching `HEAD`, and `git reflog` showed an intervening hard reset (`reset: moving to HEAD`) followed by `pull --ff-only origin main` (landing at merge commit `28ee930`, PR #66), evidence of concurrent activity on this repo from outside this session that discarded the uncommitted edits. Neither `.env.local` (gitignored) nor the Vercel Production env change were affected — only these two git-tracked artifacts. Both are being recreated and committed immediately in this pass to close that exposure.

## Ratified text (exact scope)

> GK-007 CI brokenness (docs/technical-strategic-and-ux-audit.md, finding CI-00) is a separate infrastructure bug and does not block the CEILING_RATIFIED flag on its merits.

**Content-hash (SHA-256):** `aa860cd0ee20559a00b9514ada1f4e18d973835087fd220768dd2c96b7b4fb1f`

## Primary evidence

**If backed only by a conversation / message (no commit exists):**
- **Source:** Claude Code session, `the-elder` project (this conversation)
- **Date:** 2026-08-19
- **Note:** No commit exists for the underlying decision because the only file changed by the decision itself (`.env.local`) is gitignored by design — the flag values are local-dev state, not committed config. This sign-off document, and the commit that adds it, are the durable, git-anchored evidence pointer for the decision.

## Countersignature

**Jesse Barber** — recorded this live-captured artifact 2026-08-19, per ARCH-03 (Sign-Off Artifact Standard + Backfill).

---

*Live-captured at time of decision, per ARCH-03's rule that future gates close only via artifact.*
