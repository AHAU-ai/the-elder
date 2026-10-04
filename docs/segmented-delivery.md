# Segmented delivery of the first Reading

Status: on branch `feat/segmented-reading`, not merged. Opt-in per request
(`segmented: true`); the Council tab sends it for the first Reading only.

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
| Daily rate limit | First segment: the ordinary per-IP bucket (`RATE_LIMIT_PER_DAY`, 10). Continuations: a separate `divine-cont:<ip>` bucket of `RATE_LIMIT_PER_DAY × (SEGMENT_MAX − 1)` = 20, so a Reading costs one divination |

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

1. Rate limit (resolved): see `divineRateBucket` in `lib/segmentedDelivery.ts`. `segment` is client-sent, so a forged value gains at most the continuation allowance; worst case is 30 model calls per IP per day instead of 10. Invalid JSON bodies no longer count toward the limit, because the limiter now runs after the body is parsed.
2. The excluded voices above (including the only fully authorized one) still
   give long readings. Decide whether to review their form or accept that.
3. `enforceImageFirst` (maya only) would run on continuation portions if maya
   were ever enabled; its anomaly rate would then be skewed.
4. Deepen continuations and thread follow-ups are not segmented.
5. Not yet exercised against the live model: whether it reliably emits the
   `MORE` token and keeps to the portion length. If it omits the token, the
   Reading arrives whole, as before.
