# Fork pilot: one partner instance, by hand

**Status:** procedure. No fork exists yet, no partner is named in this
repository, and nothing here has been sent to anyone. Owner: Jesse.
`docs/fork-contract.md` is the contract; this document is how to run the first
one under it, by hand, because `scripts/build-fork.mjs` does not exist.

**Goal of the pilot** is not growth. It is to find out, with one partner and one
scoped voice, whether the contract can actually be followed: whether the capsule
can be assembled, the safety floor kept unmodified, attribution measured, and a
withdrawal executed. Growth comes after the answers.

## 0. Decide before anything else

| Decision | Recommendation | Why |
|---|---|---|
| Which partner | One, who already has a relationship with a named lineage holder | The contract is a human agreement first. The code cannot enforce it on infrastructure we do not control. |
| Scope | **Precisely-scoped, one voice.** Never whole-module, never an anthology. | One voice is one capsule to assemble and one withdrawal to practice. |
| Which voice | One whose authorization evidence is strongest (see section 2) | A fork cannot be stronger than its source. |
| Code name | `partner-<short-name>`: lowercase, letters digits `_` `-`, at most 64 characters, not starting `share-` | This is the `?ref=` code; `lib/referral.ts` rejects anything else. |

Record the four answers in `governance/fork-registry.md` (section 7) before the
first message to the partner.

## 1. The agreement (human to human, before any code leaves)

`docs/fork-contract.md` says a fork agreement "must include" the withdrawal
obligation "explicitly, in writing, before a fork is granted", and that no legal
template exists (ELD-023, not started). So for the pilot, in writing, signed by
both parties:

1. The partner carries the four-part capsule (section 2) unmodified.
2. The partner runs `scripts/check-crisis-directive.mjs` in their own CI.
3. **Withdrawal:** on written notice from the attestor or their documented
   successor, the partner stops serving the voice within 30 days (or the period
   agreed with the attestor in this document), and confirms in writing.
4. The partner does not re-attest, backfill corpus, or blend voices.
5. Attribution: the partner's outbound links use the code in section 5.
6. A named contact on each side, and a named person who can receive a withdrawal
   notice on the partner's side.

This is the governance intent, not a legal remedy. Get it reviewed by whoever
handles legal for the project (ELD-023) before signing; do not treat this
document as that review.

## 2. Assemble the capsule by hand

For each included voice, all four, copied verbatim from this repository at a
recorded commit. A fork missing any one is recognizably incomplete.

| Part | Where it comes from | Pilot note |
|---|---|---|
| 1. Attestation capsule | Signed contract per `lib/attestationSchema.mjs` | **Only the Babalawo voice has attestation tooling** (`attestations/babalawo/`), and no signed contract is in this repository. For any other voice the honest capsule is "none", and the voice ships as unauthorized. Do not manufacture one. |
| 2. Authorization state | `governanceStatus` (`lib/traditions.ts`), flag state (`src/resilience/flags.ts`), the `consent_grant` row, and every artifact under `governance/signoffs/` and `attestations/` | Several voices are live on "operator decision" without a named bearer (`flags.ts` comments). Say so plainly in the capsule. The contract (section 2, correction 2026-10-06) tells the reviewer to establish authorization by hand from the ledger and signoffs. |
| 3. Safety floor | `CEILING_PROTOCOL`, `OUT_OF_SCOPE_HANDOFF`, `lib/welfareGate.ts`, `lib/welfareForbidden.ts`, the crisis directive, `check-crisis-directive.mjs` | Unmodified. Diff the partner's copy against the recorded commit. |
| 4. Corpus pointer | Pointer to `review_status=approved`, `ceremonial_sensitivity=open` passages only (ELD-020) | If the voice has no reviewed corpus, the fork ships that absence. For K'iche', `docs/runbooks/ingest-popol-wuj.md` records the clearance caveat. |

Also ship, and keep unmodified: the dual guardian (`lib/dualGuardian.ts`), the
provenance block, and `docs/fork-contract.md` itself.

**What a partner must not carry over:** any seeker data. A fork starts with an
empty database. Nothing about this repository's seekers, rows, markers or
fireside exchanges ever leaves it.

**Features:** leave the living features dark in the fork (`ELDER_TRAJECTORY`,
`FIGURE_CONTINUITY`, `MYTH_FIRST`, `FIRESIDE`, over-dwelling guard). They carry
their own governance sign-offs here and those do not transfer by copying code,
the same rule as attestation. A partner that wants one takes it through the
partner's own bearer.

## 3. Stand it up

1. Copy at the recorded commit; set the voice flags so only the scoped voice is on
   (`ELDER_VOICE_<KEY>`; others `false`).
2. The partner provisions their own database, Anthropic key, Voyage key,
   `ELDER_SESSION_SECRET`. No shared secrets, no shared database.
3. Run `npm run gk-007`, `npm run check:crisis-directive` and the unit suite in
   the partner's CI; keep the output with the capsule.
4. One live probe of the crisis path on the partner's deployment before any
   seeker reaches it.

## 4. Review before launch (you, with the attestor if there is one)

- [ ] Capsule complete (4 parts), recorded commit hash written down.
- [ ] Diff of the safety floor against the commit is empty.
- [ ] Only the scoped voice is reachable; the others return the off message.
- [ ] Living features are dark.
- [ ] Withdrawal contact on the partner side confirmed by a reply, not assumed.
- [ ] Agreement signed.

## 5. Attribution

Give the partner exactly this link for their own site and communications:

```
https://<your-domain>/?ref=partner-<name>
```

Per `docs/referral-attribution.md`: first-touch, a 90-day cookie, written once to
`elder_user.referral_source` at signup. Read it with
`npm run referral:report -- --source partner-<name>`. Note the known gap there:
anonymous "taste" visitors who share a reading are invisible to this measure, so
read the numbers as a floor.

This measures people the partner sends **to this instance**. Seekers on the
partner's own instance are not in this database and must not be: the partner
reports their own count, if they choose to, by their own choice.

**Do not** use this to count seekers inside the partner's instance, to compare
partners to one another, or to pool anything. Pooling across seekers or instances
is ruled out (`docs/axis-3-forward-architecture.md`, "What this doc deliberately
does not propose").

## 6. What to learn, and when to stop

After the agreed period (suggest 60 days), write one page into
`governance/signoffs/` answering:

1. Could the capsule be assembled from the repository alone, or did it need
   knowledge in someone's head? List what was missing.
2. Did the partner's safety floor stay unmodified (re-run the diff)?
3. Did the withdrawal drill work? **Run it as a drill with the partner**: send the
   notice, time how long until they confirm the voice is off.
4. What did attribution show, honestly stated as a floor?
5. Did the lineage holder's view of the fork change?

Stop the pilot, and withdraw the voice, if the partner modifies the safety floor,
blends voices, backfills corpus, or cannot confirm a drill. Build
`scripts/build-fork.mjs` only after this page exists, from the gaps it lists.

## 7. Registry

`governance/fork-registry.md` is the record. Update it at: agreement signed,
capsule delivered, launch, drill, withdrawal, end of pilot.

## 8. What comes after (and not before)

Living-holder **corroboration notes** (for example for the Norse lineage, where a
living practitioner exists) are a separate change: `docs/corroboration-notes.md`.
It starts only after the section 6 page is written, because a fork carrying
held commentary from a living person raises the consent question again, once per
holder and once per fork.
