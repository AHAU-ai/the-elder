# Canonical Spec Repository — Architecture Decision Records

> *"The project has a build gate for sacred text and no build gate for its own decisions."* — v3 audit, Territory 5

This directory is the **single source of truth for every standing ruling** in THE ELDER. Its purpose is to defeat *architectural amnesia*: the decision silently re-made eighteen months later, contradicting an earlier ruling no document recorded.

## The rule

**Every working session — human or AI-assisted — begins by reading this directory, not by remembering.** Before any voice spec, prompt, or architectural choice is changed, check whether an ADR governs it. If one does, it is binding until formally superseded by a new ADR. If none does and the choice is consequential, write one.

## ADR lifecycle

An ADR is `proposed`, then `accepted`, then possibly `superseded` (by a later ADR, which links back). ADRs are **append-only**: never edit an accepted ADR's decision; supersede it. The history is the provenance.

## Index of standing rulings

| # | File | Ruling | Status | Authority |
|---|------|--------|--------|-----------|
| 0001 | [ADR-0001.md](ADR-0001.md) | COSMO permanently retired; no named convergence voice | accepted | Founders |
| 0002 | [ADR-0002.md](ADR-0002.md) | Always "the Pythia of Delphi," never "the Oracle of Delphi" | accepted | Founders |
| 0003 | [ADR-0003.md](ADR-0003.md) | Imox-first nahual ordering | accepted | Lineage (Stanzione) |
| 0004 | [ADR-0004.md](ADR-0004.md) | Calendar anchor: 22 April 2020 = 5 Kawoq | accepted | Lineage (verified) |
| 0005 | [ADR-0005.md](ADR-0005.md) | Babalawo deferred pending initiated Yorùbá consult | accepted | Standing rule |
| 0006 | [ADR-0006.md](ADR-0006.md) | Readiness = signal-based (5 markers), not turn-counter | accepted | Founders |
| 0007 | [ADR-0007.md](ADR-0007.md) | Lineage Integrity: each voice divines only from its own field | accepted | Constitutional |
| 0008 | [ADR-0008.md](ADR-0008.md) | Cruz Maya position mapping (Origin −8 TOP, Destiny +8 BOTTOM, etc.) | accepted | Lineage |
| 0009 | [ADR-0009.md](ADR-0009.md) | Fail-toward-silence as the universal failure outcome | accepted | Constitutional |
| 0010 | [ADR-0010.md](ADR-0010.md) | Canonical Unicode form: saltillo = U+02BC | accepted | Engineering + lineage |
| 0011 | [ADR-0011.md](ADR-0011.md) | **OPEN** — Chol Q'ij day-boundary semantics | **proposed** | **Flagged for Ajq'ij review** |
| 0012 | [ADR-0012.md](ADR-0012.md) | **OPEN** — Venus at conjunction (neither Morning nor Evening Star) | **proposed** | **Flagged for Ajq'ij review** |

ADRs 0011 and 0012 are the audit's deepest finding in action: *when the code must choose and the tradition has not spoken, the choice is a flagged question, never a silent default.* They remain `proposed` and the calendar engine MUST fail-toward-silence on affected birth times until an Ajq'ij ruling closes them.
