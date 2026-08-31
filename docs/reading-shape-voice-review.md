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
until every row below is RESOLVED. As of 2026-08-30 a per-voice gate
enforces this in code — see "Status" and "Rollout gating" below.

---

## Status — 2026-08-30

**DECIDED: per-voice gate. The clause is now dark for every voice pending
this review.**

Background: the clause had been shipping un-gated. `lib/system-prompt-builder.ts`
appended `READING_SHAPE_CLAUSE` on `readingMode` alone, with no per-voice
check, so the closing-shape convention was live for ojer_tzij, babalawo,
dreamtime, Mekubal, bhikkhu, and the seven placeholder voices alike, ahead
of any review here.

The decision (per-voice gate, not ship-anyway) was made because the clause
is a *form claim about each tradition's own way of ending a telling* — the
exact category of claim this project does not make on a tradition's behalf
without review (same reasoning that governs voice scaffolding generally).
The clause governs form only and its absence just means readings may close
more conclusively for a while — a reversible, low cost. Ship-anyway would
have required asserting the convention is right for eleven-plus traditions
on no evidence.

Implementation: `READING_SHAPE_REVIEWED_VOICES` in `lib/readingShapeClause.ts`
is an allowlist, currently empty. `readingShapeClauseApplies(voiceKey)`
gates the append in `system-prompt-builder.ts`. Re-enable a voice by adding
its voiceKey to that set **in the same commit** that records its CONSISTENT
judgment (or a documented ship-anyway) below.

Track 1: the ask to Stanzione is drafted (below), not sent — that is
Jesse's call as relationship holder. Tracks 2 / 2b not started.

---

## Track 1 — ojer_tzij (real review)

**Status:** ASK DRAFTED — NOT SENT

- [x] Draft the ask to Stanzione (drafted 2026-08-30; see below)
- [ ] Send it (Jesse — relationship holder)
- [ ] Ask him to point to a specific tale or telling style if he has one,
      so the answer isn't just yes/no. *(folded into the draft)*
- [x] **Folded in from #135 (drift probe OR-03B):** ojer_tzij's generation
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

### Drafted ask (for Jesse to send, edit, or voice however fits)

> Vincent —
>
> One question about how a telling ends, and I want your read before we
> keep going.
>
> We've been shaping how The Elder finishes a reading. Right now we're
> steering it to end on something still open — an image left mid-motion,
> a thing named but not yet resolved — rather than on a summary or a
> reassurance. In practice that means endings like "the jaguar has not
> finished crossing the river," or "you have named the wound, not yet
> what it guards" — instead of "the path is now clear."
>
> What I don't know is whether that's how a K'iche' telling actually
> lands, or whether we've reached for a habit from somewhere else —
> film, Western storytelling — and told ourselves it's older than it is.
>
> So: when an ajq'ij or an older storyteller you've heard closes a
> telling, where do they leave it? Is an unfinished image a real way to
> end, or does a telling close differently than that — and if there's a
> particular story or a way of ending you can point me to, that helps me
> more than a yes or no.
>
> One more, related. The voice has a way of saying "the old words don't
> hold this" when the source texts are silent on something — that part we
> want to keep. But it's also been reaching for that same phrasing in a
> different situation: when the seeker simply hasn't told it something it
> would need — a date, a name, a number — and the honest move is to ask
> for it. Does the K'iche' voice have its own way of saying "I need you
> to tell me this before I can go on" that's distinct from "the old words
> are silent here" — or do those land the same way?
>
> Whatever you say, we'll follow for the K'iche' voice specifically —
> keep this, change it, or drop it. Until I hear from you it's switched
> off for that voice.

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

The per-voice gate exists: `READING_SHAPE_REVIEWED_VOICES` in
`lib/readingShapeClause.ts`, consumed by `readingShapeClauseApplies()` in
`system-prompt-builder.ts`. It is an allowlist and is currently **empty**,
so the clause is applied for no voice.

A voice is added to that set only when its row above shows a CONSISTENT
judgment, or an explicit documented ship-anyway decision with reasoning —
and the set edit goes in the **same commit** as that judgment, so the code
and this doc never drift.
