'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

/* ─────────────────────────────────────────────
   BREATH SEQUENCE
   Phase 0 — silence      1.2s  — embers only, ring at rest
   Phase 1 — BREATHE IN   4.0s  — ring expands, arc sweeps
   Phase 2 — HOLD         2.0s  — ring holds at peak
   Phase 3 — BREATHE OUT  4.0s  — ring contracts
   Phase 4 — silence      1.2s  — ring rests
   → gate dissolves, threshold reveals
───────────────────────────────────────────── */
const RING_BASE   = 38;
const RING_INHALE = 88;

const PHASES = [
  { duration: 1200, label: '',            sub: '',                      ringTarget: RING_BASE   },
  { duration: 4000, label: 'BREATHE IN',  sub: 'slowly, from the belly', ringTarget: RING_INHALE },
  { duration: 2000, label: 'HOLD',        sub: '',                      ringTarget: RING_INHALE },
  { duration: 4000, label: 'BREATHE OUT', sub: 'let it all go',         ringTarget: RING_BASE   },
  { duration: 1200, label: '',            sub: '',                      ringTarget: RING_BASE   },
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
    setTimeout(() => onComplete(), 1400);
  }, [onComplete]);

  /* ── show skip link after 1.8s ── */
  useEffect(() => {
    const t = setTimeout(() => setSkipVisible(true), 1800);
    return () => clearTimeout(t);
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

    /* init embers */
    function initEmbers(){
      eCanvas.width = W(); eCanvas.height = H();
      embersRef.current = Array.from({ length: 40 }, () => {
        const e = mkEmber(false, W(), H());
        e.life = Math.floor(Math.random() * e.maxLife);
        return e;
      });
    }

    function tickEmbers(){
      const w = W(), h = H();
      if (eCanvas.width !== w || eCanvas.height !== h){ eCanvas.width = w; eCanvas.height = h; }
      ectx.clearRect(0, 0, w, h);
      embersRef.current.forEach((e, i) => {
        e.life++; e.t++;
        e.x += e.vx + Math.sin(e.t * e.df + e.dp) * e.da;
        e.y += e.vy;
        const tw = 0.7 + 0.3 * Math.sin(e.t * e.tw + e.twO);
        const lr = e.life / e.maxLife;
        const ba = lr < 0.15 ? lr / 0.15 : lr > 0.7 ? (1 - lr) / 0.3 : 1;
        const fa = e.alpha * ba * tw;
        const [r, g, b] = e.col;
        const grd = ectx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 3.5);
        grd.addColorStop(0, `rgba(${r},${g},${b},${fa})`);
        grd.addColorStop(0.4, `rgba(${r},${g},${b},${fa * 0.5})`);
        grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ectx.beginPath(); ectx.arc(e.x, e.y, e.r * 3.5, 0, Math.PI*2); ectx.fillStyle = grd; ectx.fill();
        ectx.beginPath(); ectx.arc(e.x, e.y, e.r * 0.7, 0, Math.PI*2); ectx.fillStyle = `rgba(255,240,200,${fa*0.9})`; ectx.fill();
        if (e.life >= e.maxLife || e.y < -20 || e.x < 0 || e.x > w) {
          embersRef.current[i] = mkEmber(true, w, h);
        }
      });
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

      /* ambient glow */
      const glowR = radius * 2.2;
      const glowAlpha = 0.04 + (radius - RING_BASE) / (RING_INHALE - RING_BASE) * 0.08;
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

    function loop(ts: number){
      if (!startTimeRef.current) startTimeRef.current = ts;
      const elapsed = ts - startTimeRef.current;

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

      tickEmbers();
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

  return (
    <div ref={rootRef} style={styles.root}>
      <div style={styles.bgFire} />
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
    background: '#0a0503',
    overflow: 'hidden',
    cursor: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgFire: {
    position: 'absolute', inset: 0,
    background: `
      radial-gradient(ellipse 70% 60% at 50% 100%, #5c1a00 0%, #3a0e00 25%, #1a0700 55%, #0a0503 100%),
      radial-gradient(ellipse 40% 30% at 50% 90%, #7a2800 0%, transparent 70%)
    `,
    zIndex: 0,
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
    transition: 'opacity 1.4s ease',
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
    fontSize: 15,
    letterSpacing: '0.12em',
    color: '#7a5025',
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
