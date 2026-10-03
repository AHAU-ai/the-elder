'use client';

// app/components/PortalGate.tsx
//
// The crossing. Before the herald, before the breath, a cold visitor
// stands in an ordinary, quiet room -- cool, dim, nothing asked of them --
// with one anomaly in it: a seam of ember light in the wall where no door
// should be. They put a hand to it. It gives. Warmth comes through the gap,
// the room falls away behind them, and they are standing in the fire that
// was already burning: the existing herald (BreathGate) lands as the
// arrival, the Eye opens and asks its question.
//
// Why it is built the way it is (the wardrobe, taken apart):
//   1. CONTRAST. The room is deliberately the opposite of the fire world --
//      cold, desaturated, still, silent -- so that crossing is *warmth
//      arriving*, not a screen change. The real fire (CeremonyGround +
//      FireAtmosphere, mounted in the root layout) has been burning behind
//      this the whole time; this overlay is what stands between.
//   2. AGENCY. The seeker's own hand opens it. Press and hold to push the
//      door; let go early and it eases shut, no penalty; let go late and it
//      carries you through. A single tap carries it all the way on its own
//      -- the always-available path (and the one reduced-motion uses).
//   3. THE SENSES SHIFT DURING THE ACT, not after: light, colour, sound
//      (the hearth's own bed starts on the first press), a camera that
//      pushes forward, embers drifting toward you out of the gap.
//   4. ONE ARRIVAL. The crossing ends where BreathGate's herald begins --
//      its ember flare and eye-ignition were built to "front-load the
//      visual"; here they are the doorway's other side. No new arrival
//      scene is invented to compete with it.
//
// What it deliberately is NOT:
//   - Not a gate. The skip link is always on screen after 2.4s, a tap is
//     always enough, and a seeker in any state is never held in here.
//     (Welfare: nothing in this component precedes or touches the welfare
//     gate -- it runs before any model call exists.)
//   - Not lineage imagery. A plain door in a plain room. Nothing here
//     belongs to a tradition; see lib/portalCopy.ts.
//   - Not a replacement for the breath. BreathGate is untouched and still
//     the literal opener of the sitting proper.
//
// Mechanics: door progress lives in a ref and is advanced in one
// requestAnimationFrame loop; everything visual is written to CSS custom
// properties on the root (no React re-render per frame). Pure model +
// tuning in lib/portalCrossing.ts.

import { useCallback, useEffect, useRef, useState } from 'react';
import { TRANSITION_MS } from '../../lib/transitions';
import { BREATH_CYCLE_MS } from '../../lib/breathTiming';
import {
  clamp01,
  smoothstep,
  stepProgress,
  modeAfterRelease,
  doorFrame,
  type DoorMode,
} from '../../lib/portalCrossing';
import { PORTAL_ROOM_LINES, PORTAL_CROSSING_LINE, PORTAL_AFFORDANCE } from '../../lib/portalCopy';
import { acquireHearthFire, releaseHearthFire } from './enhancements';

/* ── timeline of the cold open (ms from ready) ── */
const ADJUST_MS     = 1300;  // eyes adjusting: the room emerges from the dark
const IGNITE_AT_MS  = 650;   // the seam lights
const IGNITE_MS     = 900;
const LINE_ONE_MS   = 1000;
const LINE_TWO_MS   = 2700;
const HINT_MS       = 3800;
const SKIP_MS       = 2400;  // same beat as BreathGate's skip
const INTERACTIVE_MS = 700;
/** How long the white-gold flare takes to clear once the crossing lands. */
const BLOOM_FADE_MS = 1100;

/* ── door geometry ──
   Not a fixed fraction of the viewport: the narration above and the hint +
   skip below take whatever room their wrapped text needs (a 360px phone
   wraps the lines three times over; a desktop does not wrap them at all),
   and the door takes the band that is left, centred in the viewport when
   there is room to spare. Measured, so the narration can never collide
   with the door at any size -- verified across nine viewports. */
const DOOR_MAX_H = 460;
const DOOR_MIN_H = 96;
const TEXT_TOP_MIN = 18;
const TEXT_GAP = 18;          // between the narration and the door
const BOTTOM_RESERVE = 142;   // hint (above the skip link) + gaps, portrait
const BOTTOM_RESERVE_COMPACT = 84; // hint and skip share one row
const COMPACT_BELOW_H = 540;  // short screens (landscape phones)

