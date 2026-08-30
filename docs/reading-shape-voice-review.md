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

## Status — 2026-08-30

**The clause is already live, un-gated, for every voice.**
`lib/system-prompt-builder.ts` appends `READING_SHAPE_CLAUSE` whenever
`readingMode` is true, with no per-voice check — there is no gate to
remove. On `main` today the closing-shape convention is shipping to
ojer_tzij, babalawo, dreamtime, Mekubal, bhikkhu, and the seven
placeholder voices alike, ahead of any review in this file.

This is a known exposure, surfaced to Jesse 2026-08-30. Options:
1. Add a per-voice gate now (allowlist, default off; ojer_tzij excluded
   until Track 1 clears) so the code matches this doc's stated intent,
   then work the tracks.
2. Accept the current broad rollout as an explicit ship-anyway decision,
   recorded here with reasoning, and treat the tracks as confirm-or-revert
   rather than gate-then-open.

No decision recorded yet. Until one is, treat the "Rollout gating"
section at the bottom as aspirational, not descriptive.

Track 1 progress this pass: the ask to Stanzione is drafted (below).
It has not been sent — sending is Jesse's call, as the relationship
holder. Tracks 2 / 2b not started.

---

## Track 1 — ojer_tzij (real review)

**Status:** ASK DRAFTED — NOT SENT

- [x] Draft the ask to Stanzione (drafted 2026-08-30; see below)
- [ ] Send it (Jesse — relationship holder)
- [ ] Ask him to point to a specific tale or telling style if he has one,
      so the answer isn't just yes/no. *(folded into the draft)*
- [ ] Record his answer here:

  > (paste his response / summary here)

- [ ] Decision: SHIP AS-IS / MODIFY CLAUSE FOR ojer_tzij / EXEMPT ojer_tzij

### Drafted ask (for Jesse to send, edit, or voice however fits)

> Vincent —
>
> A form question about how The Elder closes a reading, not a content one.
>
> We've given the model a rule about the *shape* of a reading's ending:
> it should stop on something still unresolved in the seeker's own story
> rather than tie a bow on it. The examples we hand the model are:
>
> Good (open):
>   - "The jaguar has not finished crossing the river."
>   - "You have named the wound. You have not yet named what it is guarding."
>
> Bad (falsely open — trailing off, not enticing):
>   - "And so it continues…"
>   - "There is more, but that is for another time."
>
> Bad (resolved — closes the door):
>   - "You have found your answer and can move forward with confidence."
>   - "The path is now clear."
>
> The question: does ending on an unresolved image sit inside K'iche'
> oral-narrative convention — the way an ajq'ij or a storyteller actually
> lands the end of a telling — or is it a Western/screenwriting instinct
> we're importing and dressing up as tradition?
>
> If there's a specific tale, or a way you've heard endings handled, that
> would show us what "right" sounds like here, that's more useful to us
> than a yes/no.
>
> Three possible outcomes on our side: keep the rule as-is for the K'iche'
> voice, change it for that voice, or drop it for that voice entirely.
> Your read decides which.

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
