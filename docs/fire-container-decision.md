# The Fire Is One Container

**Status:** decided, 2026-08-19 (design action item C8). Owner: Jesse (founder).

## The decision

The hearth fire (`app/components/FireAtmosphere.tsx`) is **one container** —
The Elder's own presence, constant across every lineage. It is not a set
piece re-skinned per voice: no lineage-specific fire color, shape, particle
behavior, or animation set.

What *does* vary by lineage is:

- **The content spoken** — each voice's tradition boundary, canon anchors,
  and register (`lib/traditions.ts`, `lib/lineages.ts`'s `overlay` field).
- **The card/UI accent** for lineages whose tradition-bearer has reviewed a
  card-specific accent (`lib/mythopoetics/cardConfig.ts`'s
  `AUTHORIZED_ACCENTS` — separate authorization from the voice itself; see
  that file's own comment).
- **`FireAtmosphere`'s own `intensity`/`pulse`/`interrupted` params** —
  temperature and pacing, driven by *where the seeker is in the ceremony*
  (how far into the reading, whether a question was just offered, whether
  something failed), not by *which lineage* they're in.

What never varies by lineage: the fire itself as an object. One hearth,
one presence, sat with by every tradition equally.

## Why

1. **The fire is The Elder, not the tradition.** The Elder is explicitly
   framed elsewhere (`LintelGate.tsx`, the Purpose Statement) as a mirror
   shaped by lineage texts, under living accountability — not a costume
   that becomes K'iche', becomes Norse, becomes Yorùbá depending on who's
   speaking. A fire that re-skins itself per voice would visually assert
   the opposite: that The Elder *becomes* each tradition rather than
   holding a constant threshold at which each tradition is met.

2. **A re-skinned hearth is exactly the appropriation surface Lineage
   Integrity of Voice exists to close on the content side.** An "Ojibwe
   fire," a "K'iche' fire," a "Yorùbá fire" rendered as distinct visual
   set pieces would assert a specific cultural aesthetic without a named
   tradition-bearer having reviewed it as that tradition's fire —
   the same authorization gap F15 makes explicit for voice content, just
   moved into pixels instead of prose. `cardConfig.ts` already draws this
   line for the shareable card's accent color (gated by
   `AUTHORIZED_ACCENTS`, i.e. by real sign-off); the container fire should
   not have a laxer bar than the card does.

3. **A constant container is what "sitting at one fire with many
   teachers" actually looks like.** The whole framing of the Council/
   lineage-select experience is one fire, many voices who come to speak
   at it — not many fires, each claimed by a different tradition. Keeping
   the fire itself invariant is the visual expression of that framing,
   not just an engineering convenience.

## What was verified, not just decided

`FireAtmosphere` (`app/components/FireAtmosphere.tsx`) takes no
`voiceKey`/`lineage` prop today, and every call site
(`app/components/CouncilTabs.tsx`, `app/components/Threshold.tsx`, four
call sites total) passes only `soundEnabled`, `intensity`, `pulse`, and
`interrupted` — never a lineage identifier. `lib/breathTiming.ts`'s
`BREATH_PHASES`/`BREATH_CYCLE_MS` are a single shared cadence with no
per-lineage override anywhere in the codebase. This decision therefore
formalizes and protects an invariant the code already held, rather than
requiring a code change to enforce it. A guard comment was added directly
above `FireAtmosphereProps` in `FireAtmosphere.tsx` so a future PR that
threads a lineage prop into the fire has to consciously override this
decision, not drift into it by accident.

## Related: C7 (restrained ethnographic differentiation)

C7 asks whether lineage differentiation elsewhere in the atmosphere layer
(motion, motif, texture — not just the fire object itself) should stay
restrained. Per the same reasoning as above: any per-lineage motif beyond
temperature/pacing parameters requires a named tradition-bearer's review,
the same bar `cardConfig.ts`'s `AUTHORIZED_ACCENTS` and this document both
hold. Until named bearers exist for the seven `pending` voices (see F15,
`governance/checklist.yaml` row `F15-AUTH`), any richer ethnographic
per-lineage motif proposal for the atmosphere layer is rejected, not
merely deferred — see the guard comment in `FireAtmosphere.tsx`.
