# The Elder — Threshold & Living-Lineage Layer, v2

### Addendum: From Registry to Witnessed Attestation Network

> Part I (the original hardened spec) is unchanged and remains binding. This addendum does not replace it — it deepens its roots. All seven Part I invariants stay exactly as written. What follows is additive: four structural leaps, each red/blue-tested, each traceable back to infrastructure Jesse already trusts (git-commit provenance, `CONTRACT_HASH`-style derivation, the existing review envelope) rather than anything imported from outside the project's own grammar.

---

## 6. The Leap, Named

**6.1 — Witnessed Attestation, not database rows.**
A `living_lineages` row in Neon is currently the *only* record of a holder's claim. If the DB is compromised, migrated badly, or simply disagreed with later, the trust graph has no independent anchor. The leap: every attestation is recorded as a **git commit** — the same pattern already used for the Sealing Ceremony (`18c3d7a`) and the Babalawo activation sign-off — before it ever becomes a row. The commit message carries holder name, lineage, modality, date, and witness. Neon becomes a **cache of the repo's truth**, not the truth itself. Anyone, including a future Stanzione successor with no faith in The Elder's infrastructure, can `git log` the attestation history independently of whether The Elder is even running.

**6.2 — Lineage-native cadence, not a generic TTL.**
`attestation_ttl_days = 365` is a Gregorian default imposed on every tradition equally — which quietly violates the spirit of Lineage Integrity of Voice by treating all lineages' sense of time as interchangeable. The leap: `attestation_cadence` is **authored by the holder, in their own tradition's terms**, exactly like `withheld_reason` is holder-authored under B4. For K'iche' scope, Stanzione may choose a 260-day Chol Q'ij-aligned renewal. A Sufi holder might choose something else entirely, or simply keep the Gregorian default. The Elder never proposes a cadence on a lineage's behalf — it only ever offers the option and stores whatever a named holder gives it.

**6.3 — Reciprocal field signal (opt-in, aggregate-only).**
Right now the referral layer is one-directional: seekers flow out, nothing flows back. The leap: holders who opt in can receive a periodic, **strictly aggregated** signal — "in this cycle, N seekers reached threshold for this lineage; common themes were X" — never individual, never below a k-anonymity floor (default N ≥ 5; below that, the honest output is "insufficient signal," the same honorable-null posture as `withheld`). This is not surveillance of seekers and not profiling — it's the digital threshold finally being useful *to the tradition itself*, helping a living teacher know roughly what's arriving at their door before it arrives.

**6.4 — The Threshold Letter, not a static card.**
`referral_copy` today is one fixed paragraph per lineage. The leap: at the moment of hand-off, The Elder can compose a short, personalized **letter of introduction** — combining the holder's static `referral_copy` with a true summary of the seeker's actual reading thread, gated by the exact same `assertValidTriple()` provenance enforcement already hard-gating `/api/divine`. No new fabrication surface is opened; the existing anti-fabrication contract is simply extended one hop further. The hand-off stops being a UI card and becomes a small, honest rite — something a seeker could plausibly print and carry.

---

## 7. Why this is a leap and not scope creep

Each of the four moves above takes a Part I mechanism that was *correct but generic* and re-grounds it in something the project already, specifically, is: a commit-based provenance culture, a calendrical scholarship Stanzione already holds lineage authority over, a refusal to fabricate that's already hard-gated in code, and a founding axiom (the mirror cannot transmit, but it can introduce well). Nothing here introduces a new kind of trust — it just stops asking a SQL table to carry trust alone.

---

## 8. Red team / Blue team on the new surface

**R9 — Witness capture / stall.** If the sole named witness for a lineage (e.g., Stanzione) is unreachable for an extended period, does the whole cadence for that lineage silently lapse or silently freeze?
**B9 —** `succession_contact` (already in the schema) is empowered to perform a renewal **only as a witnessed transition in its own right** — itself a commit, naming who acted and why the primary holder was unavailable. The system never auto-extends trust quietly, and it never permanently freezes on one person's absence.

**R10 — Aggregate signal as a backdoor profiling vector.** A small lineage might rarely clear the k-anonymity floor, tempting someone to lower the threshold "just this once" to give a holder something.
**B10 —** The floor is a hard invariant, not a target. Below N ≥ 5, the only valid output is "insufficient signal this cycle" — exactly the same honorable-null posture Part I already applies to `withheld`. Data either earns aggregation or it doesn't exist.

**R11 — Tier-2 key custody is unusable for most holders.** Asking a K'iche' Ajq'ij or a Babalawo to manage a personal signing key is a real-world access barrier disguised as decentralization.
**B11 —** Tier 1 (git-commit witnessing, no key management) is the default and the expectation for essentially everyone. Self-custodied signing is offered only as an opt-in Tier 2 for holders who specifically want independence from The Elder's own repo — never a requirement to participate.

---

## 9. Schema delta (additive only)

```
attestation_capsules            -- new: the witnessed record itself
  id
  lineage_key
  access_modality
  attested_by          → FK accountability_holders
  witnessed_by          -- name + role of the recording witness
  commit_hash            -- git commit this capsule was recorded in
  attestation_cadence    -- holder-authored, e.g. "260d-cholqij" | "365d-gregorian" | custom
  signature_tier          -- 'witnessed' (default) | 'self-custodied'
  public_key             -- nullable; only present for tier 2

living_lineages                  -- unchanged structurally, now sourced FROM capsules
  + capsule_id           → FK attestation_capsules   -- Neon row becomes a cache pointer

field_signal_aggregates          -- new, opt-in per holder
  lineage_key
  cycle_window
  seeker_count            -- only ever populated if >= k_anonymity_floor (default 5)
  theme_summary           -- aggregate only, never individual
  opted_in_by             → FK accountability_holders
```

---

## 10. Updated invariants

Invariants 1–7 from Part I are unchanged and remain binding without modification. Add:

8. **A capsule's truth lives in version control, not in Neon.** The database is always a cache; it is never the sole record of a holder's claim.
9. **No aggregate signal below the k-anonymity floor, ever.** "Insufficient signal" is a complete, honorable output — never a number to be coaxed lower.

---

## 11. What does not change

The founding axiom is untouched: The Elder is a mirror, not a vessel. Crisis still supersedes everything (§4, route step 1, unchanged). Consent is still structurally prior to representation (invariant 2, unchanged). No fees, no ranking, no comprehensiveness goal (invariant 6, unchanged). This addendum only asks: *can the thing we already do right — naming a human, recording their word, refusing to fabricate — be made to stand on its own, independent of any single piece of infrastructure, and quietly useful to the tradition it's pointing toward?*
