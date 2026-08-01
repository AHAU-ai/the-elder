// lib/breathTiming.ts
//
// Single source of truth for the breath cadence used across the app.
// BreathGate.tsx (the entry reveal) hard-codes these same values today;
// this file exists so the loading-state breathing (BreathingWait.tsx)
// uses the identical rhythm rather than inventing a second one. If you
// ever retune BreathGate's pacing, update it here too so the two don't drift apart.

export const BREATH_PHASES = [
  { name: 'rest-low',  duration: 1200, label: '' },
  { name: 'inhale',    duration: 4000, label: 'BREATHE IN' },
  { name: 'hold',      duration: 2000, label: 'HOLD' },
  { name: 'exhale',    duration: 4000, label: 'BREATHE OUT' },
  { name: 'rest-high', duration: 1200, label: '' },
] as const;

export const BREATH_CYCLE_MS = BREATH_PHASES.reduce((sum, p) => sum + p.duration, 0); // 12400ms
