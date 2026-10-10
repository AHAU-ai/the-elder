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

/* ── BreathGate herald: ignition chime ──
   A single soft, low bell struck at the moment the Elder's Eye ignites,
   reusing the same module-level audioCtx/gain-envelope shape as
   playLineageTone above (a bowl-strike attack/decay), just lower and
   slightly longer to read as an opening note rather than a UI blip.
   Silently no-ops before any user gesture has unlocked audio (autoplay
   policy) -- purely a progressive touch, the herald reads fine without it. */
export function playIgnitionChime(): void {
  if (typeof window === 'undefined') return;
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') return; // no gesture yet -- skip rather than force a resume the browser will ignore anyway
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const sub = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); sub.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine'; sub.type = 'sine';
    osc.frequency.setValueAtTime(196, now);       // G3 — low, warm
    sub.frequency.setValueAtTime(98, now);        // octave under, for body
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);
    osc.start(now); sub.start(now);
    osc.stop(now + 2.3); sub.stop(now + 2.3);
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
// Refcounted module-level singleton, same pattern as acquireHearthFire /
// releaseHearthFire above. FireAtmosphere is mounted more than once at a
// time by design (the persistent root-layout instance plus each phase's own
// instance in Threshold), and initFireCursor used to attach a brand-new
// `document.addEventListener('mousemove', ...)` on every single call --
// the DOM cursor element was deduped via getElementById, but the listener
// (and its own independent throttle timer and spark trail) was not. With
// two mounts alive, as is normal here, every physical mouse move did the
// work -- and spawned sparks -- twice. Only the first caller now does any
// real work; later callers just bump the refcount and get a no-op cleanup.
let _cursorRefs = 0;
let _cursorTeardown: (() => void) | null = null;

export function initFireCursor(): () => void {
  if (typeof document === 'undefined') return () => {};

  _cursorRefs++;
  if (_cursorRefs > 1) {
    // Already attached by an earlier caller -- nothing more to do, but
    // still return a real cleanup so this caller's own unmount decrements
    // the shared refcount correctly.
    let released = false;
    return () => {
      if (released) return;
      released = true;
      _cursorRefs = Math.max(0, _cursorRefs - 1);
      if (_cursorRefs === 0 && _cursorTeardown) {
        _cursorTeardown();
        _cursorTeardown = null;
      }
    };
  }

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
      // The orb swells over anything clickable (see onMove) so it still says
      // "this responds" now that the system pointer is hidden.
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? '' : 'transition:transform 0.18s ease',
    ].join(';');
    document.body.appendChild(cursor);
  }

  const trail: HTMLElement[] = [];
  // A fast mouse move can fire mousemove dozens of times a second, and this
  // handler used to create a brand-new spark element on every single one --
  // unthrottled DOM churn (create, append, animate, remove) on the hottest
  // event in the browser, which bogs down the main thread and reads as
  // general sluggishness, not just a laggy cursor. The orb's own position
  // update below (two style writes) is cheap and stays on every event, for
  // maximum tracking responsiveness; only the expensive part -- spawning a
  // new element -- is capped to a steady rate.
  let lastSparkTime = 0;
  const SPARK_INTERVAL_MS = 30;
  let cursorHot = false;

  function onMove(e: MouseEvent) {
    cursor!.style.left = e.clientX + 'px';
    cursor!.style.top = e.clientY + 'px';
    cursor!.style.opacity = '1';

    const hot = e.target instanceof Element
      && !!e.target.closest('button:not(:disabled), a[href], input, textarea, select, [role="button"]');
    if (hot !== cursorHot) {
      cursorHot = hot;
      cursor!.style.transform = hot ? 'translate(-50%,-50%) scale(1.45)' : 'translate(-50%,-50%)';
    }

    const now = performance.now();
    if (now - lastSparkTime < SPARK_INTERVAL_MS) return;
    lastSparkTime = now;

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
  let released = false;
  _cursorTeardown = () => {
    document.removeEventListener('mousemove', onMove);
    trail.forEach(s => s.remove());
    trail.length = 0;
  };
  return () => {
    if (released) return;
    released = true;
    _cursorRefs = Math.max(0, _cursorRefs - 1);
    if (_cursorRefs === 0 && _cursorTeardown) {
      _cursorTeardown();
      _cursorTeardown = null;
    }
    // Keep the cursor element in the DOM — layout remounts it globally
  };
}


