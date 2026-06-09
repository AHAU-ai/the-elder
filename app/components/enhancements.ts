/*
  The Elder — Enhancement hooks
  ──────────────────────────────
  Drop-in JS/TS functions for enhancements 2, 3, 4, 5, 7, 8, 12.
  Import and call these inside Threshold.tsx at the right points.

  Usage:
    import {
      initTouchEmbers,
      initQuestionPulse,
      initPlaceholderCycle,
      initScrollFire,
      initWebAudio,
      applyFirstFlicker,
    } from './enhancements';
*/

/* ── Enhancement 2: Touch ember trail ── */
export function initTouchEmbers(): () => void {
  if (typeof window === 'undefined') return () => {};
  function onTouch(e: TouchEvent) {
    Array.from(e.changedTouches).forEach(touch => {
      const el = document.createElement('div');
      el.className = 'touch-ember';
      el.style.left = touch.clientX + 'px';
      el.style.top  = touch.clientY + 'px';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 520);
    });
  }
  window.addEventListener('touchmove', onTouch, { passive: true });
  return () => window.removeEventListener('touchmove', onTouch);
}

/* ── Enhancement 3: Question pulse — one question brightens every 8s ── */
export function initQuestionPulse(selector: string): () => void {
  if (typeof window === 'undefined') return () => {};
  let current = -1;
  let timer: ReturnType<typeof setInterval>;

  function pulse() {
    const cards = document.querySelectorAll<HTMLElement>(selector);
    if (!cards.length) return;
    /* Remove previous */
    if (current >= 0 && cards[current]) {
      cards[current].classList.remove('elder-q-pulse');
          cards[current].style.opacity = '';
    }
    /* Pick next */
    current = (current + 1) % cards.length;
    cards[current].classList.add('elder-q-pulse');
    /* Remove class after animation completes */
    setTimeout(() => {
      if (cards[current]) {
        cards[current].classList.remove('elder-q-pulse');
        cards[current].style.opacity = '';
      }
    }, 1800);
  }

  timer = setInterval(pulse, 8000);
  return () => clearInterval(timer);
}

/* ── Enhancement 4: Breathing placeholder cycle ── */
const PLACEHOLDERS = [
  'Or speak freely: describe what you are living through...',
  'The fire is listening.',
  'Speak your truth here.',
];

export function initPlaceholderCycle(inputEl: HTMLInputElement | null): () => void {
  if (!inputEl || typeof window === 'undefined') return () => {};
  let idx = 0;
  let timer: ReturnType<typeof setInterval>;

  function cycle() {
    /* Only cycle if the field is empty and unfocused */
    if (document.activeElement === inputEl || inputEl.value.length > 0) return;
    idx = (idx + 1) % PLACEHOLDERS.length;
    inputEl.style.transition = 'opacity 0.6s ease';
    inputEl.style.opacity = '0';
    setTimeout(() => {
      inputEl.placeholder = PLACEHOLDERS[idx];
      inputEl.style.opacity = '';
    }, 620);
  }

  timer = setInterval(cycle, 8000);
  return () => clearInterval(timer);
}

/* ── Enhancement 5: CONSULT button pre-ignition state ── */
export function watchConsultReady(
  inputEl: HTMLInputElement | null,
  buttonEl: HTMLButtonElement | null
): () => void {
  if (!inputEl || !buttonEl) return () => {};
  function check() {
    if (inputEl.value.trim().length > 0) {
      buttonEl.classList.add('elder-consult-ready');
    } else {
      buttonEl.classList.remove('elder-consult-ready');
    }
  }
  inputEl.addEventListener('input', check);
  return () => inputEl.removeEventListener('input', check);
}

/* ── Enhancement 7: Lineage tone on hover (Web Audio) ── */
const LINEAGE_FREQS: Record<string, number> = {
  mayan:      174,
  greek:      396,
  egyptian:   417,
  vedic:      528,
  yoruba:     639,
  sufi:       741,
  aboriginal: 285,
  nordic:     852,
};

let audioCtx: AudioContext | null = null;

export function playLineageTone(lineageKey: string): void {
  if (typeof window === 'undefined') return;
  const freq = LINEAGE_FREQS[lineageKey];
  if (!freq) return;
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    /* Soft attack, quick decay — like a bowl strike */
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.5);
  } catch { /* AudioContext blocked — silent fail */ }
}

