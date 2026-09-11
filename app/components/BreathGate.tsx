'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { TRANSITION_MS } from '../../lib/transitions';
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

// The hook line for the herald beat. A direct question, not a statement --
// pulls a seeker in by naming the thing they're already privately asking,
// rather than asserting a claim at them before they've engaged at all.
const HERALD_LINE = 'What myth is living through you?';

const PHASES = [
  { duration: 3400, label: '',            sub: '',                      ringTarget: RING_BASE   },
  { duration: 5000, label: 'BREATHE IN',  sub: 'slowly, from the belly', ringTarget: RING_INHALE },
  { duration: 3000, label: 'HOLD',        sub: '',                      ringTarget: RING_INHALE },
  { duration: 6000, label: 'BREATHE OUT', sub: 'let it all go',         ringTarget: RING_BASE   },
  { duration: 2000, label: '',            sub: '',                      ringTarget: RING_BASE   },
];

const PHASE_STARTS = PHASES.reduce<number[]>((acc, p, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + PHASES[i - 1].duration);
  return acc;
}, []);
const TOTAL_DURATION = PHASE_STARTS[PHASES.length - 1] + PHASES[PHASES.length - 1].duration;

/* ─────────────────────────────────────────────
   EMBER TYPES
───────────────────────────────────────────── */
type Ember = {
  x: number; y: number; vx: number; vy: number;
  r: number; alpha: number;
  tw: number; twO: number;
  df: number; da: number; dp: number;
  col: [number, number, number];
  life: number; maxLife: number; t: number;
};

type CursorSpark = {
  x: number; y: number; vx: number; vy: number;
  r: number; alpha: number;
  col: [number, number, number];
  life: number; maxLife: number;
};

const EMBER_COLS: [number, number, number][] = [
  [255,80,10],[255,130,20],[255,170,50],[255,210,90],[255,240,160],[200,50,5],
];
const CURSOR_COLS: [number, number, number][] = [
  [255,200,80],[255,160,40],[255,120,20],[255,80,10],[220,140,30],
];

function rand(a: number, b: number){ return a + Math.random() * (b - a); }

function mkEmber(fromBot: boolean, W: number, H: number): Ember {
  const col = EMBER_COLS[Math.floor(Math.random() * EMBER_COLS.length)];
  return {
    x: W * 0.25 + Math.random() * W * 0.5,
    y: fromBot ? H + 10 : H * 0.3 + Math.random() * H * 0.6,
    vx: rand(-0.6, 0.6), vy: rand(-0.9, -0.25),
    r: rand(0.8, 2.6), alpha: rand(0.3, 1.0),
    tw: rand(0.02, 0.06), twO: rand(0, Math.PI * 2),
    df: rand(0.008, 0.025), da: rand(0.2, 0.9), dp: rand(0, Math.PI * 2),
    col, life: 0, maxLife: rand(120, 340), t: 0,
  };
}

