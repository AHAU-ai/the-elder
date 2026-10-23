# Living-holder corroboration notes

**Status:** proposal. **Unbuilt, and deliberately not started.** It begins only
after the fork pilot has run and its review page exists
(`docs/fork-pilot.md`, section 6). Nothing here is authorized scope; it follows
the shape of `docs/axis-2-marker-trajectory.md`, and the idea comes from
`docs/axis-3-forward-architecture.md` ("A second retrieval corpus per lineage,
lineage-holder-authored rather than ingested").

## The idea

For a lineage with a living practitioner (the Norse practitioner is the case that
prompted this), let that person author short, versioned **corroboration notes**:
held commentary on what a recurring marker tends to mean in their tradition. Not
source text. Retrievable the way passages are, but authored for the purpose.

What changes is what a provenance block claims. Today a cited passage says "the
text says". A note says "a living holder of this tradition says", which is a
claim about a person's judgment and carries their accountability. That is why the
generation contract (ELD-009) must be revised before any of it ships.

## The failure mode being guarded against

A model attributing words to a real person that they did not say, or that they
said about something else, or that they would not say to this seeker. In this
domain a fabricated connection is a trust violation (Axis 2). A note is a
sentence in a named person's voice; retrieval picking the wrong one, or the model
paraphrasing it, puts words in their mouth.

## Preconditions (all, before any code)

1. The fork pilot's review page is written, and its withdrawal drill worked.
2. The holder consents **in writing**, for this use, with the withdrawal right
   the fork contract describes (a single written statement is enough to revoke).
3. The holder reviews every note as it will appear, and the exact provenance
   sentence that cites it, and approves each by name and version. Their approval
   is for that specific item (the same rule as Vincent's letter, section 6.1).
4. ELD-009 revised: the generation contract states that a note is quoted
   verbatim, attributed, never paraphrased, and never presented as the Elder's
   own view.
5. A decision on forks: a note travels with a fork only with the holder's separate
   consent for that fork. Default is that it does not.
6. Lineage review of the voice it would attach to (for Norse, the voice has no
   named bearer in this repository today; see `flags.ts`).

## Shape, if it is built

- **Authored, not extracted.** Notes are written by the holder in their own words.
  No model drafts, edits or summarizes them.
- **Scoped to a marker type and a lineage.** A note about "wound" in Norse cannot be
  retrieved for another lineage's voice (lineage lock, as G3 in figure continuity).
- **Corroborates, never creates.** Axis 3 item 3: a note can be surfaced only for a
  marker that already crossed the Axis 2 floor by the seeker's own confirmations.
  It narrows which thing is said; it never decides that something is true of the
  seeker.
- **Versioned and withdrawable.** Each note has a version and the holder's approval
  date; withdrawing removes it from retrieval immediately.
- **Verbatim and attributed.** Surfaced as a quotation with the holder's chosen
  attribution. If they prefer anonymity, the claim is "a holder of this tradition",
  never a name they did not approve.
- Storage would reuse `retrievable_passage`'s build gate (`approved` plus `open`)
  with a distinct kind, so the existing gates apply and a note cannot be mistaken
  for source text.

## What it does not do

No cross-seeker pooling, no model-authored notes, no counts, and no loosening of
the appearance floor or the welfare gate. It does not use anything from the
seekers' records to decide what a holder should write.

## Next step

When the preconditions hold: a decision record in this shape naming the failure
mode, then the holder's written consent and the ELD-009 revision, then a schema.
