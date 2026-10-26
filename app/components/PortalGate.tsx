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
//      (the room is silent; the hearth's own bed fades in once the door is
//      about 40% open), a camera that pushes forward, a swirl of cosmic light
//      spiralling toward you out of the gap.
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
import { useLanguage } from '../../lib/i18n/LanguageContext';
import { acquireHearthFire, releaseHearthFire } from './enhancements';
import { logPortalEvent } from '../../lib/portalTelemetry';
import { useElderPhase } from './ElderPresence';
import { buildPortalTextures, type PortalTextures } from '../../lib/portalTexture';
import { FRAME_MS } from '../../lib/vortexMotion';
import { stepFall } from '../../lib/petalMotion';
import { drawPetal, drawBlossom, BLOSSOM_PETALS, PETAL_COLS, type RGB } from '../../lib/petalDraw';
import { createPortalLure, readSoundPref, writeSoundPref, type PortalLure, type LureState } from '../../lib/portalLure';

/* ── timeline of the cold open (ms from ready) ── */
const ADJUST_MS     = 1300;  // eyes adjusting: the room emerges from the dark
const IGNITE_AT_MS  = 650;   // the seam lights
const IGNITE_MS     = 900;
const LINE_ONE_MS   = 1000;
const LINE_TWO_MS   = 2700;
const HINT_MS       = 3800;
const SKIP_MS       = 2400;  // same beat as BreathGate's skip
const SOUND_MS      = 1200;  // the sound control appears once the room has settled
const MEMBER_BYPASS_MS = 600; // after a member is known: the way past appears early
const INTERACTIVE_MS = 700;
/** How long the white-gold flare takes to clear once the crossing lands. */
const BLOOM_FADE_MS = 1100;
/** The room is silent. The hearth starts (its own 3.5s fade-in) once the door
 *  is this far open; if the door eases shut again before it is committed
 *  (below HEARTH_RELEASE_AT) the hearth is let go and fades out. */
const HEARTH_AT = 0.4;
const HEARTH_RELEASE_AT = 0.1;

/** The two closed outer doors of the photographed wardrobe, enhanced and cropped
 *  to leaf proportions (public/portal). Each is hinged on its outer edge, as the
 *  leaves are. If either fails to load the procedural wood is drawn instead. */
const DOOR_PHOTO_L = '/portal/door-left.webp';
const DOOR_PHOTO_R = '/portal/door-right.webp';
const loadImage = (src: string) => new Promise<boolean>((resolve) => {
  const i = new Image();
  i.onload = () => resolve(true);
  i.onerror = () => resolve(false);
  i.src = src;
});

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
  // The sound control sits in the top corner: on narrow or short screens the
  // narration starts below it so the two can never overlap.
  const soundClear = compact ? 52 : w < 640 ? 68 : 0;
  const textTop = Math.round(Math.max(TEXT_TOP_MIN, h * 0.055, soundClear));
  const top = textTop + textH + TEXT_GAP;
  const bottom = compact ? BOTTOM_RESERVE_COMPACT : BOTTOM_RESERVE;
  const avail = h - top - bottom;
  const dh = Math.max(DOOR_MIN_H, Math.min(DOOR_MAX_H, w, avail));
  // Clearance under the narration wins over centring: if space is that tight
  // the door is pushed down, never up into the words.
  const cy = Math.max(top + dh / 2, Math.min(h / 2, h - bottom - dh / 2));
  // Two leaves of 0.325 : 1 each -- the proportions of the photographed doors.
  return { dw: dh * 0.65, dh, cy, textTop, compact };
}

/* ── particles ── */
type Mote = { x: number; y: number; vx: number; vy: number; r: number; a: number; ph: number };
/** A mote of cosmic light: it is born at the doorway and spirals outward,
 *  fast and tight near the centre, wide and lazy as it goes. */
type Swirl = {
  a: number; r: number;          // polar position around the door's centre
  w: number; vr: number;         // angular speed (rad/s, signed), outward speed (px/s)
  size: number; life: number; max: number;
  c0: [number, number, number]; cw: [number, number, number];  // cosmic colour -> the warm ember it settles into
  tr: number[];                  // recent positions (x,y,x,y...) -- the curved trail
};
/** Cosmic light (gold-white leading, a little violet, sky and rose) ... */
const SWIRL_COSMIC: [number, number, number][] = [
  [255, 236, 190], [255, 226, 170], [255, 244, 214], [255, 232, 180],
  [214, 192, 255], [196, 214, 255], [255, 204, 224],
];
/** ... that warms as it travels until it is the fire's own embers: soft amber and gold. */
const SWIRL_WARM: [number, number, number][] = [
  [255, 190, 90], [255, 206, 120], [255, 172, 74], [255, 222, 150],
];
const mixC = (a: [number, number, number], b: [number, number, number], t: number) =>
  `${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)}`;
/** A white petal that rides the spiral out of the gap, then is let go and drifts
 *  down. The arrival (BreathGate) picks the same petals up in its own galaxy. */
