# Docs index

What each document is, where it stands, who owns it, and when its claims were
last checked against the code. Written 2026-10-02.

## How to read the columns

- **Status** is copied from the document's own header. "Not stated" means the
  document has no status line. Nothing here is inferred.
- **Owner** is copied from the document. "Not stated" means it names none. The
  project-level accountable people, per `CONSOLIDATION.md`, are Jesse Barber
  (technical) and Vincent James Stanzione (lineage). A "not stated" owner is a
  request to assign one, not an assumption that it is one of them.
- **Last verified** has two parts. *Paths* means every file path the document
  names in backticks was checked against the repo on that date. *Claims* means
  a person or session also checked the document's statements about behavior
  against the code. Where only paths were checked, the document's behavioral
  claims are unverified.

When you add or change a doc: give it a status line and an owner, and update
"Last verified" only for what you actually checked.

## In `docs/`

| Doc | Status | Owner | Last verified | Notes |
| --- | --- | --- | --- | --- |
| `VOICE-DIRECTIVE-PROTOCOL.md` | Ratified (implemented) | Ratified by Shalom Ormsby and Jesse Barber; lineage authority Vincent J. Stanzione | 2026-10-02, claims (§4, §6) and paths | Single status as of this date; §6 probe is `scripts/welfare-gate-probe.mjs` |
| `WHITE-PAPER.md` | Not stated | Not stated | 2026-10-02, claims (§VI) and paths | §VI rewritten to match what the code enforces; the other sections are unchecked |
| `fork-contract.md` | Specification, 2026-08-19 | Jesse | 2026-10-02, claims (§3) and paths | The fork-CI authorization-status check was dropped; it never existed |
| `reading-shape-voice-review.md` | Ask drafted, not sent | Not stated | 2026-10-02, claims (authorization notes) and paths | Retraction notes for `mekubal` superseded 2026-10-02; the corpus review-attribution caveat still stands |
| `technical-strategic-and-ux-audit.md` | Mixed: OPEN, FIXED and DECISION per finding | Not stated | 2026-10-02, paths only | Dead refs: `CrisisPage.tsx`, `LintelGate.tsx`. Findings may have been fixed since it was written |
| `backend-profile.md` | Not stated | Not stated | 2026-10-02, paths only | Describes the `/api/divine` pipeline; re-check the step order against `app/api/divine/route.ts` before relying on it |
| `ELDER-LIVING-WORD.md` | Canon | Not stated | 2026-10-02, paths only | Sibling of `ELDER-CEREMONY-SIGNAL-SURFACE.md` |
| `ELDER-CEREMONY-SIGNAL-SURFACE.md` | Not stated | Not stated | 2026-10-02, paths only | |
| `AXIS-MUNDI-ARCHITECTURE.md` | Not stated | Not stated | 2026-10-02, paths only | Dead ref: `LintelGate.tsx` |
| `elder-ui-v2-architecture.md` | Not stated | Not stated | 2026-10-02, paths only | Dead ref: `lib/ceremonialClock.ts` |
| `axis-2-marker-trajectory.md` | Implemented, gated off | Not stated | 2026-10-02, paths only | |
| `axis-3-forward-architecture.md` | Proposal, unbuilt, not ratified | Not stated | 2026-10-02, paths only | |
| `age-register-spec.md` | Header says "proposed, not yet built" | Jesse Barber | 2026-10-02, paths only | Header looks stale: `lib/narrativeRegister.ts` implements the tiers, with the child tier gated off |
| `age-register-crisis-corpus.md` | Scaffolding only; not clinically reviewed | Not stated | 2026-10-02, paths only | |
| `fire-container-decision.md` | Decided, 2026-08-19 | Jesse | 2026-10-02, paths only | |
| `shareable-card-visual-system.md` | Implemented | Not stated | 2026-10-02, paths only | |
| `referral-attribution.md` | Not stated | Not stated | 2026-10-02, paths only | |
| `CONSECRATION.md` | Not stated | Not stated | 2026-10-02, paths only | |
| `SESSION-COMPLETION-GK-007.md` | Not stated | Not stated | 2026-10-02, paths only | A session record, not a living spec |
| `ENV.md` | Not stated | Not stated | 2026-10-02, paths only | |
| `handoff-2026-07-07.md` | Not stated | Not stated | 2026-10-02, paths only | A dated snapshot. Dead refs to the beta gate are expected, since the gate was removed |
| `The_Elder_Build_Plan.docx` | Not stated | Not stated | Not checked | Binary; not diffable, so it cannot be verified by the checks above |

## In `docs/signoff/`

| Doc | Status | Owner | Last verified | Notes |
| --- | --- | --- | --- | --- |
| `coppa-legal-review-packet.md` | Not reviewed | Not stated | 2026-10-02, paths only | State is tracked in `lib/compliance/signoff-status.json`, which the code reads |
| `crisis-copy-clinical-review-packet.md` | Not reviewed | Not stated | 2026-10-02, paths only | Same tracker |

## In `docs/whitepapers/`

| Doc | Status | Owner | Last verified | Notes |
| --- | --- | --- | --- | --- |
| `applied-mythopoetics-whitepaper-v5.md` | Not stated | Authors: Jesse Barber and Vincent J. Stanzione | 2026-10-02, paths only | A separate paper from `docs/WHITE-PAPER.md` |

## Outside `docs/`

| Doc | Status | Owner | Notes |
| --- | --- | --- | --- |
| `GOVERNANCE.md` | Governing document, reviewed at every major deploy | Author: Jesse Barber | |
| `CONSOLIDATION.md` | Active | Jesse Barber (technical), Vincent James Stanzione (lineage) | |
| `elder-spec-DT1-directional-transformation.md` | Ratified | Ratified by Vincent Stanzione | |
| `the-elder-threshold-v2-witnessed-attestation.md` | Not stated | Not stated | |
| `specs/adr/` | See `specs/adr/README.md` | Per ADR | Decision records ADR-0001 to ADR-0013 |
