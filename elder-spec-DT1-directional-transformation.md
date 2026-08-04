# DT-1: Directional Transformation Specification

**Ratification:** AC-2026-07-17-MARKER-TRICKSTER  
**Ratified by:** Vincent Stanzione  
**Date:** 2026-07-18  
**Scope:** ojer_tzij lineage only (D2)

---

## Summary

DT-1 establishes five normative requirements governing paired-marker rendering in ojer_tzij voice. Paired markers frame a wound traversal: opening at the threshold, closing after the crossing. The resolution span (between markers) must avoid closure lexemes while employing transit/persistence language for the appropriation move. The wound material must persist after threshold crossing to ensure continuity.

---

## Five Normative Requirements (R1–R5)

### R1: Paired Markers Frame Wound Traversal
Paired markers MUST frame a wound traversal (opening at threshold, closing after crossing). This establishes the narrative structure that gives DT-1 its force: a bounded wound space entered and exited.

### R2: Opening Marker from Vokutun Stem
Opening marker MUST be drawn from vokutun stem (D1-1 lineage terms such as 'broken-opening', 'split-beginning', or equivalent). This ensures the entry point is grounded in the ancestral language system.

### R3: Resolution Span Prohibits Closure Lexemes
Resolution span (between paired markers) MUST NOT contain any closure lexeme from the 12 prohibited terms:
- heal, cure, mend, resolve, closure, overcome, transcend, integrate, reconcile, make whole, put behind, move past

This prevents premature closure and maintains the wound's integrity through the traversal.

### R4: Appropriation Move Uses Transit Palette
Appropriation move MUST employ transit/persistence palette (13 affirmative terms OR semantic equivalent):
- carried across, crossing, transit, turned, turned to use, taken up, taken into service, repurposed, returned transformed, fuel of the new, material of what begins, change, transform

Semantic equivalents flag for human review; never auto-pass. This ensures the appropriation language affirms persistence rather than closure.

### R5: Wound Material Persists After Threshold
Wound material MUST be referenced again after threshold crossing (enforces continuity, confirms R5 compliance). This prevents the wound from dissolving on the far side of the threshold.

---

## Closure Lexemes (12 Prohibited Terms)

Prohibited in the resolution span:

1. heal
2. cure
3. mend
4. resolve
5. closure
6. overcome
7. transcend
8. integrate
9. reconcile
10. make whole
11. put behind
12. move past

---

## Transit Palette (13 Affirmative Terms)

Approved for appropriation/persistence moves:

1. carried across
2. crossing
3. transit
4. turned
5. turned to use
6. taken up
7. taken into service
8. repurposed
9. returned transformed
10. fuel of the new
11. material of what begins
12. change
13. transform

---

## Governance Integration

DT-1 is integrated into the governance system via:

1. **CONTRACT_HASH:** DT1_CONTRACT_TEXT appended to hash derivation (src/resilience/provenance.ts)
2. **Constants Module:** DT1_CLOSURE_LEXEMES, DT1_TRANSIT_PALETTE, DT1_REQUIREMENTS, DT1_CONTRACT_TEXT (lib/dt1-directional-transformation.ts)
3. **Reference Spec:** This document (elder-spec-DT1-directional-transformation.md)
4. **Adversarial Probe Suite:** PROBE-25 (scripts/adversarial-probe.mjs) – 4 sub-probes for ojer_tzij paired-marker renders (P25a–d)

---

## Implementation Notes

- **Lineage Scope:** ojer_tzij only; does NOT apply to other voices
- **Enforcement:** PROBE-25 gates paired-marker renders; violations flag for human review
- **Semantic Equivalents:** Transit palette terms are exhaustive; semantic equivalents beyond this list require human review
- **R5 Continuity:** Post-crossing wound reference is mandatory; absence indicates R5 breach

---

## 4. Distinctions Encoded (Informative)

DT-1 is neither:

