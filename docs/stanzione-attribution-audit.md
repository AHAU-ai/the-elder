# Audit: where the app attributes Vincent Stanzione or says "reviewed"

**Why:** Vincent James Stanzione's permission letter (October 7, 2026) requires (section 4) that he is credited by name, in set wording, wherever his works are quoted, adapted or relied on in public-facing form, and (section 6.1 and 6.2) that the Licensee never states or implies he reviewed, approved or endorsed any text, voice, reading or software output unless he did so in writing for that specific item. This audit covers `app/`, `src/`, `lib/` and `components/` as of `main` at commit `6298914`. It is a reading of the source, not legal advice. The original letter stays with Jesse and is not in this repository.

## What changed in this PR

The provenance block (`renderProvenanceBlock`, `src/resilience/provenance.ts`) now appends the letter's credit line whenever a reading drew on a passage whose source names him:
- his Popol Wuj translation, introduction and layered renderings: "Popol Wuj translation and interpretation by Vincent James Stanzione, © 2026 Vincent James Stanzione. Used with permission."
- his other writings (teachings, ruminations, transcripts, Notion material): "From the writings of Vincent James Stanzione. Used with permission."

The year (2026) is one constant, `STANZIONE_CREDIT_YEAR`. Both lines are tested against the letter's exact wording, and every real corpus source in the repo that names him is classified in the test, so a new corpus file naming him cannot ship without a decision about its credit.

## Findings

### A. Seeker-facing (what a seeker can see or receive)

| # | Where | What it says | Status |
|---|---|---|---|
| A1 | `renderProvenanceBlock`, grounded branch | "retrieved from **lineage-reviewed** source text" | **Fixed 2026-10-08 (Jesse: "make it neutral").** Now reads "retrieved from source text in the instrument's corpus", for every voice. |
| A2 | The same block | No credit to Vincent anywhere before this PR | **Fixed in the block (this PR). Not yet visible: see A3.** |
| A3 | Reading screens (`CouncilTabs.tsx` and friends) | Nothing renders `provenanceBlock`. The client uses only the machine stamp `_provenance`. The block is returned by `/api/divine` and never shown. | **Open by decision (Jesse, 2026-10-08: "not yet").** Seekers currently see no credit at all. Showing it is new seeker-facing text on every reading screen and needs your approval of placement and wording. |
| A4 | Downloaded or shared PNG cards, `/share/[id]` | Carry the machine stamp (ids, versions, voice), no source names and no credit | Open with A3: a card that quotes his text would need the credit too. |

### B. Model-facing (instructions the model sees; the model can repeat them)

| # | Where | What it says | Note |
|---|---|---|---|
| B1 | `app/api/divine/route.ts` (grounding block) | "LINEAGE-REVIEWED SOURCE TEXT — retrieved for this seeker's question" | **Fixed 2026-10-08 with A1:** the label is now "SOURCE TEXT FROM THE CORPUS". |
| B2 | `lib/lineages.ts`, ojer_tzij voice | "Popol Wuj (Stanzione translation)" in the voice's epistemic mode and mythic register | Attribution, not endorsement. The model may name the translation; that credits him but not in the letter's wording. |

### C. Internal (code comments, governance records, never shown to seekers)

| # | Where | What it says |
|---|---|---|
| C1 | `src/resilience/flags.ts`, `lib/mythopoetics/*`, `lib/narrativeForm.ts`, `lib/psychopompLayer.ts` (comments) | "authorized — Vincent Stanzione", "standing authorization covers all ojer_tzij architectural decisions", "requires Vincent James Stanzione sign-off" |
| C2 | `lib/dt1-directional-transformation.ts` (`DT1_CONTRACT_TEXT`, hashed into the contract) | "Ratified via capsule AC-2026-07-17-MARKER-TRICKSTER by Vincent Stanzione (2026-07-18)" |
| C3 | `governance/signoffs/*` and the ceremonial changelog | Sign-offs attributed to Vincent, several backfilled from chat |
| C4 | `src/resilience/provenance.ts` `shortSource()` | Maps a source to "V. J. Stanzione"; it is **never called** (dead code), so it credits nothing |

These are internal records of his decisions. Section 6.1 asks for his written approval **per item** before anyone *states or implies* he approved something. For these records the question is whether each has his writing behind it, and none should be quoted outside the project as his endorsement without it. The D7 sign-off now says this explicitly (PR #256).

## Decisions for Jesse

1. **A1/B1 wording: DECIDED 2026-10-08, neutral for every voice** ("retrieved from source text in the instrument's corpus"; model label "SOURCE TEXT FROM THE CORPUS"). Tests keep "reviewed" out of both.
2. **A3 display: DECIDED 2026-10-08, not yet.** The credit stays in the provenance block only. Revisit when the display is wanted.
3. **Whether his written approval exists** for the 1,220 ojer_tzij passages and the voice, to support the words "reviewed" and "approved" in C1-C3 and A1.

## Gaps in the letter, for Jesse or counsel (not legal advice)

- 2(b) lists no titles (the bracket is blank), so it is unclear whether the Notion teachings and ruminations the corpus uses are covered. They are given the "writings" credit here on that assumption.
- The year in the translation credit was left blank in the letter; 2026 was chosen by Jesse and should be confirmed with Vincent.
- Section 3 limits retrieval and display "subject to Section 6", and section 4 asks for credit "in a published or public-facing form". Whether an API field nobody renders counts as public-facing is the question in A3.
- **Counsel:** Jesse reports (2026-10-07) that counsel reviewed the draft and approved it. Not independently verified here, and no counsel record is in this repository. The copy of the letter I was shown still carried the "Draft for review by counsel before signature" header and blank brackets (mailing addresses, governing law, the term, the 2(b) titles, the section 7 publisher-agreement check, the credit year), with typed initials as signatures. If the executed version has those completed, this note should point to it; if not, counsel's approval of the draft does not by itself settle the open terms.
