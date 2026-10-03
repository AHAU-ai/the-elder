// lib/portalCopy.ts
//
// The words of the portal -- the cold room a cold visitor stands in before
// the door opens onto the fire.
//
// Two kinds of text live here and they are held to different standards,
// exactly as BreathGate already separates them:
//
//   1. NARRATION -- the Elder's own voice (the scene as witnessed). Held to
//      the same register as lib/openingBridge.ts: witnessing, never
//      instructive, no flattery, lineage-agnostic. Mechanically checked by
//      scripts/check-opening-register.mjs, which reads this file as text
//      (it does not import it) and fails the build on drift.
//
//   2. AFFORDANCE -- interface labels ("hold to open"). Instruction here is
//      the interface speaking, like BreathGate's "BREATHE IN"; it is not the
//      Elder's voice and is not under the register guard.
//
// What is deliberately NOT here, and does not get added without real
// authorization + a Shalom review: any lineage-differentiated threshold
// imagery or greeting. The door is a plain door; the room is an ordinary
// room. Nothing in it belongs to a tradition.
//
// UI copy only. Never imported into the prompt layer.

/** The cold room, before anything has been touched. One beat each. */
export const PORTAL_ROOM_LINES = [
  'The room is quiet. Nothing in it asks anything of you.',
  'In the wall there is a seam of ember light, where no door should be.',
] as const;

/** Arrives as the door gives way -- the first thing the other side offers. */
export const PORTAL_CROSSING_LINE =
  'Woodsmoke, and a fire that was burning before you came.';

/** Interface labels. Not the Elder's voice; see the header note. */
export const PORTAL_AFFORDANCE = {
  hold: 'HOLD TO OPEN',
  holdSub: 'or tap once',
  doorLabel: 'Hold to open the door and step through, or tap once',
  skip: 'already know this place',
} as const;
