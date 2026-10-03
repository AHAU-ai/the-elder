// lib/portalFlag.ts
//
// "You have crossed before." A persisted (cross-session) flag, set the moment
// the door gives way. A seeker who has crossed once no longer stands in the
// cold room on later visits; they land directly at the breath (BreathGate),
// which stays the literal opener of the sitting. Skipping the portal does NOT
// set it -- only actually crossing does. Storage failures (private mode) mean
// "not crossed": the portal simply shows again.

const KEY = 'elder_crossed';

export function hasCrossedBefore(): boolean {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function markCrossed(): void {
  try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
}
