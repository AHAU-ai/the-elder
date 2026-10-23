// lib/ceremonyDrone.ts
//
// The ceremonial drone: one low, slowly beating pad held under the WHOLE
// ceremony -- portal, breath, threshold, lineage-select, the reading -- and
// silent only for the fireside chat (the council), where the seeker talks
// with the Elder.
//
// It used to live inside the hearth fire's audio graph (enhancements.ts), so
// it started, stopped and muted whenever a fire component happened to mount
// or unmount. This module replaces that: its own AudioContext, its own
// lifecycle, owned by the root layout (app/components/CeremonyDrone.tsx) so
// it spans the ceremony instead of following the fire. Independent of the
// fire and of the heartbeat drums.
//
// Three inputs, nothing else:
//   - acquire/release  refcounted, with a grace period so an unmount/remount
//                      gap reuses the same drone instead of restarting it
//   - setSuspended     the fireside chat: fade out, and back in on leaving
//   - setMuted         the seeker's mute control
//
// Same fail-silent pattern as the rest of the app's audio: create on demand,
// never throw into the render path. Nothing happens at 0ms: every change of
// level is a fade.

const DRONE_LEVEL = 0.11;        // audible under the fire bed on small speakers
const FADE_SEC = 3;              // arrival/departure; nothing happens at 0ms
const MUTE_FADE_SEC = 0.4;       // matches the hearth's mute feel
const GRACE_MS = 2500;           // reuse across an unmount -> remount gap
const SWELL_HZ = 0.07;           // the pad slowly breathes (~14s cycle)
const SWELL_DEPTH = 0.22;        // fraction of DRONE_LEVEL
const HAPTIC_MS = 1250;          // period of the 110 / 110.8 Hz beat (1 / 0.8 Hz)

// root, slight detune for beating, fifth, and an octave pair so the pad has
// body above ~150 Hz where laptop and phone speakers actually play.
const PARTIALS: ReadonlyArray<readonly [number, number]> = [
  [110, 0.6],
  [110.8, 0.6],
  [165, 0.35],
  [220, 0.4],
  [220.5, 0.3],
];

let ctx: AudioContext | null = null;
let master: GainNode | null = null;   // mute / suspend / fade live here
let oscs: OscillatorNode[] = [];
let lfo: OscillatorNode | null = null;
let hapticTimer: ReturnType<typeof setInterval> | null = null;
let graceTimer: ReturnType<typeof setTimeout> | null = null;
let refCount = 0;
let suspended = false;                // fireside chat
let muted = false;
let gestureAttached = false;

function targetLevel(): number {
  return suspended || muted ? 0 : DRONE_LEVEL;
}

function fadeTo(level: number, seconds: number) {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  const g = master.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  // setTargetAtTime reaches ~95% in 3 time-constants.
  g.setTargetAtTime(level, now, seconds / 3);
}

function syncHaptic() {
  const want = !!ctx && refCount > 0 && !suspended && !muted;
  if (want && !hapticTimer) {
    // A single soft tick on the beat, not a buzz, so it reads as touch, not notification.
    hapticTimer = setInterval(() => {
      try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(12); } catch { /* ignore */ }
    }, HAPTIC_MS);
  } else if (!want && hapticTimer) {
    clearInterval(hapticTimer);
    hapticTimer = null;
  }
}

function attachResumeOnGesture() {
  if (gestureAttached || typeof window === 'undefined') return;
  gestureAttached = true;
  const resume = () => {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    window.removeEventListener('pointerdown', resume);
    window.removeEventListener('keydown', resume);
    window.removeEventListener('touchstart', resume);
    gestureAttached = false;
  };
  window.addEventListener('pointerdown', resume);
  window.addEventListener('keydown', resume);
  window.addEventListener('touchstart', resume);
}

function build() {
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return;
  ctx = new Ctor() as AudioContext;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
    attachResumeOnGesture(); // autoplay policy: first pointer/key/touch unlocks it
  }

  master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.connect(ctx.destination);

  // The slow swell rides a second gain so it never fights the fades on master.
  const swell = ctx.createGain();
  swell.gain.setValueAtTime(1, ctx.currentTime);
  swell.connect(master);
  lfo = ctx.createOscillator();
  lfo.frequency.setValueAtTime(SWELL_HZ, ctx.currentTime);
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.setValueAtTime(SWELL_DEPTH, ctx.currentTime);
  lfo.connect(lfoDepth);
  lfoDepth.connect(swell.gain);
  lfo.start();

  oscs = PARTIALS.map(([freq, level]) => {
    const osc = ctx!.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx!.currentTime);
    const g = ctx!.createGain();
    g.gain.setValueAtTime(level, ctx!.currentTime);
    osc.connect(g);
    g.connect(swell);
    osc.start();
    return osc;
  });

  fadeTo(targetLevel(), FADE_SEC);
}

function teardown() {
  if (hapticTimer) { clearInterval(hapticTimer); hapticTimer = null; }
  const dyingCtx = ctx;
  const dyingOscs = oscs;
  const dyingLfo = lfo;
  ctx = null; master = null; oscs = []; lfo = null;
  if (!dyingCtx) return;
  setTimeout(() => {
    try { dyingOscs.forEach(o => o.stop()); dyingLfo?.stop(); } catch { /* ignore */ }
    try { dyingCtx.close(); } catch { /* ignore */ }
  }, 1200);
}

/** Begin (or join) the drone. Pair every call with releaseCeremonyDrone(). */
export function acquireCeremonyDrone(): void {
  refCount++;
  if (graceTimer) { clearTimeout(graceTimer); graceTimer = null; }
  if (refCount > 1) return;
  try {
    if (!ctx) build();
    else {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      fadeTo(targetLevel(), FADE_SEC); // re-acquired inside the grace window
    }
    syncHaptic();
  } catch {
    // AudioContext blocked or unavailable -- silent fail
  }
}

export function releaseCeremonyDrone(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0 || !ctx || graceTimer) return;
  // Fade out first, then tear down -- unless someone re-acquires within the grace window.
  fadeTo(0, 1);
  syncHaptic();
  graceTimer = setTimeout(() => {
    graceTimer = null;
    if (refCount === 0) teardown();
  }, GRACE_MS);
}

/** The fireside chat: fade the drone out (true) or back in (false). */
export function setCeremonyDroneSuspended(value: boolean): void {
  suspended = value;
  try { fadeTo(targetLevel(), FADE_SEC); syncHaptic(); } catch { /* ignore */ }
}

/** The seeker's mute control. */
export function setCeremonyDroneMuted(value: boolean): void {
  muted = value;
  try { fadeTo(targetLevel(), MUTE_FADE_SEC); syncHaptic(); } catch { /* ignore */ }
}
