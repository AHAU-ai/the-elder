'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { TRANSITION_MS } from '../../lib/transitions';
import { useElderPhase } from './ElderPresence';
import { FRAME_MS, frameScale, stepPolar } from '../../lib/vortexMotion';
import { stepFall, gustX, isOffScreen } from '../../lib/petalMotion';
import { drawPetal, PETAL_COLS, type RGB } from '../../lib/petalDraw';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import type { MessageKey } from '../../lib/i18n/translate';
import { acquireHearthFire, releaseHearthFire, playIgnitionChime } from './enhancements';

/* ─────────────────────────────────────────────
   BREATH SEQUENCE
   Paced like a teacher guiding a student into a ceremonial space, not a
   UI transition -- every phase is long enough to actually be inhabited,
   not just glimpsed. A real guided breath runs slower than an inhale/
   exhale reflex: this errs toward "too slow to feel like an app" over
   "brisk enough to not lose someone."
   Phase 0 — HERALD       3.4s  — the Eye ignites out of the dark, hook
                                  line lands and holds long enough to
                                  actually be read; ring stays at rest.
                                  This is the "first 3 seconds" beat: a
                                  cold visitor sees something arresting
                                  happen immediately instead of near-blank
                                  embers before any content at all. Paced
                                  at a full unhurried breath's length (not
                                  a flash-cut) so it reads as the ceremony
                                  beginning, not a jump-scare.
   Phase 1 — BREATHE IN   5.0s  — ring expands, arc sweeps
   Phase 2 — HOLD         3.0s  — ring holds at peak
   Phase 3 — BREATHE OUT  6.0s  — ring contracts (exhale reads longer than
                                  the inhale -- the settling half of a
                                  guided breath, not a mirror of it)
   Phase 4 — silence      2.0s  — ring rests
   → gate dissolves, threshold reveals
───────────────────────────────────────────── */
const RING_BASE   = 38;
const RING_INHALE = 88;

// The hook line for the herald beat is the catalog string 'breath.herald'. A
// direct question, not a statement -- pulls a seeker in by naming the thing
// they're already privately asking, rather than asserting a claim at them
// before they've engaged at all.

// label / sub are catalog keys (or '' for a silent beat), resolved with t() at
// render so the guided breath is spoken in the seeker's language.
const PHASES: Array<{ duration: number; label: MessageKey | ''; sub: MessageKey | ''; ringTarget: number }> = [
  { duration: 3400, label: '',               sub: '',               ringTarget: RING_BASE   },
  { duration: 5000, label: 'breath.in',      sub: 'breath.in_sub',  ringTarget: RING_INHALE },
  { duration: 3000, label: 'breath.hold',    sub: '',               ringTarget: RING_INHALE },
  { duration: 6000, label: 'breath.out',     sub: 'breath.out_sub', ringTarget: RING_BASE   },
  { duration: 2000, label: '',               sub: '',               ringTarget: RING_BASE   },
];

const PHASE_STARTS = PHASES.reduce<number[]>((acc, p, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + PHASES[i - 1].duration);
  return acc;
}, []);
const TOTAL_DURATION = PHASE_STARTS[PHASES.length - 1] + PHASES[PHASES.length - 1].duration;

/* ─────────────────────────────────────────────
   EMBER TYPES
───────────────────────────────────────────── */
/** A mote of cosmic light turning around the centre of the screen. `shower`
 *  motes are the opening vortex that fills the screen and then opens out and
 *  dissolves; the rest are the few that keep slowly orbiting after it. */
type Star = {
  a: number; r: number; w: number; vr: number;
  size: number; alpha: number;
  c0: [number, number, number]; cw: [number, number, number];
  lift: number;                       // how far it has risen, once it turns to an ember
  vx: number; vy: number; ph: number; // ambient embers: drift, rise, flicker phase
  x: number; y: number; tr: number[];
  life: number; maxLife: number; delay: number;
  shower: boolean;
};

type CursorSpark = {
  x: number; y: number; vx: number; vy: number;
  r: number; alpha: number;
  col: [number, number, number];
  life: number; maxLife: number;
};

// The vortex starts as cosmic light (gold-white leading, a little violet, sky,
// rose) and warms as it opens out until it is the fire's own embers.
const STAR_COSMIC: [number, number, number][] = [
  [255,236,190],[255,226,170],[255,244,214],[255,232,180],
  [214,192,255],[196,214,255],[255,204,224],
];
const STAR_WARM: [number, number, number][] = [
  [255,190,90],[255,206,120],[255,172,74],[255,222,150],
];
const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const mixC = (a: [number, number, number], b: [number, number, number], t: number) =>
  `${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)}`;
const CURSOR_COLS: [number, number, number][] = [
  [255,200,80],[255,160,40],[255,120,20],[255,80,10],[220,140,30],
];

function rand(a: number, b: number){ return a + Math.random() * (b - a); }

// The vortex: a swirl of cosmic light that fills the whole screen, then opens
// outward and dissolves. A few slow orbiting motes carry on after it.
const SHOWER_AT_MS = 2300;   // when it begins to open out (ms from mount)
const SHOWER_DISPERSE_MS = 1500;

