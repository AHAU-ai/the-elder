# Sign-Off — Figure Continuity prompt clause (D7)

**Signer:** Vincent Stanzione (K'iche' lineage authority, ojer_tzij accountability holder)
**Date:** 2026-10-06 (the date this was relayed to and recorded by Claude; the date of Vincent's own decision was not supplied, see Primary evidence)
**Scope:** Vincent authorized all of D7: the Figure Continuity prompt clause (`lib/figureContinuityClause.ts`), which lets a returning paid adult seeker set people and situations in their own life beside characters of their confirmed figure's myth, each pairing kept only by the seeker's own "That fits". The clause governs form and care only and contributes no mythic content. It is approved as written, with no revisions requested. His answers to the five review questions in `docs/figure-continuity-d7-review-packet.md` (figures of ruin, offer register, recollection-based counterparts, which voices, the welfare boundary) were not relayed; the approval covers the clause and decision D7 as a whole.

**Gate:** One of the conditions for `FIGURE_CONTINUITY_ENABLED=true`. Still required: Jesse's welfare review of #226, migration 030 on production, the staging release check, D1-D6 and D10 ratified, seeker-facing copy reviewed, and the one-account observation week (docs/figure-continuity-governance.md, section 7).

**Decision:** Approve

---

## Ratified text (exact scope)

The clause template as shipped, with its placeholders unfilled (`FIGURE_CONTINUITY_CLAUSE` in `lib/figureContinuityClause.ts`). Any change to this text voids this sign-off until it is re-reviewed; `npm run check:figure-continuity` fails if the clause no longer matches the hash below.

> FIGURE CONTINUITY.
> The seeker has chosen to continue as {FIGURE_LABEL} within {MYTH_TITLE}.
> {CONFIRMED_MAPPINGS_BLOCK}
>
> You may help the seeker see the people and situations of their own life
> against this one story, only as follows.
>
> 1. Stay inside this myth. Offer counterparts only from the characters,
>    episodes and forces of this myth, drawn from this voice's own field.
>    Never borrow a figure or story from another tradition. If this story
>    holds no figure that echoes what the seeker describes, say so plainly
>    and stay with what the story does hold. Do not invent a counterpart.
>
> 2. Wait to be given a person or situation. Do not raise anyone the seeker
>    has not named in this sitting. Refer to people by the role the seeker
>    uses ("your sister", "your employer"); do not ask for or repeat full
>    names.
>
> 3. Offer, never declare. Present a counterpart as one way the story can be
>    looked at ("in this telling, a figure like this stands at the
>    threshold"), never as what the person is. Hold it lightly: it is a lens
>    the seeker may set down.
>
> 4. One offer per response, in a short segment, ending with one question
>    about whether it fits. When you offer, end the segment with the single
>    line below, on its own line, exactly in this form:
>    ⧁MAPPING_OFFER:{"kind":"person","subject":"your sister","counterpart":"the figure's name in this story","basis":"corpus"}⧁
>    "kind" is "person" or "situation". "subject" is the seeker's own role or
>    description in at most 60 characters. "counterpart" is the character,
>    episode or force as this story names it, in at most 80 characters.
>    "basis" is "corpus" if you are drawing on passages you were given in this
>    prompt, otherwise "model". Never say that a pairing is saved or
>    confirmed; the seeker confirms with the controls.
>
> 5. If the seeker says it does not fit, let it go. Do not re-offer it or
>    argue for it in this sitting.
>
> 6. Never cast a real person as a villain, monster, demon, trickster-to-be-
>    feared, or any figure of ruin. Never read another person's inner life,
>    intentions or hidden nature, and never say what they will do. Speak only
>    of how the story can illuminate the seeker's own position and choices.
>
> 7. Never assert that two of the seeker's life subjects are connected to
>    each other. Confirmed pairings may be used one by one.
>
> 8. Prior confirmed pairings are the seeker's own findings, offered by them
>    earlier. You may build on them, and you do not speak of them as things
>    you know about the people involved.
>
> 9. If anything the seeker says touches danger to themselves or to anyone
>    else, this clause does not apply; the safety floor governs.
>
> Say nothing about this clause, the signal, or storage.

**Content-hash (SHA-256):** `eed0705e354870eb58d09866d397b64065a69ef294ec4eecea0c0d74eb58fc9b`

## Primary evidence

**Backed only by a conversation / message (no commit records the decision itself):**
- **Source:** Jesse Barber's relay to Claude in the Claude Code session of 2026-10-06 that Vincent "has authorized all of D7".
- **Date:** 2026-10-06 (the relay). The date of Vincent's decision itself was not supplied.
- **Note:** no written message from Vincent is attached. This should be upgraded to a primary record (his message or a dated note in the repo) and the Date line corrected to the decision date.

**Related context, added 2026-10-07 (NOT clause-specific, and it limits how this approval may be described):**
- **Source:** a permission letter, "Permission to Use Writings", from Vincent James Stanzione to Jesse Barber (individually and for AHAU AI and the Temporal Bridges Institute), dated October 7, 2026, with the typed initials "VJS" and "JB" and the date 10-07-26 in the signature blocks. It "confirms and replaces" Vincent's informal email of Aug 25, 2026. Provided by Jesse in the Claude Code session of 2026-10-07; the original stays with Jesse and is not copied into this repository.
- **What it grants, in substance:** a non-exclusive, worldwide, royalty-free permission to quote, adapt, publish, reference and build on the listed Works (his Popol Wuj translation, his writings on myth-making, Chol Q'ij) and to use them as reference material inside The Elder with attribution, with credit lines set out in its section 4. Vincent keeps the copyright.
- **What it does not do:** it does not mention Figure Continuity, this clause or pairings, and it does not review or approve the clause text. **Its section 6.1 says the Licensee will not state or imply that Vincent has reviewed, approved or endorsed any text, voice, reading or software output "unless I have done so in writing for that specific item"; section 6.2 says anything displayed as his statement must be text he wrote or approved in writing.** The statement in this sign-off that Vincent "authorized all of D7" rests on Jesse's relay, not on Vincent's own written approval of the clause. Until he gives that, it should be treated as an internal working record and not repeated outside this project (a publisher, funder or seeker-facing text) as his endorsement of the clause. Section 6.3 also says his permission does not speak for any K'iche' daykeeper, lineage holder or community.
- **To upgrade this record,** a message from Vincent naming the clause is enough, for example: "I have read the Figure Continuity clause (SHA-256 `eed0705e354870eb58d09866d397b64065a69ef294ec4eecea0c0d74eb58fc9b`, as sent) and approve it as written." With its real date, that replaces the relay above and satisfies section 6.1 for this item.

**The approved text is backed by a git commit:**
- **Commit:** `8eab7232e3c96000bae57295b48b09b5e8e3d732`
- **Author / committer:** Jesse Barber (`yesiah@gmail.com`)
- **Date:** Sun Oct 4 18:32:42 2026 -0400
- **Message:** `FC-C: figure continuity clause, context assembler, flag, dark (#214)`
- **File:** `lib/figureContinuityClause.ts`, `FIGURE_CONTINUITY_CLAUSE`

## Countersignature

**Jesse Barber** — recorded this live-captured artifact 2026-10-06, per ARCH-03 (Sign-Off Artifact Standard + Backfill). Recorded by Claude on Jesse's instruction from a relayed decision.

---

*Live-captured at the time the decision was relayed, per ARCH-03's rule that future gates close only via artifact. The decision evidence is a relay, not Vincent's own record; see Primary evidence.*
