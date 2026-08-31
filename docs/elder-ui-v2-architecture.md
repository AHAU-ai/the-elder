# The Elder — UI/UX v2.0 Architecture
### The Living Field: making the reading surface represent what the system already knows

This document pulls all six v2.0 concepts into one coherent architecture,
maps each to real components/data already in the codebase (not
invented ones), and sequences them by actual dependency — not by
which is most exciting to build first.

---

## 0. The organizing idea

Every prior surface (v1, the reading-delivery concept) treats one
reading as the whole world. v2.0's actual leap isn't more visual
polish on a single reading — it's that **the visual field becomes a
persistent representation of the seeker's real trajectory data**,
across every sitting, across every voice, across a whole relationship.

Concretely: the six concepts aren't six separate features. They're
one system — *The Living Field* — viewed from six angles:

```
                    THE LIVING FIELD
                          │
      ┌─────────┬─────────┼─────────┬─────────┬─────────┐
      │         │         │         │         │         │
  Persistent  Voice-   Unified   Spatial   Council   Physical
    Tree     Specific   Fire+     Deepen   Constel-   Kept
  (§1)       Motif(§2)  Drum(§3)  Nav(§4)  lation(§5) Card(§6)
```

§1 is the trunk everything else hangs off. §2 determines what grows.
§3 is the ambient nervous system underneath all of it. §4 and §5 are
two different camera behaviors on the same tree data. §6 is what a
seeker takes *out* of the field when they leave.

---

## 1. Persistent Tree — the trunk

**What it is:** the ceiba (or lineage-appropriate equivalent, see §2)
stops being redrawn from a hardcoded script each reading and becomes
a real render of the seeker's actual `marker_trajectory` state.

**Real data it draws from (already exists):**
- `markerTrajectory.ts` / migration 009 — flat `(user_id, marker_type,
  marker_value)` counts table. This is the root system: each
  confirmed marker that's crossed `MIN_APPEARANCES_TO_SURFACE` (3)
  becomes a root; markers below the floor are thin unconfirmed shoots,
  visually present but not yet "real" the way the trajectory system
  itself treats them.
- `getMarkerCooccurrences()` — per the R1 resolution, this is counted
  but never *spoken*. Visually, this constraint should hold too:
  co-occurring markers can sit near each other in the root field, but
  the UI must never draw an explicit connecting line between two
  roots the seeker never confirmed were related. (This is the same
  discipline as the prompt-layer rule, just extended to pixels — see
  Risk R-1 below.)
- `visit_record` / chain data (PR A/B, `mostRecentChain`,
  `assembleDeepContext`) — depth of the canopy reflects how many
  chained/deepened sittings exist in the seeker's most recent chain,
  not how long today's reading is.
- `threshold_letter` table — each kept letter could be a small mark
  on a branch (see §6 for what that mark actually looks like when
  picked up).

**New surface needed:** a `/api/user/tree-state` endpoint (doesn't
exist yet) that assembles floor-crossed markers + co-occurrence pairs
+ chain depth into a render-ready shape, mirroring how
`trajectoryContext.ts` already assembles the same underlying data for
the *prompt* layer. This is genuinely new work, but it's assembling
data that already exists — not new tracking.

**Sequencing dependency:** blocked on nothing technical. Blocked on
`trajectoryEnabled()`'s flag flip — you can't visually represent
trajectory data for seekers who aren't accruing it. This is first in
line the moment that governance decision is made.

---

## 2. Voice-Specific Visual Language — what grows

**What it is:** each authorized voice gets its own grown-form,
grounded in that lineage's actual cosmology the way the ceiba is
grounded in K'iche' cosmology (Popol Wuj, world-tree-at-center
convention) — not a reskinned tree with different colors.

**Hard dependency, not a nice-to-have:** this cannot ship ahead of
the reading-shape voice-review checklist (`docs/reading-shape-voice-
review.md`) resolving per voice, for exactly the reason that checklist
exists — committing to a *visual* claim about a lineage's symbolism is
a stronger, more public assertion than a closing-sentence convention
was, and you don't have real authorization for anything but ojer_tzij
yet. Shipping voice-specific visuals for babalawo or Rashbi/Mekubal
ahead of real review would be the melting-pot anti-pattern (named in
the 2026-07-30 milestone marker) expressed visually instead of
textually — arguably worse, because an image reads as a firmer claim
than a sentence does.

**Practical sequencing:**
- ojer_tzij: ceiba, buildable now (Stanzione review already in
  motion for the closing-shape clause; the tree motif itself
  should go in the *same* ask to him, not a separate round-trip).
- babalawo, dreamtime, Rashbi/Mekubal, bhikkhu: motif design work
  should not start until each voice's Track 2 self-review is
  CONSISTENT. Design time spent before that is time that may be
  thrown away if a review comes back CONTRADICTED.
