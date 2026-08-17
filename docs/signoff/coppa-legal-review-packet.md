# COPPA legal review packet — child narrative-register tier

**Status:** not reviewed. Tracked in machine-readable form at
`lib/compliance/signoff-status.json` (`coppaChildTier`). The code enforces
this — see "How this is enforced" below — so this is not just a paperwork
formality that can be skipped by flipping an env var.

**Who this is for:** an attorney competent in FTC/COPPA compliance. This
document is a briefing packet to hand to them, not a substitute for their
review.

## What's being decided

Whether The Elder may offer a self-attested "child" narrative register
(content/tone tuned for under-13 seekers) as a live, selectable option in
production — and if so, under what conditions.

## Why this needs review

`docs/age-register-spec.md` §9 lays out the risk: COPPA's "actual
knowledge" standard attaches when a service knows a user is under 13, not
just could infer it. A seeker selecting a "child" register tier is a
plausible knowledge-trigger. The FTC's amended COPPA Rule (full compliance
deadline April 22, 2026) is actively enforced as of this writing. A
February 2026 FTC policy statement carves out narrow discretion for
age-verification-only data collection, which §9 argues does not cover this
case — the register selection isn't age-verification, and the moment of
selection is itself the trigger.

**This packet does not ask the reviewer to accept that analysis.** It's
one non-lawyer's plain-language read of public FTC guidance, included so
the reviewer has context, not a conclusion to rubber-stamp.

## What's already built (technical mitigation, not legal clearance)

These reduce exposure but are explicitly not a substitute for legal
sign-off (§9):

- `lib/narrativeRegister.ts` — `setNarrativeRegister()` hard no-ops on
  `'child'`; the child tier is never written to a persistent, signed-in
  account record, for any user. A DB `CHECK` constraint backs this up
  (`migrations/007_narrative_register.sql`).
- A child-tier seeker's selection lives client-side only (React
  state/`sessionStorage` in `app/components/Threshold.tsx`) and is
  re-chosen every sitting.
- The entire child tier — whether it's even offered as a selectable
  option in onboarding or the mid-sitting `RegisterSwitch` — is held
  behind an env flag, `NARRATIVE_REGISTER_CHILD_ENABLED`, defaulting to
  `false`.

## Questions for the reviewer

1. Does self-attested, non-persisted register selection constitute "actual
   knowledge" under COPPA as currently enforced, given the technical
   mitigation above?
2. If yes: is there a version of this feature (different data handling,
   different UX, a different age boundary) that would not trigger COPPA
   obligations, or does the child tier need to be withdrawn entirely?
3. If a conditional yes: what conditions (data handling, retention,
   disclosure, consent flow) need to be added before this can ship, beyond
   what's listed above?
4. Does the answer change if/when the app adds analytics, error logging,
   or any other system that could incidentally correlate a child-tier
   session with other identifying data (IP, account, etc.)? Worth
   surfacing to whoever owns those systems if so.

## Decision record

Fill in and update `lib/compliance/signoff-status.json` →
`coppaChildTier` to match. Do not flip `NARRATIVE_REGISTER_CHILD_ENABLED`
in any production environment until `status` there is `"approved"`.

```
Reviewer:        [name / firm]
Date:            [ISO date]
Decision:        [approved | approved_with_conditions | rejected]
Conditions:      [if any — must be reflected back into the codebase before ship]
Notes:           [free text]
```

## How this is enforced

`lib/narrativeRegister.ts`'s `isChildTierEnabled()` requires **both**
`NARRATIVE_REGISTER_CHILD_ENABLED=true` **and**
`lib/compliance/signoff-status.json`'s `coppaChildTier.status ===
"approved"`. Setting the env var alone is not sufficient to enable the
child tier in any environment — someone still has to have recorded a real
decision in the status file. That file is the source of truth this packet
feeds; update it only after the review above has actually happened.
