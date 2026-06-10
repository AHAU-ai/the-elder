# Canonical Spec Repository — Architecture Decision Records

> *"The project has a build gate for sacred text and no build gate for its own decisions."* — v3 audit, Territory 5

This directory is the **single source of truth for every standing ruling** in THE ELDER. Its purpose is to defeat *architectural amnesia*: the decision silently re-made eighteen months later, contradicting an earlier ruling no document recorded.

## The rule

**Every working session — human or AI-assisted — begins by reading this directory, not by remembering.** Before any voice spec, prompt, or architectural choice is changed, check whether an ADR governs it. If one does, it is binding until formally superseded by a new ADR. If none does and the choice is consequential, write one.

## ADR lifecycle

An ADR is `proposed`, then `accepted`, then possibly `superseded` (by a later ADR, which links back). ADRs are **append-only**: never edit an accepted ADR's decision; supersede it. The history is the provenance.

## Index of standing rulings (seed from existing canon)

These already-decided rulings must each become a numbered ADR:

| # | Ruling | Authority |
|---|--------|-----------|
| 0001 | COSMO permanently retired; no named convergence voice | Founders |
| 0002 | Always "the Pythia of Delphi," never "the Oracle of Delphi" | Founders |
| 0003 | Imox-first nahual ordering | Lineage (Stanzione) |
| 0004 | Calendar anchor: 22 April 2020 = 5 Kawoq | Lineage (verified) |
| 0005 | Babalawo deferred to Phase 2+ pending initiated Yorùbá consult | Standing rule |
| 0006 | Readiness = signal-based (5 markers), not turn-counter | Founders |
| 0007 | Lineage Integrity: each voice divines only from its own field | Constitutional |
| 0008 | Cruz Maya position mapping (Origin -8 TOP, Destiny +8 BOTTOM, etc.) | Lineage |
| 0009 | Fail-toward-silence as the universal failure outcome | Constitutional (v3) |
| 0010 | Canonical Unicode form: saltillo = U+02BC | Engineering + lineage |
| 0011 | **OPEN** — Chol Q'ij day-boundary semantics (midnight local / Guatemala / sunrise?) | **Flagged for Ajq'ij review** |
| 0012 | **OPEN** — Venus at conjunction (neither Morning nor Evening Star) | **Flagged for Ajq'ij review** |

Items 0011 and 0012 are the audit's deepest finding in action: *when the code must choose and the tradition has not spoken, the choice is a flagged question, never a silent default.* They remain `proposed` and the code MUST fail-toward-silence on affected birth times until an Ajq'ij ruling closes them.