- The seven unnamed placeholder voices: no motif work is possible
  until they're named at all.

**Fallback requirement:** any voice without a resolved motif needs an
honest, low-claim default (a plain, non-symbolic ember-field — not a
generic "spiritual tree" that implies false specificity) — the same
`failTowardHonesty` principle applied to the visual layer.

---

## 3. Unified Fire + Drum Instrument — the nervous system

**What it is:** `FireAtmosphere.tsx`'s living-light system (phase
baseline intensity, question-flare, smoke veil, the sixth
breath-synced glow layer added this cycle) and the heartbeat drum
(`apply-heartbeat-drum.sh`, scoped to `OracleResponse`/`CouncilTab`)
stop being two features that happen to run at the same time and
become one instrument with one shared clock.

**Concretely:**
- The drum's tempo becomes the actual timing source for the
  spark-burst ignition moment (v1 built this as a fixed ~1.1s CSS
  animation) — the burst should land *on* a drumbeat, not near one.
- `FireAtmosphere`'s existing `interrupted` prop (added when firelight
  needed to dim rather than flare on error) should also duck the
  drum's volume/intensity, not just the visual flame — right now a
  fast-fail validation error dims the fire but the drum (if playing)
  wouldn't know anything went wrong.
- The breath-synced glow layer (BREATH_CYCLE_MS) and the breathe-gate
  stage from the v1 concept should share literally the same timing
  source as the drum's pre-reading idle tempo, so the transition from
  "breathing" to "the drum starts" is a tempo shift, not a hard cut
  between two unrelated systems.

**New surface needed:** a small shared `lib/ceremonialClock.ts` (or
similar) that both `FireAtmosphere` and the drum module import from,
replacing the drum's currently-independent tempo and
`FireAtmosphere`'s currently-independent `BREATH_CYCLE_MS` reference
with one real source of truth. This is a refactor of existing working
code, not new behavior — the risk is regression, not invention (see
Risk R-2).

---

## 4. Spatial Deepen Navigation — depth as literal depth

**What it is:** right now (per the v1 concept and the real
`chainAction: 'deepen'` backend behavior) deepening a thread just
replays the reveal sequence with new text. v2.0: the canopy that
opened for reading N becomes the visual floor/ground-level for
reading N+1 — the camera moves *into* the tree rather than the tree
resetting.

**Real backend this rides on (already built, already inert on
frontend):** `mostRecentChain()`, `assembleDeepContext()`,
`effectivePriorMythContext`, `DEEPEN_CONTEXT_WINDOW` /
`DEEPEN_TOKEN_CEILING`, `renderChainContext()` — this entire feature
is backend-complete and unwired on the frontend, exactly as flagged
in the 2026-08-07 build log. v2.0's spatial navigation is arguably the
*correct* frontend for this backend, more so than "just show more
text" would have been — the backend already models depth as a real
structural concept (`nextDepth`, `ChainHead`), and a flat reveal
throws that structure away visually while a depth-based camera keeps
it.

**Constraint from the backend that must hold visually:** deepen is
only honored server-side when signed-in + reading mode + non-crisis +
*same lineage as the prior chain*. The camera-move-inward interaction
must be unreachable (not just disabled-looking) outside those
conditions — an interactive "go deeper" gesture that silently falls
back to a fresh `explore` reading with no visual signal that the
depth reset would be a real regression from the backend's own
cross-lineage-fallback discipline.

**Sequencing dependency:** blocked on wiring `chainAction` into the
frontend at all (flagged as not-yet-done as of the last build log
entry) — this has to happen before spatial navigation can be built on
top of it, and it's a smaller, independently valuable step worth doing
first regardless of the visual work.

---

## 5. Council Constellation — three trees, one field

**What it is:** Council mode (currently tab-based per
`CouncilTabs.tsx`/`CouncilTab`) renders three (or however many) voices'
trees in one shared dark field for the same question, rather than
switching between isolated tab views.

**Why this is a real design tension, not just a layout change:**
Lineage Integrity of Voice requires each voice to divine only from its
own tradition, no cross-borrowing — and §2 already establishes that
each voice's motif must be visually distinct and separately
authorized. Putting three trees in one frame is the single riskiest
visual decision in this whole architecture, because proximity itself
implies relationship. Three world-trees standing near each other in
one field visually suggests they're aspects of one thing — which is
close to the exact anti-pattern (melting-pot convergence) the
architecture exists to prevent, even though the underlying reading
text stays properly separated per-voice.

**Mitigating direction, not a full solution:** visually partition the
field — three trees each rooted in their own clearly bounded ground
(not sharing soil/roots visually), enough shared darkness to read as
"one sitting, one question" but enough separation (space, a threshold
line, distinct root systems that never touch) that "three answers to
one question" doesn't slide into "three chapters of one answer."

