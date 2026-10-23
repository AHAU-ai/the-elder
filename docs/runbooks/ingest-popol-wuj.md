# Runbook: grounding the second voice (Popol Wuj, `ojer_tzij`)

**Status:** pipeline ready, ingest **not run**. Writing this changed no
database. Ingest writes to the database `DATABASE_URL` points at and spends
Voyage embedding calls (about 1,220 passages), so it is run by a person who has
checked which database that is.

**Why this voice.** `lib/corpusRetrieval.ts` is already voice-scoped and works
for any `lineage_key`. `maya` resolves to the voice `ojer_tzij`
(`lib/lineageToVoiceKey.ts`), and the corpus for it is staged. Until it is
loaded, `ojer_tzij` Readings carry the honest "not grounded in specific
passages" provenance. Vincent Stanzione is the collaborator behind this text.

## What is staged

| File | Passages | What it is |
|---|---:|---|
| `corpus/kiche-stanzione-popol-wuj-2026-03-24-STAGED.json` | 1,069 | the March 24 2026 complete translation and interpretation |
| `corpus/kiche-stanzione-intro-2024-STAGED.json` | 78 | the February 2024 introduction (method and framing) |
| `corpus/kiche-vinny-passages-STAGED.json` | 18 | Stanzione's English translation, opening sections |
| `corpus/kiche-popol-wuj-layered-STAGED.json` | 55 | a *derivative* "layered" rendering; author not identified in the file |

All carry `review_status: approved`, `ceremonial_sensitivity: open`,
`voice_key: ojer_tzij`, and pass `npm run ingest:popol-wuj:dry`
(normalization gate and build gate, no database, no network).

## Read this before ingesting

1. **Clearance is a relay.** Every file's provenance says the approval was given
   "at Jesse's instruction" and that "no signed artifact was seen by the
   ingesting session." That is the same relay caveat as figure continuity D7:
   Vincent's permission letter (section 6.1) requires his written approval for
   the specific item before it is stated or implied that he approved it. Before
   the voice is described as grounded in his text to anyone outside, get that in
   writing and file it under `governance/signoffs/`.
2. **The layered file is not Stanzione's wording.** Its provenance says wording
   differs from his text and the rendering's author is unknown. The
   `ingest:popol-wuj` script therefore **leaves it out**. Include it only after
   Vincent confirms it, by running it by hand.
3. **Corpus size changes retrieval behaviour.** 1,100+ passages of ~1,900 chars
   against a handful for other voices means retrieval will always find
   something for `ojer_tzij`. That makes the diagnosis query and rerank
   (below) matter more here than for any other voice.

## Ingest (a person, once)

```
# 0. which database is this? A dev-only ingest has written to production here before
#    (2026-09-10; see tests/support/devDatabaseGuard.ts). Check the host against
#    KNOWN_PRODUCTION_HOSTS, and ingest to the branch you mean, on purpose.
echo $DATABASE_URL | sed 's#//.*@#//***@#'
# 1. validate, no writes
npm run ingest:popol-wuj:dry
# 2. write + embed (needs DATABASE_URL, VOYAGE_API_KEY; EMBED_SLEEP_SECONDS=0.2 if rate limited)
npm run ingest:popol-wuj
# 3. verify the voice now has rows and retrieval returns them
npx tsx tests/corpusRetrieval.integration.test.ts
```

Then one real `ojer_tzij` Reading on a deployment: the response's
`_provenance.passage_ids` should be non-empty and the provenance block should
cite a Stanzione section (as was done for the other six voices, ELD-008 status
notes).

## Diagnosis query and rerank (ELD-008)

Built, off by default: `CORPUS_RETRIEVAL_V2=true`.

- **Query.** `lib/retrievalQuery.ts` makes one small model call over the
  seeker's current message to write a short five-marker diagnosis, adds the Cruz
  Maya position when a birth date was given, and appends a slice of the
  seeker's own words so a thin diagnosis cannot pull retrieval off the subject.
  Any failure returns the literal words (today's behaviour).
- **Rerank.** `lib/corpusRetrieval.ts` fetches 12 nearest by embedding, then
  Voyage `rerank-2` picks the top 2 (the current prompt budget). ELD-008 names
  4 to 6; raise the limit in `app/api/divine/route.ts` (`groundWith`) only after
  checking the 29-34s generation times noted for long voices.
- **What it is not.** The diagnosis is used once and discarded: not stored, not
  shown, not a marker, never written to `markers_confirmed`. Axis 2 stays
  confirm-only. A figure query (myth-first) skips the diagnosis.
- **Light it** on testers' deployment first. Compare provenance passage ids and
  the ELD-008 hallucination spot-check (step 2.b) on 10 `ojer_tzij` Readings with
  the flag off and on before leaving it on.

## The other staged voices

Norse (five files, ~3.4 MB), Dreamtime and Vedic are staged but are **not** in
this change. Each needs its own clearance first: the Norse corpus is the
subject of the living-holder question in item 7 (corroboration notes), and the
Dreamtime and Vedic files still carry `STAGED` status. Same runbook, one voice
at a time.
