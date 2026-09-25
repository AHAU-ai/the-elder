# Beat-2 Probing-Instrument Derivation Status

**This document is a rendering, not the source of truth.** (2026-09-24: `pythia` was found to have had NO record at all in the registry, since this document's very first draft -- a real gap this rendering itself never caught either, since nothing checked the doc's row count against the full voice list. `lib/beat2VoiceStatus.ts` now asserts completeness against `src/resilience/flags.ts`'s full 14-voice list at import time; this document should be checked the same way whenever a new voice is added anywhere in the app.) The actual,
enforced governance lives in code:

- `lib/beat2VoiceStatus.ts` — `BEAT2_VOICE_REGISTRY`, the single source of
  truth for every voice's status and the reason behind it.
- `lib/beat2Instrument.ts` — throws at import time if `BEAT2_INSTRUMENTS`
  (authored questions) or `BEAT2_REVIEWED_VOICES` (the live allowlist) ever
  exceeds what the registry authorizes. This is not a CI-only check; it
  breaks `next dev` / `next build` / any test that imports the module.
- `scripts/check-beat2-instrument.mjs` (wired into `gk-007`) — an
  independent static check, including verifying that THIS document's table
  below has not drifted from the registry. If you edit the registry, run
  `npm run check:beat2` and fix this table until it passes again, or the
  edit will fail CI even though the runtime invariant alone would have
  allowed it (the runtime check cannot see this file).

Two review tracks, same split as `docs/reading-shape-voice-review.md`:
- ojer_tzij: real review with Vincent Stanzione (only voice with confirmed
  authorization).
- Every other voice: self-review against that voice's corpus source
  material — named explicitly as a weaker form of review, not equivalent.

To enable a voice: set its registry record's `status` to `'reviewed'` with
`reviewedBy` + `reviewedDate` filled in, in the same commit that records
the actual review, THEN add it to `BEAT2_REVIEWED_VOICES` in
`lib/beat2Instrument.ts`. Either step without the other throws at import
time — see that file's own invariant check.

---

## Status — 2026-09-24

| Voice | Lineage | Corpus | Status |
|---|---|---|---|
| ojer_tzij | maya | Ten Theses / whitepaper (not a passages.json) | DRAFTED — pending Stanzione review |
| stoa | stoic | stoic-passages.json — 22 entries, 0 caution flags | DRAFTED — pending self-review sign-off |
| sage_of_the_way | taoist | taoist-passages.json — 15 entries, 1 caution flag | DRAFTED — pending self-review sign-off |
| hem_netjer | egyptian | egyptian-passages.json — 15 entries, 0 caution flags | DRAFTED — pending self-review sign-off |
| pythia | greek | greek-passages.json — 12 entries (NEW: Herodotus x6, Sophocles/Jebb x4, Homeric Hymn to Apollo x2), 0 caution flags | DRAFTED — resolved 2026-09-24; this voice had no registry record and no dedicated corpus file at all until now |
| sufi | sufi | sufi-passages.json + sufi-hafiz-ibnarabi-passages.json — 17 entries, 0 caution flags | DRAFTED — pending self-review sign-off |
| vedic | vedic | vedic-passages.json — 27 entries, 6 caution flags (Wilkins secondary-compilation entries, not an ethics problem) | DRAFTED — pending self-review sign-off |
| mekubal | mekubal | mekubal-passages.json — 10 entries, raw untranslated Aramaic Zohar, each reviewed_by Getzel Davis | HOLD — deriving questions would require Claude to translate/interpret Zohar directly, not self-review an existing translation; needs Jesse to decide how to involve Getzel specifically |
| bhikkhu | buddhist | buddhist-passages.json — 18 entries, 3 caution flags | BLOCKED — confirmed deliberate: TRADITION_MAP entry needs a real Theravada lineage holder, same category as babalawo/dreamtime |
| babalawo | yoruba | babalawo-passages.json — 12 entries (4 new, Johnson Ch. I), 4 caution flags (unchanged, all on the older Ellis entries) | DRAFTED — resolved 2026-09-24 by adding real insider-sourced (Johnson) material; pending self-review sign-off |
| elder_of_country | dreamtime | dreamtime-passages-STAGED.json — 9 entries, 9 caution flags | BLOCKED — all entries flagged, sacred-content norms, retracted tradition-bearer; stronger than a review gap |
| volva | norse | norse-*-STAGED.json (5 files) — 614 entries, 0 caution flags | DRAFTED — pipeline-wide approval given by Jesse 2026-09-24; pending self-review sign-off |
| chukchi_shaman | chukchi | none | BLOCKED — explicitly scaffolding-only, no authorization at all |
| keeper_of_the_fire | default | none | N/A — not a specific tradition |

## Open items

- [ ] Self-review stoa's four questions against the full stoic-passages.json
      (drafted from a representative sample this session, not every entry)
- [ ] Self-review sage_of_the_way's four questions the same way
- [ ] Self-review hem_netjer's four questions against the full egyptian-passages.json
- [ ] Self-review sufi's four questions against the full sufi corpus
- [ ] Self-review volva's four questions against the full norse corpus
- [ ] Separate, non-blocking finding: audit and fix the DB-seeded volva rows in
      scripts/seed-corpus.json (no _provenance, 2 of 5 read as modern commentary
      mislabeled as Poetic Edda) before norse retrieval is ever wired up in
      lib/corpusRetrieval.ts — same defect the 2026-09-20 audit found and fixed
      for stoa/sufi/mekubal, which never actually reached volva. A draft fix
      script mirroring scripts/fix-seed-corpus-review-status.mjs's pattern is
      available on request; not run against any database this session
      (no DB credentials, and this needs Jesse's own review before running).
- [ ] Decide how to involve Getzel Davis for mekubal before drafting (he'd need to
      supply/react to questions himself -- the corpus is untranslated Aramaic)
- [ ] Self-review vedic's four questions against the full corpus
- [ ] Fix bhikkhu's missing tradition_map entry (separate, pre-existing gap)
      before revisiting Beat-2 for that voice
- [ ] Self-review babalawo's four questions against corpus/babalawo-passages.json's
      Johnson-sourced entries (yor-johnson-005..008)
- [ ] Self-review pythia's four questions against corpus/greek-passages.json
- [ ] Run scripts/fix-seed-pythia-provenance.mjs (not yet run) if the pythia DB-seed
      rows should be retired the same way volva's were
- [ ] Dreamtime, chukchi: no action until their own blockers are resolved by Jesse
- [ ] Run `npm run check:beat2` after any edit to this doc or to
      `lib/beat2VoiceStatus.ts` — they must stay in lockstep or CI fails
