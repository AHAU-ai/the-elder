/**
 * heartbeatDrum.ts
 *
 * Subtle rhythmic "lub-dub" pulse layered under active reading delivery in
 * OracleResponse only — starts when the word-by-word reveal begins, stops
 * the instant the reveal completes (before the glyph / ceremonial closing /
 * ThresholdLetter). Ref-counted start/stop, own short-lived AudioContext,
 * lookahead scheduling so tempo doesn't drift over a long reading.
 */

const BPM = 92; // slightly faster than resting heart rate (~60-80bpm)
const BEAT_INTERVAL_SEC = 60 / BPM;
const LUB_DUB_GAP_SEC = 0.14; // gap between "lub" and "dub" within one beat
const SCHEDULE_AHEAD_SEC = 0.15; // how far ahead we schedule audio events
const SCHEDULER_TICK_MS = 50; // how often the scheduler loop wakes up

const LUB_FREQ = 100; // sine, "lub" (primary) — kept above typical speaker rolloff
const DUB_FREQ = 80; // sine, "dub" (softer secondary)
const LUB_GAIN = 0.16; // subtle but audible on laptop/phone speakers
const DUB_GAIN = 0.11;
const PULSE_ATTACK_SEC = 0.01;
const PULSE_DECAY_SEC = 0.18;

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let refCount = 0;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let nextBeatTime = 0;
let stopped = true;

function ensureContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 1;
    masterGain.connect(audioCtx.destination);
  }
  return audioCtx;
}

function schedulePulse(ctx: AudioContext, time: number, freq: number, gain: number) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, time);

  env.gain.setValueAtTime(0, time);
  env.gain.linearRampToValueAtTime(gain, time + PULSE_ATTACK_SEC);
  env.gain.exponentialRampToValueAtTime(0.0001, time + PULSE_ATTACK_SEC + PULSE_DECAY_SEC);

  osc.connect(env);
  env.connect(masterGain!);

  osc.start(time);
  osc.stop(time + PULSE_ATTACK_SEC + PULSE_DECAY_SEC + 0.02);
}

function scheduleBeat(ctx: AudioContext, beatTime: number) {
  schedulePulse(ctx, beatTime, LUB_FREQ, LUB_GAIN);
  schedulePulse(ctx, beatTime + LUB_DUB_GAP_SEC, DUB_FREQ, DUB_GAIN);
}

function schedulerLoop() {
  if (!audioCtx || stopped) return;

  while (nextBeatTime < audioCtx.currentTime + SCHEDULE_AHEAD_SEC) {
    scheduleBeat(audioCtx, nextBeatTime);
    nextBeatTime += BEAT_INTERVAL_SEC;
  }
}

/**
 * Start the heartbeat drum. Ref-counted so overlapping callers (e.g. a
 * reveal that gets retriggered before cleanup runs) can't stop each other's
 * instance early — only the first caller actually starts the scheduler.
 */
export function startHeartbeatDrum() {
  refCount += 1;
  if (refCount > 1) return;

  const ctx = ensureContext();
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {
      /* best-effort; ceremony should never hard-fail on audio */
    });
  }

  stopped = false;
  nextBeatTime = ctx.currentTime + 0.1;
  schedulerLoop();
  schedulerTimer = setInterval(schedulerLoop, SCHEDULER_TICK_MS);
}

/**
 * Stop the heartbeat drum. Only tears down once every start() has a
 * matching stop() (ref count reaches 0). Safe to call more than once —
 * guarded against going below zero.
 */
export function stopHeartbeatDrum() {
  if (refCount === 0) return;
  refCount -= 1;
  if (refCount > 0) return;

  stopped = true;
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
