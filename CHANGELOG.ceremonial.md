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

## Entry 003 -- September 1, 2026
**Event:** Opening-sequence continuity pass. The breath, the front-door ask, the age-register beat and lineage-select were four separate opaque full-screen surfaces that swapped via an entrance-only fade -- each painting its own `#0a0806`/`C.obsidian` fill directly over the persistent `FireAtmosphere` in the root layout, so the fire the flow claims to sustain was in fact invisible for the whole opening, and `ElderFrontDoor` alone carried an ambient ember field that then vanished at the next beat. The result read as a web wizard with mystical typography rather than one continuous sitting.

**Model version:** claude-sonnet-5

**Mechanism only -- no ceremonial copy authored this pass.** The masthead ("THE ELDER / Myth Diviner · Seer · Soothsayer") on lineage-select was *removed* (it announced the instrument as a landing page after the seeker had already met the Elder and taken a reading); nothing was written to replace it -- `LineageSelector`'s existing invocation copy orients from there. The age-register skip affordance keeps its exact prior wording. Any Elder-voiced transition line for the breath->ask or ask->lineage handoffs is explicitly deferred: that is new ceremonial copy and needs `lib/openingBridge.ts` + a `check:opening-register` guard + Shalom review before it exists, on the `lib/closingBridge.ts` precedent.

**Files changed this session:**
- `app/components/CeremonyGround.tsx` -- new. One fixed, persistent obsidian floor + scattered ambient ember field, mounted once in the root layout, never unmounted. The ember field is ported from `ElderFrontDoor.makeEmberField` so it is now continuous across every opening beat. Not lineage-aware, no intensity/pulse prop (docs/fire-container-decision.md -- one container).
- `app/layout.tsx` -- mounts `<CeremonyGround />` behind `<FireAtmosphere />`.
- `app/components/BreathGate.tsx` -- root background `#0a0503` -> transparent; opaque `bgFire` radial removed. The breath now happens over the shared ground/fire instead of its own sealed fire-world that reset on handoff.
- `app/components/ElderFrontDoor.tsx` -- root background `C.obsidian` -> transparent; local ambient ember field + `fdEmberDrift` removed (now in CeremonyGround); content wrapper gets `zIndex: 1`. `.fd-input` restyled from a bordered box to a single fire-lit underline; `.fd-button` hover from a solid gold fill to a warm glow. Ignition flare + spark burst unchanged -- correctly local to the moment the log catches.
- `app/components/Threshold.tsx` -- every opening beat's `background: '#0a0806'` -> transparent so the shared ground/fire show through; `ask` phase wrapped in the same hoisted-`<FireAtmosphere>` sibling pattern as the other beats so one instance persists ask -> lineage-select; age-register choices restyled from bordered boxes to ember-lit lines (`.elder-age-choice`); lineage-select masthead removed; `LanguageToggle` moved from the centre column to a quiet fixed corner.

**Not done / follow-ups:**
- Deferred: `PhaseFade` is still entrance-only; a true recede-as-smoke crossfade between beats was not attempted this pass.
- Deferred: Elder-voiced transition copy + `lib/openingBridge.ts` + `scripts/check-opening-register.mjs` (`check:opening-register`) + `lib/ceremonyPacing.ts` timing-coordinator, all pending Shalom review of the copy.
- Pre-existing, untouched: the root layout's prop-less `<FireAtmosphere>` and each phase's own `<FireAtmosphere>` both mount, so two instances run during Threshold phases.
- One full `npx next build` to confirm the new component and the layout change compile clean with the rest of the app.

**Signed:** Jesse Barber
