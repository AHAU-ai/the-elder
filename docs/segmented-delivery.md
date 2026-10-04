# Segmented delivery of the first Reading

Status: live on `main`. Opt-in per request (`segmented: true`); the Council
tab sends it for the first Reading only. (This file used to say it lived on
`feat/segmented-reading`, unmerged. Its work is on `main`.)

## What it does

The first Reading arrives in up to `SEGMENT_MAX` (3) portions of roughly 70-110
words. Each portion except the last ends with one follow-up question and the
signal token `⧁⧁MORE⧁⧁`. The server strips the token and returns
`moreToCome: true`. The portion that completes the Reading carries the
Ceremonial Charge and the `⧁MYTH:...⧁` token.

Code: `lib/segmentedDelivery.ts`, `lib/system-prompt-builder.ts`,
`app/api/divine/route.ts`, `app/components/ReadingSegment.tsx`,
`app/components/CouncilTabs.tsx`.

## What fires when

| Effect | When |
| --- | --- |
| Myth ledger, visit record, marker extraction | Once, on the final portion, over the assembled full text |
| Closing ritual, share card, Threshold Letter, journal prompt, `ReadingSignal` | Once, when the final portion becomes `firstReading` |
| Welfare gate | Every turn, on the latest seeker message (unchanged) |
| Dual guardian | Every portion, on that portion's text |
| Corpus retrieval | Every turn, keyed to the opening offering (not "Go on.") |
| Daily rate limit | Every request, so one Reading costs up to 3 |

## Voices excluded by default

`SEGMENTED_DELIVERY_EXCLUDED_VOICES` keeps these voices delivering whole,
because each already has a written form rule against portioning:

- `ojer_tzij`: Ajq'ij reading directive, SEAL: no questions after the seal.
  Also law-tier, with its narrative register pending Stanzione's signature.
- `pythia`: narrative register, "never broken into parts".
- `sufi`: narrative register, "one breath from the first word to the last".

To lift an exclusion, remove the key in the same commit that records the
decision here, as `lib/readingShapeClause.ts` does for its own gate.

## Open decisions

1. Rate limit: continuation portions still count against `RATE_LIMIT_PER_DAY`.
2. The excluded voices above (including the only fully authorized one) still
   give long readings. Decide whether to review their form or accept that.
3. `enforceImageFirst` (maya only) would run on continuation portions if maya
   were ever enabled; its anomaly rate would then be skewed.
4. Deepen continuations and thread follow-ups are not segmented.
5. Not yet exercised against the live model: whether it reliably emits the
   `MORE` token and keeps to the portion length. If it omits the token, the
   Reading arrives whole, as before.

## Myth-first (planned)

A new seeker's first Reading is planned to be told myth-first (the myth, then
the figure, then the seeker's story) through this same machinery. Voices that
this file excludes from segmenting still receive that order, as one unbroken
telling, so `SEGMENTED_DELIVERY_EXCLUDED_VOICES` stays the single list that
decides delivery. Design, decisions and build plan: `docs/myth-first-spec.md`
(PR #215). The pure decision and prompt module is `lib/mythFirst.ts`; nothing
calls it yet and the feature stays dark behind a governance flag until the
route is wired (MF-4) and the voice reviews are recorded (MF-7).
