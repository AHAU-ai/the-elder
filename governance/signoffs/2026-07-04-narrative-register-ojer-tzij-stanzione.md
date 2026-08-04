# Narrative Register Signoff — ojer_tzij

**Date:** 2026-07-04
**Reviewer:** Vincent Stanzione (K'iche' Maya lineage authority, accountability holder for ojer_tzij)
**Artifact reviewed:** `NARRATIVE_REGISTERS.ojer_tzij` in `lib/narrativeForm.ts`
**Contract:** NARRATIVE-01

## Text reviewed

> The telling moves as the old words move — in pairs, in parallel,
> event flowing into event. A reading is not parts of a chart but
> one story of the corn: what was planted, what house it passes
> through, what harvest waits. A return is the next season of a
> field already sown.

## Context

Vincent Stanzione reviewed the existing K'iche' Maya register content
and the Elder's lineage architecture directly with Jesse Barber on
2026-07-04, and authorized this register text for use at law tier
(the Han-cadenced narrative form layer, gated per NARRATIVE-01).

## Effect

`ojer_tzij` moves from `floor` to `law` tier in
`governance/narrative-tiers.json` and `governance/checklist.yaml`,
effective this commit. At law tier, `composeNarrativeBlock("ojer_tzij", ...)`
will inject `NARRATIVE_LAW` (the Law of the Telling) and this register
alongside the universal `NARRATIVE_FLOOR`, per the composition order
specified in `lib/narrativeForm.ts`.

## Note on process

Standing governance practice ties lineage signoff to a specific
reviewed artifact (see `governance/signoffs/2026-06-28-lineage-gate-trajectory-stanzione.md`,
`2026-06-30-marker-offer-register-stanzione.md`). This document
follows that pattern for the narrative register specifically, as
distinct from any broader authorization Vincent may have given
elsewhere for ojer_tzij's overall generation contract or corpus
grounding.