export interface DoorLayout { dw: number; dh: number; cy: number; textTop: number; compact: boolean }

function computeLayout(w: number, h: number, textH: number): DoorLayout {
  const compact = h < COMPACT_BELOW_H;
  const textTop = Math.round(Math.max(TEXT_TOP_MIN, h * 0.055));
  const top = textTop + textH + TEXT_GAP;
  const bottom = compact ? BOTTOM_RESERVE_COMPACT : BOTTOM_RESERVE;
  const avail = h - top - bottom;
  const dh = Math.max(DOOR_MIN_H, Math.min(DOOR_MAX_H, w, avail));
  // Clearance under the narration wins over centring: if space is that tight
  // the door is pushed down, never up into the words.
  const cy = Math.max(top + dh / 2, Math.min(h / 2, h - bottom - dh / 2));
  return { dw: dh * 0.4, dh, cy, textTop, compact };
}

/* ── particles ── */
type Mote = { x: number; y: number; vx: number; vy: number; r: number; a: number; ph: number };
type Spark = { x: number; y: number; vx: number; vy: number; r0: number; life: number; max: number; c: [number, number, number] };
const SPARK_COLS: [number, number, number][] = [
  [255, 170, 60], [255, 210, 110], [255, 130, 30], [255, 240, 170], [230, 90, 15],
];
const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface PortalGateProps {
  /** The door has given way: mount the arrival (BreathGate) underneath now. */
  onCross: () => void;
  /** The flare has cleared: unmount the portal. */
  onDone: () => void;
  /** Seeker chose to skip the whole opening; called after the fade-out. */
  onSkip: () => void;
}