/* -- Layer 1: Generative Hearth Fire (Web Audio, no files) -- */
export interface HearthFireControl {
  start: () => void;
  stop: () => void;
  setMuted: (muted: boolean) => void;
  isRunning: () => boolean;
  /** Re-attempt resume — call on first user gesture in case autoplay policy blocked it at start(). */
  resume: () => void;
}

export function initHearthFire(): HearthFireControl {
  if (typeof window === 'undefined') {
    return { start: () => {}, stop: () => {}, setMuted: () => {}, isRunning: () => false, resume: () => {} };
  }

  let ctx: AudioContext | null = null;
  let masterGain: GainNode | null = null;
  let droneNodes: { oscs: OscillatorNode[]; gain: GainNode } | null = null;
  let running = false;
  let muted = false;
  let crackleTimer: ReturnType<typeof setTimeout> | null = null;
  let drumTimer: ReturnType<typeof setTimeout> | null = null;
  let droneHapticTimer: ReturnType<typeof setInterval> | null = null;
  // The hearth bus: every crackle and the fire bed pass through one warm
  // chain (soft top-end roll-off, a gentle low-mid bloom, and a little room
  // reverb) so the fire sounds like it is burning in a stone hall, not a speaker.
  let hearthBus: GainNode | null = null;
  let bedGain: GainNode | null = null;

  // Haptics ride along the same mute state as the audio -- unlike
  // cardAudio.ts's one-off arrival chime, these repeat for as long as the
  // hearth runs, so muting the fire should stop the phone buzzing too.
  function vibrateSafe(pattern: number | number[]) {
    if (muted) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

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
    buildHearthBus();
    startFireBed();
    scheduleCrackle();
    scheduleDrum();
    startDrone();
  }

  /* Warm chain + synthetic room reverb shared by all fire sounds. */
  function buildHearthBus() {
    if (!ctx || !masterGain) return;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(1, ctx.currentTime);

    const soften = ctx.createBiquadFilter();       // rounds off any harsh, tinny edge
    soften.type = 'lowpass';
    soften.frequency.setValueAtTime(4200, ctx.currentTime);
    soften.Q.setValueAtTime(0.5, ctx.currentTime);

    const bloom = ctx.createBiquadFilter();        // a resonant, wooden warmth
    bloom.type = 'peaking';
    bloom.frequency.setValueAtTime(240, ctx.currentTime);
    bloom.Q.setValueAtTime(0.9, ctx.currentTime);
    bloom.gain.setValueAtTime(5, ctx.currentTime);

    bus.connect(soften);
    soften.connect(bloom);
    bloom.connect(masterGain);                     // dry

    // Impulse response: ~1.2s of dark, exponentially decaying noise.
    const irLen = Math.floor(ctx.sampleRate * 1.2);
    const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < irLen; i++) {
        const t = i / ctx.sampleRate;
        lp += 0.35 * ((Math.random() * 2 - 1) - lp); // one-pole lowpass keeps the tail dark
        d[i] = lp * Math.exp(-t * 4.5);
      }
    }
    const verb = ctx.createConvolver();
    verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.setValueAtTime(0.38, ctx.currentTime);
    soften.connect(verb);
    verb.connect(wet);
    wet.connect(masterGain);

    hearthBus = bus;
  }

  /* Seamless looping noise (brown-ish), end crossfaded into the start. */
  function makeLoopNoise(seconds: number): AudioBuffer | null {
    if (!ctx) return null;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    let peak = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last;
      peak = Math.max(peak, Math.abs(last));
    }
    const norm = peak > 0 ? 0.9 / peak : 1;
    for (let i = 0; i < len; i++) d[i] *= norm;
    const fade = Math.floor(ctx.sampleRate * 0.25);
    for (let i = 0; i < fade; i++) {
      const w = i / fade;
      d[i] = d[i] * w + d[len - fade + i] * (1 - w);
    }
    return buf;
  }

  /* The fire's breathing body: a low, slowly swelling hush beneath the crackles. */
  function startFireBed() {
    if (!ctx || !hearthBus) return;
    const buf = makeLoopNoise(6);
    if (!buf) return;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0, ctx.currentTime);
    out.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 4);
    out.connect(hearthBus);
    bedGain = out;

    const layer = (freq: number, type: BiquadFilterType, q: number, level: number, lfoHz: number, depth: number) => {
      const src = ctx!.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.loopStart = 0;
      src.playbackRate.setValueAtTime(0.9 + Math.random() * 0.2, ctx!.currentTime);
      const f = ctx!.createBiquadFilter();
      f.type = type;
      f.frequency.setValueAtTime(freq, ctx!.currentTime);
      f.Q.setValueAtTime(q, ctx!.currentTime);
      const g = ctx!.createGain();
      g.gain.setValueAtTime(level, ctx!.currentTime);
      const lfo = ctx!.createOscillator();         // slow swell, like the fire drawing breath
      lfo.frequency.setValueAtTime(lfoHz, ctx!.currentTime);
      const lfoG = ctx!.createGain();
      lfoG.gain.setValueAtTime(depth, ctx!.currentTime);
      lfo.connect(lfoG);
      lfoG.connect(g.gain);
      src.connect(f);
      f.connect(g);
      g.connect(out);
      src.start(ctx!.currentTime);
      lfo.start(ctx!.currentTime);
    };
    layer(320, 'lowpass', 0.7, 0.55, 0.13, 0.18);   // deep warm roar
    layer(900, 'bandpass', 0.6, 0.16, 0.29, 0.07);  // soft licking hush
  }

  /** Route a source through an optional random stereo placement into the hearth bus. */
  function toHearth(node: AudioNode) {
    if (!ctx || !hearthBus) return;
    if (typeof ctx.createStereoPanner === 'function') {
      const pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime((Math.random() * 2 - 1) * 0.55, ctx.currentTime);
      node.connect(pan);
      pan.connect(hearthBus);
    } else {
      node.connect(hearthBus);
    }
  }

  /* Sacred drone — a sustained, slowly beating low pad, like a singing bowl held under the fire. */
  function startDrone() {
    if (!ctx || !masterGain) return;
    const drone = ctx.createGain();
    drone.gain.setValueAtTime(0.05, ctx.currentTime);
    drone.connect(masterGain);

    const freqs = [110, 110.8, 165]; // root, slight detune for beating, fifth
    const oscs = freqs.map((f, i) => {
      const osc = ctx!.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, ctx!.currentTime);
      const g = ctx!.createGain();
      g.gain.setValueAtTime(i === 2 ? 0.35 : 0.6, ctx!.currentTime);
      osc.connect(g);
      g.connect(drone);
      osc.start(ctx!.currentTime);
      return osc;
    });

    droneNodes = { oscs, gain: drone };

    // The 110 / 110.8 Hz pair beats at their 0.8 Hz difference -- that's
    // the actual acoustic "pulse" audible in the drone, so the haptic
    // rides the same period (1000 / 0.8 = 1250ms) rather than an
    // arbitrary tempo. A single soft tick, not a buzz, so it reads as
    // touch, not notification.
    droneHapticTimer = setInterval(() => vibrateSafe(12), 1250);
  }

  function stopDrone() {
    if (!droneNodes || !ctx) return;
    const { oscs, gain } = droneNodes;
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.0);
    setTimeout(() => oscs.forEach(o => { try { o.stop(); } catch {} }), 1100);
    droneNodes = null;
    if (droneHapticTimer) { clearInterval(droneHapticTimer); droneHapticTimer = null; }
  }

  /* A short burst of noise, band-shaped. The raw material of every snap. */
  function noiseClick(time: number, len: number, freq: number, q: number, peak: number) {
    if (!ctx || !hearthBus) return;
    const size = Math.max(8, Math.floor(ctx.sampleRate * len));
    const buf = ctx.createBuffer(1, size, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(freq, time);
    bp.Q.setValueAtTime(q, time);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(peak, time + 0.003);       // soft attack: no harsh click
    g.gain.exponentialRampToValueAtTime(0.0005, time + len);
    src.connect(bp);
    bp.connect(g);
    toHearth(g);
    src.start(time);
    src.stop(time + len + 0.01);
  }

  /* Small dry snap — the fine crackle of kindling. */
  function snap(time: number) {
    noiseClick(time, 0.012 + Math.random() * 0.02, 1500 + Math.random() * 1800, 1.2 + Math.random() * 1.3, 0.12 + Math.random() * 0.14);
  }

  /* A resonant wood pop: a woody tonal body that rings and decays, with a soft snap on top. */
  function pop(time: number) {
    if (!ctx || !hearthBus) return;
    const f0 = 170 + Math.random() * 230;                     // 170-400 Hz body
    const ring = 0.10 + Math.random() * 0.14;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f0, time);
    osc.frequency.exponentialRampToValueAtTime(f0 * 0.72, time + ring);
    const g = ctx.createGain();
    const peak = 0.14 + Math.random() * 0.14;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(peak, time + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0005, time + ring);
    osc.connect(g);
    toHearth(g);
    osc.start(time);
    osc.stop(time + ring + 0.02);
    noiseClick(time, 0.025, 700 + Math.random() * 700, 1.4, 0.10 + Math.random() * 0.08);
  }

  function fireBurst() {
    if (!ctx || !hearthBus || !running) return;
    const now = ctx.currentTime;
    const r = Math.random();
    if (r < 0.58) {
      snap(now);
    } else if (r < 0.88) {
      pop(now);
    } else {
      // A cluster: a log shifting, a quick run of snaps ending in a pop.
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) snap(now + i * (0.03 + Math.random() * 0.05));
      pop(now + n * 0.06);
    }
  }

  function scheduleCrackle() {
    if (!running) return;
    fireBurst();
    const next = 110 + Math.random() * 380;
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
    // Twin thump, same 210ms gap as the audio: a firm tap then a softer
    // echo. setTimeout drives it rather than the AudioContext clock since
    // Vibration API has no scheduling of its own.
    vibrateSafe([35, 210, 20]);
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
    stopDrone();
    if (masterGain && ctx) {
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
      setTimeout(() => { try { ctx?.close(); } catch {} ctx = null; masterGain = null; hearthBus = null; bedGain = null; }, 1300);
    }
  }

  function setMuted(m: boolean) {
    muted = m;
    if (!masterGain || !ctx) return;
    if (m) { masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4); }
    else   { masterGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 0.4); }
  }

  function isRunning() { return running; }
  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  return { start, stop, setMuted, isRunning, resume };
}

