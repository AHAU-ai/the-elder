// lib/hapticBreathPulse.ts
//
// One short vibration pulse per breath cycle, timed to the crest of
// BREATH_PHASES' `hold` phase (the fullest point of the breath).

import { BREATH_PHASES } from './breathTiming';

let pulseTimer: ReturnType<typeof setTimeout> | null = null;
let cycleTimer: ReturnType<typeof setInterval> | null = null;
let refCount = 0;

function msUntilHoldCrest(): number {
  let t = 0;
  for (const phase of BREATH_PHASES) {
    if (phase.name === 'hold') return t + phase.duration / 2;
    t += phase.duration;
  }
  const total = BREATH_PHASES.reduce((s, p) => s + p.duration, 0);
  return total / 2;
}

function totalCycleMs(): number {
  return BREATH_PHASES.reduce((s, p) => s + p.duration, 0);
}

export function startHapticBreathPulse(): void {
  refCount++;
  if (refCount > 1) return;

  try {
    if (!('vibrate' in navigator)) return;
    if (pulseTimer || cycleTimer) return;

    const offset = msUntilHoldCrest();
    const cycleMs = totalCycleMs();

    const fire = () => {
      try { navigator.vibrate(50); } catch {}
    };

    pulseTimer = setTimeout(() => {
      fire();
      cycleTimer = setInterval(fire, cycleMs);
    }, offset);
  } catch {
  }
}

export function stopHapticBreathPulse(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) return;

  try {
    if (pulseTimer) {
      clearTimeout(pulseTimer);
      pulseTimer = null;
    }
    if (cycleTimer) {
      clearInterval(cycleTimer);
      cycleTimer = null;
    }
    if ('vibrate' in navigator) {
      try { navigator.vibrate(0); } catch {}
    }
  } catch {
  }
}