type DoorPetal = {
  a: number; r: number; w: number; vr: number;
  x: number; y: number; px: number; py: number; vx: number; vy: number;
  size: number; rot: number; spin: number; flipPh: number; flipSp: number;
  swayPh: number; swaySp: number; sway: number;
  col: RGB; life: number; max: number; releaseAt: number; falling: boolean; releasedAt: number;
  glow?: boolean;
};
/** A petal lying on the doorway floor (x, y are offsets from the doorway's centre / threshold line). */
type FloorPetal = { x: number; y: number; size: number; rot: number; flip: number; col: RGB; delay: number; ph: number };
/** A lotus blossom on the floor; sheds its petals into the wind when the gust comes. */
type Blossom = { x: number; y: number; size: number; bd: number; jit: number[]; delay: number; shedAt: number; ph: number };
/** The strong gust: when the camera starts to enter and the door is well ajar. */
const GUST_AT = 0.44;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface PortalGateProps {
  /** The door has given way: mount the arrival (BreathGate) underneath now. */
  onCross: () => void;
  /** The flare has cleared: unmount the portal. */
  onDone: () => void;
  /** Seeker chose to skip the whole opening; called after the fade-out. */
  onSkip: () => void;
  /** A signed-in member chose to go straight in: called after the fade-out;
   *  the parent starts the breath (the ceremony proper), no door crossed.
   *  `remember` = they chose "every visit": the parent saves that on the account. */
  onBypass: (remember: boolean) => void;
  /** Signed in. Members are offered the way past the door; everyone else
   *  always meets it (the skip link is still there for anyone). */
  member: boolean;
}

