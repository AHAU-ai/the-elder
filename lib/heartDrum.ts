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

// Per-destination "room": louder, limited dry hit + a resonant reverb tail +
// one soft low echo, so each beat blooms and rings out like a chest/drum in a
// stone room instead of a dry click. Cached per destination node.
const OUTPUT_BOOST = 1.9;
const busCache = new WeakMap<AudioNode, AudioNode>();

function getBus(ctx: AudioContext, dest: AudioNode): AudioNode {
  const hit = busCache.get(dest);
  if (hit) return hit;

  const input = ctx.createGain();
  input.gain.value = OUTPUT_BOOST;

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  limiter.connect(dest);

  input.connect(limiter); // dry

  // Reverb: 1.8s decaying stereo noise, darkened so the tail is low and warm.
  const secs = 1.8;
  const len = Math.floor(ctx.sampleRate * secs);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / ctx.sampleRate;
      lp += 0.12 * ((Math.random() * 2 - 1) - lp); // one-pole lowpass (~900 Hz)
      d[i] = lp * Math.exp(-t * 3.0) * 6;
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.7;
  input.connect(conv);
  conv.connect(wet);
  wet.connect(limiter);

  // One soft, dark echo with feedback.
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.23;
  const dlp = ctx.createBiquadFilter();
  dlp.type = 'lowpass';
  dlp.frequency.value = 420;
  const fb = ctx.createGain();
  fb.gain.value = 0.34;
  const echoOut = ctx.createGain();
  echoOut.gain.value = 0.5;
  input.connect(delay);
  delay.connect(dlp);
  dlp.connect(fb);
  fb.connect(delay);
  dlp.connect(echoOut);
  echoOut.connect(limiter);

  busCache.set(dest, input);
  return input;
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
  dest = getBus(ctx, dest);
  // A softer hit (< 0.5) is the "dub": a touch higher and tighter than the "lub".
  const dub = level < 0.5;
  const pitch = dub ? 1.18 : 1;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(68 * pitch, time);
  osc.frequency.exponentialRampToValueAtTime(36 * pitch, time + (dub ? 0.18 : 0.24)); // deep, slow-relaxing skin

  // Body.
  const body = ctx.createGain();
  body.gain.setValueAtTime(0, time);
  body.gain.linearRampToValueAtTime(0.95 * level, time + 0.004);
  body.gain.exponentialRampToValueAtTime(0.0005, time + 0.6); // long, round decay
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

  // Shell resonance: the knock excites a tuned, ringing low resonator, like
  // the body of a drum answering the strike. This is the "boom" tail.
  const ringSrc = ctx.createBufferSource();
  ringSrc.buffer = getKnock(ctx);
  const ringBp = ctx.createBiquadFilter();
  ringBp.type = 'bandpass';
  ringBp.frequency.setValueAtTime(92 * pitch, time);
  ringBp.Q.setValueAtTime(8, time);
  const ringG = ctx.createGain();
  ringG.gain.setValueAtTime(0, time);
  ringG.gain.linearRampToValueAtTime(2.5 * level, time + 0.002);
  ringG.gain.exponentialRampToValueAtTime(0.0005, time + 0.5);
  ringSrc.connect(ringBp);
  ringBp.connect(ringG);
  ringG.connect(dest);
  ringSrc.start(time);
  ringSrc.stop(time + 0.06);

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
  osc.stop(time + 0.65);
  knock.start(time);
  knock.stop(time + 0.06);
}
