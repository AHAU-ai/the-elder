// lib/usePresence.ts
//
// Reads the seeker's own stillness and rhythm back as a single 0–1 value —
// not "is the user active" (that's the opposite question). Presence rises
// the longer a visitor holds still or types in an even cadence, and falls
// the moment they scroll, jump the cursor, or move erratically. The fire
// and mist consume this so the ceremony's atmosphere visibly answers the
// seeker's own attention instead of running on a clock alone — the room
// is only as alive as they are.

import { useEffect, useRef, useState } from 'react';

const RISE_MS = 2600;   // stillness this long reaches full presence
const FALL_MS = 900;    // a single restless movement decays it this fast
const TICK_MS = 240;
const STEP_EPSILON = 0.015; // skip the state update (and re-render) below this delta

export function usePresence() {
  const [presence, setPresence] = useState(0);
  const lastEventRef = useRef<number>(Date.now());
  const restlessRef  = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let lastX = -1, lastY = -1;

    const markRestless = () => {
      lastEventRef.current = Date.now();
      restlessRef.current = true;
    };

    const onMove = (e: PointerEvent) => {
      const dx = lastX < 0 ? 0 : Math.abs(e.clientX - lastX);
      const dy = lastY < 0 ? 0 : Math.abs(e.clientY - lastY);
      lastX = e.clientX; lastY = e.clientY;
      // Small drift while otherwise still shouldn't reset presence to zero —
      // only a real jump (scanning, scrolling-adjacent motion) counts as restless.
      if (dx + dy > 6) markRestless();
    };
    const onScroll = () => markRestless();
    const onKey = () => markRestless();

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);

    const iv = setInterval(() => {
      const stillFor = Date.now() - lastEventRef.current;
      setPresence(p => {
        const target = Math.min(1, stillFor / RISE_MS);
        const rate = target > p ? TICK_MS / RISE_MS : TICK_MS / FALL_MS;
        const next = p + (target - p) * Math.min(1, rate * 3);
        // Bail out of the setState entirely when the change is imperceptible —
        // React still re-renders on a same-value update if the reference
        // differs, so this is the difference between ~4 renders/sec and none.
        return Math.abs(next - p) < STEP_EPSILON ? p : next;
      });
    }, TICK_MS);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
      clearInterval(iv);
    };
  }, []);

  return presence;
}
