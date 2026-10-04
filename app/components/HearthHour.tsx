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
//
// It also carries the banked fire (M5, lib/hearthBank.ts): after a long
// absence the hearth arrives a little lower and catches over ~9s. No text, a
// capped veil (always clearly lit), device-local, and never for reduced motion.

import { useEffect, useRef, useState } from 'react';
import { hearthToneAt, localHour, type HearthTone } from '../../lib/hearthHour';
import {
  bankLevel,
  bankVeilOpacity,
  readHearthSeen,
  touchHearthSeen,
  RELIGHT_DELAY_MS,
  RELIGHT_MS,
} from '../../lib/hearthBank';

const GLOW_MAX_OPACITY = 0.16;   // at glow = 1
const REFRESH_MS = 10 * 60 * 1000;

export default function HearthHour() {
  const [tone, setTone] = useState<HearthTone | null>(null);
  // null = fully lit (the default for everyone, and what the server renders).
  const [bank, setBank] = useState<{ level: number; released: boolean } | null>(null);
  const decidedRef = useRef(false);

  // Decided once per page load. A ref guards StrictMode's double-invoke (dev),
  // and the release timer is deliberately not cleared on cleanup for the same
  // reason: clearing it would strand the fire banked.
  useEffect(() => {
    if (decidedRef.current) return;
    decidedRef.current = true;
    const now = Date.now();
    const last = readHearthSeen();
    touchHearthSeen(now);
    let reduced = false;
    try { reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { /* ignore */ }
    const level = last === null || reduced ? 0 : bankLevel(now - last);
    if (level <= 0) return;
    setBank({ level, released: false });
    window.setTimeout(() => setBank((b) => (b ? { ...b, released: true } : b)), RELIGHT_DELAY_MS);
  }, []);

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
      data-hearth-bank={bank ? `${bank.level.toFixed(2)}:${bank.released ? 'lit' : 'banked'}` : ''}
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
      {/* The bank: holds still while banked (no transition, so it is already
          there on arrival), then lets go slowly as the fire catches. */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: '#050403',
          opacity: bank && !bank.released ? bankVeilOpacity(bank.level) : 0,
          transition: bank?.released ? `opacity ${RELIGHT_MS}ms cubic-bezier(0.3, 0, 0.2, 1)` : 'none',
        }}
      />
    </div>
  );
}