function mkShowerStar(W: number, H: number): Star {
  const maxR = Math.hypot(W, H) / 2;
  const a = rand(0, Math.PI * 2);
  const r = Math.sqrt(Math.random()) * maxR;       // even cover of the WHOLE screen
  return {
    a, r,
    w: rand(0.9, 1.6) * (Math.random() < 0.92 ? 1 : -1),
    vr: rand(-0.45, 0.25),
    size: rand(0.9, 2.6), alpha: rand(0.55, 0.95),
    c0: pick(STAR_COSMIC), cw: pick(STAR_WARM), lift: rand(0.7, 2.1),   // lift: how eagerly it rises as the vortex dissolves
    vx: 0, vy: 0, ph: 0,
    x: 0, y: 0, tr: [],
    life: 0, maxLife: 1e9,
    delay: rand(0, 670),                       // ms: staggered over the first ~0.7s
    shower: true,
  };
}

/** A white petal. It rides the galaxy round with the lights, a gust lets go of it
 *  (releaseAt, ms into the arrival), and it drifts down and off the bottom of the
 *  screen. The lights do the opposite: they lift and become the fire's sparks. */
type Petal = {
  a: number; r: number; w: number; vr: number;       // polar state while it rides the spiral
  x: number; y: number; px: number; py: number;
  vx: number; vy: number;                            // once released
  size: number; alpha: number;
  rot: number; spin: number; flipPh: number; flipSp: number;
  swayPh: number; swaySp: number; sway: number;
  col: RGB;
  life: number; delay: number; releaseAt: number; falling: boolean; releasedAt: number;
};
function mkPetal(W: number, H: number): Petal {
  const maxR = Math.hypot(W, H) / 2;
  const a = rand(0, Math.PI * 2);
  const r = Math.sqrt(Math.random()) * maxR * 0.95;        // spread over the whole screen
  const x = W / 2 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r;
  return {
    a, r, w: rand(0.9, 1.5), vr: rand(-0.3, 0.2),
    x, y, px: x, py: y, vx: 0, vy: 0,
    size: rand(0.026, 0.052) * Math.min(W, H) + 7, alpha: rand(0.72, 0.97),
    rot: rand(0, Math.PI * 2), spin: rand(-0.03, 0.03),
    flipPh: rand(0, Math.PI * 2), flipSp: rand(0.03, 0.07),
    swayPh: rand(0, Math.PI * 2), swaySp: rand(0.012, 0.028), sway: rand(0.25, 0.8),
    col: pick(PETAL_COLS),
    life: 0, delay: rand(0, 600), releaseAt: rand(800, 1900), falling: false, releasedAt: 0,
  };
}
const PETAL_COUNT = 38;

/** The few that carry on: the fire's own soft sparks, rising slow and golden.
 *  Honey, amber, apricot, cream -- no reds -- so the hearth reads warm and inviting. */
const HEARTH_COLS: [number, number, number][] = [
  [255,200,110],[255,182,84],[255,214,140],[255,232,176],[255,170,72],
];
function mkHearthEmber(W: number, H: number, fromBot: boolean): Star {
  const col = pick(HEARTH_COLS);
  return {
    a: 0, r: 0, w: 0, vr: 0,
    size: rand(0.9, 2.5), alpha: rand(0.35, 0.85),
    c0: col, cw: col,
    ph: rand(0, Math.PI * 2),                         // twinkle phase
    lift: rand(0.02, 0.06),                           // (ambient) twinkle rate
    x: W * 0.15 + Math.random() * W * 0.7,
    y: fromBot ? H + 10 : H * 0.25 + Math.random() * H * 0.75,
    tr: [], vx: rand(-0.45, 0.45), vy: rand(-0.85, -0.25),
    life: 0, maxLife: 1e9, delay: 0,
    shower: false,
  };
}

// Opening vortex: the herald beat opens with a full-screen swirl of cosmic light
// that opens out and dissolves by the time BREATHE IN starts. A cold-open screen
// that's 90% empty for a beat reads as "nothing loaded" rather than "ceremony" --
// this front-loads something alive on screen from frame one, then settles to a
// few slow motes for the rest of the gate.
// Matches the herald phase's own duration (PHASES[0]).
const FLARE_DECAY_MS = 3400;
const SHOWER_COUNT = 150;
const AMBIENT_COUNT = 38;

