# Axis 4 — The Hearth Follows Movement

Status: designed and implemented, gated off. Not ratified.
Decided: 2026-10-23 (Jesse asked for it; this record names what was chosen).

This is a decision record in the shape of Axis 2. Where it and the code
disagree, the code ships and this file should be corrected. Nothing here
authorizes lighting it: flipping `HEARTH_RESPONDS_TO_MOVEMENT_ENABLED` is a
governance action (section "What ships gated").

## The failure mode being guarded against

`HEARTH_RESPONDS_TO_MOVEMENT` was an empty placeholder. The movement classifier
(`lib/returning/trajectory.ts`, Arriving / Descending / Circling / Ranging /
Crossing over the last five visits) already tones the *Reading's register*
through a prompt clause in `/api/divine`. The ask is to let the *fire itself*
carry a trace of the same thing, silently.

The risk is not that it is wrong; it is that it is **legible**. A fire the
seeker can see is a surface they can read. If the fire dims for one movement
and brightens for another, the seeker learns the instrument has classified
them, and learns which class. Circling is the dangerous one: a fire that cools
when someone returns to the same wound is a reproach delivered in light, the
exact thing M5 (the banked fire) is cut for. Axis 2 chose counting over
inference because a fabricated connection is a trust violation; a visible
verdict, even a wordless one, is the same violation with no words to push back
on. The design therefore makes the hearth **unable to say anything the seeker
could object to**.

## The choice

Three ways to let the fire follow movement were considered.

**A. Map each movement to its own look** (dim for Circling, bright for
Crossing, flicker for Ranging). Rejected: five distinguishable states are five
readable verdicts, and any cooler state is a reproach.

**B. Pass the movement to the client and let it decide.** Rejected: puts the
enum, which RT-2 says is ephemeral by construction, in browser state and
network responses where it can be stored or logged.

**C. Warm-only, coarse, derived on the server, never the label.** Chosen. The
server turns the movement into one bounded number, `warmth`, that can only add
light, and sends only that number.

## Scope

1. `lib/hearthMovement.ts` — pure: `warmthFor(movement)` and the bounds.
2. `GET /api/user/hearth` — session-scoped; computes the movement from the
   seeker's last five visits and returns `{ warmth }` only.
3. `HearthHour.tsx` — adds `warmth` to the existing glow layer. Nothing else.
4. `hearthRespondsToMovementEnabled()` in `config/returning-features.ts`.

## The floor (what the fire may and may not do)

- **Warm-only.** `warmth` is in `[0, WARMTH_MAX]`, `WARMTH_MAX = 0.06`. No
  movement ever lowers brightness, raises the veil, slows or stills the fire.
  Neutral is the floor. A seeker with no signal sees today's fire.
- **Coarse.** Three values, not five: Arriving and Ranging are neutral
  (0). Descending and Circling are the *same* value (0.04), so the fire cannot
  tell the seeker they are circling. Crossing is slightly more (0.06). The
  least-informative reading of the output is "the fire knows you have been here",
  which is what the trajectory layer already says in words once it is lit.
- **Subtle.** `0.06` on a layer whose own maximum opacity is `0.16`
  (`GLOW_MAX_OPACITY`) is below what two side-by-side screenshots make obvious.
  It is meant to be felt, not noticed.
- **No label, no text, no explanation.** Not in the DOM beyond the existing
  `data-` attributes (which receive nothing new), not in About, not in logs.
- **Not a reward for frequency.** The input is the shape of the last five
  sittings, not how many or how recent; the output has no ceiling that rises
  with use.

## What stays server-side vs. what is spoken

| Item | Where it lives |
|---|---|
| The movement enum | Server memory for the length of one request. Never persisted, never logged, never in a response (RT-2). |
| `warmth` | Sent to the browser as a number, applied, discarded. Not stored in `localStorage` or `sessionStorage`; the next page load asks again. |
| Anything the fire "says" | Nothing. The Reading's register clause is the only spoken trace of movement, and is unchanged. |

## Welfare and grief

The hearth read has no message, so it cannot run the welfare gate. It cannot
make anything worse: warm-only means the worst case is a fire slightly warmer
than neutral. The RT-1 grief override still holds in spirit (grief never maps
to anything but warm), and a failure to read history returns neutral, never a
guess.

## Rollout

`hearthRespondsToMovementEnabled()` requires, all at once:

1. `HEARTH_RESPONDS_TO_MOVEMENT_ENABLED=true` — the deliberate flip;
2. every trajectory gate (`trajectoryEnabled()`), because it reads the same
   classifier and the same confirmed markers;
3. the seeker is inside the trajectory rollout stage (testers first,
   `TRAJECTORY_ALL_SEEKERS`, `docs/runbooks/light-the-living-features.md`);
4. the seeker is Kept or above (same rule as the Reading's movement clause).

While any is closed `/api/user/hearth` returns `{ warmth: 0 }` without a
database read, and the fire is byte-for-byte what it was.

## Open questions for review (not engineering's to settle)

1. **Is a warm trace the synthetic-intimacy ceiling (Appendix B) or inside it?**
   Words are the thing the ceiling was written about; light was not considered.
   Shalom's call. If the answer is "outside", delete this feature, not soften it.
2. **Should Circling be left neutral instead of sharing Descending's value?**
   Sharing hides it; neutral hides it too but makes "no warmth" mean
   "Arriving, Ranging, or Circling", which is less honest-looking if noticed.
3. **Lineage holder.** Does a warmer hearth for a returning seeker sit right in
   Ajq'ija' practice (Vincent), or is the fire not ours to tune?

## Implementation

| File | Role |
|---|---|
| `config/returning-features.ts` | `hearthRespondsToMovementEnabled()`; `FEATURES.HEARTH_RESPONDS_TO_MOVEMENT` now reads the flip |
| `lib/hearthMovement.ts` | `warmthFor`, bounds |
| `lib/returning/visit.ts` | `recentVisitsForMovement` — the last five visits, no reading text |
| `lib/returning/hearthRead.ts` | gate + classify + map, fails neutral |
| `app/api/user/hearth/route.ts` | the one read |
| `app/components/HearthHour.tsx` | applies `warmth` to the glow layer |
| `lib/hearthMovement.test.ts` | warm-only, bounded, coarse, inert when dark |
