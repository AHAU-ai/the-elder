# Fork / Export Contract

**Status:** specification, 2026-08-19 (design action item F14). Owner: Jesse
(founder). This is primarily a specification, not a code change — it
governs what any future fork/export tooling must do, and what a human
reviewing a fork request should check by hand until that tooling exists.

## Scope

"A fork" here means any deployment of The Elder (or of a subset of its
voices) outside this repository's own production deployment — a partner
organization running their own instance, a single lineage spun out as its
own standalone product, a community group standing up a local copy, or
any other redistribution of the running instrument rather than of source
code alone. This document does not cover ordinary open-source code
contribution back into this repo (that is normal PR review); it covers a
copy that leaves this repo's own governance and runs elsewhere.

## What a fork ships

A fork MUST ship, alongside the code, exactly these four things —
constructed so that a fork missing any one of them is recognizably
incomplete, not silently degraded:

### 1. The attestation capsule

The signed attestation contract(s) for every voice included in the fork,
in the shape already defined by `lib/attestationSchema.mjs` — the exact
spec hash that was attested, the named human attestor and their
recognized role for that tradition, the lineage accountability holder's
co-signature, and the ed25519 signature over the canonical payload. A
fork does not get to re-attest a voice itself; it carries forward the
attestation this repo already holds (or, per §4 below, the fork carries
no attestation and the voice ships as unauthorized).

A fork's attestation capsule for a given voice is **identical** to this
repo's own attestation for that voice at fork time — not re-derived, not
re-signed by the forking party. Attestation authority does not transfer
by copying code.

### 2. The authorization state

The `authorizationStatus` (`lib/traditions.ts`, added under F15) and
`governanceStatus` for every voice in the fork, copied verbatim from this
repo at fork time. A voice that is `pending` (no named bearer — see
`governance/checklist.yaml` row `F15-AUTH`) in this repo ships as
`pending` in the fork; a fork build process must not upgrade a voice's
authorization status on its own. If a fork's own tradition-bearer review
later changes this for their deployment, that is the fork's own new
attestation, tracked in the fork's own capsule — it does not write back
to this repo, and this repo's own state does not change because a fork
claims otherwise.

### 3. The safety floor

Everything that makes a hard ceiling actually hard, unmodified:
`CEILING_PROTOCOL` and `OUT_OF_SCOPE_HANDOFF` (`lib/system-prompt-
builder.ts`), the welfare/crisis gate (`lib/welfareGate.ts`,
`lib/welfareForbidden.ts`), and the crisis directive verified live by
`scripts/check-crisis-directive.mjs`. A fork MUST run these unmodified —
no fork gets to loosen the crisis gate, soften the ceiling protocol, or
strip the out-of-scope firewall (see `docs/fire-container-decision.md`'s
sibling reasoning for why voice-level customization has a hard floor it
cannot cross). `scripts/check-crisis-directive.mjs` and
`scripts/check-authorization-status.mjs` MUST run in the fork's own CI,
not just this repo's — a fork that never runs these checks again is
exactly the failure mode this section exists to prevent.

### 4. The corpus pointer

A pointer to the reviewed corpus/passages the fork's voice(s) draw from
(`review_status=approved` passages only, per `ELD-020`'s build-gate
principle) — not a copy of unreviewed or flagged material, and never a
passage bundle assembled by the forking party from outside sources. If a
voice has no reviewed corpus yet (most voices today — see
`ELD-008`/`ELD-012`), the fork ships that same absence; it does not
backfill content from elsewhere to make the fork feel more complete than
the source it was forked from.

## Whole-module or precisely-scoped — never a cross-lineage anthology

A fork is either:

- **Whole-module**: every voice this repo currently ships, unmodified,
  with all four capsule components above intact for each; or
- **Precisely-scoped**: a named, explicit subset — e.g. "the K'iche' Maya
  voice only" — where the scoping is a clean cut along existing lineage
  boundaries (one or more complete `TRADITION_MAP`/`LINEAGES` entries),
  never a partial voice, never a blend.