export default function PortalGate({ onCross, onDone, onSkip, onBypass, member }: PortalGateProps) {
  useElderPhase('arrival');
  const { t } = useLanguage();
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
  const lureRef         = useRef<PortalLure | null>(null);
  const proxTargetRef   = useRef(0);   // 0..1, how near the pointer is to the door
  const proxRef         = useRef(0);   // the smoothed value actually sent to the voice
  const crossShownRef   = useRef(false);
  const cb = useRef({ onCross, onDone, onSkip, onBypass });
  useEffect(() => { cb.current = { onCross, onDone, onSkip, onBypass }; });

  const [ready, setReady]       = useState(false);
  const [lineOne, setLineOne]   = useState(false);
  const [lineTwo, setLineTwo]   = useState(false);
  const [hint, setHint]         = useState(false);
  const [skipShown, setSkipShown] = useState(false);
  const [soundShown, setSoundShown] = useState(false);
  const [soundState, setSoundState] = useState<LureState>('locked');
  const [bypassShown, setBypassShown] = useState(false);
  const [crossLine, setCrossLine] = useState(false);
  const [leaving, setLeaving]   = useState(false);

  /* ── audio: silent room. The hearth's own bed is acquired by the animation
     loop once the door passes HEARTH_AT, so the first sound the seeker hears
     is the fire through the door they are opening. Refcounted + grace-period
     shared hearth (enhancements.ts) -- BreathGate and FireAtmosphere pick up
     the very same fire after the crossing. Presses only *resume* a hearth
     that already exists (iOS counts touchend/click as the gesture). ── */
  const primeAudio = useCallback(() => {
    try { hearthRef.current?.resume(); }
    catch { /* audio blocked -- the door still opens in silence */ }
  }, []);

  const startHearth = useCallback(() => {
    if (hearthRef.current) return;
    // A seeker who turned the landing sound off is not given the fire early either;
    // the breath brings the hearth in on its own as before.
    if (!readSoundPref()) return;
    try {
      hearthRef.current = acquireHearthFire();
      hearthRef.current.resume();
    } catch { hearthRef.current = null; }
  }, []);

  const letGoHearth = useCallback(() => {
    if (!hearthRef.current) return;
    hearthRef.current = null;
    try { releaseHearthFire(); } catch { /* ignore */ }
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
    primeAudio();
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
    logPortalEvent('skipped');
    setLeaving(true);
    // Same coordination BreathGate's own skip uses: fade, then hand off.
    skipTimerRef.current = window.setTimeout(() => cb.current.onSkip(), TRANSITION_MS);
  }, []);

  const bypass = useCallback((remember: boolean) => {
    if (leavingRef.current || crossedAtRef.current !== null) return;
    leavingRef.current = true;
    pressRef.current = null;
    logPortalEvent('bypassed');
    setLeaving(true);
    skipTimerRef.current = window.setTimeout(() => cb.current.onBypass(remember), TRANSITION_MS);
  }, []);

  /* The member's way past the door appears early: they know this place, and
     the answer to "do I have to?" should not wait. (Auth resolves after the
     room mounts, so this keys on `member`, not on the mount clock.) */
  useEffect(() => {
    if (!member) return;
    const t = window.setTimeout(() => setBypassShown(true), MEMBER_BYPASS_MS);
    return () => window.clearTimeout(t);
  }, [member]);

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
      // "Reached the door" is logged here, not on mount: a returning seeker
      // mounts this for one render before page.tsx drops it, and must not count.
      window.setTimeout(() => { interactiveRef.current = true; logPortalEvent('reached-door'); }, INTERACTIVE_MS),
      window.setTimeout(() => setLineOne(true), LINE_ONE_MS),
      window.setTimeout(() => setLineTwo(true), LINE_TWO_MS),
      window.setTimeout(() => setHint(true), HINT_MS),
      window.setTimeout(() => setSkipShown(true), SKIP_MS),
      window.setTimeout(() => setSoundShown(true), SOUND_MS),
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
    letGoHearth();
  }, [letGoHearth]);

  /* ── the door's look: procedural wood fallback (lib/portalTexture.ts).
     Built once after first paint and faded in OVER the plain CSS door, so a
     failure anywhere (no canvas, low memory) just leaves the plain door. ── */
  useEffect(() => {
    if (!ready) return;
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    let tex: PortalTextures | null = null;
    const build = async () => {
      try {
        const [okL, okR] = await Promise.all([loadImage(DOOR_PHOTO_L), loadImage(DOOR_PHOTO_R)]);
        const photo = okL && okR;
        const t = await buildPortalTextures({ wood: !photo });
        if (cancelled) { t.revoke(); return; }
        tex = t;
        if (t.leafUrl) root.style.setProperty('--leaf-tex', `url("${t.leafUrl}")`);
        if (photo) {
          root.style.setProperty('--photo-l', `url("${DOOR_PHOTO_L}")`);
          root.style.setProperty('--photo-r', `url("${DOOR_PHOTO_R}")`);
          root.dataset.photo = 'true';
        }
        root.dataset.tex = 'true';
      } catch { /* the plain door stays */ }
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (h: number) => void };
    let handle = 0;
    if (typeof w.requestIdleCallback === 'function') handle = w.requestIdleCallback(build, { timeout: 400 });
    else handle = window.setTimeout(build, 60);
    return () => {
      cancelled = true;
      if (typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(handle); else window.clearTimeout(handle);
      tex?.revoke();
    };
  }, [ready]);

  /* ── the siren (lib/portalLure.ts): a voice that calls from the door.
     Browsers will not start sound before the visitor has interacted, so it
     starts at once if the browser allows and otherwise the moment the first
     click / tap / key arrives. The visible control (and the remembered
     choice) is the way to turn it off. ── */
  useEffect(() => {
    if (!ready) return;
    const lure = createPortalLure();
    lureRef.current = lure;
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __portalLure?: PortalLure }).__portalLure = lure;
    lure.setMuted(!readSoundPref());
    const off = lure.subscribe(setSoundState);
    lure.start();
    setSoundState(lure.getState());
    const unlock = () => lure.resume();
    const evs = ['pointerdown', 'keydown', 'touchend', 'click'] as const;
    evs.forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));
    return () => {
      evs.forEach((ev) => window.removeEventListener(ev, unlock));
      off();
      lureRef.current = null;
      lure.stop();
    };
  }, [ready]);

  const toggleSound = () => {
    const lure = lureRef.current;
    if (!lure) return;
    const st = lure.getState();
    if (st === 'off') { writeSoundPref(true); lure.setMuted(false); lure.resume(); }
    else if (st === 'locked') { lure.resume(); }
    else { writeSoundPref(false); lure.setMuted(true); }
  };

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
    let swirls: Swirl[] = [];
    let swirlCarry = 0;
    let doorPetals: DoorPetal[] = [];
    let floor: FloorPetal[] = [];
    let blossoms: Blossom[] = [];
    let gusted = false, gustAt = 0;
    let streaks: { x: number; y: number; dir: number; sp: number; len: number; w: number; a: number }[] = [];

    /* petals and blossoms on the threshold floor: dense in the middle, thinning outward */
    const seedFloor = () => {
      const { dw, dh } = geomRef.current;
      const mob = W < 600;
      const nP = reducedRef.current ? 0 : mob ? 30 : 46;
      const nB = reducedRef.current ? 0 : mob ? 4 : 6;
      const base = Math.min(W, H);
      floor = Array.from({ length: nP }, () => {
        const x = ((Math.random() + Math.random() + Math.random() - 1.5) / 1.5) * dw * 0.46;
        const y = -Math.pow(Math.random(), 1.4) * 0.17 * dh;   // inside, on the floor: nearer the threshold = nearer you = a little larger
        return {
          x, y, size: (rand(0.022, 0.04) * base + 6) * (0.62 + 0.38 * (1 + y / (0.17 * dh))),
          rot: rand(0, Math.PI * 2), flip: rand(-0.75, 0.75), col: PETAL_COLS[Math.floor(Math.random() * PETAL_COLS.length)],
          delay: rand(250, 700) + (Math.abs(x) / dw) * 150, ph: rand(0, Math.PI * 2),
        };
      });
      blossoms = Array.from({ length: nB }, (_, i) => {
        const x = ((i + 0.5) / nB - 0.5) * dw * 0.8 + rand(-0.03, 0.03) * dw;
        return {
          x, y: -rand(0.0, 0.1) * dh,
          size: dh * rand(0.07, 0.1),
          bd: rand(0, 0.06), jit: Array.from({ length: BLOSSOM_PETALS }, () => rand(-1, 1)),
          delay: rand(0, 200), shedAt: -1, ph: rand(0, Math.PI * 2),
        };
      });
    };
    /* a petal blown off the floor joins the same spiral the lights are riding */
    const blowIntoSpiral = (sx: number, sy: number, size: number, rot: number, col: RGB, cx: number, cy: number) => {
      const dx = sx - cx, dy = (sy - cy) / 1.1;
      doorPetals.push({
        a: Math.atan2(dy, dx), r: Math.max(8, Math.hypot(dx, dy)), w: rand(2.6, 4.6), vr: rand(60, 140),
        x: sx, y: sy, px: sx, py: sy, vx: 0, vy: 0,
        size, rot, spin: rand(-0.06, 0.06), flipPh: rand(0, Math.PI * 2), flipSp: rand(0.03, 0.07),
        swayPh: rand(0, Math.PI * 2), swaySp: rand(0.012, 0.028), sway: rand(0.25, 0.8),
        col, life: 250, max: rand(2600, 3600), releaseAt: rand(900, 1500), falling: false, releasedAt: 0,
        glow: Math.random() < 0.35,
      });
    };

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
      if (!gusted) seedFloor();
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
    let lastProx = -1, lastYield = -1;
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
        logPortalEvent('crossed');
        cb.current.onCross();
      }
      /* the fire is heard only through the opening door */
      if (!leavingRef.current) {
        if (p >= HEARTH_AT) startHearth();
        else if (p < HEARTH_RELEASE_AT && crossedAtRef.current === null) letGoHearth();
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

      /* the siren: nearer the door, louder and brighter; as the door opens it
         gives way to the hearth */
      const lure = lureRef.current;
      if (lure) {
        const target = pressRef.current ? 1 : proxTargetRef.current;
        proxRef.current += (target - proxRef.current) * Math.min(1, dt / 400);
        if (Math.abs(proxRef.current - lastProx) > 0.01) { lastProx = proxRef.current; lure.setProximity(lastProx); }
        // The siren stays while the hearth swells in (it starts at HEARTH_AT and takes
        // ~3.5s) and is gone as the door gives way: one voice handing to the next, never
        // a gap. Their pitches agree: the siren's A and E are an octave above the hearth's.
        const yv = smoothstep(HEARTH_AT, 1, p);
        if (Math.abs(yv - lastYield) > 0.01) { lastYield = yv; lure.setYield(yv); }
      }

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

        /* the doorway floor: blossoms opening among drifts of petals, seen through the
           gap; when the camera starts to enter, the gust takes them into the vortex */
        if (!gusted && p >= GUST_AT && (floor.length || blossoms.length)) {
          gusted = true; gustAt = now;
          // the cold gust, made visible: pale streaks of wind driving in from both sides to the doorway
          streaks = Array.from({ length: W < 600 ? 26 : 44 }, (_, i) => ({
            x: i % 2 ? W + rand(20, 120) : -rand(20, 120), y: cy + rand(-0.55, 0.6) * dh,
            dir: i % 2 ? -1 : 1, sp: rand(1.1, 2.0) * W, len: rand(0.12, 0.3) * W, w: rand(1, 2.4), a: rand(0.35, 0.8),
          }));
        }
        else if (gusted && p < 0.2 && crossedAtRef.current === null) { gusted = false; seedFloor(); }
        {
          const sc = Math.min(f.scale, 1.12);   // the floor stays in the doorway: it does not swell past the camera
          const floorY = cy + dh / 2;
          const toX = (x: number) => cx + x * sc;
          const toY = (y: number) => cy + (floorY + y - cy) * sc;   // camera push about the doorway's centre
          const stir = smoothstep(0.3, GUST_AT, p) * 0.9 + (gusted ? 0.1 : 0);
          const fa = smoothstep(0.02, 0.14, f.open) * (1 - smoothstep(0.7, 0.92, p));
          if (gusted) {
            const since = now - gustAt;
            floor = floor.filter(fp => {
              if (since < fp.delay + 150) return true;
              blowIntoSpiral(toX(fp.x), toY(fp.y), fp.size * sc, fp.rot, fp.col, cx, cy);
              return false;
            });
            for (const b of blossoms) {
              if (b.shedAt < 0 && since >= b.delay) {
                b.shedAt = now;
                for (let j = 0; j < 6; j++) {
                  const ang = rand(-1.1, 1.1), up = b.size * rand(0.5, 0.95);
                  blowIntoSpiral(toX(b.x) + Math.sin(ang) * up * sc, toY(b.y) - Math.cos(ang) * up * sc, b.size * sc * rand(0.5, 0.75), ang, PETAL_COLS[Math.floor(Math.random() * PETAL_COLS.length)], cx, cy);
                }
              }
            }
            blossoms = blossoms.filter(b => b.shedAt < 0 || now - b.shedAt < 700);
          }
          if (fa > 0.01 && (floor.length || blossoms.length)) {
            const fyS = toY(0);
            ctx.save();
            ctx.beginPath();
            const gap = Math.max(1.5, (dw / 2) * f.scale * Math.max(f.open, 0.04));
            ctx.rect(cx - gap, 0, gap * 2, fyS);            // only inside the doorway, seen through the gap
            ctx.clip();
            for (const fp of floor) {
              const rock = Math.sin(now / 70 + fp.ph) * 0.25 * stir;
              const gt = gusted ? Math.min(1, (now - gustAt) / (fp.delay + 150)) : 0;
              const ge = gt * gt;   // the wind builds: the petals slide toward the doorway's heart and rise
              drawPetal(ctx, { x: toX(fp.x * (1 - 0.7 * ge) + Math.sin(now / 90 + fp.ph) * (2 + 8 * gt) * stir), y: toY(fp.y - ge * dh * 0.22), size: fp.size * sc, rot: fp.rot + rock, flip: fp.flip, alpha: 0.9 * fa, col: fp.col, glow: false });
            }
            for (const b of blossoms) {
              const o = smoothstep(0.02 + b.bd, 0.3 + b.bd, f.open);
              const shed = b.shedAt < 0 ? 1 : 1 - smoothstep(0, 700, now - b.shedAt);
              drawBlossom(ctx, toX(b.x), toY(b.y), b.size * sc, o, b.jit, fa * shed);
            }
            ctx.restore();
          }
        }

        // the cold gust: a chill that washes over the whole screen, streaks of wind driving in
        if (gusted) {
          const since = now - gustAt;
          const env = smoothstep(0, 220, since) * (1 - smoothstep(600, 1900, since));
          if (env > 0.01) {
            ctx.fillStyle = `rgba(150,190,245,${(0.16 * env).toFixed(3)})`;
            ctx.fillRect(0, 0, W, H);
            ctx.lineCap = 'round';
            for (const st of streaks) {
              const hx = st.x + st.dir * st.sp * since / 1000;
              const tx = hx - st.dir * st.len;
              const wav = Math.sin(since / 160 + st.y * 0.02) * 6;
              const al = st.a * env;
              const g = ctx.createLinearGradient(tx, 0, hx, 0);
              g.addColorStop(0, 'rgba(205,228,255,0)'); g.addColorStop(1, `rgba(225,240,255,${al.toFixed(3)})`);
              ctx.strokeStyle = g; ctx.lineWidth = st.w;
              ctx.beginPath(); ctx.moveTo(tx, st.y + wav * 0.4); ctx.quadraticCurveTo((tx + hx) / 2, st.y - wav, hx, st.y + wav * 0.2); ctx.stroke();
            }
          }
        }

        // cosmic light pouring out of the doorway and spiralling away: a slow
        // galaxy-turn of gold, violet, sky and rose that widens as it comes
        const hw = Math.max(1.5, (dw / 2) * f.scale * Math.max(f.open, 0.04));
        if (f.embers > 0.01 && swirls.length < 170) {
          swirlCarry += f.embers * 105 * dt / 1000;
          while (swirlCarry >= 1) {
            swirlCarry -= 1;
            const ang = rand(0, Math.PI * 2);
            const r = Math.max(6, hw * 0.6) * rand(0.1, 1);
            const dir = Math.random() < 0.9 ? 1 : -1;   // nearly all one way, so it reads as one vortex
            if (doorPetals.length < 34 && Math.random() < 0.26) {
              const px0 = cx + Math.cos(ang) * r, py0 = cy + Math.sin(ang) * r * 1.1;
              doorPetals.push({
                a: ang, r, w: dir * rand(2.6, 4.6), vr: rand(40, 120),
                x: px0, y: py0, px: px0, py: py0, vx: 0, vy: 0,
                size: rand(0.022, 0.04) * Math.min(W, H) + 6, rot: rand(0, Math.PI * 2), spin: rand(-0.04, 0.04),
                flipPh: rand(0, Math.PI * 2), flipSp: rand(0.03, 0.07),
                swayPh: rand(0, Math.PI * 2), swaySp: rand(0.012, 0.028), sway: rand(0.25, 0.8),
                col: PETAL_COLS[Math.floor(Math.random() * PETAL_COLS.length)],
                life: 0, max: rand(2400, 3400), releaseAt: rand(700, 1300), falling: false, releasedAt: 0,
              });
            }
            swirls.push({
              a: ang, r,
              w: dir * rand(3.2, 6.0), vr: rand(40, 130),
              size: rand(0.9, 2.3), life: 0, max: rand(1800, 3300),
              c0: SWIRL_COSMIC[Math.floor(Math.random() * SWIRL_COSMIC.length)],
              cw: SWIRL_WARM[Math.floor(Math.random() * SWIRL_WARM.length)],
              tr: [],
            });
          }
        }
        const live: Swirl[] = [];
        ctx.globalCompositeOperation = 'lighter';   // light adds to light
        ctx.lineCap = 'round';
        for (const s2 of swirls) {
          const step = Math.min(dt, 40);                       // a stalled frame must not fling a straight streak
          s2.life += step;
          if (s2.life >= s2.max) continue;
          const sec = step / 1000;
          const lf = s2.life / s2.max;
          s2.a += (s2.w / (1 + s2.r / 140)) * sec;           // fast in the heart, slow at the rim
          s2.r += (s2.vr + s2.r * 0.5) * sec;
          const x = cx + Math.cos(s2.a) * s2.r;
          const y = cy + Math.sin(s2.a) * s2.r * 1.1;
          const al = Math.pow(Math.sin(Math.PI * lf), 0.8) * 0.9;
          const sz = s2.size * (1 + 1.4 * lf);
          const rgb = mixC(s2.c0, s2.cw, smoothstep(0.2, 0.85, lf));   // cosmic -> ember as it goes
          s2.tr.push(x, y);
          if (s2.tr.length > 18) s2.tr.splice(0, 2);          // the last nine positions
          if (s2.tr.length >= 4) {
            ctx.beginPath(); ctx.moveTo(s2.tr[0], s2.tr[1]);
            for (let i = 2; i < s2.tr.length; i += 2) ctx.lineTo(s2.tr[i], s2.tr[i + 1]);
            ctx.strokeStyle = `rgba(${rgb},${(al * 0.38).toFixed(3)})`;
            ctx.lineWidth = Math.max(0.8, sz * 0.7); ctx.stroke();
          }
          const g = ctx.createRadialGradient(x, y, 0, x, y, sz * 3.6);
          g.addColorStop(0, `rgba(${rgb},${(al * 0.85).toFixed(3)})`);
          g.addColorStop(1, `rgba(${rgb},0)`);
          ctx.beginPath(); ctx.arc(x, y, sz * 3.6, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
          live.push(s2);
        }
        ctx.globalCompositeOperation = 'source-over';
        swirls = live;

        // petals riding the same spiral; the gust lets go of them and they drift down
        const gustGate = smoothstep(0.3, 0.8, p);
        const keepP: DoorPetal[] = [];
        for (const pt of doorPetals) {
          const step = Math.min(dt, 40);
          pt.life += step;
          if (pt.life >= pt.max) continue;
          const sec = step / 1000, k = step / FRAME_MS;
          if (!pt.falling) {
            pt.px = pt.x; pt.py = pt.y;
            pt.a += (pt.w / (1 + pt.r / 140)) * sec;
            pt.r += (pt.vr + pt.r * 0.5) * sec;
            pt.x = cx + Math.cos(pt.a) * pt.r;
            pt.y = cy + Math.sin(pt.a) * pt.r * 1.1;
            if (pt.life >= pt.releaseAt) {
              const kk = Math.max(k, 0.25);
              pt.vx = (pt.x - pt.px) / kk; pt.vy = (pt.y - pt.py) / kk;
              pt.falling = true; pt.releasedAt = pt.life;
            }
          } else {
            stepFall(pt, k, (pt.life - pt.releasedAt) / FRAME_MS, 2.2 * gustGate * Math.sin(now / 520 + pt.swayPh * 0.6));
          }
          pt.rot += pt.spin * k;
          if (pt.falling && (pt.y > H + pt.size * 2 || pt.x < -pt.size * 3 || pt.x > W + pt.size * 3)) continue;
          const lf = pt.life / pt.max;
          const al = Math.min(1, pt.life / 250) * (1 - smoothstep(0.78, 1, lf)) * 0.92;
          drawPetal(ctx, { x: pt.x, y: pt.y, size: pt.size * (0.75 + 0.55 * lf), rot: pt.rot, flip: Math.cos(pt.life / FRAME_MS * pt.flipSp + pt.flipPh), alpha: al, col: pt.col, glow: pt.glow });
          keepP.push(pt);
        }
        doorPetals = keepP;
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
  }, [ready, startHearth, letGoHearth]);

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

  const onRootPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root) return;
    const { cy, dh } = geomRef.current;
    const reach = Math.max(240, dh * 0.9);
    const near = clamp01(1 - Math.hypot(e.clientX - root.clientWidth / 2, e.clientY - cy) / reach);
    proxTargetRef.current = near * near * (3 - 2 * near);
  };
  const onRootPointerLeave = () => { proxTargetRef.current = 0; };

  return (
    <div
      ref={rootRef}
      className="portal-root"
      role="region"
      aria-label={t('portal.region')}
      data-ready={ready ? 'true' : 'false'}
      data-leaving={leaving ? 'true' : 'false'}
      onPointerMove={onRootPointerMove}
      onPointerLeave={onRootPointerLeave}
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
          /* inner reveal, then a moulded frame that takes the seam's light */
          box-shadow:
            inset 0 0 0 2px rgba(5,7,10,0.9),
            0 0 0 5px rgba(20,13,8,calc(0.95 * var(--adjust))),
            0 0 0 6px rgba(150,98,50,calc(0.38 * var(--adjust))),
            0 0 0 10px rgba(11,8,6,calc(0.95 * var(--adjust))),
            0 0 0 11px rgba(255,170,80,calc(0.5 * var(--cast)));
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
          /* Raster the textured face once; the swing is a compositor transform. */
          will-change: transform;
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
        /* ── the door's face (only once the textures exist; see data-tex) ──
           wood -> a cold grade that lifts as the room warms -> a warm sheen
           from the seam. The right leaf is the left, mirrored. */
        .portal-leaf-wood, .portal-leaf-photo, .portal-leaf-grade, .portal-leaf-sheen {
          position: absolute; inset: 0; pointer-events: none;
          opacity: 0; transition: opacity 1.4s ease;
        }
        .portal-leaf--r .portal-leaf-wood, .portal-leaf--r .portal-leaf-sheen { transform: scaleX(-1); }
        .portal-leaf-wood { background: var(--leaf-tex) center / 100% 100% no-repeat; }
        /* The photographed doors: each leaf its own door, so no mirroring. */
        .portal-leaf--l .portal-leaf-photo { background: var(--photo-l) center / 100% 100% no-repeat; }
        .portal-leaf--r .portal-leaf-photo { background: var(--photo-r) center / 100% 100% no-repeat; }
        .portal-leaf-grade {
          background: linear-gradient(180deg, rgba(8,14,24,0.66), rgba(8,14,24,0.5));
        }
        .portal-leaf-sheen {
          mix-blend-mode: soft-light;
          background: linear-gradient(90deg, rgba(255,170,90,0) 38%, rgba(255,175,95,0.95) 100%);
        }
        .portal-root[data-tex="true"] .portal-leaf-wood  { opacity: calc(var(--adjust) * 0.96); }
        .portal-root[data-tex="true"] .portal-leaf-grade { opacity: calc(var(--adjust) * (1 - var(--warm) * 0.85)); }
        .portal-root[data-tex="true"] .portal-leaf-sheen { opacity: calc(var(--cast) * 0.9); }
        .portal-root[data-tex="true"][data-photo="true"] .portal-leaf-photo { opacity: calc(var(--adjust) * 0.98); }
        .portal-root[data-tex="true"][data-photo="true"] .portal-leaf-wood { opacity: 0; }
        /* the baked panels replace the plain CSS panel outlines */
        .portal-root[data-tex="true"] .portal-panel { opacity: 0; }
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
        /* An antique ring pull: a worn, tarnished brass backplate with a
           pivot boss and a loose ring hanging from it. Dull on purpose -- it
           takes only a thin line of the seam's light on its edge, no glow, so
           it never competes with the seam (docs/portal-crossing.md, "Warm
           against cold"). A plain functional pull: no engraving, no motif.
           Everything is sized from the door width so it scales with the door. */
        .portal-handle {
          --rim: -1.5px;
          position: absolute; top: 50%;
          width: calc(var(--dw) * 0.09); height: calc(var(--dw) * 0.2);
          transform: translateY(-50%);
          /* teardrop plate: wide where the ring hangs, tapering below */
          border-radius: 50% 50% 50% 50% / 40% 40% 60% 60%;
          background:
            radial-gradient(circle at 50% 84%, #120b04 0 1.5px, rgba(190,160,96,0.22) 1.5px 2.4px, transparent 2.6px),
            radial-gradient(ellipse 62% 26% at 28% 74%, rgba(70,96,80,0.36), transparent 72%),
            radial-gradient(ellipse 50% 22% at 72% 18%, rgba(58,76,64,0.26), transparent 72%),
            radial-gradient(ellipse 34% 26% at 40% 38%, rgba(168,132,62,0.22), transparent 75%),
            linear-gradient(90deg, #1b1306 0%, #4a3814 24%, #6c5322 46%, #3a2b0f 72%, #140d04 100%);
          opacity: var(--adjust);
          box-shadow:
            1px 3px 5px rgba(0,0,0,0.75),
            inset 0 0 0 1px rgba(12,7,2,0.9),
            inset 0 0 0 2px rgba(120,92,40,0.2),
            inset var(--rim) 0 0 0 rgba(255,172,92,calc(0.42 * var(--cast)));
        }
        .portal-handle::before, .portal-handle::after { content: ""; position: absolute; left: 50%; }
        /* the pivot boss the ring hangs from */
        .portal-handle::before {
          width: calc(var(--dw) * 0.036); height: calc(var(--dw) * 0.036);
          top: calc(var(--dw) * 0.034); transform: translateX(-50%); border-radius: 50%;
          background: radial-gradient(circle at 36% 32%, #9a7a35 0%, #5f4619 45%, #2a1d08 100%);
          box-shadow: 0 1px 2px rgba(0,0,0,0.75), inset 0 0 0 1px rgba(12,7,2,0.7);
        }
        /* the loose ring: four-tone border = a bevel of light from above */
        .portal-handle::after {
          box-sizing: border-box;
          width: calc(var(--dw) * 0.07); height: calc(var(--dw) * 0.07);
          top: calc(var(--dw) * 0.05); transform: translateX(-50%); border-radius: 50%;
          border: max(2.5px, calc(var(--dw) * 0.013)) solid;
          border-color: #7a5d25 #4d3813 #1f1506 #6a4f1e;
          box-shadow: 1px 3px 4px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(12,7,2,0.55);
        }
        .portal-leaf--l .portal-handle { right: 6%; }
        .portal-leaf--r .portal-handle { left: 6%; --rim: 1.5px; }

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
        /* A signed-in member's two ways past the door, side by side. */
        .portal-bypass-row {
          position: absolute; z-index: 4; bottom: 30px; left: 0; right: 0;
          display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;
          padding: 0 3vw;
          opacity: 0; pointer-events: none;
          transition: opacity 1.2s ease;
        }
        .portal-bypass-row.is-in { opacity: var(--skipop); pointer-events: auto; }
        .portal-bypass-row .portal-skip {
          position: static; transform: none; opacity: 1; pointer-events: auto;
          font-size: 13px; letter-spacing: 0.18em; padding: 10px 14px;
        }
        .portal-skip:focus-visible { outline: 1px dashed rgba(200,147,58,0.7); outline-offset: 3px; }

        /* The sound control: always reachable, always honest about its state. */
        .portal-sound {
          position: absolute; z-index: 4; top: 18px; left: 18px; /* top-left: the language toggle owns the top-right corner */
          display: flex; align-items: center; gap: 10px;
          min-height: 44px; padding: 0 16px;
          font-family: 'Inter', Arial, sans-serif; font-size: 13px; letter-spacing: 0.18em;
          color: #8ea0b4; background: rgba(6,8,11,0.55);
          border: 1px solid rgba(142,160,180,0.32); border-radius: 4px;
          cursor: pointer; white-space: nowrap;
          opacity: 0; pointer-events: none; transition: opacity 1.2s ease;
        }
        .portal-sound.is-in { opacity: var(--skipop); pointer-events: auto; }
        .portal-sound:focus-visible { outline: 1px dashed rgba(200,147,58,0.7); outline-offset: 3px; }
        .portal-sound-dot {
          width: 8px; height: 8px; border-radius: 50%; flex: none;
          background: #5d6b7c; transition: background 0.4s ease, box-shadow 0.4s ease;
        }
        .portal-sound[data-state="on"] .portal-sound-dot { background: #f0b25a; box-shadow: 0 0 10px 2px rgba(240,170,80,0.55); }
        .portal-sound[data-state="locked"] .portal-sound-dot { background: #c8933a; animation: portalSoundWake 2.4s ease-in-out infinite; }
        @keyframes portalSoundWake { 0%,100% { opacity: 0.35; } 50% { opacity: 1; } }
        .portal-root[data-compact="true"] .portal-sound { top: 8px; left: 8px; min-height: 36px; padding: 0 12px; }

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
        @media (max-width: 420px) {
          .portal-bypass-row { gap: 8px; }
          .portal-bypass-row .portal-skip { font-size: 12px; letter-spacing: 0.1em; padding: 9px 10px; }
        }
        .portal-root[data-compact="true"] .portal-bypass-row {
          left: auto; right: 6vw; padding: 0; bottom: 26px;
        }
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
                <div className="portal-leaf-wood" />
                <div className="portal-leaf-photo" />
                <div className="portal-leaf-grade" />
                <div className="portal-leaf-sheen" />
                <div className="portal-leaf-rim" />
                <span className="portal-panel portal-panel--hi" />
                <span className="portal-panel portal-panel--lo" />
                <span className="portal-handle" />
              </div>
              <div className="portal-leaf portal-leaf--r">
                <div className="portal-leaf-tone" />
                <div className="portal-leaf-wood" />
                <div className="portal-leaf-photo" />
                <div className="portal-leaf-grade" />
                <div className="portal-leaf-sheen" />
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
            <p className="portal-line">{t('portal.room_1')}</p>
            <p className="portal-line">{t('portal.room_2')}</p>
          </div>

          {/* Narration: the Elder's voice, witnessing. Real text, announced
              politely as each beat arrives. */}
          <div className="portal-text" aria-live="polite">
            <p className={'portal-line portal-line--1' + (lineOne ? ' is-in' : '') + (crossLine ? ' is-out' : '')}>
              {lineOne ? t('portal.room_1') : ''}
            </p>
            <p className={'portal-line portal-line--2' + (lineTwo ? ' is-in' : '') + (crossLine ? ' is-out' : '')}>
              {lineTwo ? t('portal.room_2') : ''}
            </p>
            <p className={'portal-line portal-line--cross' + (crossLine ? ' is-in' : '')}>
              {crossLine ? t('portal.crossing') : ''}
            </p>
          </div>

          <div className={'portal-hint' + (hint ? ' is-in' : '')} aria-hidden="true">
            <span className="portal-hint-word">{t('portal.hold')}</span>
            <span className="portal-hint-sub">{t('portal.hold_sub')}</span>
          </div>

          <button
            ref={hitRef}
            type="button"
            className="portal-hit"
            aria-label={t('portal.door_label')}
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
            className={'portal-sound' + (soundShown ? ' is-in' : '')}
            data-state={soundState}
            aria-pressed={soundState === 'on'}
            aria-label={
              soundState === 'on' ? t('portal.sound_label_on')
              : soundState === 'off' ? t('portal.sound_label_off')
              : t('portal.sound_label_locked')
            }
            onClick={toggleSound}
          >
            <span className="portal-sound-dot" aria-hidden="true" />
            {soundState === 'on' ? t('portal.sound_on') : soundState === 'off' ? t('portal.sound_off') : t('portal.sound_locked')}
          </button>

          {member ? (
            <div className={'portal-bypass-row' + (bypassShown ? ' is-in' : '')}>
              <button type="button" className="portal-skip" onClick={() => bypass(false)}>
                {t('portal.bypass')} &nbsp;&rsaquo;
              </button>
              <button type="button" className="portal-skip" onClick={() => bypass(true)}>
                {t('portal.bypass_always')} &nbsp;&rsaquo;
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={'portal-skip' + (skipShown ? ' is-in' : '')}
              onClick={skip}
            >
              {t('portal.skip')} &nbsp;&rsaquo;
            </button>
          )}

          <div className="portal-bloom" aria-hidden="true" />
        </>
      )}
    </div>
  );
}