/* ── Enhancement 8: Scroll fire intensity ── */
export function initScrollFire(rootEl: HTMLElement | null): () => void {
  if (!rootEl || typeof window === 'undefined') return () => {};
  function onScroll() {
    const scrolled = window.scrollY > 80;
    rootEl.classList.toggle('elder-fire-deep', scrolled);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}

/* ── Enhancement 9: First-load title flicker ── */
export function applyFirstFlicker(el: HTMLElement | null): void {
  if (!el) return;
  if (sessionStorage.getItem('elder_flickered')) return;
  el.classList.add('elder-first-flicker');
  sessionStorage.setItem('elder_flickered', '1');
  setTimeout(() => el.classList.remove('elder-first-flicker'), 420);
}

/* ── Enhancement 12: Set lang=mul on html element ── */
export function setMultilingualLang(): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = 'mul';
  }
}


/* ── Enhancement 13: Background ember sparks ── */
export function initEmberSparks(container: HTMLElement): () => void {
  const sparks: HTMLElement[] = [];
  const MAX = 38;

  function spawnSpark() {
    if (sparks.length >= MAX) return;
    const el = document.createElement('div');
    el.className = 'bg-ember-spark';
    const x = Math.random() * 100;
    const dur = 10 + Math.random() * 10;
    const size = 2 + Math.random() * 3;
    const driftX = (Math.random() - 0.5) * 140;
    const riseVh = 30 + Math.random() * 55;
    const dipPx  = Math.random() < 0.3 ? (Math.random() * 18) : 0;
    const sway   = (Math.random() - 0.5) * 40;
    el.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'border-radius:50%',
      'z-index:2',
      'will-change:transform,opacity',
      'left:' + x + 'vw',
      'bottom:-8px',
      'width:' + size + 'px',
      'height:' + size + 'px',
      'background:radial-gradient(circle,#fff7e0 0%,#ffb347 40%,#c8601a 80%,transparent 100%)',
      'box-shadow:0 0 ' + (size*3) + 'px #ffb347,0 0 ' + (size*6) + 'px rgba(200,96,26,0.5)',
      '--drift:' + driftX + 'px',
      '--rise:' + riseVh + 'vh',
      '--dip:' + dipPx + 'px',
      '--sway:' + sway + 'px',
      'animation:emberFloat ' + dur + 's ease-in-out forwards',
    ].join(';');
    container.appendChild(el);
    sparks.push(el);
    setTimeout(() => {
      el.remove();
      const idx = sparks.indexOf(el);
      if (idx > -1) sparks.splice(idx, 1);
    }, dur * 1000);
  }

  const interval = setInterval(spawnSpark, 700);
  for (let i = 0; i < 12; i++) setTimeout(spawnSpark, i * 80);

  return () => {
    clearInterval(interval);
    sparks.forEach(s => s.remove());
    sparks.length = 0;
  };
}

/* ── Enhancement 14: Fire cursor ── */
export function initFireCursor(): () => void {
  if (typeof document === 'undefined') return () => {};

  // Singleton cursor element — create once, reuse always
  let cursor = document.getElementById('fire-cursor') as HTMLElement | null;
  if (!cursor) {
    cursor = document.createElement('div');
    cursor.id = 'fire-cursor';
    cursor.style.cssText = [
      'position:fixed','pointer-events:none','z-index:9999','width:28px','height:28px',
      'border-radius:50%','transform:translate(-50%,-50%)',
      'background:radial-gradient(circle,rgba(255,140,60,0.82) 0%,rgba(215,80,20,0.58) 42%,rgba(150,40,8,0.22) 70%,transparent 100%)',
      'box-shadow:0 0 10px rgba(215,80,20,0.8),0 0 22px rgba(170,50,8,0.5),0 0 42px rgba(130,35,5,0.18)',
      'opacity:0',
    ].join(';');
    document.body.appendChild(cursor);
  }

  const trail: HTMLElement[] = [];

  function onMove(e: MouseEvent) {
    cursor!.style.left = e.clientX + 'px';
    cursor!.style.top = e.clientY + 'px';
    cursor!.style.opacity = '1';
    const size = 3 + Math.random() * 4;
    const spark = document.createElement('div');
    spark.style.cssText = [
      'position:fixed','pointer-events:none','z-index:9998','border-radius:50%',
      'width:' + size + 'px','height:' + size + 'px',
      'left:' + (e.clientX + (Math.random()-0.5)*14) + 'px',
      'top:' + (e.clientY + (Math.random()-0.5)*14) + 'px',
      'transform:translate(-50%,-50%)',
      'background:radial-gradient(circle,rgba(255,130,50,0.88) 0%,rgba(205,70,15,0.48) 55%,transparent 100%)',
      'box-shadow:0 0 6px rgba(215,80,20,0.75)',
      'animation:cursorEmber 0.6s ease-out forwards',
    ].join(';');
    document.body.appendChild(spark);
    trail.push(spark);
    setTimeout(() => { spark.remove(); const i = trail.indexOf(spark); if (i > -1) trail.splice(i, 1); }, 600);
    if (trail.length > 20) { trail[0].remove(); trail.shift(); }
  }

  document.addEventListener('mousemove', onMove);
  return () => {
    document.removeEventListener('mousemove', onMove);
    trail.forEach(s => s.remove());
    trail.length = 0;
    // Keep the cursor element in the DOM — layout remounts it globally
  };
}


