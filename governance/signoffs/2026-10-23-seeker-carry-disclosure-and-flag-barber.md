# Sign-Off — Seeker's Carry: disclosure published, ELDER_CARRY_ENABLED on

**Signer:** Jesse Barber (founder, frame accountability holder)
**Date:** 2026-10-23
**Scope:** Publishes the plaintext-storage notice for a carried line at the point of collection (`CARRY_COPY.lineNotice`, shown under the line field in `CarryOffer`) and authorizes `ELDER_CARRY_ENABLED=true` in Vercel Production. This satisfies the pre-launch requirement in ADR-0015 (Consequences) and issue #194 to the extent a founder can: the disclosure exists and is shown before a seeker writes anything.

**Gate:** The last condition for `carryEnabled()` (`config/returning-features.ts`), which also requires the three trajectory gates already set in Production. Migration 032 was applied and verified on Production the same day (6 columns, 3 indexes, 6 constraints, 0 rows).

**Decision:** Approve, with counsel review outstanding

## What this does NOT establish

- **Counsel has not reviewed or approved this text.** `governance/checklist.yaml` ("Legal Entity, Terms of Use, Honest Disclosure Language") remains an open legal item. This sign-off is a founder decision made ahead of that review, not a substitute for it.
- The open questions for counsel in `docs/signoff/seeker-carry-privacy-disclosure.md` still stand, notably whether deleted lines persist in database backups. The published notice says "deleted for good" and does not mention backups; counsel should confirm or amend that wording.
- The notice is English-only, as the rest of the carry copy is (ADR-0015).
- Rollback: unset `ELDER_CARRY_ENABLED` and redeploy.

---

## Ratified text (exact scope)

> A line is stored as plain text in our database, not specially encrypted, so anyone with direct database access could read it. No AI model reads it. Release it any time and it is deleted for good.

**Content-hash (SHA-256):** `d4a06ab56a0ef6f4cc68934c98cd0410f2c99e7c3c806195f0bc3f709356eb99`

## Primary evidence

**If backed only by a conversation / message (no commit exists):**
- **Source:** Claude Code session, `the-elder` project; the founder's instruction to publish the disclosure and set the flag.
- **Date:** 2026-10-23
- **Note:** The commit that adds this file, `lib/returning/carry.ts` and `app/components/CarryOffer.tsx` is the durable evidence pointer for the published text.

## Countersignature

**Jesse Barber** — live-captured artifact 2026-10-23, per ARCH-03 (Sign-Off Artifact Standard + Backfill).

---

*Live-captured at time of decision, per ARCH-03's rule that future gates close only via artifact. Counsel review is recorded as outstanding, not waived.*
