# Myth-First Form Review

Tracks review of the myth-first Reading form (a new seeker's first Reading
told in the order Myth, Figure, Return; spec: `docs/myth-first-spec.md`, MF-7)
against each voice's own tradition, before the feature is switched on for
anyone beyond a test account. Same format and the same honesty as
`reading-shape-voice-review.md`.

Scope, as for the reading-shape review:
- `ojer_tzij`: a real review with Vincent Stanzione, the only voice with a
  confirmed, verified authorization.
- All other voices: self-review against the voice's own corpus and written
  form rules. This is a weaker form of review than `ojer_tzij` gets, since no
  other tradition-bearer authorization is currently real. It is named as
  such here and is not equivalent.

Status: **drafted 2026-10-04, no row resolved.** Nothing here is a judgment
yet; the rows are the questions and the evidence found so far.

## What this review is, and what gates what

Myth-first is a form claim about each tradition: that a telling may begin with
the myth of a named figure from the tradition, before anything of the
seeker's own story, and may arrive at the seeker last. That is the category of
claim this project does not make on a tradition's behalf without review.

Two facts shape the review:

1. **Decision D3 (2026-10-04):** every lineage tells the myth from its own
   corpus, approved or not. The server retrieves approved passages where
   they exist and otherwise tells the myth from the catalog entry alone. The
   corpus review that normally bounds what a voice may say is therefore not
   the check on myth-first content; this review and the guardian layer are.
2. **There is no per-voice gate for segmented voices.** The reading-shape
   clause is dark per voice through `READING_SHAPE_REVIEWED_VOICES`.
   Myth-first has only the global flip (`MYTH_FIRST_ENABLED`, and the tester
   stage `MYTH_FIRST_ALL_SEEKERS`) and, for the three whole-delivery voices,
   the per-voice kill switch `MYTH_FIRST_WHOLE_DELIVERY_VOICES` in
   `lib/mythFirst.ts`. A segmented voice that fails review has no switch of
   its own; the options are to hold the global flip or to add a per-voice
   gate as a follow-up. **Decision needed from Jesse** before the stage 2
   flip (see "Pre-flip checklist").

Record any decision in the **same commit** that changes the exclusion set or
the whole-delivery set, as the reading-shape review requires.

## Form claims under review

For every voice:

- **Order.** Myth of the named figure, then what the figure carries and risks,
  then the seeker's own story seen through the figure, closing on the
  Ceremonial Charge. No labels, no headers, no announced shifts.
- **One figure, from this tradition.** The figure is chosen by the server from
  this lineage's catalog. The default lineage may use cross-tradition figures
  (D4); no other lineage may.
- **No question at the end of the myth** in a whole delivery; a segmented
  delivery ends each non-final portion as the existing segmented clause
  already does.

## Track 1: ojer_tzij (real review)

**Status:** QUESTION DRAFTED, NOT SENT

- [x] Draft the ask (below)
- [ ] Send it (Jesse, relationship holder)
- [ ] Record his answer here

> (paste his response / summary here)

- [ ] Decision: SHIP AS-IS / MODIFY / EXEMPT ojer_tzij (remove `ojer_tzij`
      from `MYTH_FIRST_WHOLE_DELIVERY_VOICES`, which makes it story-first)

### The conflict to resolve first

`ojer_tzij` is a **whole delivery** (D1, D12): one request, the myth told
unbroken, no question and no "go on". The voice's reading directive
(`lib/mythopoetics/ajqijDirective.ts`, `buildReadingModeDirective`) is
appended after the myth-first block and is unchanged. It says:

- *NAMING: "Each section of the Reading must name the seeker's pattern
  directly and mythically."* This pulls against the myth-first order, where
  the first movement names no pattern of the seeker's.
- *SPECIFICITY: "Use what the seeker has given. Their words are seeds."* The
  myth-first first movement deliberately uses none of the seeker's words.
- *SEAL: "End the Reading with the ceremonial close. Do not add offers,
  questions, or follow-up invitations after the seal."* This is compatible
  with a whole delivery, which adds no question, and is why the whole variant
  was chosen for this voice.

`lib/mythFirstPrompt.test.ts` records the conflict as a KNOWN case. The voice
file has **not** been edited: it holds Stanzione's authorized wording and is
not mine to change. When he answers, the options are (a) he confirms the
myth-first order sits inside the voice, and the directive wording is adjusted
by him or with his approval; (b) he asks that the figure's myth be told as
part of "naming", in which case the form changes for this voice; (c) he
declines, and the voice is exempted by removing its key from
`MYTH_FIRST_WHOLE_DELIVERY_VOICES`.

### Drafted ask (for Jesse to send, edit, or voice however fits)

