/**
 * heartbeatDrum.ts
 *
 * Subtle rhythmic "lub-dub" pulse tracking the ceremony's own pace: it
 * quickens while the supplicant's inquiry is held at the fire (awaiting
 * the Elder's answer) and settles back to a resting cadence once the
 * reading begins revealing itself. Ref-counted start/stop, own
 * short-lived AudioContext, lookahead scheduling so tempo doesn't drift
 * over a long reading — and tempo changes ramp rather than snap, in
 * keeping with the instrument's motion grammar (nothing happens at 0ms).
 */

import { strikeHeartDrum } from './heartDrum';

export const RESTING_BPM = 92; // slightly faster than resting heart rate — the reading itself
export const INQUIRY_BPM = 124; // quickened, anticipatory — the fire is being asked

const LUB_DUB_GAP_SEC = 0.22; // gap between "lub" and "dub" within one beat
const SCHEDULE_AHEAD_SEC = 0.15; // how far ahead we schedule audio events
const SCHEDULER_TICK_MS = 50; // how often the scheduler loop wakes up
const DEFAULT_RAMP_SEC = 2.5; // how long a tempo change takes to arrive

// Hit loudness for lib/heartDrum.ts's voice (0..1): the "lub", then a softer "dub".
const LUB_GAIN = 0.6;
const DUB_GAIN = 0.4;

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let refCount = 0;
let schedulerTimer: ReturnType<typeof setInterval> | null = null;
let nextBeatTime = 0;
let stopped = true;

// Tempo state: a stable base bpm, optionally interpolating toward a target
// over a ramp window so a tempo change is felt as a gradual quickening or
// settling rather than a jump cut.
let baseBpm = RESTING_BPM;
let rampActive = false;
let rampFromBpm = RESTING_BPM;
let rampToBpm = RESTING_BPM;
let rampStartTime = 0;
let rampDurationSec = 0;

function bpmAtTime(t: number): number {
  if (!rampActive) return baseBpm;
  const elapsed = t - rampStartTime;
  if (elapsed >= rampDurationSec) {
    rampActive = false;
    baseBpm = rampToBpm;
    return baseBpm;
  }
  const progress = Math.max(0, elapsed) / rampDurationSec;
  return rampFromBpm + (rampToBpm - rampFromBpm) * progress;
}

function ensureContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext ||
      (window as any).webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 1;
    // Gentle limiter: the deeper, more resonant drum carries real low-end
    // energy, so protect the output from clipping when hits overlap.
    const limiter = audioCtx.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-9, audioCtx.currentTime);
    limiter.knee.setValueAtTime(6, audioCtx.currentTime);
    limiter.ratio.setValueAtTime(10, audioCtx.currentTime);
    limiter.attack.setValueAtTime(0.003, audioCtx.currentTime);
    limiter.release.setValueAtTime(0.2, audioCtx.currentTime);
    masterGain.connect(limiter);
    limiter.connect(audioCtx.destination);
  }
  return audioCtx;
}

function schedulePulse(ctx: AudioContext, time: number, level: number) {
  strikeHeartDrum(ctx, masterGain!, time, level);
}

function scheduleBeat(ctx: AudioContext, beatTime: number) {
  schedulePulse(ctx, beatTime, LUB_GAIN);
  schedulePulse(ctx, beatTime + LUB_DUB_GAP_SEC, DUB_GAIN);
}

function schedulerLoop() {
  if (!audioCtx || stopped) return;

  while (nextBeatTime < audioCtx.currentTime + SCHEDULE_AHEAD_SEC) {
    const bpm = bpmAtTime(nextBeatTime);
    scheduleBeat(audioCtx, nextBeatTime);
    nextBeatTime += 60 / bpm;
  }
}

/**
 * Start the heartbeat drum at the given tempo (default: resting pace).
 * Ref-counted so overlapping callers (e.g. the inquiry wait handing off to
 * the reveal before its own cleanup runs) can't stop each other's instance
 * early — only the first caller actually starts the scheduler, and a
 * caller arriving after start has no effect on the running tempo (use
 * setHeartbeatTempo for that).
 */
export function startHeartbeatDrum(bpm: number = RESTING_BPM) {
  refCount += 1;
  if (refCount > 1) return;

  const ctx = ensureContext();
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {
      /* best-effort; ceremony should never hard-fail on audio */
    });
  }

  baseBpm = bpm;
  rampActive = false;
  stopped = false;
  nextBeatTime = ctx.currentTime + 0.1;
  schedulerLoop();
  schedulerTimer = setInterval(schedulerLoop, SCHEDULER_TICK_MS);
}

/** Whether the drum currently has an active start/stop session. */
export function isHeartbeatDrumActive(): boolean {
  return refCount > 0;
}

/**
 * Move the drum toward a new tempo over `rampSeconds`, easing rather than
 * snapping — the sound of the ceremony changing register, not a switch
 * flipping. A no-op if the drum isn't currently running (or hasn't started
 * yet — the next startHeartbeatDrum() call decides the starting tempo).
 */
export function setHeartbeatTempo(bpm: number, rampSeconds: number = DEFAULT_RAMP_SEC) {
  if (!audioCtx || stopped) return;

  if (rampSeconds <= 0) {
    baseBpm = bpm;
    rampActive = false;
    return;
  }

  rampFromBpm = bpmAtTime(audioCtx.currentTime);
  rampToBpm = bpm;
  rampStartTime = audioCtx.currentTime;
  rampDurationSec = rampSeconds;
  rampActive = true;
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
