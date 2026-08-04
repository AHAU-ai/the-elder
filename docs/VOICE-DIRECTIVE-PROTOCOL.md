# VOICE-DIRECTIVE-PROTOCOL.md
# Version: 1.0
# Status: RATIFIED
# Ratified by: Shalom Ormsby (governance reviewer), Jesse Barber (instrument steward)
# Lineage authority: Vincent J. Stanzione (standing authorization, ojer_tzij scope)

---

## 1. Purpose

This document governs the order of operations between the welfare gate and voice persona directives in The Elder request pipeline. It exists because voice directives that shape model generation must never run before the welfare gate has cleared a request. Poetic reframing of user input prior to crisis detection is a patient-safety risk.

This protocol applies to all current and future voice directives, beginning with the Ajq-ij Directive (ojer_tzij voice, features 1 and 2 of the Applied Mythopoetics scaffold).

---

## 2. Definitions

Welfare gate: lib/welfareGate.ts
The crisis hard-block that intercepts requests before model generation. On a positive crisis signal, it returns a hard-stop response and exits the pipeline. Governed by failTowardSilence.ts.

Voice directive: A prompt-layer instruction that shapes how a specific lineage voice generates its response. Voice directives live in lib/mythopoetics/ and are composed into the system prompt by lib/system-prompt-builder.ts. They do not run before the welfare gate.

Ajq-ij Directive: lib/mythopoetics/ajqijDirective.ts
The voice persona directive for the ojer_tzij lineage voice. Encodes the K-iche daykeeper as the governing generative posture: image before abstraction, living calendar language, ancestral transmission frame. Vates appears in documentation as a comparative bridge only. Scope: ojer_tzij exclusively. Lineage authority: Vincent J. Stanzione.

Image-First Constraint: lib/mythopoetics/imageBeforeExplanation.ts
A fallback post-processor. Checks whether a response leads with archetypal image or abstraction. If abstraction leads, flags the violation. Safety net only. If it fires frequently, strengthen ajqijDirective.ts.

---

## 3. Pipeline Order - Non-Negotiable

Step 1: Welfare gate fires on raw user input - ALWAYS FIRST
Step 2: System prompt construction - voice directives applied here
Step 3: Model generation - Anthropic API call
Step 4: Image-First Constraint - post-processor if needed
Step 5: Response to user

The welfare gate must always see raw user input. If a directive runs before it, the gate receives reframed input. A crisis signal could be rendered as archetypal language before detection. This is a known failure mode.

---

## 4. Call-Stack Verification - COMPLETE

Verified: The actual call sequence in app/api/divine/route.ts confirms:
a) assessWelfare() is invoked on raw user input before buildSystemPrompt() constructs the system prompt.
b) There is no path through the route handler where prompt construction precedes the welfare gate check.
c) The crisis hard-block exits the pipeline before the model is called.

Verification marker in route.ts:
// S4 VERIFIED - assessWelfare() fires here on raw user input, before buildSystemPrompt().
// Call order confirmed against VOICE-DIRECTIVE-PROTOCOL.md S3. Do not reorder.

---

## 5. Scope Constraints

5.1 Ajq-ij Directive is ojer_tzij-only
buildAjqijDirective() must be injected for ojer_tzij only. Guard: lineageKey === maya.
Applying K-iche daykeeper framing to any other lineage is a Lineage Integrity of Voice violation.

5.2 No cross-traditional persona contamination
Vates must not appear in generated output. The model is instructed as an Ajq-ij.

5.3 Image-First Constraint is ojer_tzij-only
enforceImageFirst() is scoped to ojer_tzij output only. Guard: body.lineageKey === maya.

---

## 6. Adversarial Probe Requirement

Status: OPEN - probe not yet written. Required before merge to main.

Probe: Submit a crisis-signal input with ojer_tzij voice active. Assert:
- Welfare gate fires and returns hard-stop response.
- No model generation occurs.
- No Ajq-ij Directive framing appears in the response.

Lives in scripts/adversarial-probe.mjs, runs in CI on wip/welfare-ci-review.

---

## 7. Ratification

Lineage authority: Vincent J. Stanzione - Standing authorization confirmed
Governance reviewer: Shalom Ormsby - Approved (PR review, feat/ajqij-directive)
Instrument steward: Jesse Barber - Author

Version 1.0 - ratified on merge of feat/ajqij-directive to main.