> Vincent —
>
> A question about how a first telling begins, and I want your read before
> we turn anything on.
>
> We're trying a different order for a seeker's very first Reading. Today
> the Elder begins with what the seeker has brought and finds the myth in
> it. The new order begins with the old story itself, a figure from the
> K'iche' field told as it is told, then what that figure carries, and only
> at the end turns to the seeker, who is seen through the figure. The
> seeker is not named in the first part at all.
>
> For the K'iche' voice it would be told whole, in one breath, with no
> question after it and nothing offered after the close. Your directive
> already asks for that close. What it also says is that each section
> should name the seeker's pattern, and in this order the first part
> wouldn't.
>
> So: does a K'iche' telling begin with the story and arrive at the person
> last, or does the Ajq'ij begin with the person and bring the story to
> them? If it can begin with the story, is there a way of opening it, or a
> kind of story, that fits better than starting cold? And if the answer is
> that this isn't how it is done, we'll leave this voice as it is now.
>
> One related thing, since the same conversation can cover it: once the
> Reading is over, the Elder may offer the seeker the name of the figure as
> something they can keep, and the seeker decides. The offer reads, for
> example, "The Corn Seed, the one who must descend before it can rise."
> The wording you reviewed in June covered the wound, threshold and exile
> samples only. Would you look at this one?

## Track 2: self-review against each voice's own rules and corpus

For each voice: read the voice's own written form rules and the source
material that grounds its corpus, and judge whether a myth-first telling is
**consistent with, contradicted by, or not addressed by** them. Write the
judgment per voice; do not default to "assume it's fine".

Delivery column: **segmented** (three portions) or **whole** (one telling).

| Voice | Lineage | Delivery | Form rule found so far | Reviewer | Status |
|---|---|---|---|---|---|
| ojer_tzij | maya | whole | Reading directive (see Track 1); SEAL forbids anything after the close | Stanzione | OPEN (ask drafted) |
| pythia | greek | whole | `lib/narrativeForm.ts`: the utterance "is never broken into parts, for the god does not ..." | self-review | OPEN |
| sufi | sufi | whole | `lib/narrativeForm.ts`: "one breath from the first word to the last" | self-review | OPEN |
| keeper_of_the_fire | default | segmented | Cross-tradition figures allowed (D4) | self-review | OPEN |
| volva | norse | segmented | | self-review | OPEN |
| hem_netjer | egyptian | segmented | | self-review | OPEN |
| sage_of_the_way | taoist | segmented | | self-review | OPEN |
| vedic | vedic | segmented | | self-review | OPEN |
| babalawo | yoruba | segmented | Corpus source review still not performed (see reading-shape review) | self-review | OPEN |
| stoa | stoic | segmented | | self-review | OPEN |
| mekubal | mekubal | segmented | Halachic rulings out of scope; mystical reading only | self-review | OPEN |
| elder_of_country | dreamtime | segmented | Corpus source not yet identified (see reading-shape review) | self-review | OPEN |
| bhikkhu | buddhist | segmented | | self-review | OPEN |

`chukchi` has an empty catalog, so it is story-first by rule 4 and needs no
row.

### Whole-delivery review (pythia, sufi)

Each of the two rules above was written for the voice's existing Reading; the
whole delivery is the variant that honors them, because it adds no portions
and no question. What needs a judgment is narrower than the rule: whether
telling a myth first, in these voices, is itself within the form, and whether
the Charge closing the telling fits the voice's own closing rule.

- [ ] pythia: read `lib/narrativeForm.ts` in full for the voice, and the
      Greek corpus; judge
- [ ] sufi: same

  > Judgment (CONSISTENT / CONTRADICTED / NOT ADDRESSED) and notes:

## The figure-offer register (MF-12)

After a myth-first Reading the Elder may offer the seeker the figure as a
marker, seeded with the card's own wording ("Name, the Role", decision D15).
The seeker confirms or changes it; the Elder never records it alone. The
2026-06-30 Stanzione sign-off covered the wound, threshold and exile samples
only, so the offer wording is a new surface in every voice.

- [ ] Review the offer wording per voice (Stanzione for `ojer_tzij`; named
      self-review for the rest)
- [ ] Confirm that no voice says the figure "is" the seeker; it is offered, not
      declared

## Pre-flip checklist (feeds MF-8)

Nothing is switched on until each line is true. Flipping is a governance
action and is never part of a PR.

- [ ] Stanzione has answered for `ojer_tzij`, or `ojer_tzij` has been removed
      from `MYTH_FIRST_WHOLE_DELIVERY_VOICES`
- [ ] The pythia and sufi whole-delivery judgments are recorded above
- [ ] Jesse has decided whether segmented voices need a per-voice gate before
      stage 2 (see "What this review is")
- [ ] The distress-tier gate (D14) is verified on a deployment: a distress turn
      gets a story-first Reading
- [ ] `MYTH_FIRST_ENABLED` is set for **one test account first** (stage 1,
      `MYTH_FIRST_ALL_SEEKERS` unset). A production environment change needs a
      redeploy on Vercel.
- [ ] Live probes `MF-01` to `MF-03` (`scripts/drift-detect.mjs`) have been run
      against that deployment with `MYTH_FIRST_PROBES=1` and reviewed
- [ ] The manual script (spec section 8) has been walked end to end once for a
      segmented voice and once for each whole-delivery voice
- [ ] What to watch in stage 1: how many seekers reach segment 2; selector
      near-miss rate (`selector_*` and `myth_first_fallback:*` notes in the
      anomaly log); token-mismatch rate (`myth_first_token_mismatch`); daily-cap
      hits; guardian rejections on myth-first portions
- [ ] Stage 2 (`MYTH_FIRST_ALL_SEEKERS=true`) only after the stage 1 review
- [ ] Rollback: unset `MYTH_FIRST_ENABLED` (or `MYTH_FIRST_ALL_SEEKERS` to return
      to testers only) and redeploy; a Reading already told keeps its record