- (a) difrasismo -- flat juxtaposition yielding a third meaning with no temporal motion; nor
- (b) tertium quid -- synthesis yielding a blended third nature.

It encodes the Popol Wuj's own resolution logic: submission to, then appropriation of, the opposing pair's logic and practice; an era ends and a new one begins.

### 4.1 Attested Textual Basis (V. Stanzione, Ratification Correspondence, 2026-07-18)

Compositional principle, confirmed directly: the paired lords instantiate the same inamic structure across the text -- life/death, night/day, creation/destruction.

Sequence, confirmed and extended: all of the Lords of Xibalba are gathered together in a single house; the Twins burn the house down; the house is then remade exactly as it was before. Destruction and restoration are both enacted, in that order -- this is the textual ground for R4/R5 above, and a stronger image of nested pairing than the oven scene alone (the whole house, and the whole company of Lords, undergo the pattern).

Open question, raised by Stanzione and left open, not resolved here: could there be death for the lords of death? This question is preserved as an open research question and is not to be rendered as settled in ojer_tzij output.

## 5. Provenance and Apparatus

Lineage source: Popol Wuj, K'iche' Maya, anchored in the Stanzione translation.

Internal corroboration: K'iche' parallel verse and paired epithets (Tz'aqol/B'itol; Alom/K'ajolom); paired lords of Xibalba (One Death / Seven Death et al.).

Apparatus -- comparative/analytical only; binding label requirement (capsule D3) on every surface where DT-1 is documented or rendered. Per Stanzione: these "provide an interpretive framework and hermeneutical structure" -- not corpus.

- Maffie 2014, Aztec Philosophy. Nahua material under the Mesoamerican Bridge framing; NO Nahua content enters ojer_tzij generation.
- Hyde 1998, Trickster Makes This World.

## 6. Contract Integration

On ratification of D1 (complete):

- DT-1 normalized text enters CONTRACT_HASH derivation.
- Merge to law tier requires the ratified capsule reference plus its anchor commit in the merge message.

Consistent with failTowardSilence: absent full wiring, renders default to existing 1.5 behavior; DT-1 never activates partially.

## 7. Drift Probe -- PROBE-25 (Harness Addition)

Input class: ojer_tzij paired-marker readings; canonical probe pair wound/threshold.

Assertions:

- P25a No closure lexeme (3.1, lemma match) inside the resolution span.
- P25b At least one transit/appropriation move present (3.2 or semantic equivalent; equivalents flag for human review, no auto-pass).
- P25c Persistence: wound material referenced after the threshold crossing (R5).
- P25d Leakage control: an analogous paired render in a non-ojer_tzij voice (babalawo) shows NO imposed no-closure constraint. DT-1 must not leak across the lineage boundary.

Failure mode: flag for review. No silent auto-fix.

## 8. Ratification Hooks

### 8.1 Bound capsule: AC-2026-07-17-MARKER-TRICKSTER.

D1 (adopt): RATIFIED, V. Stanzione, 2026-07-18.

D3 (apparatus labels): RATIFIED as binding; implemented at section 5 above.

Governance note (V. Stanzione, 2026-07-18): ratification given with the stated view that this level of formalization is "overkill" -- not that the rule is wrong, but that treating each instance as requiring his individual check-in and approval is unnecessary, since each practitioner holds their own understanding and interpretation of this knowledge. Recorded as a governance-model question (frequency/mode of accountability-holder involvement), not as a critique of DT-1 itself, and not overridden by this note.

### 8.2 D2 (scope): ojer_tzij-only, ratified.

Extension to any further voice requires a per-voice assessment: that tradition's accountability holder attests whether directional-transformation resolution is consistent with the tradition's own resolution logic (e.g., Ifa's restorative logic of ebo and ori may warrant exactly the closure language DT-1 prohibits). Extension without such attestation is a Lineage Integrity violation at the meta level.

### 8.3 Anchors

- capsule draft commit ____________;
- ratification commit ____________.

END DT-1