function smooth01(a: number, b: number, x: number){ const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function easeInOutSine(t: number){ return -(Math.cos(Math.PI * t) - 1) / 2; }
function lerp(a: number, b: number, t: number){ return a + (b - a) * t; }

/* ─────────────────────────────────────────────
   COMPONENT PROPS
───────────────────────────────────────────── */
interface BreathGateProps {
  onComplete: () => void;
}

/* ─────────────────────────────────────────────
   COMPONENT
───────────────────────────────────────────── */
export default function BreathGate({ onComplete }: BreathGateProps) {
  useElderPhase('arrival');
  const { t } = useLanguage();
  const rootRef         = useRef<HTMLDivElement>(null);
  const emberCanvasRef  = useRef<HTMLCanvasElement>(null);
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null);
  const ringCanvasRef   = useRef<HTMLCanvasElement>(null);
  const rafRef          = useRef<number>(0);
  const eyeRef          = useRef<SVGSVGElement>(null);
  const pupilRef        = useRef<SVGGElement>(null);

  const embersRef  = useRef<Star[]>([]);
  const sparksRef  = useRef<CursorSpark[]>([]);
  const mouseRef   = useRef<{x:number;y:number}>({x:-200,y:-200});
  const startTimeRef = useRef<number | null>(null);
  const gateOpenRef  = useRef<boolean>(false);

  const [phaseIdx,     setPhaseIdx]     = useState(0);
  const [wordVisible,  setWordVisible]  = useState(false);
  const [subVisible,   setSubVisible]   = useState(false);
  const [skipVisible,  setSkipVisible]  = useState(false);
  const [overlayFade,  setOverlayFade]  = useState(false);

  /* ── open gate (skip or auto) ── */
  // The parent hands in a fresh onComplete on every render. Held in a ref so that
  // openGate -- a dependency of the animation effect below -- keeps one identity;
  // otherwise every parent re-render (the portal finishing its fade is one, about
  // 1.1s into the vortex) restarted the whole canvas effect: the vortex was wiped
  // and re-seeded mid-flight.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });
  const openGate = useCallback(() => {
    if (gateOpenRef.current) return;
    gateOpenRef.current = true;
    setOverlayFade(true);
    // Coordinated to the shared transition constant (lib/transitions.ts)
    // so Threshold's own entrance fade on the other side of this handoff
    // -- previously an uncoordinated, independent number -- now agrees
    // with this fade-out's duration instead of merely being close to it.
    setTimeout(() => onCompleteRef.current(), TRANSITION_MS);
  }, []);

  /* ── show skip link after 2.4s -- scaled with the slower, meditative
     pacing so it still appears roughly a third of the way into the herald
     beat rather than rushing in against the new, longer rhythm.
     Under prefers-reduced-motion, show it immediately instead: the delay
     itself is a motion-paced affordance, and someone who asked for less
     motion shouldn't have to wait out the very thing they opted out of
     just to find the way past it. This never auto-skips the gate --
     openGate still only runs when the seeker actually clicks. ── */
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setSkipVisible(true);
      return;
    }
    const t = setTimeout(() => setSkipVisible(true), 2400);
    return () => clearTimeout(t);
  }, []);

  /* ── herald ignition chime ──
     Timed to land at the eye's bloom peak (elderHeraldEyeIgnite's 32%
     keyframe, ~0.1s animation-delay + ~0.5s into its 1.5s duration).
     Silently a no-op before any user gesture has unlocked audio -- see
     playIgnitionChime's own comment. */
  useEffect(() => {
    const t = setTimeout(() => playIgnitionChime(), 550);
    return () => clearTimeout(t);
  }, []);

  /* ── ambient hearth ──
     acquireHearthFire is the shared, refcounted hearth -- FireAtmosphere
     picks up the same instance when Threshold mounts, so it's one
     continuous bed from here through the reading rather than starting
     cold at age-register. Silent until the seeker's first gesture
     (autoplay policy); the mute control lives in FireAtmosphere once the
     fire proper is on screen. BreathGate only runs on a cold open, so
     acquiring unconditionally matches Threshold's soundEnabled default. */
  useEffect(() => {
    acquireHearthFire();
    return () => releaseHearthFire();
  }, []);

  /* ── phase label transitions ── */
  useEffect(() => {
    setWordVisible(false);
    setSubVisible(false);
    const p = PHASES[phaseIdx];
    if (p.label) {
      const t1 = setTimeout(() => setWordVisible(true), 120);
      const t2 = p.sub ? setTimeout(() => setSubVisible(true), 320) : null;
      return () => { clearTimeout(t1); if (t2) clearTimeout(t2); };
    }
  }, [phaseIdx]);

  /* ── canvas animation loop ── */
  useEffect(() => {
    const root      = rootRef.current!;
    const eCanvas   = emberCanvasRef.current!;
    const cCanvas   = cursorCanvasRef.current!;
    const rCanvas   = ringCanvasRef.current!;
    const ectx      = eCanvas.getContext('2d')!;
    const cctx      = cCanvas.getContext('2d')!;
    const rctx      = rCanvas.getContext('2d')!;

    function W(){ return root.offsetWidth; }
    function H(){ return root.offsetHeight; }

    /* init the vortex (fewer motes on small screens) plus a few ambient ones. */
    const reducedMotion = typeof window !== 'undefined'
      && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let petals: Petal[] = [];
    function initEmbers(){
      eCanvas.width = W(); eCanvas.height = H();
      petals = reducedMotion ? [] : Array.from({ length: W() < 600 ? Math.round(PETAL_COUNT * 0.65) : PETAL_COUNT }, () => mkPetal(W(), H()));
      const showerN = reducedMotion ? 0 : (W() < 600 ? Math.round(SHOWER_COUNT * 0.62) : SHOWER_COUNT);
      embersRef.current = [
        ...Array.from({ length: showerN }, () => mkShowerStar(W(), H())),
        ...Array.from({ length: reducedMotion ? 6 : AMBIENT_COUNT }, () => mkHearthEmber(W(), H(), false)),
      ];
    }

    let lastTickAt = -1;
    function tickEmbers(elapsed: number){
      // Everything below moves by real time, never by frame count (lib/vortexMotion.ts).
      const dtMs = lastTickAt < 0 ? FRAME_MS : elapsed - lastTickAt;
      lastTickAt = elapsed;
      // Motion is clamped (a stalled frame must not fling a mote); *schedules* (start
      // delay, fade-in) follow real time, so a slow device still gets its vortex on time.
      const realT = Math.min(Math.max(dtMs, 0), 1000);
      const k = frameScale(dtMs);          // 60Hz-frame equivalents, clamped
      const w = W(), h = H();
      if (eCanvas.width !== w || eCanvas.height !== h){ eCanvas.width = w; eCanvas.height = h; }
      ectx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2;
      const scale = Math.min(w, h);
      // 0 while the vortex holds, easing to 1 as it opens out and turns to embers.
      const dRaw = Math.min(1, Math.max(0, (elapsed - SHOWER_AT_MS) / SHOWER_DISPERSE_MS));
      const disperse = dRaw * dRaw * (3 - 2 * dRaw);
      ectx.globalCompositeOperation = 'lighter';   // light adds to light
      ectx.lineCap = 'round';
      // A soft golden heart behind the swirl: the doorway's own light, warm.
      const core = 0.17 * Math.min(1, elapsed / 700) * (1 - disperse);
      if (core > 0.005 && !reducedMotion) {
        const cg = ectx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.65);
        cg.addColorStop(0, `hsla(46,95%,86%,${core.toFixed(3)})`);
        cg.addColorStop(0.4, `hsla(34,90%,64%,${(core * 0.5).toFixed(3)})`);
        cg.addColorStop(1, 'hsla(26,90%,50%,0)');
        ectx.fillStyle = cg; ectx.fillRect(0, 0, w, h);
      }
      // The hearth's embers come up as the vortex lifts, so one becomes the other.
      const hearthIn = reducedMotion ? 1 : Math.min(1, Math.max(0, (elapsed - 1400) / 2400));
      const next: Star[] = [];
      for (const e of embersRef.current) {
        if (e.delay > 0) { e.delay -= realT; next.push(e); continue; }
        e.life += realT;                    // ms alive
        const fl = e.life / FRAME_MS;       // ...as 60Hz frames, for the slow sway/twinkle
        if (!e.shower) {
          // a hearth ember: rises, sways, twinkles; recycled from the bottom
          e.x += (e.vx + Math.sin(fl * e.lift + e.ph) * 0.35) * k;
          e.y += e.vy * k;
          const tw = 0.7 + 0.3 * Math.sin(fl * (e.lift * 1.7) + e.ph);
          const al = e.alpha * tw * hearthIn * Math.min(1, e.life / 1000);
          const [r, g, b] = e.cw;
          if (al > 0.005) {
            const gr = ectx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.size * 3.6);
            gr.addColorStop(0, `rgba(${r},${g},${b},${al.toFixed(3)})`);
            gr.addColorStop(0.4, `rgba(${r},${g},${b},${(al * 0.45).toFixed(3)})`);
            gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
            ectx.beginPath(); ectx.arc(e.x, e.y, e.size * 3.6, 0, Math.PI * 2); ectx.fillStyle = gr; ectx.fill();
            ectx.beginPath(); ectx.arc(e.x, e.y, e.size * 0.7, 0, Math.PI * 2);
            ectx.fillStyle = `rgba(255,244,214,${(al * 0.9).toFixed(3)})`; ectx.fill();
          }
          if (e.y < -20 || e.x < -10 || e.x > w + 10) next.push(mkHearthEmber(w, h, true)); else next.push(e);
          continue;
        }
        let al = e.alpha;
        // fast in the heart, slow at the rim: a galaxy turning; opens gently as it disperses
        stepPolar(e, k, disperse, scale);
        const rise = disperse * disperse * e.lift * 38;      // and the light lifts like embers
        al *= Math.min(1, e.life / 233) * (1 - disperse * 0.92);
        e.x = cx + Math.cos(e.a) * e.r;
        e.y = cy + Math.sin(e.a) * e.r - rise * (1 + dRaw);
        e.tr.push(e.x, e.y);
        if (e.tr.length > 20) e.tr.splice(0, 2);               // a curved trail of the last ten positions
        if (al > 0.005) {
          // born cosmic gold-white, warming to hearth amber as it lives and lifts
          const rgb = mixC(e.c0, e.cw, Math.max(smooth01(900, SHOWER_AT_MS + 800, elapsed), disperse));
          if (e.tr.length >= 4) {
            ectx.beginPath(); ectx.moveTo(e.tr[0], e.tr[1]);
            for (let i = 2; i < e.tr.length; i += 2) ectx.lineTo(e.tr[i], e.tr[i + 1]);
            ectx.strokeStyle = `rgba(${rgb},${(al * 0.38).toFixed(3)})`;
            ectx.lineWidth = Math.max(0.8, e.size * 0.7); ectx.stroke();
          }
          const gr = ectx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.size * 3.6);
          gr.addColorStop(0, `rgba(${rgb},${(al * 0.85).toFixed(3)})`);
          gr.addColorStop(1, `rgba(${rgb},0)`);
          ectx.beginPath(); ectx.arc(e.x, e.y, e.size * 3.6, 0, Math.PI * 2); ectx.fillStyle = gr; ectx.fill();
        }
        if (e.life >= e.maxLife || disperse >= 1) continue;     // gone: the hearth's embers carry on
        next.push(e);
      }
      ectx.globalCompositeOperation = 'source-over';
      embersRef.current = next;

      // The petals: carried round by the galaxy, let go by a gust, drifting down and out.
      const keep: Petal[] = [];
      for (const p of petals) {
        if (p.delay > 0) { p.delay -= realT; keep.push(p); continue; }
        p.life += realT;
        if (!p.falling) {
          p.px = p.x; p.py = p.y;
          stepPolar(p, k, 0, scale);
          p.x = cx + Math.cos(p.a) * p.r;
          p.y = cy + Math.sin(p.a) * p.r;
          if (elapsed >= p.releaseAt) {
            const kk = Math.max(k, 0.25);
            p.vx = (p.x - p.px) / kk; p.vy = (p.y - p.py) / kk;      // it leaves along the spiral
            p.falling = true; p.releasedAt = p.life;
          }
        } else {
          stepFall(p, k, (p.life - p.releasedAt) / FRAME_MS, gustX(elapsed, p.swayPh));
        }
        p.rot += p.spin * k;
        if (p.falling && isOffScreen(p, p.size, w, h)) continue;   // gone off the screen, for good
        const fade = Math.min(1, p.life / 300);
        drawPetal(ectx, { x: p.x, y: p.y, size: p.size, rot: p.rot, flip: Math.cos(p.life / FRAME_MS * p.flipSp + p.flipPh), alpha: p.alpha * fade * (p.falling ? 0.82 : 1), col: p.col });
        keep.push(p);
      }
      petals = keep;
    }

    function tickCursor(){
      const w = W(), h = H();
      if (cCanvas.width !== w || cCanvas.height !== h){ cCanvas.width = w; cCanvas.height = h; }
      cctx.clearRect(0, 0, w, h);
      const { x: mx, y: my } = mouseRef.current;
      if (mx > 0) {
        const gr = cctx.createRadialGradient(mx,my,0,mx,my,28);
        gr.addColorStop(0,'rgba(220,120,20,.2)'); gr.addColorStop(0.4,'rgba(180,80,10,.07)'); gr.addColorStop(1,'rgba(140,50,5,0)');
        cctx.beginPath(); cctx.arc(mx,my,28,0,Math.PI*2); cctx.fillStyle=gr; cctx.fill();
        cctx.beginPath(); cctx.arc(mx,my,2.5,0,Math.PI*2); cctx.fillStyle='rgba(255,220,120,.95)'; cctx.fill();
        cctx.beginPath(); cctx.arc(mx,my,1,0,Math.PI*2); cctx.fillStyle='rgba(255,255,220,1)'; cctx.fill();
      }
      sparksRef.current.forEach((p, i) => {
        p.life++; p.x += p.vx; p.y += p.vy; p.vy += 0.04;
        const fa = p.alpha * (1 - p.life / p.maxLife);
        const [r,g,b] = p.col;
        const gr2 = cctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.r*3.5);
        gr2.addColorStop(0,`rgba(${r},${g},${b},${fa})`); gr2.addColorStop(0.5,`rgba(${r},${g},${b},${fa*0.4})`); gr2.addColorStop(1,`rgba(${r},${g},${b},0)`);
        cctx.beginPath(); cctx.arc(p.x,p.y,p.r*3.5,0,Math.PI*2); cctx.fillStyle=gr2; cctx.fill();
        cctx.beginPath(); cctx.arc(p.x,p.y,p.r*0.6,0,Math.PI*2); cctx.fillStyle=`rgba(255,240,180,${fa*0.9})`; cctx.fill();
      });
      sparksRef.current = sparksRef.current.filter(p => p.life < p.maxLife);
    }

    function drawRing(radius: number, progress: number, ph: number){
      const size = Math.max(W(), H()) * 0.55;
      rCanvas.width = size; rCanvas.height = size;
      rCanvas.style.left = '50%';
      rCanvas.style.top  = '50%';
      rCanvas.style.transform = 'translate(-50%,-50%)';
      rctx.clearRect(0,0,size,size);
      const cx = size/2, cy = size/2;

      /* ambient glow -- boosted during the herald beat (elapsed passed via
         closure below) so the ring reads as lit rather than merely present
         from the very first frame, then relaxes to the original baseline. */
      const glowR = radius * 2.2;
      const heraldBoost = Math.max(0, 1 - lastElapsed / FLARE_DECAY_MS) * 0.16;
      const glowAlpha = 0.04 + heraldBoost + (radius - RING_BASE) / (RING_INHALE - RING_BASE) * 0.08;
      const grd = rctx.createRadialGradient(cx,cy,radius*0.6,cx,cy,glowR);
      grd.addColorStop(0,`rgba(180,70,10,${glowAlpha})`); grd.addColorStop(1,'rgba(180,70,10,0)');
      rctx.beginPath(); rctx.arc(cx,cy,glowR,0,Math.PI*2); rctx.fillStyle=grd; rctx.fill();

      /* dim background ring */
      rctx.save();
      rctx.beginPath(); rctx.arc(cx,cy,radius,0,Math.PI*2);
      rctx.strokeStyle='rgba(90,35,8,.3)'; rctx.lineWidth=1; rctx.stroke();
      rctx.restore();

      /* sweep arc */
      const sweep = ph === 1 ? easeInOutSine(progress) * Math.PI*2 : Math.PI*2;
      if (sweep > 0.01) {
        const startAngle = -Math.PI / 2;
        rctx.save();
        rctx.beginPath(); rctx.arc(cx,cy,radius,startAngle,startAngle+sweep);
        const arcAlpha = 0.55 + (radius - RING_BASE) / (RING_INHALE - RING_BASE) * 0.35;
        rctx.strokeStyle = `rgba(200,140,40,${arcAlpha})`;
        rctx.lineWidth = 1.2; rctx.lineCap = 'round'; rctx.stroke(); rctx.restore();

        /* leading ember dot */
        const endAngle = startAngle + sweep;
        const dotX = cx + radius * Math.cos(endAngle);
        const dotY = cy + radius * Math.sin(endAngle);
        const dotGrd = rctx.createRadialGradient(dotX,dotY,0,dotX,dotY,5);
        dotGrd.addColorStop(0,'rgba(255,220,120,.95)'); dotGrd.addColorStop(1,'rgba(255,180,60,0)');
        rctx.beginPath(); rctx.arc(dotX,dotY,5,0,Math.PI*2); rctx.fillStyle=dotGrd; rctx.fill();
        rctx.beginPath(); rctx.arc(dotX,dotY,1.5,0,Math.PI*2); rctx.fillStyle='rgba(255,255,200,1)'; rctx.fill();
      }

      /* center sigil */
      const sigilAlpha = 0.3 + (radius - RING_BASE) / (RING_INHALE - RING_BASE) * 0.35;
      rctx.save(); rctx.globalAlpha = sigilAlpha; rctx.strokeStyle='#8a6030'; rctx.lineWidth=0.7;
      rctx.beginPath(); rctx.ellipse(cx,cy,9,4.5,0,0,Math.PI*2); rctx.stroke();
      rctx.beginPath(); rctx.arc(cx,cy,2.2,0,Math.PI*2); rctx.stroke();
      rctx.beginPath(); rctx.arc(cx,cy,0.8,0,Math.PI*2); rctx.fillStyle='#8a6030'; rctx.fill();
      rctx.restore();
    }

    let currentPhaseTracked = -1;
    let lastElapsed = 0;

    function loop(ts: number){
      if (!startTimeRef.current) startTimeRef.current = ts;
      const elapsed = ts - startTimeRef.current;
      lastElapsed = elapsed;

      /* phase detection */
      let ph = PHASES.length - 1;
      for (let i = 0; i < PHASES.length; i++) {
        if (elapsed < PHASE_STARTS[i] + PHASES[i].duration){ ph = i; break; }
      }
      if (ph !== currentPhaseTracked){
        currentPhaseTracked = ph;
        setPhaseIdx(ph);
      }

      /* ring */
      if (!gateOpenRef.current) {
        const phElapsed  = elapsed - PHASE_STARTS[ph];
        const phProgress = Math.min(phElapsed / PHASES[ph].duration, 1);
        const fromTarget = ph > 0 ? PHASES[ph - 1].ringTarget : RING_BASE;
        const toTarget   = PHASES[ph].ringTarget;
        const radius = lerp(fromTarget, toTarget, easeInOutSine(phProgress));
        drawRing(radius, phProgress, ph);

        if (elapsed >= TOTAL_DURATION) openGate();
      }

      tickEmbers(elapsed);
      tickCursor();
      rafRef.current = requestAnimationFrame(loop);
    }

    initEmbers();
    rafRef.current = requestAnimationFrame(loop);

    /* mouse */
    const onMove = (e: MouseEvent) => {
      const rect = root.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      mouseRef.current = { x, y };

      // Herald only: the eye's pupil drifts toward the cursor, like it's
      // watching -- reinforces "someone is here with you" (the same
      // theme ThresholdReception's own watching-eye motif carries) right
      // from the very first frame, rather than only after the breath.
      // currentPhaseTracked is closed over from loop() above; gating on
      // it (rather than always tracking) keeps this cost-free once the
      // eye has faded and stopped rendering.
      if (currentPhaseTracked === 0 && eyeRef.current && pupilRef.current) {
        const eyeRect = eyeRef.current.getBoundingClientRect();
        const cx = eyeRect.left + eyeRect.width / 2;
        const cy = eyeRect.top + eyeRect.height / 2;
        const dx = e.clientX - cx, dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const MAX_OFFSET = 3.2; // stays within the iris ring (r=10 in the 70-unit viewBox)
        const ease = Math.min(1, dist / 140);
        pupilRef.current.style.transform =
          `translate(${(dx / dist) * MAX_OFFSET * ease}px, ${(dy / dist) * MAX_OFFSET * ease}px)`;
      }

      for (let i = 0; i < 2; i++) {
        const c = CURSOR_COLS[Math.floor(Math.random() * CURSOR_COLS.length)];
        sparksRef.current.push({ x, y, vx: (Math.random()-.5)*1.2, vy: -Math.random()*1.4-.3, r: 0.6+Math.random()*1.4, alpha: 0.7+Math.random()*0.3, col: c, life: 0, maxLife: 18+Math.floor(Math.random()*22) });
      }
    };
    const onLeave = () => { mouseRef.current = { x: -200, y: -200 }; };
    root.addEventListener('mousemove', onMove);
    root.addEventListener('mouseleave', onLeave);

    return () => {
      cancelAnimationFrame(rafRef.current);
      root.removeEventListener('mousemove', onMove);
      root.removeEventListener('mouseleave', onLeave);
    };
  }, [openGate]);

  const currentPhase = PHASES[phaseIdx];
  const heraldActive = phaseIdx === 0;

  return (
    <div ref={rootRef} style={styles.root}>
      <style>{`
        /* Herald ignition -- eye blooms out of the dark with a bright
           overshoot flare, then settles; line rises a beat behind it.
           Both hold, then fade out together as the herald phase ends. */
        @keyframes elderHeraldEyeIgnite {
          0%   { opacity: 0; transform: scale(0.4);  filter: drop-shadow(0 0 0 rgba(212,168,67,0)); }
          32%  { opacity: 1; transform: scale(1.45); filter: drop-shadow(0 0 52px rgba(255,214,140,1)) drop-shadow(0 0 110px rgba(212,168,67,0.75)); }
          52%  { opacity: 1; transform: scale(0.92); filter: drop-shadow(0 0 20px rgba(212,168,67,0.65)) drop-shadow(0 0 42px rgba(212,168,67,0.3)); }
          100% { opacity: 1; transform: scale(1);    filter: drop-shadow(0 0 14px rgba(212,168,67,0.5)) drop-shadow(0 0 30px rgba(212,168,67,0.24)); }
        }
        @keyframes elderHeraldLineRise {
          0%   { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .elder-herald {
          transition: opacity 0.55s ease;
        }
        .elder-herald-eye {
          opacity: 0;
        }
        .elder-herald--in .elder-herald-eye {
          animation: elderHeraldEyeIgnite 1.5s cubic-bezier(.3,.6,.25,1) 0.1s forwards;
        }
        /* Pupil drift toward the cursor (set imperatively via onMove in
           the effect above) -- the transition is what makes it read as a
           glance rather than a snap to position. */
        .elder-herald-pupil {
          transition: transform 0.25s ease-out;
        }
        .elder-herald-line {
          font-family: 'Cormorant Garamond', 'Gentium Plus', Georgia, serif;
          font-style: italic;
          font-size: clamp(1.15rem, 4vw, 1.6rem);
          letter-spacing: 0.02em;
          color: #f0dcae;
          text-shadow: 0 0 30px rgba(212,168,67,0.4), 0 0 60px rgba(180,100,20,0.22);
          text-align: center;
          max-width: 480px;
          padding: 0 24px;
          opacity: 0;
        }
        .elder-herald--in .elder-herald-line {
          /* Starts once the eye's bloom has visibly settled (~1s in),
             finishes rising by ~1.9s, then holds legible for a full
             second before the herald phase ends at 2.6s -- enough time
             to actually read the line, not just glimpse it. fireReflect
             (globals.css) layers on top once the rise finishes, so the
             line breathes with the same living firelight shadow every
             other Cinzel/serif heading in the app already carries,
             instead of sitting on a flat, static glow the whole time. */
          animation: elderHeraldLineRise 0.9s ease-out 1s forwards,
                     fireReflect 9s ease-in-out 1.9s infinite;
        }
      `}</style>
      {/* bgFire (an opaque dark-red radial) removed -- it hid the shared
          CeremonyGround/FireAtmosphere burning behind the breath. bgGlow
          stays: it's semi-transparent and just warms the lower field. */}
      <div style={styles.bgGlow} />

      {/* canvas layers */}
      <canvas ref={emberCanvasRef}  style={styles.canvas} />
      <canvas ref={cursorCanvasRef} style={{ ...styles.canvas, zIndex: 10 }} />
      <canvas ref={ringCanvasRef}   style={{ position:'absolute', zIndex:8, pointerEvents:'none' }} />

      {/* gate overlay */}
      <div style={{
        ...styles.overlay,
        opacity: overlayFade ? 0 : 1,
        pointerEvents: overlayFade ? 'none' : 'all',
      }}>
        {/* HERALD -- the first thing a cold visitor sees: the Elder's Eye
            ignites out of the dark with a bright bloom flare, and the hook
            line lands, all within the herald phase (PHASES[0], 1.6s). Both
            fade out together as BREATHE IN takes over -- see .elder-herald
            keyframes below. Absolutely positioned over instructionBlock so
            it doesn't shift layout when it exits. */}
        <div
          className={heraldActive ? 'elder-herald elder-herald--in' : 'elder-herald'}
          aria-hidden={!heraldActive}
          style={{
            position: 'absolute',
            inset: 0,
            opacity: heraldActive ? undefined : 0,
            pointerEvents: 'none',
          }}
        >
          {/* Eye's own centering wrapper -- kept separate from the eye svg
              itself so the ignite animation's transform:scale() (applied to
              .elder-herald-eye below) doesn't clobber this translate and
              knock the eye off the ring's true center. */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }}>
          <svg ref={eyeRef} viewBox="60 28 560 560" fill="none" width="72" height="72" className="elder-herald-eye">
            {/* THE ELDER sigil (the-elder-sigil-dark.svg v1.2) -- diamond
                frame + almond eye, recolored to the herald's gold/rust
                palette. Same signed paths as ElderLogoMark; only the
                pupil (iris fill + catchlight) is grouped so it can still
                drift toward the cursor via onMove above. */}
            <defs>
              <clipPath id="herald-eye-almond">
                <path d="M 102,308 C 208,196 464,197 578,312 C 464,415 208,419 102,308 Z" />
              </clipPath>
            </defs>
            <polygon points="340,72 578,308 340,544 102,308" fill="none" stroke="#d4a843" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
            <polygon points="340,66 344.2,72 340,78 335.8,72" fill="#d4a843" />
            <polygon points="572,308 578,312.2 584,308 578,303.8" fill="#d4a843" />
            <polygon points="340,538 344.2,544 340,550 335.8,544" fill="#d4a843" />
            <polygon points="96,308 102,312.2 108,308 102,303.8" fill="#d4a843" />
            <path d="M 148,252 C 205,216 265,192 308,188 C 358,190 432,208 528,250" fill="none" stroke="#d4a843" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="340" cy="304" r="88" fill="rgba(200,96,26,0.18)" clipPath="url(#herald-eye-almond)" />
            {/* Pupil group -- drifts toward the cursor via onMove above,
                so the eye reads as watching rather than a static glyph. */}
            <g ref={pupilRef} className="elder-herald-pupil">
              <circle cx="335" cy="300" r="40" fill="#050302" clipPath="url(#herald-eye-almond)" />
              <ellipse cx="322" cy="306" rx="3.5" ry="2.5" fill="#d4a843" opacity="0.7" transform="rotate(-15,322,306)" clipPath="url(#herald-eye-almond)" />
            </g>
            <path d="M 102,308 C 208,196 464,197 578,312" fill="none" stroke="#d4a843" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 102,308 C 208,419 464,415 578,312" fill="none" stroke="#d4a843" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          </div>
          {/* Line sits below the ring on its own centering wrapper, clear
              of the eye's translate above, so it never pulls the eye's
              apparent center off the ring. */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, 64px)' }}>
          <p className="elder-herald-line">{t('breath.herald')}</p>
          </div>
        </div>

        {/* breath instruction */}
        <div style={styles.instructionBlock}>
          <p style={{
            ...styles.breathWord,
            opacity: wordVisible && currentPhase.label ? 1 : 0,
          }}>
            {currentPhase.label ? t(currentPhase.label) : ''}
          </p>
          <p style={{
            ...styles.breathSub,
            opacity: subVisible && currentPhase.sub ? 0.7 : 0,
          }}>
            {currentPhase.sub ? t(currentPhase.sub) : ''}
          </p>
        </div>

        {/* skip */}
        <button
          onClick={openGate}
          className="breath-gate-skip-link"
          style={{
            ...styles.skipLink,
            opacity: skipVisible ? 1 : 0,
          }}
        >
          {t('breath.skip')} &nbsp;&rsaquo;
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   STYLES
───────────────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    // Transparent -- CeremonyGround + FireAtmosphere (root layout) burn
    // behind the breath now, so the fire the seeker breathes on is the
    // same fire that's still there when the gate opens and the front-door
    // ask appears. Was an opaque '#0a0503' fire-world that reset on handoff.
    background: 'transparent',
    overflow: 'hidden',
    cursor: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgGlow: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(ellipse 60% 40% at 50% 85%, rgba(150,55,0,0.28) 0%, transparent 70%)',
    zIndex: 1,
  },
  canvas: {
    position: 'absolute', inset: 0,
    zIndex: 2,
    pointerEvents: 'none',
  },
  overlay: {
    position: 'absolute', inset: 0,
    zIndex: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    transition: `opacity ${TRANSITION_MS}ms ease`,
  },
  instructionBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
    minHeight: 80,
    justifyContent: 'center',
  },
  breathWord: {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: 22,
    letterSpacing: '0.32em',
    color: '#c8933a',
    textAlign: 'center',
    marginBottom: 6,
    minHeight: 34,
    transition: 'opacity .8s ease',
  },
  breathSub: {
    fontFamily: "'Gentium Plus', Georgia, serif",
    fontStyle: 'italic',
    fontSize: 16,
    letterSpacing: '0.12em',
    color: '#a87c38',
    textAlign: 'center',
    marginBottom: 0,
    minHeight: 24,
    transition: 'opacity .6s ease',
  },
  skipLink: {
    position: 'absolute',
    bottom: 32,
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: 15,
    letterSpacing: '0.22em',
    color: '#c8860a',
    background: 'rgba(10,8,6,0.55)',
    border: '1px solid rgba(200,134,10,0.35)',
    borderRadius: 4,
    padding: '10px 22px',
    // The only interactive control in a screen that otherwise hides the
    // system cursor on purpose (breath-gate ritual) -- a mouse user needs
    // to see the pointer here to find it. cursor: 'auto' alone would lose
    // to the global `* { cursor: none !important; }` rule in globals.css;
    // .breath-gate-skip-link below carries the !important override.
    cursor: 'pointer',
    transition: 'opacity 1.2s ease',
  },
};
