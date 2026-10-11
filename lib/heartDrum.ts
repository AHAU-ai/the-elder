// lib/heartDrum.ts
//
// ONE shared heartbeat-drum voice for the whole app.
//
// Why this exists: every earlier "drum" here was a bare sine at 58-100 Hz.
// Laptop and phone speakers barely reproduce anything below ~120 Hz, so
// what survived was only the tiny attack click -- which reads as a random
// electronic blip, not a drum. This voice is built to be heard on small
// speakers:
//   - a body with a steep pitch drop (a skin relaxing), never a steady tone
//   - a saturated copy of that body, high-passed, so it carries harmonics
//     at ~150-300 Hz that small speakers DO play (the "thump" you hear)
//   - a short low-passed noise knock, the mallet on the skin
// Nothing in it sustains a pitch for more than ~0.3s, so it cannot be
// mistaken for a beep.

const knockCache = new WeakMap<BaseAudioContext, AudioBuffer>();

function getKnock(ctx: BaseAudioContext): AudioBuffer {
  let b = knockCache.get(ctx);
  if (!b) {
    const len = Math.floor(ctx.sampleRate * 0.06);
    b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    knockCache.set(ctx, b);
  }
  return b;
}

function makeShaper(ctx: BaseAudioContext): WaveShaperNode {
  const s = ctx.createWaveShaper();
  const n = 512;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(3 * x);
  }
  s.curve = curve;
  return s;
}

/**
 * Strike one heartbeat-drum hit.
 * @param level loudness of this hit; a "lub" is ~0.6, a softer "dub" ~0.4 (a hit at 1.0 is loud).
 */
export function strikeHeartDrum(
  ctx: AudioContext,
  dest: AudioNode,
  time: number,
  level: number,
): void {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(92, time);
  osc.frequency.exponentialRampToValueAtTime(46, time + 0.16);

  // Body.
  const body = ctx.createGain();
  body.gain.setValueAtTime(0, time);
  body.gain.linearRampToValueAtTime(0.5 * level, time + 0.004);
  body.gain.exponentialRampToValueAtTime(0.0005, time + 0.3);
  osc.connect(body);
  body.connect(dest);

  // Harmonic layer: the part small speakers can actually reproduce.
  const pre = ctx.createGain();
  pre.gain.setValueAtTime(3, time);
  const sat = makeShaper(ctx); // per-hit shaper so each hit has its own output chain
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(130, time);
  const harm = ctx.createGain();
  harm.gain.setValueAtTime(0, time);
  harm.gain.linearRampToValueAtTime(1.0 * level, time + 0.004);
  harm.gain.exponentialRampToValueAtTime(0.0005, time + 0.14);
  osc.connect(pre);
  pre.connect(sat);
  sat.connect(hp);
  hp.connect(harm);
  harm.connect(dest);

  // Mallet knock.
  const knock = ctx.createBufferSource();
  knock.buffer = getKnock(ctx);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(210, time);
  bp.Q.setValueAtTime(0.9, time);
  const kg = ctx.createGain();
  kg.gain.setValueAtTime(0, time);
  kg.gain.linearRampToValueAtTime(0.9 * level, time + 0.002);
  kg.gain.exponentialRampToValueAtTime(0.0005, time + 0.05);
  knock.connect(bp);
  bp.connect(kg);
  kg.connect(dest);

  osc.start(time);
  osc.stop(time + 0.34);
  knock.start(time);
  knock.stop(time + 0.06);
}
