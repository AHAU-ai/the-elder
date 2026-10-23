# The Fireside: a room, not a feature

**Status:** built, dark. Lighting it is a governance action
(`FIRESIDE_ENABLED`, testers first, then `FIRESIDE_ALL_SEEKERS`; see
`docs/runbooks/light-the-living-features.md`). The fireside spec referred to in
project notes was not in the repository, so this document is the spec as built.
Migration `033_fireside_entry.sql` must be applied before it is lit.

## What it is

A room beside The Fire, the Tree, the Journal, the Letters and About, where the
seeker talks with the Elder as host. Not a Reading: no myth is told, no
archetype named, no diagnosis, no prediction. The Elder listens and answers in a
few plain sentences in the frame voice (`elder_frame`, `lib/narrativeForm.ts`),
hosted by the Keeper of the Fire (tradition slug `default`).

It stands in the nav only where it is lit for that seeker
(`/api/fireside/probe`). A closed room is not shown and its API answers 404.

## What it reuses (nothing is reimplemented)

| Spine | How the fireside uses it |
|---|---|
| Welfare gate | `assessWelfare` on every message, model judge plus lexical floor, before any generation. **Crisis** never reaches the model: the same copy as a Reading (`server.crisis_adult`, with the English tail until a language is native-reviewed). **Distress** gets a plain-presence prompt. |
| Dual guardian | `dualGuardReading` on every reply, distress turns included, fail closed. A declined or failed reply is a silence, never a retry-until-it-passes. |
| Ceiling and hand-off | `CEILING_PROTOCOL` and `OUT_OF_SCOPE_HANDOFF` are in the system prompt unmodified. |
| Rate limit | `checkRateLimit` per account, 40 a day. |
| Language | `languageNameFromInput`, `serverText`, `languageDirective`. |

## What is written down, and what never is

`fireside_entry` holds one row per **completed ordinary exchange**. The single
write is behind `shouldPersist(tier, guardianPassed)` (`lib/fireside.ts`), which
is true only for an `ordinary` turn the guardian passed.

- A **crisis** turn is never written. A **distress** turn is not either (the brief
  names crisis; distress is kept out on the same side of the line as figure
  continuity's D8, and can be relaxed only by an explicit decision).
- A turn the guardian declined, or that failed, is never written.
- The exchange panel tells the seeker plainly when an exchange "was not written
  down" (`fireside.not_kept`). Silence about it would be a quiet lie.
- No markers, no classification, no summary, no cross-sitting memory. The Elder
  is told it holds none and must never imply one (no "last time", no "again").
- The sitting itself lives in the page and is sent back each turn (bounded to
  six exchanges, strictly alternating, validated). The server keeps no session.

## What feeds the Tree

Only a line the seeker **writes in their own words and chooses to carry**
(`PUT /api/fireside`, 3 to 140 characters). It becomes an outer leaf on the Tree
beside Becoming sentences (`firesideStatements`, `lib/returning/treeState.ts`),
listed by date and never joined into one sentence with them. The Tree shows it
independent of the trajectory gate, as it does Becoming sentences, because it is
the seeker's own words kept by the seeker.

That is "confirmed entries feed the Tree" and nothing more. The model never
proposes a line, never writes one, and nothing in the exchange is inferred into
a marker (Axis 3 rules out autonomous marker-writing; this does not cross it).

## Release

Every exchange can be released one at a time (`DELETE /api/fireside?id=`, loud on
failure) and all at once through the journal's release-all, which now includes
the fireside. Releasing an exchange removes its leaf. Keeping or releasing what
is already the seeker's own is not gated on the room being lit.

## What it deliberately does not do

- No streak, count, "welcome back", or any line that gives a reason to return
  (RT-6, Appendix B). The over-dwelling guard (`docs/over-dwelling-guard.md`)
  counts Readings only; **a conversation room is exactly the kind of surface
  that guard exists for, and it does not count fireside turns today.** That is a
  known gap to raise with the reviewer before this is lit beyond testers: either
  count exchanges toward the guard, or accept that the room is outside it.
- No anonymous access. It needs an account (rate limit and release both depend
  on one).
- No tier gate. Cost is bounded by the daily limit instead.

## Open questions for review

1. Should distress turns be written down? (Conservatively no.)
2. Does the Keeper of the Fire hosting count as a lineage voice needing its own
   holder's view, or is it the Elder's frame voice? Currently the latter.
3. Does the over-dwelling guard need to count this room (above)?
4. The nav labels in the nine non-English catalogs are machine drafts, like the
   rest of the catalog (`lib/i18n/reviewStatus.ts`).

## Where it lives

`lib/fireside.ts` (rules), `lib/firesideLedger.ts` (database), `app/api/fireside/`
(route and probe), `app/fireside/page.tsx`, `app/components/Fireside.tsx`,
`app/components/AppWayfinding.tsx` (nav), `migrations/033_fireside_entry.sql`,
`lib/fireside.test.ts`.
