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
