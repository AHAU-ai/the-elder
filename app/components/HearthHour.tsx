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
//
// And the quiet close (over-dwelling guard, lib/overDwelling.ts): when many
// sittings fall in a short window the fire is banked a little lower for the
// rest of that window. Same device and limits as the bank, and a lower cap. It
// is told to this layer by the closing letter (QUIET_EVENT) and remembered only
// in this browser until the window ends.

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
import { clampWarmth } from '../../lib/hearthMovement';
import { QUIET_EVENT, QUIET_UNTIL_KEY, QUIET_VEIL_MAX, QUIET_VEIL_MS } from '../../lib/overDwelling';

const GLOW_MAX_OPACITY = 0.16;   // at glow = 1
const REFRESH_MS = 10 * 60 * 1000;

export default function HearthHour() {
  const [tone, setTone] = useState<HearthTone | null>(null);
  // null = fully lit (the default for everyone, and what the server renders).
  const [bank, setBank] = useState<{ level: number; released: boolean } | null>(null);
  const decidedRef = useRef(false);
  const [quietVeil, setQuietVeil] = useState(false);
  // Axis 4 (docs/axis-4-hearth-movement.md): a warm-only, bounded trace of the
  // seeker's movement. A bare number from the server, never the movement, and
  // deliberately not stored anywhere: the next load asks again. 0 is today's fire.
  const [warmth, setWarmth] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/user/hearth', { signal: ctrl.signal, cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { warmth?: unknown }) => setWarmth(clampWarmth(d.warmth)))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  // The guard's veil. Never for reduced motion (no "banking" without motion; a
  // permanently dim fire would be a penalty), and gone as soon as the window is.
  useEffect(() => {
    let reduced = false;
    try { reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { /* ignore */ }
    if (reduced) return;
    let timer: number | undefined;
    const holdFor = (ms: number) => {
      if (!(ms > 0)) return;
      setQuietVeil(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setQuietVeil(false), ms);
    };
    try {
      const until = Number(window.localStorage.getItem(QUIET_UNTIL_KEY));
      if (Number.isFinite(until) && until > Date.now()) holdFor(until - Date.now());
    } catch { /* storage unavailable: the fire is simply lit */ }
    const onQuiet = (e: Event) => holdFor(Number((e as CustomEvent<{ untilMs?: number }>).detail?.untilMs) || 0);
    window.addEventListener(QUIET_EVENT, onQuiet);
    return () => { window.removeEventListener(QUIET_EVENT, onQuiet); window.clearTimeout(timer); };
  }, []);

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
    // "Last at the fire" is the last moment this tab was actually present, not
    // the moment it loaded: a tab left open for days and then reloaded must not
    // read as a days-long absence (that would be the reproach this feature is
    // cut for). Touch while visible, and as the tab is hidden or closed.
    const present = () => touchHearthSeen(Date.now());
    const tick = () => { read(); if (!document.hidden) present(); };
    const id = window.setInterval(tick, REFRESH_MS);
    const onVis = () => { if (!document.hidden) read(); present(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', present);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', present);
    };
  }, []);

  const glow = tone ? Math.min(1, tone.glow * GLOW_MAX_OPACITY + warmth) : 0;
  const veil = tone ? tone.veil : 0;

  return (
    <div
      aria-hidden="true"
      data-hearth-hour={tone ? `${tone.glow.toFixed(2)},${tone.veil.toFixed(2)}` : ''}
      data-hearth-quiet={quietVeil ? 'on' : ''}
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
      {/* The quiet close: eases in slowly and eases out when the window ends. */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: '#050403',
          opacity: quietVeil ? QUIET_VEIL_MAX : 0,
          transition: `opacity ${QUIET_VEIL_MS}ms cubic-bezier(0.3, 0, 0.2, 1)`,
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