/* -- Layer 1: Generative Hearth Fire (Web Audio, no files) -- */
export interface HearthFireControl {
  start: () => void;
  stop: () => void;
  setMuted: (muted: boolean) => void;
  isRunning: () => boolean;
}

export function initHearthFire(): HearthFireControl {
  if (typeof window === 'undefined') {
    return { start: () => {}, stop: () => {}, setMuted: () => {}, isRunning: () => false };
  }

  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let running = false;
  let muted = false;
  let crackleTimer: ReturnType<typeof setTimeout> | null = null;
  let drumTimer: ReturnType<typeof setTimeout> | null = null;

  function buildGraph() {
    ctx = new AudioContext();
    ctx.resume();
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    if (!muted) {
      masterGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 3.5);
    }
    masterGain.connect(ctx.destination);
    running = true;
    scheduleCrackle();
    scheduleDrum();
  }

  function fireBurst() {
    if (!ctx || !masterGain || !running) return;
    const now = ctx.currentTime;
    const burstLen = 0.02 + Math.random() * 0.035;
    const bufSize  = Math.floor(ctx.sampleRate * burstLen);
    const buf      = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data     = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) { data[i] = (Math.random() * 2 - 1); }
    const src2 = ctx.createBufferSource();
    src2.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(900 + Math.random() * 400, now);
    bp.Q.setValueAtTime(4 + Math.random() * 3, now);
    const g = ctx.createGain();
    const peak = 0.025 + Math.random() * 0.04;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.010);
    g.gain.exponentialRampToValueAtTime(0.001, now + burstLen);
    src2.connect(bp);
    bp.connect(g);
    g.connect(masterGain);
    src2.start(now);
    src2.stop(now + burstLen + 0.01);
  }

  function scheduleCrackle() {
    if (!running) return;
    fireBurst();
    const next = 200 + Math.random() * 400;
    crackleTimer = setTimeout(scheduleCrackle, next);
  }

  function drumBeat(time: number, gain: number) {
    if (!ctx || !masterGain) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(58, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.18);
    const clickBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.012), ctx.sampleRate);
    const cd = clickBuf.getChannelData(0);
    for (let i = 0; i < cd.length; i++) cd[i] = Math.random() * 2 - 1;
    const click = ctx.createBufferSource();
    click.buffer = clickBuf;
    const clickBp = ctx.createBiquadFilter();
    clickBp.type = 'bandpass';
    clickBp.frequency.setValueAtTime(180, time);
    clickBp.Q.setValueAtTime(0.8, time);
    const clickG = ctx.createGain();
    clickG.gain.setValueAtTime(gain * 0.35, time);
    clickG.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
    click.connect(clickBp);
    clickBp.connect(clickG);
    clickG.connect(masterGain);
    click.start(time);
    click.stop(time + 0.04);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.55);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(time);
    osc.stop(time + 0.6);
  }

  function scheduleDrum() {
    if (!ctx || !running) return;
    const now = ctx.currentTime;
    drumBeat(now,        0.32);
    drumBeat(now + 0.21, 0.22);
    drumTimer = setTimeout(scheduleDrum, 3000);
  }

  function start() {
    if (running) return;
    try { buildGraph(); } catch { /* AudioContext blocked -- silent fail */ }
  }

  function stop() {
    if (!running) return;
    running = false;
    if (crackleTimer) { clearTimeout(crackleTimer); crackleTimer = null; }
    if (drumTimer)    { clearTimeout(drumTimer);    drumTimer    = null; }
    if (masterGain && ctx) {
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
      setTimeout(() => { try { ctx?.close(); } catch {} ctx = null; masterGain = null; }, 1300);
    }
  }

  function setMuted(m: boolean) {
    muted = m;
    if (!masterGain || !ctx) return;
    if (m) { masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4); }
    else   { masterGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 0.4); }
  }

  function isRunning() { return running; }
  return { start, stop, setMuted, isRunning };
}
