'use client';

// app/components/HearthHour.tsx
//
// The hearth knows the hour (docs/inhabiting-the-elder.md, M1). A quiet,
// opacity-only layer over the persistent fire that leans the room's light
// with the seeker's own local time of day: warm and pooled at night, wide at
// dawn, plainest at midday. The hour is read on this device and goes nowhere.
//
// Server and first client render agree on "no tone" (both layers at 0), so
// there is no hydration mismatch and no flash; the tone fades in after mount
// at the instrument's slow speed (1.4s). Nothing here is ever text, never
// asks anything of the seeker, and is bounded by lib/hearthHour.ts so the
// room is never dim or out at any hour. Lineage-agnostic by construction.

import { useEffect, useState } from 'react';
import { hearthToneAt, localHour, type HearthTone } from '../../lib/hearthHour';

const GLOW_MAX_OPACITY = 0.16;   // at glow = 1
const REFRESH_MS = 10 * 60 * 1000;

export default function HearthHour() {
  const [tone, setTone] = useState<HearthTone | null>(null);

  useEffect(() => {
    const read = () => setTone(hearthToneAt(localHour(new Date())));
    read();
    const id = window.setInterval(read, REFRESH_MS);
    const onVis = () => { if (!document.hidden) read(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const glow = tone ? tone.glow * GLOW_MAX_OPACITY : 0;
  const veil = tone ? tone.veil : 0;

  return (
    <div
      aria-hidden="true"
      data-hearth-hour={tone ? `${tone.glow.toFixed(2)},${tone.veil.toFixed(2)}` : ''}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}
    >
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 95% 60% at 50% 104%, rgba(214,112,34,0.9) 0%, rgba(160,70,16,0.4) 45%, rgba(160,70,16,0) 75%)',
          opacity: glow,
          transition: 'opacity 1.4s ease',
        }}
      />
      <div
        style={{
          position: 'absolute', inset: 0,
          background: '#050403',
          opacity: veil,
          transition: 'opacity 1.4s ease',
        }}
      />
    </div>
  );
}
