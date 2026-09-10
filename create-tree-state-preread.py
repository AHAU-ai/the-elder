#!/usr/bin/env python3
"""
create-tree-state-preread.py
Writes docs/elder-tree-state-preread.md — the pre-design reference to
read BEFORE writing any code for /api/user/tree-state (§1 of the v2.0
architecture). Covers: which existing data it assembles (no new
tracking), the three-state root/shoot/knot model, the R-1 constraint
applied directly to the schema (not just the render layer), the
permanent no-cross-seeker-fields boundary, fail-closed behavior while
trajectoryEnabled() is off, and a draft (non-final) response shape.

STATUS: reference document only. Writing this file does not build or
enable anything. The endpoint itself should not be built live ahead
of the trajectoryEnabled() flag decision (see doc §7).

Safety checks (mirrors the other create-*-doc.py scripts in this repo):
  - Confirms this is actually being run inside the AHAU-ai/the-elder
    repo (checks .git/config for the remote) before writing anything.
  - Does NOT overwrite an existing file at that path unless --force is
    passed (this is a reference document people may annotate directly;
    silently overwriting would discard that).

Run from repo root:
  /c/Python314/python create-tree-state-preread.py
  /c/Python314/python create-tree-state-preread.py --force   # to regenerate
"""

import sys
from pathlib import Path

REPO_ROOT = Path.cwd()
EXPECTED_REMOTE_FRAGMENT = "AHAU-ai/the-elder"

PREREAD_MD = """# §1 Tree-State Data Shape — Read Before Designing

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
"""


def confirm_repo_identity():
    """Abort rather than write into the wrong repo silently."""
    git_config = REPO_ROOT / ".git" / "config"
    if not git_config.exists():
        print("ABORT: no .git/config found in the current directory.")
        print(f"  cwd: {REPO_ROOT}")
        print("This doesn't look like a git repo at all. Run this from the-elder's repo root.")
        sys.exit(1)

    config_text = git_config.read_text(encoding="utf-8", errors="ignore")
    if EXPECTED_REMOTE_FRAGMENT not in config_text:
        print("ABORT: this directory's git remote doesn't look like AHAU-ai/the-elder.")
        print(f"  cwd: {REPO_ROOT}")
        print("Re-run this script from the-elder's actual repo root.")
        sys.exit(1)

    print(f"Confirmed: {REPO_ROOT} has a remote matching '{EXPECTED_REMOTE_FRAGMENT}'.")


def main():
    force = "--force" in sys.argv

    confirm_repo_identity()

    target = REPO_ROOT / "docs" / "elder-tree-state-preread.md"
    target.parent.mkdir(parents=True, exist_ok=True)

    if target.exists() and not force:
        print(f"SKIP (already exists, not overwriting): {target.relative_to(REPO_ROOT)}")
        print("This is a reference doc — if you've annotated it, re-running would")
        print("discard that. Re-run with --force only if you want a clean reset.")
        return

    if target.exists() and force:
        print(f"--force given: overwriting {target.relative_to(REPO_ROOT)}")
        print("Any annotations/edits made directly to that file are now discarded.")

    target.write_text(PREREAD_MD, encoding="utf-8")
    print(f"WROTE: {target.relative_to(REPO_ROOT)}")

    print()
    print("Reminder: do not build /api/user/tree-state live ahead of the")
    print("trajectoryEnabled() flag decision. This doc makes the design ready,")
    print("it does not authorize shipping it early.")
    print()
    print("This is a docs-only change — no tsc/build check needed.")
    print("Established branch flow for this repo (main is protected, GH013):")
    print("  git checkout -b docs/tree-state-preread")
    print("  git add docs/elder-tree-state-preread.md")
    print("  git commit -m 'Add §1 tree-state pre-design reference doc'")
    print("  git push -u origin docs/tree-state-preread")
    print("  gh pr create")


if __name__ == "__main__":
    main()
