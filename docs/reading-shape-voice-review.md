# Reading-Shape Closing-Convention Review

Tracks review of the closing-shape clause (readings should end on an
unresolved thread, not a resolution — see lib/readingShapeClause.ts)
against each voice's actual tradition, before the clause ships broadly.

Scope ratified 2026-08-30:
- ojer_tzij: real review with Vincent Stanzione (only voice with confirmed,
  verified authorization).
- All other voices: self-review against that voice's corpus source
  material — a weaker form of review than ojer_tzij gets, since no other
  tradition-bearer authorization is currently real. Named as such, not
  presented as equivalent.

Do not ship the closing-shape clause broadly (i.e. un-gated per voice)
until every row below is RESOLVED.

---

## Track 1 — ojer_tzij (real review)

**Status:** NOT STARTED

- [ ] Draft the ask to Stanzione: the GOOD/BAD closing examples from
      lib/readingShapeClause.ts, plus a direct question — does ending a
      reading on an unresolved image/thread match K'iche' oral-narrative
      convention, or does it import a Western/screenwriting instinct?
- [ ] Ask him to point to a specific tale or telling style if he has one,
      so the answer isn't just yes/no.
- [ ] **Folded in from #135 (drift probe OR-03B):** ojer_tzij's generation
      contract has a scripted opener for corpus-silence ("the old words
      have not given me this" / "SILENCE WHERE THE CORPUS IS SILENT" in
      lib/lineages.ts). On some generations the voice uses it for a
      *missing-user-input* case instead — a seeker asking "how many days
      have I missed, I need the exact count" gets the silence-opener
      rather than "tell me the morning you began, and I will count."
      Ask Stanzione whether a distinct, plainer move for "I lack a fact
      you'd need to give me" (ask for it, or defer honestly) fits the
      voice, vs. the corpus-silence register. Decision below should cover
      this alongside the closing-shape clause.
- [ ] Record his answer here:

  > (paste his response / summary here)

- [ ] Decision: SHIP AS-IS / MODIFY CLAUSE FOR ojer_tzij / EXEMPT ojer_tzij

---

## Track 2 — self-review against corpus source material

For each voice: read (or re-read) the source material actually grounding
that voice's corpus, and judge whether "end on an unresolved thread" is
consistent with, contradicted by, or simply not addressed by that source.
Write the judgment per voice — don't default to "assume it's fine."

### babalawo (Yorùbá lineage)
- **Corpus source on file:** Pelton, *The Trickster in West Africa*
- [ ] Reviewed against source
- **Judgment:** CONSISTENT / CONTRADICTED / NOT ADDRESSED — notes:

  >

### dreamtime
- **Corpus source on file:** none currently recorded — locate before reviewing
- [ ] Corpus source identified
- [ ] Reviewed against source
- **Judgment:**

  >

### Rashbi / Mekubal (Zohar-sourced)
- **Corpus source on file:** Zohar text, Aramaic/Hebrew original
- **Note:** Getzel Davis is scoped as accountability holder for Mekubal
  generally (Harvard) — confirm whether that role covers this kind of
  review, or whether it's a distinct function, before treating him as a
  stand-in reviewer.
- [ ] Reviewed against source
- [ ] Accountability-holder role re: this review clarified
- **Judgment:**

  >

### bhikkhu
- **Corpus source on file:** none — this voice has no psychopompLayer
  entry and no named corpus grounding recorded anywhere in memory; it's
  already flagged for Shalom on a separate, unrelated gap.
- [ ] Corpus source identified (ask Jesse / check repo directly)
- [ ] Reviewed against source
- **Judgment:**

  >

---

## Track 2b — unnamed placeholder voices

Memory records "seven additional voices carry placeholder
self-authorization attributed to Temporal Bridges Institute" as a flagged
data-integrity gap, but does not name them individually. bhikkhu may or
may not be one of the seven — unconfirmed.

- [ ] List all seven placeholder voices here (name + corpus source, one
      row each), then duplicate the Track 2 template above per voice.

| Voice | Corpus source | Reviewed? | Judgment |
|---|---|---|---|
|   |   | [ ] |   |
|   |   | [ ] |   |
|   |   | [ ] |   |
|   |   | [ ] |   |
|   |   | [ ] |   |
|   |   | [ ] |   |
|   |   | [ ] |   |

---

## Rollout gating

Do not remove the per-voice gate on READING_SHAPE_CLAUSE (if one exists
in system-prompt-builder.ts by the time this is read) until every voice
above shows a judgment of CONSISTENT, or has an explicit documented
decision to ship anyway with reasoning recorded in this file.
