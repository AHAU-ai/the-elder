# Axis 3 — Forward Architecture

Status: proposal, unbuilt. Not ratified. Nothing here ships without the same
sign-off discipline as Axis 2 (governance/signoffs/, ARCH-03).

This is a proposal record, not a decision record like axis-2's — nothing
below has been approved, and none of it should be read as authorized
scope. It exists so the next round of "what should the backend become"
starts from a written position instead of a chat thread.

## Why this doc, why now

The frontend surface (lineage voices, threshold letters, journal, share
cards, altar record, myth arc) is broad. The backend that serves it is
comparatively narrow: one retrieval path (mekubal only, no rerank), one
memory mechanism now live (Axis 2 recurrence counting), a welfare gate,
and a provenance ledger. This doc separates two different kinds of "more
depth": (A) extending mechanisms that already exist to the scope they
were designed for, and (B) genuinely new mechanisms the product doesn't
have yet. (A) is safer and should come first. (B) is where the ask for
forward-thinking belongs, and is marked speculative throughout.

## Near-term — extending what already exists (low novelty, real gap)

These aren't new ideas; they're the acknowledged unfinished edges of Axis 1
and Axis 2, restated so they're trackable as backend work rather than
buried in code comments.

1. **Retrieval beyond mekubal.** `corpusRetrieval.ts` is voice-scoped by a
   single `lineage_key` filter with no other voice's corpus ingested. Every
   other lineage's Readings currently carry the "not grounded in specific
   passages" provenance fallback unconditionally, not because retrieval
   failed but because it was never given anything to retrieve. Extending
   ingestion (ELD-033, ELD-020, ELD-012) to a second voice is the highest-
   leverage single change in this list — it's schema-compatible today.

2. **Hybrid query + rerank (ELD-008's actual scope).** Current retrieval
   embeds the seeker's literal last message. ELD-008 specifies building
   the query from the five-marker diagnosis + Cruz Maya position instead —
   structurally different (diagnosis, not text, is the query) and requires
   a rerank step the current single-embed-and-sort path doesn't have.

3. **Axis 1 as trajectory corroboration.** Axis 2's own doc names this as
   the deferred option: once a marker crosses the appearance floor via
   confirmed recurrence, *then* let retrieval surface passages related to
   that marker specifically, narrowing rather than replacing the counting
   mechanism. This is additive to Axis 2, not a re-litigation of it — the
   floor still gates what gets spoken, retrieval only picks *which*
   corroborating passage.

4. **`CHARGE_MEMORY` / `HEARTH_RESPONDS_TO_MOVEMENT`.** Both are `false`
   with zero implementation behind them — pure placeholders in
   `config/returning-features.ts`. Neither has a design doc. Before either
   is built, each needs its own axis-N doc following Axis 2's shape: what
   failure mode is being guarded against, what the appearance/consent floor
   is, what stays server-side vs. spoken.

## Speculative — genuinely new backend surface

Marked speculative because none of this has lineage or welfare review, and
this product's own stated failure mode (a fabricated connection is a trust
violation, not a bad recommendation) applies with extra force the further
a mechanism gets from "count what was confirmed" toward "infer what wasn't
said."

**Cross-lineage trajectory.** Right now Axis 2 counts markers within one
seeker's history, unscoped by which lineage voice surfaced them. A wound
confirmed while consulting `ojer_tzij` and the same wound-type confirmed
later under `mekubal` currently count toward the same floor. Whether that's
correct or a category error depends on whether markers are seeker-truths
independent of which voice elicited them, or artifacts of that voice's
questioning style — an unresolved question, not an engineering task, and it
should be posed to the lineage holders before any schema work, not after.

**Seeker-initiated correction of the trajectory itself.** Axis 2 lets a
seeker confirm/reshape/decline a single proposed marker at offer time.
There's no path today for a seeker to say, weeks later, "that thread you
named three times — it wasn't that." A revision path is the natural
extension of "markers are confirmed, not extracted-and-assumed," applied
retroactively instead of only at the moment of offer. This is safer than it
sounds precisely because it doesn't add new inference — it's still the
seeker's own assent, just later.

**Provenance-linked welfare history.** `welfareGate.ts` assesses each
message in isolation. A seeker whose reshape text has repeatedly triggered
`distress`-tier (not `crisis`) welfare responses across visits is a pattern
the system currently has no memory of — each sitting starts blind. Whether
that pattern should ever surface to the model, versus only to a human
reviewer, versus never leave an audit log, is exactly the kind of ceiling
question Appendix B exists to answer, and would need its own ratification
before any code.

**A second retrieval corpus per lineage, lineage-holder-authored rather
than ingested.** Every existing retrieval path treats the corpus as a fixed
text to be chunked and embedded (Popol Wuj passages). A living-tradition
lineage holder could instead author short, versioned "corroboration notes"
directly — not source text, but held commentary on what a recurring marker
tends to mean in that tradition — retrievable the same way, but authored
for this purpose rather than repurposed from a primary text. This turns
retrieval from "citation of a historical document" into "citation of a
living accountability holder's judgment," which changes what the
provenance block is claiming and would need its own generation-contract
revision (ELD-009) before it could ship.

## What this doc deliberately does not propose

No autonomous trajectory-writing (the model proposing markers without a
human-in-the-loop confirm step), no cross-seeker aggregation or
population-level pattern-mining (the entire design posture of this product
is single-seeker, consent-scoped memory — anything that pools seekers
together is a different product and a different consent model), and no
loosening of the appearance floor or the welfare gate in service of any of
the above. Those aren't omissions to fill in later; they're outside this
doc's frame on purpose.

## Next step

Nothing here is scoped for build. If any one item above is worth pursuing,
the next step is the same one Axis 2 took: a decision record naming the
failure mode being guarded against, then lineage + welfare sign-off, before
any schema or endpoint work begins.
