# §1 Tree-State Data Shape — Read Before Designing

This is the doc to read before writing a single line of
`/api/user/tree-state` — not the endpoint spec itself, which doesn't
exist yet. Its job is to make sure the schema gets designed against
the real constraints from the start, instead of getting retrofitted
after a naive shape is already in production and seekers already have
real trees built on it.

Do not treat this as a green light to start building. The endpoint
still can't serve real data until `trajectoryEnabled()` is actually
flipped — this doc exists so the design is *ready* the moment that
governance decision lands, not so building starts early.

---

## 1. What already exists that this endpoint assembles

This is new *assembly* work, not new *tracking* work. Every input
already exists:

- `markerTrajectory.ts` / migration 009 — flat `(user_id,
  marker_type, marker_value)` counts. `MIN_APPEARANCES_TO_SURFACE`
  (currently 3) is the existing floor for a marker being spoken at
  all in the prompt layer; the same floor governs whether a marker is
  a root or a shoot here (see §2).
- `getMarkerCooccurrences()` — exists, is queried, and per the R1
  resolution is counted but never spoken in the prompt layer. This
  endpoint inherits that same restriction (see §3 — this is the part
  most likely to get quietly violated if whoever builds this treats
  "it's just data for a chart" as exempt from R1).
- `mostRecentChain()` / `assembleDeepContext()` — chain depth, for
  how far the canopy should read as "grown."
- `threshold_letter` table — each kept letter, for placing marks on
  the tree (§6 in the parent architecture doc). This endpoint doesn't
  need to return full letter text, just enough to place and link a
  mark (id, marker/thread it came from, date).
- Release state from PR A's chain release mechanics — this is the
  one piece that needs a genuinely new field, not just a new
  assembly of an old one (see §2, third state).

**Do not add new tracking to support this endpoint.** If a field
this endpoint wants to return doesn't map to something already
stored, that's a signal the visual idea needs to go back to the
architecture doc for reconsideration, not a signal to add a new
column.

---

## 2. The three-state model (not two)

A naive first pass would model this as two states: "marker crossed
the floor" (draw a root) / "marker hasn't" (draw nothing, or draw a
shoot). That's insufficient — per the addendum on release, there's a
third state:

| State | Condition | Visual treatment |
|---|---|---|
| **Active root** | marker crossed `MIN_APPEARANCES_TO_SURFACE`, still in an unreleased chain | full root |
| **Unconfirmed shoot** | marker below the floor | thin, provisional |
| **Released knot** | marker was in a chain the seeker explicitly released | visible, healed-over, no longer live growth |

**Design this field into the schema now, even before released chains
exist in real production data.** Retrofitting a third state onto a
schema that shipped with only two is far more disruptive once real
seeker trees depend on the existing shape than including an unused
`"released"` state value today and simply never emitting it until the
release-visualization work (addendum) actually gets built.

**Open question, not yet resolved — flag rather than guess:** should
an unconfirmed shoot be visible to the seeker at all before it
crosses the floor? The prompt layer's existing discipline is to not
speak a marker below the floor. Whether the *visual* layer should
mirror that (hide shoots entirely until confirmed) or show them as
provisional (as the parent architecture doc's §1 section assumed) is
an actual open design decision, not a settled one — resolve it
explicitly before building, don't let whichever way the first draft
happens to render become the de facto answer.

---

## 3. Hard constraint: R-1, applied to the schema itself

The parent architecture doc's Risk R-1 states this as a rendering
rule ("the UI must never draw an explicit connecting line"). That's
not sufficient on its own — a schema that returns co-occurrence pairs
as adjacent objects, or with a shared `pairId`, or in an array
literally named `connections`, hands the rendering layer a
loaded gun regardless of what the rendering rule says. A future
change to the rendering code (by someone who hasn't read the
architecture doc, or a well-meaning "let's make this clearer"
refactor) could trivially start drawing that line the schema already
implies.

**Concrete schema requirement, not just a rendering guideline:**
- If co-occurrence data is exposed at all, it must NOT be shaped as
  pairs, edges, or anything with an implicit "these two are linked"
  structure.
- Preferred approach: don't expose co-occurrence data to this
  endpoint's consumers at all in v1. It's counted server-side and can
  stay server-side-only, the same way it's counted-not-spoken in the
  prompt layer. If a future version wants proximity in the visual
  layout (roots that happen to sit near each other without a drawn
  connection), that can be computed from position randomization plus
  independent per-marker confidence, not from a co-occurrence field
  the frontend receives and has to be trusted not to visualize as a
  link.

---

## 4. Hard constraint: no cross-seeker fields, ever

Per the addendum's permanent boundary: this endpoint is scoped
strictly to `getSessionUserId()`'s own data, full stop. No aggregate
counts across users, no "seekers with a similar tree," no percentile/
comparison fields — not even in an anonymized or opt-in form. This
isn't a v1-scope note to revisit later; it's permanent. If a future
request asks for anything cross-seeker on this endpoint, that request
should be declined at the design stage, not built and gated behind a
flag.

---

## 5. Fail-closed behavior when the flag is off

Per `failTowardHonesty`: while `trajectoryEnabled()` is false (its
current state), this endpoint should not return an empty tree that
looks like "this seeker has no history yet." That's dishonest — the
seeker may have plenty of confirmed markers, they're just not being
surfaced. Return an explicit state (e.g. `{"available": false}`) that
the frontend can render as "not yet available" rather than silently
rendering a bare, empty-looking tree that implies a blank slate.

---

## 6. Draft shape (illustrative — not final, not for building against yet)

```
GET /api/user/tree-state

{
  "available": boolean,          // false while trajectoryEnabled() is off
  "lineageVoice": string,        // which voice's motif this tree belongs to (see §2 of the architecture doc — governs render, not assembled here)
  "roots": [
    { "markerType": string, "markerValue": string, "state": "active" }
  ],
  "shoots": [
    { "markerType": string, "markerValue": string, "appearanceCount": number }
    // open question from §2: should this array even be returned pre-floor? see above.
  ],
  "knots": [
    { "markerType": string, "markerValue": string, "releasedAt": string }
  ],
  "chainDepth": number,          // from mostRecentChain / assembleDeepContext
  "keptMarks": [
    { "letterId": string, "markerType": string, "date": string }
    // enough to place a mark, NOT full letter text — fetch that separately via the existing threshold-letters route if the seeker opens it
  ]
}
```

Explicitly NOT in this shape, on purpose:
- Any co-occurrence/pairing field (§3).
- Any cross-seeker field (§4).
- Full kept-letter text (already served by the existing
  `/api/threshold-letters` route — don't duplicate it here).
- Any motif-selection or rendering logic — this endpoint returns
  data, the frontend decides how a given `lineageVoice` renders it.
  Keeping that split clean matters especially once §2 (voice-specific
  motifs) starts landing for additional voices — this endpoint's
  shape shouldn't need to change just because a new voice gets a new
  visual treatment.

---

## 7. Before writing code against this doc

- Resolve the open question in §2 (shoot visibility) explicitly,
  in writing, the same way R1 and R2 got written resolutions —
  don't let an implementation detail decide it by default.
- Confirm `trajectoryEnabled()` is actually being flipped, or that
  there's a concrete plan/date for it — building this endpoint ahead
  of that decision is fine as design work, but merging it live ahead
  of the flag decision risks the same kind of "built but inert"
  outcome the marker-trajectory system itself sat in for weeks.
- Re-read Risk R-2 in the parent architecture doc before touching
  anything shared with `FireAtmosphere`/the drum — this endpoint is
  separate from that system, but if it's built in the same PR wave,
  keep the two changes independently verifiable.