/* -- Shared hearth singleton ----------------------------------------------
   initHearthFire() builds a fresh AudioContext + drone every call, so two
   live callers = two overlaid fires. The opening now has two: BreathGate
   (during the breath) and FireAtmosphere (once Threshold mounts). They
   need to be the SAME continuous bed -- the fire you breathe on is the
   fire you're still sitting at when the reading comes.

   Refcounted, exactly like lib/ambientBreathTone.ts: acquire on mount,
   release on unmount; the ~1s both-mounted overlap during the
   breath -> threshold crossfade takes the count 2 -> 1, never 0, so the
   hearth is never torn down mid-handoff. First acquire also wires a
   one-shot gesture listener to satisfy autoplay policy (the AudioContext
   starts suspended until the seeker's first pointer/key/touch). */
let _hearth: HearthFireControl | null = null;
let _hearthRefs = 0;
// Grace period so a release -> re-acquire across an unmount/remount gap
// (BreathGate tearing down while the lazy Threshold chunk is still
// loading) reuses the SAME hearth instead of stopping one context and
// building a fresh one. Only an actual sustained zero-caller state tears
// it down.
let _hearthGraceTimer: ReturnType<typeof setTimeout> | null = null;
const HEARTH_GRACE_MS = 2500;

function _attachHearthResumeOnGesture() {
  if (typeof window === 'undefined') return;
  const resume = () => {
    _hearth?.resume();
    window.removeEventListener('pointerdown', resume);
    window.removeEventListener('keydown', resume);
    window.removeEventListener('touchstart', resume);
  };
  window.addEventListener('pointerdown', resume);
  window.addEventListener('keydown', resume);
  window.addEventListener('touchstart', resume);
}

export function acquireHearthFire(): HearthFireControl {
  _hearthRefs++;
  if (_hearthGraceTimer) {
    // A pending teardown from a momentary zero-caller gap -- cancel it and
    // reuse the still-running hearth.
    clearTimeout(_hearthGraceTimer);
    _hearthGraceTimer = null;
  }
  if (!_hearth) {
    _hearth = initHearthFire();
    _hearth.start();
    _attachHearthResumeOnGesture();
  } else {
    // A later caller mounting after a gesture already happened -- make sure
    // the context is running for them too.
    _hearth.resume();
  }
  return _hearth;
}

export function releaseHearthFire(): void {
  _hearthRefs = Math.max(0, _hearthRefs - 1);
  if (_hearthRefs > 0 || !_hearth || _hearthGraceTimer) return;
  const dying = _hearth;
  _hearthGraceTimer = setTimeout(() => {
    _hearthGraceTimer = null;
    if (_hearthRefs === 0) {
      dying.stop();
      if (_hearth === dying) _hearth = null;
    }
  }, HEARTH_GRACE_MS);
}
