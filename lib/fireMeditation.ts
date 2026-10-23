// lib/fireMeditation.ts
//
// The Fire Meditation: a wordless room beside the Fireside Chat. The seeker
// sits at the fire for as long as they like, with the whole instrument (the
// fire, the embers, the hour's light, the hearth's sound, the ceremonial drone)
// and no text at all. Nothing counts, times, asks or ends.
//
// Pure helpers only; the room itself is app/components/FireMeditation.tsx.

import { BREATH_PHASES } from './breathTiming';

export const FIRE_MEDITATION_ROUTE = '/fire-meditation';

// The fire leans with the shared breath cadence (lib/breathTiming.ts), the
// same rhythm as the entry breath, so the room breathes with the seeker
// without ever telling them to. Both bounds sit inside the fire's ordinary
// range (Threshold's phases run 0.22-0.85): it never surges and never gutters.
export const MEDITATION_FIRE_LOW = 0.34;
export const MEDITATION_FIRE_HIGH = 0.5;

/** Fire intensity at the START of a breath phase (the fire eases there; nothing snaps). */
export function meditationFireIntensity(phase: (typeof BREATH_PHASES)[number]['name']): number {
  return phase === 'inhale' || phase === 'hold' ? MEDITATION_FIRE_HIGH : MEDITATION_FIRE_LOW;
}