export default function PortalGate({ onCross, onDone, onSkip }: PortalGateProps) {
  const rootRef   = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitRef    = useRef<HTMLButtonElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const geomRef   = useRef<DoorLayout>({ dw: 120, dh: 300, cy: 400, textTop: 40, compact: false });

  const progressRef     = useRef(0);
  const modeRef         = useRef<DoorMode>('idle');
  const pressRef        = useRef<{ start: number } | null>(null);
  const lastPressEndRef = useRef(-1e6);
  const crossedAtRef    = useRef<number | null>(null);
  const doneRef         = useRef(false);
  const leavingRef      = useRef(false);
  const interactiveRef  = useRef(false);
  const reducedRef      = useRef(false);
  const skipTimerRef    = useRef<number | null>(null);
  const hearthRef       = useRef<ReturnType<typeof acquireHearthFire> | null>(null);
  const crossShownRef   = useRef(false);
  const cb = useRef({ onCross, onDone, onSkip });
  useEffect(() => { cb.current = { onCross, onDone, onSkip }; });

  const [ready, setReady]       = useState(false);
  const [lineOne, setLineOne]   = useState(false);
  const [lineTwo, setLineTwo]   = useState(false);
  const [hint, setHint]         = useState(false);
  const [skipShown, setSkipShown] = useState(false);
  const [crossLine, setCrossLine] = useState(false);
  const [leaving, setLeaving]   = useState(false);

  /* ── audio: the hearth's own bed starts on the first press, so the first
     sound the seeker hears is the fire through the door they just touched.
     Refcounted + grace-period shared hearth (enhancements.ts) -- BreathGate
     and FireAtmosphere pick up the very same fire after the crossing. ── */
  const primeAudio = useCallback(() => {
    try {
      if (!hearthRef.current) hearthRef.current = acquireHearthFire();
      // Re-attempted on every press AND release: iOS only counts
      // touchend/click as a gesture, so the first press alone may not unlock.
      hearthRef.current.resume();
    } catch { /* audio blocked -- the door still opens in silence */ }
  }, []);

  /* ── press / release (pointer, keyboard, screen-reader click) ── */
  const beginPress = useCallback(() => {
    if (!interactiveRef.current || leavingRef.current || crossedAtRef.current !== null) return;
    if (pressRef.current) return;
    primeAudio();
    if (reducedRef.current) {
      // No hold mechanic under reduced motion: any press is a tap.
      modeRef.current = 'auto';
      return;
    }
    pressRef.current = { start: performance.now() };
    if (modeRef.current !== 'auto') modeRef.current = 'pushing';
  }, [primeAudio]);

  const endPress = useCallback(() => {
    const press = pressRef.current;
    if (!press) return;
    pressRef.current = null;
    lastPressEndRef.current = performance.now();
    if (crossedAtRef.current !== null || modeRef.current === 'auto') return;
    modeRef.current = modeAfterRelease(progressRef.current, performance.now() - press.start);
    if (hearthRef.current) primeAudio();
  }, [primeAudio]);

  const onHitClick = useCallback(() => {
    // Assistive tech activates with a bare click (no pointerdown/keydown).
    // A real pointer or key press has just ended -- ignore the click that
    // follows it; otherwise treat it as a tap.
    if (performance.now() - lastPressEndRef.current < 700) return;
    if (pressRef.current || crossedAtRef.current !== null || leavingRef.current) return;
    if (!interactiveRef.current) return;
    primeAudio();
    modeRef.current = 'auto';
  }, [primeAudio]);

  const skip = useCallback(() => {
    if (leavingRef.current || crossedAtRef.current !== null) return;
    leavingRef.current = true;
    pressRef.current = null;
    setLeaving(true);
    // Same coordination BreathGate's own skip uses: fade, then hand off.
    skipTimerRef.current = window.setTimeout(() => cb.current.onSkip(), TRANSITION_MS);
  }, []);

  /* ── mount: reduced-motion, ready, focus ── */
  useEffect(() => {
    try {
      reducedRef.current = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    } catch { reducedRef.current = false; }
    setReady(true);
  }, []);

  /* ── narration + affordance timeline ── */
  useEffect(() => {
    if (!ready) return;
    const timers = [
      window.setTimeout(() => { interactiveRef.current = true; }, INTERACTIVE_MS),
      window.setTimeout(() => setLineOne(true), LINE_ONE_MS),
      window.setTimeout(() => setLineTwo(true), LINE_TWO_MS),
      window.setTimeout(() => setHint(true), HINT_MS),
      window.setTimeout(() => setSkipShown(true), SKIP_MS),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [ready]);

  /* ── keyboard, with no focus yet. Nothing is focused on a cold open (a
     programmatic focus would paint a focus ring on every mouse visitor), so
     the bare page listens: Space/Enter presses the door, Tab lands on it
     (otherwise Tab would wander into the page chrome hidden behind us). ── */
  useEffect(() => {
    const bare = (t: EventTarget | null) => t === document.body || t === document.documentElement;
    const down = (e: KeyboardEvent) => {
      if (!bare(e.target)) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        hitRef.current?.focus({ preventScroll: true });
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!e.repeat) beginPress();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (!bare(e.target)) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); endPress(); }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [beginPress, endPress]);

  /* ── release on blur / tab hide: a hold must never stick ── */
  useEffect(() => {
    const release = () => endPress();
    const onVis = () => { if (document.hidden) endPress(); };
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [endPress]);

  /* ── release the shared hearth on unmount ── */
  useEffect(() => () => {
    if (skipTimerRef.current !== null) window.clearTimeout(skipTimerRef.current);
    if (hearthRef.current) {
      hearthRef.current = null;
      try { releaseHearthFire(); } catch { /* ignore */ }
    }
  }, []);

  /* ── the one animation loop ── */
  useEffect(() => {
    if (!ready) return;
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0, dpr = 1;
    let motes: Mote[] = [];
    let sparks: Spark[] = [];
    let sparkCarry = 0;

    const layout = () => {
      W = root.clientWidth; H = root.clientHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Compact (short screens) first: it restyles the narration, and the
      // narration is what we are about to measure.
      root.dataset.compact = H < COMPACT_BELOW_H ? 'true' : 'false';
      const textH = measureRef.current ? measureRef.current.offsetHeight : 90;
      const L = computeLayout(W, H, textH);
      geomRef.current = L;
      root.style.setProperty('--dw', L.dw.toFixed(1) + 'px');
      root.style.setProperty('--dh', L.dh.toFixed(1) + 'px');
      root.style.setProperty('--cy', L.cy.toFixed(1) + 'px');
      root.style.setProperty('--texttop', L.textTop + 'px');
      const count = reducedRef.current ? 0 : W < 600 ? 18 : 28;
      motes = Array.from({ length: count }, () => ({
        x: rand(0, W), y: rand(0, H),
        vx: rand(-5, 5), vy: rand(-4, 3),
        r: rand(0.6, 1.7), a: rand(0.07, 0.2), ph: rand(0, Math.PI * 2),
      }));
    };
    layout();
    window.addEventListener('resize', layout);
    // The narration's wrapped height changes when the web font arrives or
    // the viewport reflows it: re-fit the door to what is really there.
    const ro = typeof ResizeObserver !== 'undefined' && measureRef.current
      ? new ResizeObserver(() => layout()) : null;
    if (ro && measureRef.current) ro.observe(measureRef.current);
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) layout(); }).catch(() => {});

    const set = (k: string, v: number) => root.style.setProperty(k, v.toFixed(4));

    const t0 = performance.now();
    let last = t0;
    let raf = 0;

    const frame = (now: number) => {
      const dt = now - last; last = now;
      const elapsed = now - t0;
      const reduced = reducedRef.current;

      /* door */
      let p = progressRef.current;
      p = stepProgress(p, modeRef.current, dt, reduced);
      progressRef.current = p;
      if (modeRef.current === 'receding' && p <= 0) modeRef.current = 'idle';
      if (p >= 1 && crossedAtRef.current === null && !leavingRef.current) {
        crossedAtRef.current = now;
        modeRef.current = 'crossed';
        cb.current.onCross();
      }
      const f = doorFrame(p, reduced);

      /* eyes adjusting + the seam igniting (time-driven) */
      const adjust = reduced ? 1 : smoothstep(0, ADJUST_MS, elapsed);
      const ignite = reduced ? 1 : smoothstep(IGNITE_AT_MS, IGNITE_AT_MS + IGNITE_MS, elapsed);
      const cast = ignite * (0.35 + 0.65 * f.warm);

      /* the flare clears after the crossing lands */
      let bloom = f.bloom;
      if (crossedAtRef.current !== null) {
        const since = now - crossedAtRef.current;
        bloom = 1 - smoothstep(0, BLOOM_FADE_MS, since);
        if (since >= BLOOM_FADE_MS && !doneRef.current) {
          doneRef.current = true;
          cb.current.onDone();
        }
      }

      set('--open', f.open);
      set('--scale', f.scale);
      set('--warm', f.warm);
      set('--room', f.room);
      set('--bloom', bloom);
      set('--adjust', adjust);
      set('--ignite', ignite);
      set('--cast', cast);
      set('--hintop', 1 - smoothstep(0.04, 0.22, p));
      set('--lineop', 1 - smoothstep(0.66, 0.86, p));
      set('--skipop', 1 - smoothstep(0.25, 0.5, p));

      /* narration beat follows the door; fades back if it eases shut */
      if (f.beat === 'crossing' && !crossShownRef.current) { crossShownRef.current = true; setCrossLine(true); }
      else if (crossShownRef.current && p < 0.1 && crossedAtRef.current === null) { crossShownRef.current = false; setCrossLine(false); }

      /* particles */
      ctx.clearRect(0, 0, W, H);
      if (!reduced) {
        const { dw, dh, cy } = geomRef.current;
        const cx = W / 2;

        // cold dust -- the room's own air; gone as the room warms
        const dustAlpha = (1 - f.warm) * adjust * f.room;
        if (dustAlpha > 0.01) {
          for (const m of motes) {
            m.x += m.vx * dt / 1000; m.y += m.vy * dt / 1000;
            if (m.x < -4) m.x = W + 4; else if (m.x > W + 4) m.x = -4;
            if (m.y < -4) m.y = H + 4; else if (m.y > H + 4) m.y = -4;
            const tw = 0.6 + 0.4 * Math.sin(now / 1700 + m.ph);
            ctx.beginPath();
            ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(150,172,198,${(m.a * tw * dustAlpha).toFixed(3)})`;
            ctx.fill();
          }
        }

        // embers streaming out of the gap, growing as they come toward you
        const hw = Math.max(1.5, (dw / 2) * f.scale * Math.max(f.open, 0.04));
        const hh = Math.min((dh / 2) * f.scale, H * 0.55);
        if (f.embers > 0.01 && sparks.length < 170) {
          sparkCarry += f.embers * 110 * dt / 1000;
          while (sparkCarry >= 1) {
            sparkCarry -= 1;
            const x = cx + rand(-1, 1) * hw;
            const y = cy + rand(-1, 1) * hh;
            sparks.push({
              x, y,
              vx: ((x - cx) / Math.max(hw, 40)) * rand(30, 120) + rand(-14, 14),
              vy: -rand(14, 70) + ((y - cy) / Math.max(hh, 40)) * rand(10, 60),
              r0: rand(0.8, 2.1),
              life: 0, max: rand(1100, 2300),
              c: SPARK_COLS[Math.floor(Math.random() * SPARK_COLS.length)],
            });
          }
        }
        const alive: Spark[] = [];
        for (const s of sparks) {
          s.life += dt;
          if (s.life >= s.max) continue;
          const lf = s.life / s.max;
          s.x += s.vx * dt / 1000; s.y += s.vy * dt / 1000;
          const r = s.r0 * (1 + 4.2 * Math.pow(lf, 1.5));
          const a = Math.pow(Math.sin(Math.PI * lf), 0.8) * 0.92;
          const [cr, cg, cb2] = s.c;
          const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 3.2);
          g.addColorStop(0, `rgba(${cr},${cg},${cb2},${a.toFixed(3)})`);
          g.addColorStop(0.45, `rgba(${cr},${cg},${cb2},${(a * 0.45).toFixed(3)})`);
          g.addColorStop(1, `rgba(${cr},${cg},${cb2},0)`);
          ctx.beginPath(); ctx.arc(s.x, s.y, r * 3.2, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
          ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,240,200,${(a * 0.9).toFixed(3)})`; ctx.fill();
          alive.push(s);
        }
        sparks = alive;
      }

      if (!doneRef.current) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', layout);
      alive = false;
      ro?.disconnect();
    };
  }, [ready]);

  /* ── input handlers on the door ── */
  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    beginPress();
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (e.repeat) return;
    beginPress();
  };
  const onKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    endPress();
  };

  return (
    <div
      ref={rootRef}
      className="portal-root"
      role="region"
      aria-label="Entrance to The Elder"
      data-ready={ready ? 'true' : 'false'}
      data-leaving={leaving ? 'true' : 'false'}
    >
      <style>{`
        .portal-root {
          position: fixed; inset: 0; z-index: 150; overflow: hidden;
          /* Until mounted (and until we know this is a cold open) the root is
             an opaque near-black void -- never the lit room and never the
             fire, so neither a returning seeker nor a first-timer gets a
             flash of the wrong world during hydration. */
          background: #06080b;
          /* Pinch-zoom stays available; only the door itself captures the
             gesture (see .portal-hit). */
          touch-action: manipulation; user-select: none; -webkit-user-select: none;
          -webkit-touch-callout: none;
          transition: opacity ${TRANSITION_MS}ms ease;
          --dw: 19vh; --dh: 48vh; --cy: 54%;
          --lineop: 1; --skipop: 1;
          --open: 0; --scale: 1; --warm: 0; --room: 1; --bloom: 0;
          --adjust: 0; --ignite: 0; --cast: 0; --hintop: 1;
        }
        .portal-root[data-ready="true"] { background: transparent; }
        .portal-root[data-leaving="true"] { opacity: 0; pointer-events: none; }

        /* The room: wall + door, one group, so the camera push scales both. */
        .portal-room {
          position: absolute; inset: 0; z-index: 1;
          transform-origin: 50% var(--cy);
          transform: scale(var(--scale));
          opacity: var(--room);
          will-change: transform, opacity;
        }
        .portal-wall { position: absolute; inset: 0; background: #06080b; }
        .portal-wall-tone {
          position: absolute; inset: 0; opacity: var(--adjust);
          background:
            linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 24%),
            radial-gradient(ellipse 85% 75% at 50% 38%, #151d27 0%, #0c121a 55%, #06080b 100%);
        }
        /* The warm cast on the wall. Static gradient; only its opacity moves,
           so the camera push never forces a full-screen repaint per frame. */
        .portal-wall-cast {
          position: absolute; inset: 0; pointer-events: none;
          opacity: var(--cast);
          background: radial-gradient(ellipse 52% 58% at 50% var(--cy),
            rgba(255,150,60,0.26) 0%, rgba(255,120,40,0.09) 38%, transparent 72%);
        }
        /* light spilling across the floor from under the door */
        .portal-spill {
          position: absolute; left: 50%; transform: translateX(-50%);
          top: calc(var(--cy) + var(--dh) / 2 - 2px);
          width: calc(var(--dw) * (1.1 + 2.6 * var(--open)));
          height: 20vh; pointer-events: none;
          opacity: calc(var(--cast) * 0.65);
          background: radial-gradient(ellipse 50% 100% at 50% 0%, rgba(255,160,70,0.55), rgba(255,120,40,0.12) 55%, transparent 80%);
        }

        .portal-door {
          position: absolute; left: 50%; top: var(--cy);
          width: var(--dw); height: var(--dh);
          transform: translate(-50%, -50%);
          outline: 1px solid rgba(170,195,220,calc(0.10 * var(--adjust)));
          box-shadow: inset 0 0 0 2px rgba(5,7,10,0.9);
        }
        .portal-halo {
          position: absolute; inset: 0; pointer-events: none;
          opacity: var(--cast);
          box-shadow: 0 0 46px 6px rgba(255,140,50,0.38);
        }
        /* what is behind the leaves: the light itself */
        .portal-glow {
          position: absolute; inset: 0;
          /* Dark sky above, glow rising from below -- the same shape as the
             real fire on the other side, so the crossing reads as the same
             world coming into focus rather than a lit rectangle. */
          background:
            radial-gradient(ellipse 70% 38% at 50% 100%, #fff1c8 0%, rgba(255,196,104,0.85) 36%, rgba(255,150,50,0) 78%),
            linear-gradient(180deg, #2a0f06 0%, #6b2509 26%, #b9500f 52%, #ee8a2b 78%, #ffc468 100%);
        }
        .portal-leaf {
          position: absolute; top: 0; bottom: 0; width: 50%;
          background: #0b0d10;
          overflow: hidden;
        }
        .portal-leaf--l {
          left: 0; transform-origin: 0 50%;
          transform: scaleX(calc(1 - var(--open) - 0.012 * var(--ignite))) skewY(calc(var(--open) * -3.5deg));
        }
        .portal-leaf--r {
          right: 0; transform-origin: 100% 50%;
          transform: scaleX(calc(1 - var(--open) - 0.012 * var(--ignite))) skewY(calc(var(--open) * 3.5deg));
        }
        .portal-leaf-tone {
          position: absolute; inset: 0; opacity: var(--adjust);
          background:
            repeating-linear-gradient(90deg, rgba(255,255,255,0.014) 0 2px, transparent 2px 8px),
            linear-gradient(180deg, #171e26 0%, #10161d 55%, #0b0f14 100%);
        }
        .portal-leaf-rim { position: absolute; inset: 0; opacity: var(--cast); pointer-events: none; }
        .portal-leaf--l .portal-leaf-rim { box-shadow: inset -16px 0 22px -10px rgba(255,150,55,0.6); }
        .portal-leaf--r .portal-leaf-rim { box-shadow: inset 16px 0 22px -10px rgba(255,150,55,0.6); }
        .portal-panel {
          position: absolute; left: 16%; right: 16%;
          border: 1px solid rgba(190,212,235,calc(0.075 * var(--adjust)));
          box-shadow: inset 0 0 14px rgba(0,0,0,0.35);
        }
        .portal-panel--hi { top: 7%;  height: 38%; }
        .portal-panel--lo { top: 52%; height: 41%; }
        .portal-handle {
          position: absolute; top: 50%; width: 2px; height: 11%;
          transform: translateY(-50%);
          background: linear-gradient(180deg, transparent, rgba(190,150,80,calc(0.4 * var(--adjust))), transparent);
        }
        .portal-leaf--l .portal-handle { right: 7%; }
        .portal-leaf--r .portal-handle { left: 7%; }

        /* soft bloom along the seam, bleeding onto the door faces */
        .portal-seam {
          position: absolute; left: 50%; top: -2%; bottom: -2%;
          width: calc(var(--dw) * 0.55); transform: translateX(-50%);
          pointer-events: none; mix-blend-mode: screen;
          opacity: calc(var(--ignite) * (1 - var(--open)));
        }
        .portal-seam-inner {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 50% 50% at 50% 50%, rgba(255,175,80,0.7), rgba(255,130,40,0.18) 55%, transparent 80%);
          animation:
            portalFlicker 3.7s ease-in-out infinite,
            portalSwell ${BREATH_CYCLE_MS}ms ease-in-out infinite;
        }
        @keyframes portalFlicker {
          0%, 100% { opacity: 0.86; } 18% { opacity: 1; } 31% { opacity: 0.78; }
          52% { opacity: 0.97; } 74% { opacity: 0.82; }
        }
        @keyframes portalSwell {
          0%, 100% { transform: scaleX(0.9); } 50% { transform: scaleX(1.12); }
        }

        .portal-canvas { position: absolute; inset: 0; z-index: 2; pointer-events: none; }

        .portal-text {
          position: absolute; z-index: 3; left: 50%; top: var(--texttop, 6vh);
          transform: translateX(-50%);
          width: min(760px, 92vw);
          display: flex; flex-direction: column; gap: 0.7em;
          text-align: center; pointer-events: none;
        }
        .portal-line {
          margin: 0; padding: 0 8px;
          font-family: 'Cormorant Garamond', 'Gentium Plus', Georgia, serif;
          font-style: italic;
          font-size: clamp(1.08rem, 3.6vw, 1.45rem);
          line-height: 1.55; letter-spacing: 0.02em;
          color: #9fb0c2;
          color: color-mix(in srgb, #f0dcae calc(var(--warm) * 100%), #9fb0c2);
          text-shadow: 0 1px 14px rgba(14,6,2,calc(0.7 * var(--warm))), 0 0 calc(34px * var(--warm)) rgba(212,168,67,0.35);
          opacity: 0; transform: translateY(6px);
          transition: opacity 1.4s ease, transform 1.4s ease;
        }
        .portal-line.is-in { opacity: var(--lineop); transform: translateY(0); }
        .portal-line--cross { position: absolute; left: 0; right: 0; top: 0; }
        .portal-line.is-out { opacity: 0; transition-duration: 0.7s; }

        /* Invisible twin of the narration with every line present, so the door
           can be fitted to the space the full text will need. */
        .portal-text--measure { visibility: hidden; z-index: -1; }
        .portal-text--measure .portal-line { position: static; opacity: 0; }

        .portal-hint {
          position: absolute; z-index: 3; left: 50%; bottom: 92px;
          transform: translateX(-50%);
          text-align: center; pointer-events: none; white-space: nowrap;
          opacity: 0; transition: opacity 1.4s ease;
        }
        .portal-hint.is-in { opacity: calc(var(--hintop) * 0.92); }
        .portal-hint-word {
          display: block; margin: 0 0 6px;
          font-family: 'Inter', Arial, sans-serif; font-size: 13px;
          letter-spacing: 0.34em; padding-left: 0.34em;
          color: #8697ab;
          color: color-mix(in srgb, #c8933a calc(var(--warm) * 100%), #8697ab);
        }
        .portal-hint-sub {
          display: block; margin: 0;
          font-family: 'Gentium Plus', Georgia, serif; font-style: italic;
          font-size: 14px; letter-spacing: 0.1em; color: #6c7b8d; opacity: 0.85;
        }

        .portal-hit {
          position: absolute; z-index: 4; left: 50%; top: var(--cy);
          width: calc(var(--dw) * 1.7); height: calc(var(--dh) * 1.08);
          transform: translate(-50%, -50%);
          background: transparent; border: 0; padding: 0; margin: 0;
          cursor: pointer; touch-action: none; -webkit-tap-highlight-color: transparent;
          outline: none; border-radius: 6px;
        }
        .portal-hit:focus-visible { outline: 1px dashed rgba(200,147,58,0.7); outline-offset: 4px; }

        .portal-skip {
          position: absolute; z-index: 4; bottom: 30px; left: 50%;
          transform: translateX(-50%);
          font-family: 'Inter', Arial, sans-serif; font-size: 15px; letter-spacing: 0.22em;
          color: #8ea0b4; background: rgba(6,8,11,0.55);
          border: 1px solid rgba(142,160,180,0.32); border-radius: 4px;
          padding: 10px 22px; cursor: pointer; white-space: nowrap;
          opacity: 0; pointer-events: none;
          transition: opacity 1.2s ease;
        }
        .portal-skip.is-in { opacity: var(--skipop); pointer-events: auto; }
        .portal-skip:focus-visible { outline: 1px dashed rgba(200,147,58,0.7); outline-offset: 3px; }

        .portal-bloom {
          position: absolute; inset: 0; z-index: 5; pointer-events: none;
          opacity: var(--bloom);
          background: radial-gradient(ellipse 72% 72% at 50% 50%,
            rgba(255,238,196,0.96) 0%, rgba(255,196,108,0.6) 34%, rgba(255,120,40,0) 76%);
        }

        /* Short screens (landscape phones): quieter, wider narration so each
           beat is one row, and hint + skip share the bottom row. */
        .portal-root[data-compact="true"] .portal-text { width: min(900px, 94vw); gap: 0.3em; }
        .portal-root[data-compact="true"] .portal-line {
          font-size: clamp(0.95rem, 2.2vw, 1.12rem); line-height: 1.45;
        }
        .portal-root[data-compact="true"] .portal-hint {
          bottom: 30px; left: 6vw; transform: none; text-align: left;
        }
        .portal-root[data-compact="true"] .portal-hint-word { padding-left: 0; }
        .portal-root[data-compact="true"] .portal-skip {
          left: auto; right: 6vw; transform: none; bottom: 26px;
        }

        /* Reduced motion: the room holds still (animations on aria-hidden
           nodes are already killed app-wide); crossing is a plain dissolve. */
        @media (prefers-reduced-motion: reduce) {
          .portal-line { transition-duration: 0.01s; transform: none; }
        }
      `}</style>

      {ready && (
        <>
          <div className="portal-room" aria-hidden="true">
            <div className="portal-wall">
              <div className="portal-wall-tone" />
              <div className="portal-wall-cast" />
            </div>
            <div className="portal-spill" />
            <div className="portal-door">
              <div className="portal-halo" />
              <div className="portal-glow" />
              <div className="portal-leaf portal-leaf--l">
                <div className="portal-leaf-tone" />
                <div className="portal-leaf-rim" />
                <span className="portal-panel portal-panel--hi" />
                <span className="portal-panel portal-panel--lo" />
                <span className="portal-handle" />
              </div>
              <div className="portal-leaf portal-leaf--r">
                <div className="portal-leaf-tone" />
                <div className="portal-leaf-rim" />
                <span className="portal-panel portal-panel--hi" />
                <span className="portal-panel portal-panel--lo" />
                <span className="portal-handle" />
              </div>
              <div className="portal-seam"><div className="portal-seam-inner" /></div>
            </div>
          </div>

          <canvas ref={canvasRef} className="portal-canvas" aria-hidden="true" />

          <div className="portal-text portal-text--measure" aria-hidden="true" ref={measureRef}>
            <p className="portal-line">{PORTAL_ROOM_LINES[0]}</p>
            <p className="portal-line">{PORTAL_ROOM_LINES[1]}</p>
          </div>

          {/* Narration: the Elder's voice, witnessing. Real text, announced
              politely as each beat arrives. */}
          <div className="portal-text" aria-live="polite">
            <p className={'portal-line portal-line--1' + (lineOne ? ' is-in' : '') + (crossLine ? ' is-out' : '')}>
              {lineOne ? PORTAL_ROOM_LINES[0] : ''}
            </p>
            <p className={'portal-line portal-line--2' + (lineTwo ? ' is-in' : '') + (crossLine ? ' is-out' : '')}>
              {lineTwo ? PORTAL_ROOM_LINES[1] : ''}
            </p>
            <p className={'portal-line portal-line--cross' + (crossLine ? ' is-in' : '')}>
              {crossLine ? PORTAL_CROSSING_LINE : ''}
            </p>
          </div>

          <div className={'portal-hint' + (hint ? ' is-in' : '')} aria-hidden="true">
            <span className="portal-hint-word">{PORTAL_AFFORDANCE.hold}</span>
            <span className="portal-hint-sub">{PORTAL_AFFORDANCE.holdSub}</span>
          </div>

          <button
            ref={hitRef}
            type="button"
            className="portal-hit"
            aria-label={PORTAL_AFFORDANCE.doorLabel}
            onPointerDown={onPointerDown}
            onPointerUp={endPress}
            onPointerCancel={endPress}
            onLostPointerCapture={endPress}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            onBlur={endPress}
            onClick={onHitClick}
            onContextMenu={(e) => e.preventDefault()}
          />

          <button
            type="button"
            className={'portal-skip' + (skipShown ? ' is-in' : '')}
            onClick={skip}
          >
            {PORTAL_AFFORDANCE.skip} &nbsp;&rsaquo;
          </button>

          <div className="portal-bloom" aria-hidden="true" />
        </>
      )}
    </div>
  );
}
