# Axis 2 — Marker Trajectory

Status: implemented, gated off.
Decided: 2026-08-07. Last updated: 2026-08-15.

This is a decision record. It documents what was chosen and why, so the
reasoning survives outside a chat thread. It is not a spec — where this
document and the code disagree, the code is what ships, and this file
should be corrected.

## The choice

Two ways to give The Elder memory across sittings were considered.

**Axis 1 — semantic recall.** Embed prior readings (pgvector), retrieve
by similarity, let the model reference what it surfaces.

**Axis 2 — marker trajectory.** Count confirmed markers across visits.
Speak a thread only after it has appeared enough times to be a pattern
rather than a coincidence.

Axis 2 was approved. The reason is failure mode, not capability. Embedding
similarity can be *wrong* — it can surface two readings that share
vocabulary but nothing else, and the model will narrate a connection that
was never there. In this domain a fabricated connection is not a bad
recommendation; it is a trust violation, and it is indistinguishable to
the seeker from genuine recognition. Recurrence counting can be sparse,
slow, or silent, but it cannot invent. Axis 1 is not rejected permanently:
trajectory should later gate or corroborate recall, rather than recall
standing alone.

**Correction, 2026-08-19:** this section describes Axis 1 as a deferred,
unbuilt future decision. That is no longer accurate — `lib/corpusRetrieval.ts`
(`retrieveForVoice`) is a real, live embedding-similarity retrieval system,
already wired into `/api/divine` (`app/api/divine/route.ts`). It is scoped
narrowly (mekubal voice only, `retrievable_passage` rows the build gate
already cleared) and answers a different question than Axis 2 does — it
grounds a single Reading's provenance in corpus passages, not seeker
recurrence across visits — so it does not conflict with Axis 2 being chosen
for the memory-across-sittings problem this document covers. But per this
doc's own rule (code over doc where they disagree), the framing above should
not be read as "Axis 1 doesn't exist yet." It exists, is narrower in scope
than the memory question this doc addresses, and the "corroborate recall
later" note above is future work specific to *trajectory* consuming
retrieval, not retrieval itself.

## Scope

1. Wire `extractMarkers` + `insertVisit` into `/api/divine` so
   `visit_record` receives a row per reading.
2. Resurrect `marker-offer` / `confirm-marker`, session-scoped via
   `getSessionUserId` + `getVisitForUser`, with the confirm race closed.
3. `markerTrajectory.ts` + migration — flat `(user_id, marker_type,
   marker_value)` counts table, mirroring `getArchetypeArc`'s shape.
4. Make `trajectoryEnabled()` flippable.

Superseded the standalone PR D in the A–E memory-spine ladder.

## The appearance floor

`MIN_APPEARANCES_TO_SURFACE = 3`.

A marker is not spoken until it has been confirmed by the seeker in three
separate sittings. Two is a coincidence; three is the smallest number that
can honestly be called a pattern. The floor is the whole safety argument
for Axis 2 — without it, the feature is just the model being told what the
seeker said last time.

Counts are never spoken to the seeker. The model receives the threads, not
the arithmetic.

## Marker co-authorship

Markers are *confirmed*, not extracted-and-assumed. The extractor proposes;
the seeker accepts, reshapes, or declines. Only confirmed markers count
toward the floor. Five types: wound, threshold, pattern, exile, figure.

First-answer-per-field-per-visit is enforced by a guarded UPDATE
(`AND NOT markers_confirmed ? field`, `RETURNING id`; the counter
increments only when a row comes back). A replayed confirm returns
`already_recorded` rather than incrementing. This closed a proven hole:
before the guard, one replayed request inflated a count from 2 to 4, which
made the floor of 3 reachable with two real appearances plus noise.

A decline does not set the field, so a later confirm or reshape on the same
visit is still permitted.

## R1 — co-occurrence (SETTLED: (a))

Should pairs of markers that appear together be spoken as related?

