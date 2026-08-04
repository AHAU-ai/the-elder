# CHANGELOG.ceremonial.md
A record of significant ceremonial and architectural decisions in THE ELDER.

---

## Entry 001 -- June 10, 2026

**Event:** Consolidation phase opened. Governance artifact committed.

**Model version:** claude-sonnet-4-6 (pinned)

**Drift-detect probes:** 16 probes across 7 categories

**Files committed this session:**
- CONSOLIDATION.md -- six-phase consolidation plan
- GOVERNANCE.md -- founding epistemic stance (The Shell and the Fire)
- docs/WHITE-PAPER.md -- public field declaration (Applied Mythopoetics v2.0)
- docs/CONSECRATION.md -- founding vow (architectural note: predates current Council of Voices)
- CHANGELOG.ceremonial.md -- this file, first entry

**Vulnerability #8 status:** Closed. Drift-detect script is enforcement; GOVERNANCE.md is the written stance. All 7 probe categories now map to named clauses.

**Freeze declared:** No new features to main until v1.0-consolidated tag.

**Signed:** Jesse Barber

---
## Entry 002 -- June 30, 2026
**Event:** Gate-2 §1.5 marker-confirmation mechanism built and live-tested. Two governance gates cleared.
**Model version:** claude-sonnet-4-6 (pinned)
**Governance:**
- Shalom Ormsby ratified Appendix B (synthetic-intimacy ceilings).
- Vincent Stanzione approved the §1.5 marker-offer language, reviewing three live-generated samples (wound, threshold, exile markers) for authenticity as ceremonial reflection in the ojer_tzij field.
**Files committed this session:**
- `lib/returning/markers.ts` -- `selectMarkerToOffer()` and `buildMarkerOffer()` added alongside the existing `extractMarkers()`. Offer generation routes through `buildSystemPrompt('maya', ...)`, the same voice machinery used by every other Elder turn -- not a separate template.
- `app/api/elder/confirm-marker/route.ts` -- new. Writes confirmed/reshaped markers to `visit_record.markers_confirmed`; declined markers are never written. Welfare-gated on reshape text only (welfare gate fires on content, never on the act of declining).
- `app/api/elder/marker-offer/route.ts` -- new. Given a `visitId`, selects one proposed marker (fixed priority -- no real emphasis-scoring signal exists yet) and generates the offer via `buildMarkerOffer()`.
- `lib/returning/visit.ts` -- `getVisitById()` added.
- `README.md` -- troubleshooting entry for `.env.local` vs standalone-script auth failures.
**Open before `MARKER_CONFIRMATION_READY` can flip:**
- Live integration test of the full offer -> confirm-marker write flow against the dev branch DB.
- §6 CI checks: confirmed-only-reaches-trajectory, declined-never-persists, GK-007 register check, welfare-gating integration test.
- One full `npx next build` to confirm `marker-offer` + `visit.ts` compile clean together with the rest of the app (deferred to next session).
**Signed:** Jesse Barber
---