A fork MUST NOT ship a **cross-lineage anthology**: a new bundle that
mixes passages, motifs, or voice instructions from more than one
tradition into a single presented voice, a combined "greatest hits"
selection across traditions, or any packaging that implies the forked
material is one unified tradition when it draws from several. This is
the same boundary `lib/traditions.ts`'s `forbidden` lists already enforce
inside a single running instance (voice A may never borrow voice B's
content) — a fork does not get a looser version of that rule just
because the mixing happens at packaging time instead of generation time.
A precisely-scoped fork of exactly one lineage is fine specifically
*because* it doesn't mix; the same fork shipping two lineages side by
side under separate, clearly labeled voices is also fine, for the same
reason — what's prohibited is presenting mixed content as a single voice
or a single unified "tradition."

## Withdrawal of consent for already-forked deployments

Attestation is not a one-time unlock. A named attestor or lineage
accountability holder can withdraw consent for a voice at any time, for
any reason they consider sufficient — the same standing they had to
attest in the first place.

When consent is withdrawn:

1. **This repo's own deployment** stops serving that voice immediately —
   flip `governanceStatus` away from `active`/`live` and
   `authorizationStatus` away from `bearer-confirmed` in `lib/
   traditions.ts`, backed by a `governance/signoffs/` artifact recording
   the withdrawal (same standard as an authorization grant, per
   `ARCH-03`). This is a code change in this repo, made promptly, not a
   note for later.

2. **Every known fork is notified.** Whoever maintains the fork registry
   (today: manual — there is no automated fork-tracking system; building
   one is future work, not assumed to exist) contacts every known forked
   deployment of that voice, in writing, stating that consent has been
   withdrawn and the date.

3. **Already-forked deployments MUST stop serving that voice within a
   bounded window from notification** — 30 days, absent a different
   period explicitly agreed with the withdrawing attestor at attestation
   time. This is a contractual/governance obligation on the forking
   party, not something this repo can technically enforce against a
   fork it doesn't control the infrastructure for. A fork agreement (the
   human-to-human agreement under which a fork was permitted in the
   first place) must include this obligation explicitly, in writing,
   before a fork is granted — F14 does not retroactively bind a fork that
   was never asked to agree to it.

4. **A fork that continues serving a voice after its withdrawal window
   has passed is out of compliance with the fork agreement**, full stop
   — the same as continuing to use any other license after the license
   was revoked. This document does not invent new legal remedies for
   that situation (see `ELD-023`, legal entity / terms of use, still
   open); it states the governance expectation the future legal
   agreement must encode.

5. **Withdrawal is asymmetric with granting.** Granting attestation
   requires the full ceremony above (named attestor, signed contract,
   accountability co-signature). Withdrawing it does not — a single
   written statement from the original attestor (or their documented
   successor, per `ELD-042`'s succession-gap concern) revoking their own
   prior attestation is sufficient on its own. Consent that took a
   process to give does not need the same process to take back; making
   withdrawal harder than granting would be a design that discourages
   attestors from attesting in the first place.

## What this document does not solve yet

- **No fork-registry tooling exists.** There is no automated way today to
  know how many forks exist or notify them programmatically. Step 2 above
  is manual until that changes — tracked as a gap, not assumed solved by
  this document's existence.
- **No legal agreement template exists yet** binding a fork to this
  contract (see `ELD-023`, still `NOT STARTED`). Until it does, this
  document is the governance intent a legal agreement must eventually
  encode, not itself an enforceable contract.
- **Automated capsule construction does not exist.** Today, assembling
  the four-part capsule for a fork is a manual checklist a human runs
  through by hand against this document; building `scripts/build-
  fork.mjs` (or equivalent) to assemble and verify a capsule
  automatically is future engineering work this document specifies the
  requirements for, but does not implement.