The question exists because one-marker-per-visit makes *confirmed* pairs
structurally impossible. The only available pair source is the extractor's
proposed superset in `visit_record.markers`, filtered to floor-crossed
confirmed values.

- **(a) Speak them.** Ratified in the Claude Code session and posted as a
  comment on PR #43; the code currently live on that branch implements it.
- **(b) Count but don't speak.** Implemented in the v3 document, along with
  a tightened system-prompt clause requiring each thread to stand alone.

The argument for (b): filtering to floor-crossed values ratifies the
*endpoints*, not the *pairing*. The seeker confirmed each marker
individually and never said they belong to one another — the extractor put
them in one blob because they surfaced in one passage. Axis 2 was chosen
over Axis 1 precisely because counting cannot fabricate a connection, and
proposal-sourced adjacency reintroduces exactly that through a side door.

The argument for (a): it is already ratified and shipped, and the pairs are
filtered to values the seeker has confirmed at least three times each.

**Settled 2026-08-15: (a).** Re-affirmed as ratified on #43 — pairs are
spoken. `trajectoryContext.ts` and the system-prompt clause on
`feat/threshold-letter-markers` already agree on this (the 2026-08-07
attempt to switch to (b), 586da8f, was reverted same day in db9b9e6).
Option (c) — loosening one-marker-per-visit so pairs can be genuinely
co-confirmed — remains available as a future path and would make this
question moot; the argument for (b) above stands as the reason to
revisit if (c) ships.

## What ships gated

`trajectoryEnabled()` in `config/returning-features.ts` is triple-gated:
`ELDER_TRAJECTORY_ENABLED`, `MARKER_CONFIRMATION_READY`,
`CEILING_RATIFIED`. **Flipping the flag is a governance action, not a
deploy step.** It is the moment The Elder begins speaking from
accumulated seeker history, and it should not happen as a side effect of
an environment change.

Trajectory context is skipped entirely on welfare-elevated turns.

## Implementation

Stacked PRs, merge in order:

| PR | Branch | Contents |
|----|--------|----------|
| #37 | `feat/memory-spine-a` | Schema, ledger rekey, session history, release paths |
| #38 | `feat/marker-confirmation` | `markerExtractor.ts`, `insertVisit` into divine, marker-offer/confirm resurrected session-scoped |
| #39 | `feat/marker-trajectory` | `markerTrajectory.ts`, migration 009 |
| #40 | `feat/backend-cleanup-sweep` | `telemetryAllowed` gating in divine (real privacy fix), dead-code removal |
| #43 | `fix/axis2-integrity-and-speak-path` | Confirm race guard, field validation, per-lineage marker offers, `trajectoryContext.ts` + system-prompt wiring |
| — | `feat/chain-graft` | Deepen/explore chain assembly, stacked on #43 |

Then #42 (`feat/threshold-letter-markers`, marker deficit) reconciles on
top. #42 and #43 both touch `marker-offer/route.ts` and
`lib/returning/markers.ts`, each adding a parameter the other doesn't know
about — a naive second merge silently reverts the first. The reconciled
file must keep #43's `getSessionUserId` + `getVisitForUser`; #42's version
predates the session spine and reads visits with no ownership check.

`#42`'s migration is numbered 008 and collides with PR A's. Renumber to
010 before it touches Neon.

Notes on the speak path: before #43, `getTrajectoryMarkers` and
`trajectoryEnabled` had **zero consumers** — flipping the flag would have
changed nothing. `trajectoryContext.ts` caps at 5 threads and sanitizes
values; month names localize via a language→locale map (K'iche' Maya →
`es-GT`, no BCP47 tag exists).

## Open

- Reconcile #42 into the stack; renumber its migration.
- Run migrations 008 + 009 (+ renumbered 010) on Neon dev, then prod.
- Reconcile the uncommitted marker-offer UI in the working tree.
- Optional: parallelize `extractMythSignature` + `extractMarkersFromReading`
  via `Promise.all`. The chain graft can't move — it feeds the system prompt.
- Flag flip, as a governance action.
