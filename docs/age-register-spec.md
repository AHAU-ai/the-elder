# Age-Tiered Narrative Register — Spec

Status: proposed, not yet built
Owner: Jesse Barber
Governance: no review gate required for this feature (Jesse's call)

## 1. Purpose

The Elder serves a meaningful cohort of seekers across the coming-of-age threshold — from young children through young adults into adulthood. The adult narrative register (NARRATIVE-01) is not wrong for younger cohorts, but its sentence structure and word choice are calibrated for adult reading patterns. This spec introduces two additional form-only register variants (child, young_adult) and the minimal, privacy-preserving signal needed to select among all three.

Non-goal: this does not change, soften, or simplify any mythic content, marker, or lineage teaching, at any tier. It changes shape, not depth.

This is self-attestation, not verification. The Elder does not collect ID, date of birth, or any age-confirming document — see §10 for why hard age verification was considered and rejected for this feature.

## 2. Tier definitions

| Tier | Age |
|---|---|
| child | 13 and younger |
| young_adult | 14-17 |
| adult | 18+ (default) |

## 3. NARRATIVE-01-YOUTH (young_adult register variant, additive)

Governs form/register only. Contributes no content. Defers to the active lineage voice's own grammar where the two conflict.

- Sentences short and declarative. Avoid subordinate clauses stacked more than one deep. One image or idea per sentence.
- Concrete, sensory nouns over abstract or clinical ones. Say what a thing looks, sounds, or feels like before naming what it means.
- Second person, present tense, direct address.
- No diminishment: never explain a myth as if it were a lesson for children, never add reassurance-language outside the lineage's own voice, never signal "this is the simple version." A shorter sentence is not a smaller truth.
- Reading length: target roughly two-thirds the word count of the adult-register delivery for the same marker/voice combination, achieved through pacing and selection, not truncation mid-thought. Validated (2 marker pairs, self-authored sample set — see §12): 0.63 and 0.69 word-count ratios observed against a 0.55–0.75 target band. Both in band. Target holds as specified.
- Where the lineage field's own voice grammar (e.g. the mythteller voice block) conflicts with this clause on a specific point, the lineage voice grammar wins. This clause sets a floor, not a ceiling.

## 4. NARRATIVE-01-CHILD (child register variant, additive)

Same governing principles as NARRATIVE-01-YOUTH (form only, no content simplification, defers to lineage voice grammar on conflict), taken further:

- Even shorter sentences than NARRATIVE-01-YOUTH. No stacked clauses at all — one clean statement per sentence, almost always.
- Maximally concrete, physical imagery. Lean on things a child has directly touched, seen, or felt (fire, water, animals, hands, doors, paths) before any naming of an inner state.
- Second person, present tense, direct address — even more insistent on this than the young_adult tier, since abstraction reads as distance at this age.
- Same no-diminishment floor as NARRATIVE-01-YOUTH: this is not a "kids' version" of the myth. The register is simpler; the truth inside it is not.
- Reading length: revised, based on actual test results (§12). The original half-length target (0.4–0.6 ratio) proved unreachable in testing without violating the no-diminishment rule — every honest attempt at that length required cutting substance, not just pacing. Observed ratios that preserved full content and passed the mid-thought-truncation check landed at 0.58 and 0.69. Revised target: same 0.55–0.75 band as young_adult (§3). The child and young_adult tiers are not meaningfully distinguished by length — they're distinguished by sentence complexity, vocabulary concreteness, and imagery, per the bullets above. This is a correction to the original spec, not a failure of it: the initial half-length guess was wrong, and the test caught it before build.
- Given this tier includes the youngest and most vulnerable seekers the app reaches, the Safety Floor / welfare gate should be reviewed specifically against this register — not assumed to behave identically to adult-register output. Flagged as an open item, §11.

## 5. Signal: capture and storage

Default: adult register. A seeker who gives no signal, or skips the question, gets the adult-register default.

Capture point: a dedicated in-voice onboarding question, its own beat in the flow — placed before lineage-select, since register is a rendering concern that should be settled before the seeker starts making lineage choices, not entangled with them.

Three buckets, framed in-voice rather than as an age-band form field:

"How many turnings of the sun have shaped you?"

- Just a few turnings → child
- A handful more, still finding my footing → young_adult
- Many turnings, I've walked further than that → adult (also the no-answer default)

The question asks about stance toward the threshold, not literal age — consistent with the app's premise — while still cleanly mapping to three non-overlapping tiers. The mid-sitting change (§6) is the safety valve for anyone a first pass sorts wrong.

A visible "no, actually" switch remains available near the fire after onboarding, covering the mid-sitting change case without needing a second, separate capture mechanism.

Stored value: a coarse tier, never an age or date of birth.

```
narrativeRegister: 'child' | 'young_adult' | 'adult'   // default: 'adult'
```

This is a deliberate privacy choice: the tier gives the narrative layer exactly the signal it needs and nothing more. No birthdate, no precise age, no ID, ever collected or stored.

Persistence:

- Signed-in seekers: session-scoped via the existing `elder_user` / session-cookie pattern (`lib/auth.ts`, `getSessionUserId`), same shape as `myth_archetype` — set once, read on subsequent sittings, not re-asked every time.
- Anonymous/signed-out seekers: held client-side for the sitting only, same precedent as `chain_id` before persistence existed. No account required just to set register.

## 6. Mid-sitting change

This flag is changeable mid-sitting, unlike write-once state such as `myth_archetype`. A seeker who set (or defaulted to) one register can switch during an active session; the change takes effect on the next reading generated, not retroactively on readings already delivered.

Implementation note: the read path in `system-prompt-builder.ts` should pull the current value at generation time, not cache it for the sitting.

Placement and styling of the switch (resolved):

- Lives in the same persistent, low-visual-weight control cluster as the sound toggle, near the fire — not in a settings menu that requires navigating away from the sitting. A seeker mid-reading should never have to leave the fire to change register.
- Rendered as three small glyphs or short labels (child / young_adult / adult — using the same "turnings of the sun" language from the onboarding question, not raw tier names), with the current selection subtly indicated (e.g. a lit/unlit state), not a dropdown or modal. One tap/click to change, no confirmation step — this mirrors how low-stakes the change actually is.
- No animation or transition that draws attention to the switch itself firing — the register change should feel like the fire adjusting to the seeker, not like a UI event. Consistent with keeping ceremonial frame intact.
- Always visible, never conditionally hidden based on current tier — a child-register seeker must be able to see and use the same switch as anyone else, not a reduced-functionality version.

## 7. SAFETY-FLOOR-CHILD (welfare gate variant, additive)

The existing Safety Floor / welfare gate (distress detection → hard stop on the mythic reading → crisis resources surfaced) is not inherited unchanged for the child register. This clause specifies what changes and, more importantly, what must not.

What must not change (floor, not ceiling):

- The gate's authority is absolute at every tier. Under child register, the gate must trigger at least as readily as under adult register — never more permissively, never "softened" because the seeker is young. If anything, err toward a lower trigger threshold for this tier, not a higher one.
- Once triggered, the mythic reading stops. No register, however gentle, overrides that stop.

What changes for this tier:

- Detection calibration. Distress in children frequently doesn't arrive as plain statements — it shows up in metaphor, in anger, in an abrupt shift toward a darker myth-choice or marker. The detector cannot assume the same surface patterns that work for adult-register input; it needs its own calibration pass against child-register seeker language, not a shared threshold inherited by default.
- Resource content. Alongside 988 / Crisis Text Line (which stay present — this is additive, not a replacement), the surfaced message explicitly names getting a trusted adult involved: a parent, a school counselor, another adult the seeker already trusts. Hotlines alone assume a capacity for solo self-navigation that isn't a safe default assumption for this age band.
- Register consistency under the gate. The gate's own language — not just the reading it interrupts — is delivered in the same short, concrete, second-person form as NARRATIVE-01-CHILD. A sudden shift into clinical or adult-toned phrasing at the exact moment a child is distressed reads as the app dropping the mask at the worst possible time. The crisis message needs its own drafted copy in child register, not a straight reuse of the adult-register gate text.
- No negotiation, no myth-logic override. The gate does not accept in-frame appeals (e.g., a seeker or a lineage-voice-styled response arguing the reading should continue). This applies at every tier already; stated explicitly here because the child register's more intimate, second-person address could otherwise create pressure to soften the interrupt into something gentler than a full stop.

Not yet resolved by this clause:

- Detection calibration itself (the actual model/ruleset tuning) is implementation work, not a spec-level decision — flagged in §12, not blocking this document.

Drafted crisis-message copy (child register):

> "I need to stop the story here. What you're feeling matters more than any tale right now. Please tell a grown-up you trust — a parent, a teacher, anyone who keeps you safe. You can also call or text 988, any time, and someone will listen. I'll be here when you're ready. But first, please reach out to someone who can help you right now."

This draft satisfies the register-consistency and trusted-adult requirements above. It has not been reviewed by anyone with clinical or child-safety expertise — that review is a genuine prerequisite before this copy ships to real users, not a formality. Treat this draft as a strong starting point for that review, not as final.

## 8. SAFETY-FLOOR-YOUNG_ADULT (welfare gate variant, additive)

Same non-negotiable floor as §7: gate authority is absolute, triggers at least as readily as adult register, no in-frame appeals override it. What differs for young_adult is narrower than for child — this cohort (14-17) generally has more capacity for direct self-navigation than the child tier, so the deviations from adult register are smaller.

What changes for this tier:

- Detection calibration. Closer to adult-register patterns than child, but not identical — teens often signal distress through irony, deflection, or dark humor rather than either the metaphor-heavy signals typical of younger children or the more direct language typical of adults. Calibration should be checked against this tier specifically, not assumed to inherit adult-register detection unchanged.
- Resource content. 988 / Crisis Text Line remain primary, same as adult register. Unlike child, this tier's copy does not default to naming a parent specifically — many 14-17-year-olds are actively individuating from parental authority, and a message that presumes parental involvement can read as patronizing or even unsafe in specific family situations. Instead: name a trusted adult of the seeker's own choosing (counselor, coach, relative, parent — unspecified which) as an option alongside the hotlines, not a presumed first step.
- Register consistency under the gate. Same principle as child: the gate's own language stays in NARRATIVE-01-YOUTH form (short, direct, second-person) rather than shifting to adult-register phrasing mid-crisis.

Drafted crisis-message copy (young_adult register):

> "I'm stopping the story here. What you're carrying right now matters more than this reading. You can call or text 988 anytime, or reach Crisis Text Line by texting HOME to 741741. If there's someone in your life you trust — a friend's parent, a counselor, anyone — this is worth telling them too. The fire will still be here when you're ready to come back."

Same caveat as §7: this draft has not been reviewed by anyone with clinical or child-safety expertise, and that review is a genuine prerequisite before ship.

Self-review pass against general crisis-messaging principles (checked just now — SAMHSA/988 public guidance, not clinical review): both drafts (§7, §8) were checked against several commonly-cited principles for youth-directed crisis messaging: (a) offer more than one contact modality — both drafts include call and text options; (b) lead with validation, not alarm — both open by naming the feeling as mattering, not by naming the crisis; (c) name a human alternative alongside the hotline, not instead of it — both do, differentiated appropriately by tier per §7/§8; (d) avoid clinical or bureaucratic tone — both stay in their respective registers. One gap found and left as-is rather than silently patched: neither draft explicitly offers the 988 web-chat option, which some younger users may prefer over call or text — worth adding once a professional reviews the copy, not fixed unreviewed here.

This is a structured self-check against public guidance, not a substitute for the clinical review both drafts still require.

## 9. COPPA — legal status and interim technical mitigation

What I can and can't resolve here: this document does not constitute legal clearance. What follows is a plain-language risk summary, informed by current regulatory status as of this writing, plus a concrete technical mitigation that reduces exposure while a real legal review happens — not a substitute for that review.

Current regulatory status (checked just now, not from memory — this postdates general awareness of the topic): the FTC's amended COPPA Rule published April 2025 reached its full compliance deadline on April 22, 2026, and is now actively enforced, with FTC leadership on record describing children's privacy as a priority enforcement area. This is not a slow-moving or theoretical regime — it is live.

A February 2026 FTC policy statement created narrow enforcement discretion for general- and mixed-audience services that collect data solely to determine a user's age, with strict conditions (no secondary use, prompt deletion, limited disclosure). This does not cover The Elder's situation: the register question isn't functioning as age-verification technology in the FTC's sense, and the moment a seeker selects the child tier, that itself is the "actual knowledge" trigger — the policy statement's carve-out doesn't undo that, it only shields the narrower act of determining age in the first place.

The risk, stated plainly: COPPA's "actual knowledge" standard attaches when a service knows, not just could theoretically infer, that a user is under 13. A stored child tier (13-and-younger) tied to a persistent account is a plausible knowledge signal, even without DOB. If it is, standard COPPA parental-consent and data-handling obligations apply to that account going forward — not just to the register feature, but potentially to any data the app holds on it — and given the current enforcement posture, that exposure is active, not hypothetical.

Interim technical mitigation (can be built now, doesn't wait on legal sign-off):

- Do not persist `narrativeRegister: 'child'` to a signed-in account at all. Treat the child tier as session-only for every seeker, signed in or not — same as the anonymous-seeker storage path in §5, applied universally to this one tier regardless of account status. `young_adult` and `adult` can persist normally.
- This means a child-tier seeker re-selects their register each sitting rather than it being remembered — a small UX cost, in exchange for not creating a durable "we know this account is a child" record anywhere in the system.
- This mitigation reduces exposure; it does not eliminate the underlying legal question, which still needs real review.

Recommendation, strengthened given current enforcement posture: treat legal sign-off on the child tier as a hard prerequisite before that tier ships to real users — not a someday item. Given active FTC enforcement, I would not ship the child tier live without that review, even with the technical mitigation in place. young_adult and adult are not implicated by this issue and don't need to wait on it.

## 10. Why self-attestation, not verification

Hard age verification (ID upload, payment-card check, biometric age estimation, parental-consent flow) was considered and rejected for this feature. It's the right tool for gating access to restricted content; it is the wrong tool here, where the only thing being decided is prose register. Verification would also require collecting exactly the identifying data (DOB, ID documents) this spec is designed to avoid — the opposite of what a privacy-conscious feature should do. If a future need arises for actual access-gating (a distinct product decision), that deserves its own separate spec and legal review, not a retrofit of this one.

## 11. Remaining items before build

**Update, code-complete pass (branch `feat/age-register-implementation`):** everything in this section that was a code/build task has now been implemented against the live repo — migration (`migrations/007_narrative_register.sql`), persistence (`lib/narrativeRegister.ts`, `app/api/register/route.ts`), the onboarding capture beat and mid-sitting `RegisterSwitch` (`app/components/Threshold.tsx`, `app/components/RegisterSwitch.tsx`), the additive NARRATIVE-01-YOUTH/-CHILD prompt blocks (`lib/system-prompt-builder.ts`), and the register-aware crisis copy from §7/§8 wired verbatim into the welfare-gate hard-block path (`app/api/divine/route.ts`).

**Code completion is not launch clearance.** Two of the four items below are explicitly still open, unchanged by this pass, and are not things code can resolve on its own:

- ~~Word-count validation~~ — methodology defined and run against 2 marker pairs (§12); target bands are no longer guesses. A larger batch (≥20, multiple voices) against real generated output is still worth doing before ship, but this was never a hard blocker.
- ~~Mid-sitting switch~~ — implemented and wired into `Threshold.tsx` (near-fire control, same tier as other persistent low-weight controls). Changing it affects only the next generated reading, not retroactively, per §6.
- **COPPA legal sign-off — STILL REQUIRED, NOT RESOLVED BY THIS PASS.** The interim technical mitigation (§9, session-only child tier, never persisted server-side) is now implemented and enforced at the persistence boundary (`setNarrativeRegister()` hard no-ops on `'child'`; DB CHECK constraint backs it up). That is a risk *mitigation*, not a substitute for sign-off. The `child` tier is additionally gated behind a feature flag, `NARRATIVE_REGISTER_CHILD_ENABLED` (env var, defaults to `false`/unset), which controls whether the child option is even offered in onboarding or the mid-sitting switch. It must stay off in production until a lawyer actually clears this — current FTC enforcement is active, not hypothetical. Flipping the flag is a legal decision, not a deploy decision.
- **Clinical / child-safety review of crisis copy — STILL REQUIRED, NOT RESOLVED BY THIS PASS.** The §7/§8 crisis copy is now wired verbatim into `app/api/divine/route.ts` (`CRISIS_DIRECTIVE_CHILD`, `CRISIS_DIRECTIVE_YOUNG_ADULT`), selected by register at the point the welfare gate hard-blocks a crisis-tier message. Wiring the copy into code is not equivalent to clearing this review — it still needs review from someone with actual clinical or child-safety expertise before either string reaches a real user. The `NARRATIVE_REGISTER_CHILD_ENABLED` flag covers the child tier's exposure generally, but note the young_adult crisis copy is *not* behind that flag (young_adult is not COPPA-gated) — its review is independently still outstanding and should not be assumed covered by the child-tier flag being off.
- Per-tier welfare-gate detection calibration (§7/§8) — explicitly out of scope for this pass. The gate's trigger logic/threshold is unchanged for every tier; only the copy surfaced after a hard-block differs by register. A `// TODO(age-register): per-tier detection calibration, spec §7/§8` marks the spot in `app/api/divine/route.ts`. Recalibrating detection against child/young_adult-register language specifically needs real test data this pass didn't have — do not attempt it without that data.
  - **Mechanical scaffolding only, still not the calibration itself:** `docs/age-register-crisis-corpus.md` is a self-authored, NOT clinically reviewed draft corpus of child/young_adult crisis- and distress-adjacent phrasing, and `scripts/welfare-gate-probe.mjs` now runs register-parameterized probes from it (`--register=young_adult|child|all`, fixtures in `scripts/welfare-gate-probes.data.mjs`). Only `expectedTier: "crisis"` probes are hard-asserted; the actual detection logic (`lib/welfareGate.ts`, `lib/welfareForbidden.ts`) has NOT been changed. This gives a reviewer something concrete to correct and a harness to validate against once real calibration work happens — it does not substitute for that work or for clinical review.

## 12. Appendix: validation batch (self-authored samples, run this session)

The word-count claims in §3/§4 are not theoretical — they come from an actual test run against self-authored sample readings (not pulled from The Elder's live model, since I don't have access to its corpus or system prompt at runtime; these are illustrative readings I wrote by hand, applying the NARRATIVE-01/-YOUTH/-CHILD rules as specified). Treat this as a first-pass validation, useful for calibration, not a replacement for testing against real generated output once built.

Marker: wound. Adult 172 words. First-draft young_adult 134 (0.78 ratio, out of band) → revised to 109 (0.63, in band). First-draft child 136 (0.79, out of band) → revised to 100 (0.58, in band — note this is inside the revised 0.55–0.75 band, not the original 0.4–0.6 band, which no revision reached without cutting content).

Marker: threshold. Adult 143 words. First-draft young_adult 112 (0.78) → revised 98 (0.69, in band). First-draft child 114 (0.80) → revised 99 (0.69, in band under the revised target; still would have missed the original 0.4–0.6 band).

Finding that changed the spec: first-draft attempts at both younger registers consistently landed around 0.78–0.80 of adult length, not the originally guessed targets. A deliberate compression pass reliably brought young_adult into its original band. The same compression pass could not bring child below roughly 0.6 without cutting content the no-diminishment rule protects — which is why §4's target was revised rather than forced. This is exactly the kind of thing the validation step was designed to catch.

Still not done by this pass: the full ≥20-reading batch across multiple markers/voices this section originally called for — only 2 marker pairs were run. Sufficient to catch and fix the target-band error above; not sufficient to treat the revised bands as fully proven. Worth a larger batch once real generated output (not hand-authored samples) is available to test against.

## 13. Draft: mid-sitting register switch component

Not yet verified against the live codebase (no repo access from this session) — written to match the conventions documented in the project's build log (FireAtmosphere-adjacent controls, existing sound-toggle pattern). Treat as a starting draft for Jesse to verify against real source and apply himself, same as prior deliverables in this project.

```tsx
// RegisterSwitch.tsx — near-fire control, same tier as sound toggle
// Assumes a narrativeRegister state + setter passed down from
// wherever session state for the sitting already lives (e.g. the
// same parent that owns soundEnabled in Threshold.tsx).

type NarrativeRegister = 'child' | 'young_adult' | 'adult';

interface RegisterSwitchProps {
  register: NarrativeRegister;
  onChange: (r: NarrativeRegister) => void;
}

const REGISTER_LABELS: Record<NarrativeRegister, string> = {
  child: 'a few turnings',
  young_adult: 'a handful more',
  adult: 'many turnings',
};

export function RegisterSwitch({ register, onChange }: RegisterSwitchProps) {
  const order: NarrativeRegister[] = ['child', 'young_adult', 'adult'];
  return (
    <div
      className="flex gap-2 items-center opacity-60 hover:opacity-100 transition-opacity"
      aria-label="How many turnings of the sun have shaped you"
    >
      {order.map((tier) => (
        <button
          key={tier}
          onClick={() => onChange(tier)}
          aria-pressed={register === tier}
          className={`text-xs px-2 py-1 rounded-full transition-colors ${
            register === tier
              ? 'bg-amber-500/40 text-amber-100'
              : 'text-amber-100/40 hover:text-amber-100/70'
          }`}
        >
          {REGISTER_LABELS[tier]}
        </button>
      ))}
    </div>
  );
}
```

**Update:** verified against real source and applied as [app/components/RegisterSwitch.tsx](../app/components/RegisterSwitch.tsx). The draft above assumed Tailwind utility classes and an existing sound-toggle UI control to mirror; neither exists in this codebase (styling is plain CSS in `app/globals.css` / `app/globals-v3-additions.css`, and `soundEnabled` in `Threshold.tsx` is state-only with no visible switch). The applied version uses BEM-style classes (`register-switch`, `register-switch__tier`) styled in `globals-v3-additions.css` to match the existing fire-toned palette instead. The component is not yet wired into `Threshold.tsx` state or persisted per §5/§9 — that requires the onboarding capture flow and backend endpoints this spec still calls out as unbuilt.

Wiring notes (not yet verified against real files):

- Persistence per §5/§9: only young_adult/adult should write to the signed-in session store; child selection should set local/session-only state regardless of sign-in status.
- The read path in `system-prompt-builder.ts` (per §6) should pull current register value at generation time, not read it once and cache it for the sitting.