// Opening flare: the herald beat gets a denser, brighter bed of embers that
// decays to the normal baseline density/brightness by the time BREATHE IN
// starts. A cold-open screen that's 90% empty for a beat reads as "nothing
// loaded" rather than "ceremony" -- this front-loads the visual so there's
// something alive on screen from frame one, then settles back into the
// slower rhythm the rest of the gate is built on.
const FLARE_EMBER_COUNT = 110;
// Matches the herald phase's own duration (PHASES[0]) so the flare finishes
// settling right as BREATHE IN begins, instead of visibly decaying for a
// beat after the herald content has already faded out.
const FLARE_DECAY_MS = 3400;

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
  const rootRef         = useRef<HTMLDivElement>(null);
  const emberCanvasRef  = useRef<HTMLCanvasElement>(null);
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null);
  const ringCanvasRef   = useRef<HTMLCanvasElement>(null);
  const rafRef          = useRef<number>(0);
  const eyeRef          = useRef<SVGSVGElement>(null);
  const pupilRef        = useRef<SVGGElement>(null);

  const embersRef  = useRef<Ember[]>([]);
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
  const openGate = useCallback(() => {
    if (gateOpenRef.current) return;
    gateOpenRef.current = true;
    setOverlayFade(true);
    // Coordinated to the shared transition constant (lib/transitions.ts)
    // so Threshold's own entrance fade on the other side of this handoff
    // -- previously an uncoordinated, independent number -- now agrees
    // with this fade-out's duration instead of merely being close to it.
    setTimeout(() => onComplete(), TRANSITION_MS);
  }, [onComplete]);

  /* ── show skip link after 2.4s -- scaled with the slower, meditative
     pacing so it still appears roughly a third of the way into the herald
     beat rather than rushing in against the new, longer rhythm. ── */
  useEffect(() => {
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

    /* init embers -- flare-dense at start, thins out to the normal 40
       once FLARE_DECAY_MS has passed (see tickEmbers' flareBoost). */
    function initEmbers(){
      eCanvas.width = W(); eCanvas.height = H();
      embersRef.current = Array.from({ length: FLARE_EMBER_COUNT }, () => {
        const e = mkEmber(false, W(), H());
        e.life = Math.floor(Math.random() * e.maxLife);
        return e;
      });
    }

    function tickEmbers(elapsed: number){
      const w = W(), h = H();
      if (eCanvas.width !== w || eCanvas.height !== h){ eCanvas.width = w; eCanvas.height = h; }
      ectx.clearRect(0, 0, w, h);
      // 1 at t=0 (bright flare), settling to 0 by FLARE_DECAY_MS (baseline).
      const flare = Math.max(0, 1 - elapsed / FLARE_DECAY_MS);
      const flareBrightness = 1 + flare * 1.1;
      // Built fresh each frame rather than spliced in place -- splicing
      // embersRef.current mid-forEach shifted later elements down an index,
      // which caused forEach to skip ticking whatever slid into the removed
      // slot (one ember silently un-drawn per cull). Filtering into a new
      // array after the full pass avoids that without changing the settle
      // behavior: extra embers still only disappear once the flare has
      // decayed and they've naturally expired, never respawned past that.
      const next: Ember[] = [];
      embersRef.current.forEach((e) => {
        e.life++; e.t++;
        e.x += e.vx + Math.sin(e.t * e.df + e.dp) * e.da;
        e.y += e.vy;
        const tw = 0.7 + 0.3 * Math.sin(e.t * e.tw + e.twO);
        const lr = e.life / e.maxLife;
        const ba = lr < 0.15 ? lr / 0.15 : lr > 0.7 ? (1 - lr) / 0.3 : 1;
        const fa = Math.min(1, e.alpha * ba * tw * flareBrightness);
        const [r, g, b] = e.col;
        const grd = ectx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 3.5);
        grd.addColorStop(0, `rgba(${r},${g},${b},${fa})`);
        grd.addColorStop(0.4, `rgba(${r},${g},${b},${fa * 0.5})`);
        grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ectx.beginPath(); ectx.arc(e.x, e.y, e.r * 3.5, 0, Math.PI*2); ectx.fillStyle = grd; ectx.fill();
        ectx.beginPath(); ectx.arc(e.x, e.y, e.r * 0.7, 0, Math.PI*2); ectx.fillStyle = `rgba(255,240,200,${fa*0.9})`; ectx.fill();
        if (e.life >= e.maxLife || e.y < -20 || e.x < 0 || e.x > w) {
          // Once the flare has decayed, cull the extra embers back down to
          // the baseline 40 as they naturally expire, instead of respawning
          // them -- keeps the settle gradual rather than a visible snap.
          if (flare <= 0 && embersRef.current.length > 40) {
            return; // drop this ember, don't push a replacement
          }
          next.push(mkEmber(true, w, h));
        } else {
          next.push(e);
        }
      });
      embersRef.current = next;
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
          margin-bottom: 22px;
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
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            opacity: heraldActive ? undefined : 0,
            pointerEvents: 'none',
          }}
        >
          <svg ref={eyeRef} viewBox="0 0 70 70" fill="none" width="72" height="72" className="elder-herald-eye">
            <circle cx="35" cy="35" r="32" stroke="#d4a843" strokeWidth="0.5" strokeDasharray="4 6" opacity="0.4" />
            <path d="M4 35 Q35 7 66 35 Q35 63 4 35Z" stroke="#d4a843" strokeWidth="1.2" fill="rgba(212,168,67,0.04)" />
            <circle cx="35" cy="35" r="10" stroke="#c8601a" strokeWidth="1" fill="rgba(200,96,26,0.09)" />
            {/* Pupil group -- drifts toward the cursor via onMove above,
                so the eye reads as watching rather than a static glyph. */}
            <g ref={pupilRef} className="elder-herald-pupil">
              <circle cx="35" cy="35" r="5" fill="#d4a843" opacity="0.95" />
              <circle cx="35" cy="35" r="2.2" fill="#050302" />
            </g>
          </svg>
          <p className="elder-herald-line">{HERALD_LINE}</p>
        </div>

        {/* breath instruction */}
        <div style={styles.instructionBlock}>
          <p style={{
            ...styles.breathWord,
            opacity: wordVisible && currentPhase.label ? 1 : 0,
          }}>
            {currentPhase.label}
          </p>
          <p style={{
            ...styles.breathSub,
            opacity: subVisible && currentPhase.sub ? 0.7 : 0,
          }}>
            {currentPhase.sub}
          </p>
        </div>

        {/* skip */}
        <button
          onClick={openGate}
          style={{
            ...styles.skipLink,
            opacity: skipVisible ? 1 : 0,
          }}
        >
          already know this place &nbsp;&rsaquo;
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
    cursor: 'none',
    transition: 'opacity 1.2s ease',
  },
};