**Sequencing dependency:** should not start before at least two
voices beyond ojer_tzij have resolved Track 2 reviews (§2) — building
Council Constellation with only one real voice and placeholders
defeats the purpose, and building it with unreviewed voices compounds
§2's risk with §5's own.

---

## 6. Physical Kept-Letter Artifact — what leaves the field

**What it is:** "keep this reading" currently condenses to four lines
in a styled box (v1 concept) or a plain closing screen (real
`ThresholdLetters.tsx`/`ShareableCard` "Keep This Gift" flow). v2.0:
render it as something closer to an object — a small woven or carved
card the seeker can turn over — matching the "gift" language the real
UI already uses, rather than reading as a form-submission confirmation.

**Real data/components this touches:**
- `thresholdLetterLedger.ts` (fail-closed save/get), `threshold_letter`
  table (cap 20/user, oldest-eviction) — the four phrases
  (volatilization/return/gift/image) already exist as structured data;
  this is a rendering upgrade, not a new data model.
- `ShareableCard`'s existing highlight-to-share + html-to-image
  pipeline — the "physical" card treatment should extend this
  existing export path, not build a second one.
- The persistent tree (§1): each kept letter could correspond to a
  small mark on the tree it came from, so "picking up" a card from the
  journal and "seeing it as a mark on your tree" are the same object
  viewed two ways, not two disconnected representations of the same
  underlying row.

**Sequencing dependency:** independent of everything else — this can
be built any time, though it's more satisfying once §1 exists, since
the tree-mark connection is what makes it feel like a real artifact of
a real relationship rather than a nicer-looking export button.

---

## Build sequence (by actual dependency, not by appeal)

1. **Flip the trajectory flag** (governance decision, not engineering) — nothing in §1 or §5 can be real without it.
2. **Wire `chainAction` into the frontend** — unblocks §4, independently valuable regardless of visual work.
3. **Build `/api/user/tree-state`** and the real (not hardcoded) §1 tree render for ojer_tzij only.
4. **`ceremonialClock.ts` refactor** (§3) — can happen in parallel with 1–3, touches existing code more than new.
5. **Stanzione review, ceiba motif included** — needed before §2 is "done" even for the one voice you can actually ship.
6. **§6 physical kept-card** — can slot in anywhere after step 3, low risk, high polish-per-effort.
7. **§4 spatial deepen navigation** — after step 2 and step 3 both exist.
8. **§2 for additional voices** — gated one at a time behind each voice's own Track 2 review landing CONSISTENT.
9. **§5 Council Constellation** — gated behind at least two more voices clearing step 8.

---

## Cross-cutting risks (worth naming before any of this starts)

- **R-1 — co-occurrence leak through the visual layer.** The R1
  resolution (counted, not spoken) was a prompt-layer discipline. A
  tree that visually clusters two roots close together, or connects
  them with a shared branch, reintroduces exactly the fabricated-
  connection risk R1 was resolved to prevent — through pixels instead
  of words. Needs its own explicit design rule, not an assumption that
  "it's just visual, it doesn't count."
- **R-2 — the ceremonialClock refactor regresses working ceremony
  timing.** §3 touches `FireAtmosphere` and the drum, both of which
  have already been through multiple red-team passes this project
  (the pulse-prop-inert-in-Council bug, the interrupted-prop
  error-dimming fix, the breath-sync glow layer). A shared-clock
  refactor is exactly the kind of change that could silently reopen
  one of those already-fixed bugs. Needs the same fresh-clone
  tsc+build+manual-smoke-test discipline as every prior fire change,
  not a shortcut because "it's just consolidating timing."
- **R-3 — Council Constellation shipping ahead of real lineage
  breadth.** Flagged in §5 already, repeated here because it's the
  single highest-consequence risk in the whole document: this feature
  visually performs multi-lineage breadth you don't yet have real
  authorization for outside ojer_tzij.
- **R-4 — voice-specific motifs becoming a second content surface
  without a review process.** §2's motifs are visual claims about
  lineage cosmology. If they're designed by whoever's doing frontend
  work that week without going back through the same review discipline
  as the closing-shape clause, this becomes a second unreviewed
  content channel — the same failure mode the reading-shape checklist
  was built to close, reopened one layer up the stack.
- **R-5 — scope creep into "redesign everything."** This document
  covers reading delivery and Council. It deliberately does not touch
  Threshold intake or the shell/nav — keep it that way unless a
  separate decision extends scope, per the same reasoning that made
  scoping the original UI request to one surface the right call.

---

## What this is not

This is an architecture, not a build-ready spec. No code should be
written against this document directly — each numbered section still
needs its own design pass (mockup, red team, Claude Code
implementation) the way the reading-delivery concept did. Treat this
as the map that determines *order*, not a shortcut past the process
that's gotten everything else in this project actually shipped
correctly.
