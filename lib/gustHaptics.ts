// lib/gustHaptics.ts
//
// The cold gust (PortalGate) felt in the hand, in step with what the eye sees: the same envelope
// drives the wash and wind-streaks on screen and the buzz in the phone, so the chill, the
// shaking frame and the vibration begin, peak and die away together as the wind carries you into the vortex.
//
// What the platform allows, plainly:
//   - Vibration API (Chrome/Firefox on Android): on/off durations only, no strength. Strength is made
//     the only way it can be: longer pulses with shorter gaps at the peak, short pulses with long gaps in the tail.
//   - iPhone Safari does not implement navigator.vibrate. iOS 17.4+ does give a light tap when a
//     <input type="checkbox" switch> is toggled through its label, so there a train of such taps follows the
//     same envelope. Best effort: Safari wants a recent touch, so it may be silent after a quick tap
//     (a held press is the reliable case). Failure is always silent; nothing else depends on it.
//   - Never under prefers-reduced-motion; never while the tab is hidden; always cancellable
//     (skipping, easing the door shut, leaving).
//
// Pure module apart from makeSwitchTick: everything environmental is injected, so it is unit-tested.

import { smoothstep } from './portalCrossing';

/** How long the gust lasts, from the moment it arrives (the wash, streaks and buzz all end here). */
export const GUST_MS = 1900;

/** 0..1: how hard the wind is blowing, `sinceMs` after the gust arrived. Rises in 0.22s, holds to 0.6s, dies away by 1.9s. */
export function gustEnvelope(sinceMs: number): number {
  return smoothstep(0, 220, sinceMs) * (1 - smoothstep(600, GUST_MS, sinceMs));
}

const PERIOD_MS = 56;     // one pulse + its gap
const MIN_ON_MS = 7;      // below ~7ms many motors do not respond
const MAX_ON_MS = 40;
const FLOOR = 0.08;       // below this the wind is too faint to feel

/** A vibration pattern (on/off ms, starting with "on") that follows gustEnvelope. Whole, positive numbers. */
export function gustPattern(): number[] {
  const out: number[] = [];
  for (let t = 0; t < GUST_MS; t += PERIOD_MS) {
    const env = gustEnvelope(t + PERIOD_MS / 2);
    if (env < FLOOR) {
      if (out.length) break;   // the wind has dropped away: done
      continue;                // not yet risen: skip the first faint moments
    }
    const on = Math.round(MIN_ON_MS + (MAX_ON_MS - MIN_ON_MS) * env);
    out.push(on, PERIOD_MS - on);
  }
  if (out.length && out.length % 2 === 0) out.pop();   // end on an "on": a trailing gap is meaningless
  return out;
}

/** Times (ms after the gust) of discrete taps for platforms that can only tick: dense at the peak, sparse in the tail. */
export function gustTicks(): number[] {
  const ticks: number[] = [];
  let t = 40;
  while (t < GUST_MS) {
    const env = gustEnvelope(t);
    if (env >= FLOOR) ticks.push(Math.round(t));
    t += 30 + (1 - env) * 150;   // 30ms apart at the peak, up to 180ms apart as it fades
  }
  return ticks;
}

export interface GustHapticDeps {
  /** navigator.vibrate, or null where it does not exist. */
  vibrate: ((pattern: number | number[]) => unknown) | null;
  /** One discrete light tap (iOS switch haptic), or null. Used only when vibrate is null. */
  tick: (() => void) | null;
  reducedMotion: () => boolean;
  isVisible: () => boolean;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (h: unknown) => void;
}

export interface GustHaptics {
  /** The gust has just arrived: start the buzz. No-op if one is already running. */
  fire: () => void;
  /** Stop at once (skip, door eased shut, unmount). Safe to call any time, twice. */
  cancel: () => void;
}

export function createGustHaptics(deps: GustHapticDeps): GustHaptics {
  let running = false;
  let handles: unknown[] = [];

  const cancel = () => {
    for (const h of handles) deps.clearTimeout(h);
    handles = [];
    if (running && deps.vibrate) { try { deps.vibrate(0); } catch { /* ignore */ } }
    running = false;
  };

  return {
    fire() {
      if (running) return;
      let allowed = false;
      try { allowed = !deps.reducedMotion() && deps.isVisible(); } catch { allowed = false; }
      if (!allowed) return;
      if (deps.vibrate) {
        const pattern = gustPattern();
        if (!pattern.length) return;
        try { deps.vibrate(pattern); running = true; } catch { return; }
        handles.push(deps.setTimeout(() => { running = false; handles = []; }, GUST_MS + 200));
      } else if (deps.tick) {
        const tick = deps.tick;
        running = true;
        for (const at of gustTicks()) {
          handles.push(deps.setTimeout(() => { try { if (deps.isVisible()) tick(); } catch { /* ignore */ } }, at));
        }
        handles.push(deps.setTimeout(() => { running = false; handles = []; }, GUST_MS + 200));
      }
    },
    cancel,
  };
}

/** iOS 17.4+: a light haptic from toggling a hidden checkbox switch through its label. Returns null off the web. */
export function makeSwitchTick(): { tick: () => void; dispose: () => void } | null {
  if (typeof document === 'undefined' || !document.body) return null;
  try {
    const wrap = document.createElement('div');
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    const label = document.createElement('label');
    label.appendChild(input);
    wrap.appendChild(label);
    document.body.appendChild(wrap);
    return { tick: () => label.click(), dispose: () => wrap.remove() };
  } catch {
    return null;
  }
}
