# Your myth, so far: the through-line

**Status:** built, behind no flag (it reads only what the seeker already keeps). Needs Jesse's ratification of the M3 amendment below and a Shalom glance at the new copy (Appendix B, synthetic-intimacy ceiling) before launch.

## What it is

A seeker who returns should feel they are building toward something: **a page only they can write** (the Core Myth Statement), with the figures that came and the words they laid down along the way. `/journal` now opens with a short road of four stations, ending at that page:

| Station | Lit when (a fact, never an inference) | Source |
|---|---|---|
| A figure came to meet you | at least one archetype exists | `myth_archetype` (`getUserMyths`) |
| You went back to one of them | some archetype has been sat with more than once | same, `reading_count >= 2` |
| You said it in your own words | at least one confirmed marker (`integrated`) or kept Becoming sentence exists | `assembleConfirmedMaterial` |
| You wrote your myth | a current Core Myth Statement exists | `getCurrentStatement` |

Under the road: the figures (one line per tradition), the seeker's own gathered lines as a flat list, and "the page at the end" (what it is, that it is never written for them, and the honest rule for when it opens). One optional door at most, to the first station not yet touched. Built from `lib/returning/mythPortraitDerive.ts` (pure, tested) → `mythPortrait.ts` → `GET /api/user/portrait` → `MythPortrait.tsx`.

It works while `ELDER_TRAJECTORY` is dark: nothing here reads the trajectory gate.

## The tension, and the amendment

`inhabiting-the-elder.md` M3 says: *"Nothing unlocks, nothing is earned, nothing shows progress."* A road that visibly fills is, on its face, progress. This feature is the deliberate amendment, and the line it keeps is narrower and more defensible:

> **Direction, not a score.** The seeker may see where the road goes and what of their own they have laid on it. The seeker may never be shown a number about themselves, a level, a streak, a percentage, a locked room, or a deficit.

How that is enforced structurally, not only in copy:
- Stations are lit/unlit with no order enforced; unlit text is an invitation ("A figure will come when you ask the fire"), never "locked" or "missing".
- The payload carries no counts. The raw reading count never leaves the server (tested).
- "Returned to" means only "sat with it more than once". The archetype ledger's own `depth_stage` auto-advances by reading count with no seeker confirmation, so this surface ignores it rather than saying "integrated" on a count.
- No animation, no pulsing next-step marker (pull vs. dwelling, §0): the road is still.
- One number is spoken: how many threads the Core Myth page asks for (`REQUIRED_INTEGRATED_MARKERS`). It is the existing gate stated honestly (fail toward honesty) rather than a mystery; it is a rule, not a meter, and no "x of y" is drawn.

## Steelman and red-team

**Steelman.** The pieces already existed (archetypes, markers, Becoming, letters, Core Myth, Tree) but as separate rooms. A returning seeker had no single place that says what all of it is *for*. Naming the horizon on day one gives each sitting a reason that belongs to the seeker, and it does so with their own words, not the Elder's.

**Red-team, and what survived.**
1. *It is a streak wearing a costume.* Mitigated: no time component at all (nothing about recency, gaps, or frequency), nothing lost by absence, nothing expires. Cut condition: if testers read the unlit stations as a to-do list, collapse to the figures and gathered lines only.
2. *"A complete understanding of your life" overpromises.* The surface never says complete. It says "so far", "never written in your place", and "a myth is a lens, not a verdict", per the 2026-08-08 reviewer's warning about prescriptive myths.
3. *Melting pot.* One entry per tradition, never merged; the closing note says they are kept apart. Cross-tradition synthesis is out of scope on purpose.
4. *A fabricated connection.* The gathered list is a 1:1 copy of confirmed rows. Nothing relates two of them (R-1 holds; same discipline as the Core Myth material list).
5. *A false negative reads as a false claim.* If any source fails to load, the whole portrait is null and renders nothing, rather than showing "a figure will come" over a figure that exists.
6. *The 3-thread number invites gaming.* Accepted: the only way to reach it is to confirm threads in one's own words, which is the intended act.

## Not built (on purpose)

- A touch inside the reading flow ("added to your telling"). §2.3 keeps the closing quiet; revisit only with a Shalom look.
- Credit for markers confirmed but not yet `integrated`: they are in the seeker's words too, but counting them needs the trajectory gate. Revisit when it is lit.
- Tree/Letters integration. The Tree already draws the same material spatially; the road is the sentence version.

## Verified

`tsc`; `npm run test:unit` (new: `mythPortraitDerive.test.ts`, 13 checks); i18n parity (22 new keys across all 11 locales; non-English copy is **machine draft**, like the rest of those catalogs, and K'iche' carries the Spanish per that file's own policy); `check:purpose`, `check:pattern-view`, `check:opening-register`, `check:language-wired`, `check:unwired-exports`; production `next build`; headless Chromium against the built app with the API mocked: new seeker, two traditions, page open, statement written, and a failing API (renders nothing), at 1000px and 360px (no horizontal overflow).

**Not verified:** against a real database and real session (the route is a thin wrapper over existing ledger functions, exercised only through mocks here); a native read of the translated copy; how it feels to a person.
