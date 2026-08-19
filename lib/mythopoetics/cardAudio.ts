// lib/mythopoetics/cardAudio.ts
//
// Live Web Audio synthesis for the shareable card's ambient bed + arrival
// chime -- see docs/shareable-card-visual-system.md for the governance
// context this operates under (same document covers the card's landscape
// imagery; this file is its audio counterpart).
//
// DECISION, same shape as the imagery one: everything here is synthesized
// in-browser from oscillators/noise/envelopes, never a sourced or
// AI-generated recording. Nothing claims to be a real ceremonial
// recording of any tradition's music, so the tradition-bearer-consent
// question that governs the landscape imagery never arises here -- there
// is no recording, so there is nothing to have fabricated. If a future
// pass wants richer/sampled audio, it must clear the same bar the
// landscapes did (marker-only, never voice/tradition-tied, reviewed
// before shipping) -- this file's approach of synthesizing instead of
// sourcing is what makes that bar unnecessary today, not a shortcut
// around it.
//
// Marker-only, exactly like the landscapes: each of the five archetypes
// gets its own timbre, never anything keyed to voice/tradition.

import type { MarkerType } from './cardConfig'

export interface AmbientLoop {
  stop: () => void
}

let sharedCtx: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (!sharedCtx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext
    sharedCtx = new Ctor()
  }
  return sharedCtx
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buf
}

// A single soft, non-alarming struck-tone -- the audio half of the
// glyph-burst "arrival" moment (ShareableCard.tsx, elderGlyphBurst).
// Frequency varies by marker so the five archetypes are audibly
// distinct, same principle as their five landscapes.
const CHIME_HZ: Record<MarkerType, number> = {
  wound: 220,
  threshold: 440,
  pattern: 523.25,
  exile: 330,
  figure: 165,
}

export function playArrivalChime(marker: MarkerType, volume = 0.18) {
  const ctx = getAudioContext()
  const now = ctx.currentTime
  const hz = CHIME_HZ[marker]

  const master = ctx.createGain()
  master.gain.setValueAtTime(0, now)
  master.gain.linearRampToValueAtTime(volume, now + 0.02)
  master.gain.exponentialRampToValueAtTime(0.0001, now + 3.2)
  master.connect(ctx.destination)

  // fundamental + a soft detuned partial, triangle for warmth over sine
  ;[1, 2.01].forEach((mult, i) => {
    const osc = ctx.createOscillator()
    osc.type = i === 0 ? 'triangle' : 'sine'
    osc.frequency.setValueAtTime(hz * mult, now)
    const g = ctx.createGain()
    g.gain.setValueAtTime(i === 0 ? 1 : 0.35, now)
    osc.connect(g)
    g.connect(master)
    osc.start(now)
    osc.stop(now + 3.3)
  })
}

// Fires the arrival chime and, where supported, a matching haptic pulse.
// Haptics fire regardless of the audio mute state -- vibration carries no
// autoplay-policy restriction and isn't "sound," so gating it on the audio
// toggle would silence a channel that never needed permission.
const HAPTIC_PATTERN: Record<MarkerType, number[]> = {
  wound: [40],
  threshold: [20, 40, 60, 80],
  pattern: [30, 60, 30, 60, 30],
  exile: [15],
  figure: [120],
}

export function playArrival(marker: MarkerType, audioOn: boolean) {
  if (audioOn) playArrivalChime(marker)
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(HAPTIC_PATTERN[marker])
  }
}

// Continuous ambient bed, one per marker archetype. Each returns a
// stop() that ramps out cleanly rather than cutting the sound off.
export function startAmbientLoop(marker: MarkerType): AmbientLoop {
  const ctx = getAudioContext()
  const master = ctx.createGain()
  master.gain.setValueAtTime(0, ctx.currentTime)
  master.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5)
  master.connect(ctx.destination)

  const cleanup: (() => void)[] = []
  const stopAt = (node: AudioScheduledSourceNode, t: number) => {
    node.stop(t)
    cleanup.push(() => { try { node.stop() } catch {} })
  }

  if (marker === 'wound') {
    // low sustained drone + an occasional faint "crack" (short filtered
    // noise burst) at irregular intervals
    const drone = ctx.createOscillator()
    drone.type = 'sine'
    drone.frequency.value = 55
    const droneGain = ctx.createGain()
    droneGain.gain.value = 0.05
    drone.connect(droneGain)
    droneGain.connect(master)
    drone.start()

    let crackTimer: ReturnType<typeof setTimeout>
    const scheduleCrack = () => {
      crackTimer = setTimeout(() => {
        const src = ctx.createBufferSource()
        src.buffer = noiseBuffer(ctx, 0.15)
        const filter = ctx.createBiquadFilter()
        filter.type = 'bandpass'
        filter.frequency.value = 1800
        const g = ctx.createGain()
        const t = ctx.currentTime
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.08, t + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15)
        src.connect(filter)
        filter.connect(g)
        g.connect(master)
        src.start()
        scheduleCrack()
      }, 14000 + Math.random() * 12000)
    }
    scheduleCrack()

    return {
      stop: () => {
        clearTimeout(crackTimer)
        const t = ctx.currentTime
        master.gain.cancelScheduledValues(t)
        master.gain.setValueAtTime(master.gain.value, t)
        master.gain.linearRampToValueAtTime(0, t + 1.2)
        stopAt(drone, t + 1.3)
      },
    }
  }

  if (marker === 'threshold') {
    // swelling filtered-noise resonance, like air moving through an
    // opening -- slow LFO breathing on both gain and filter cutoff
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx, 4)
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 500
    filter.Q.value = 0.7
    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0.06

    const lfo = ctx.createOscillator()
    lfo.frequency.value = 1 / 5.5 // breathes on the same ~5.5s cycle as elderGlyphPulse
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 220
    lfo.connect(lfoGain)
    lfoGain.connect(filter.frequency)
    lfo.start()

    src.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(master)
    src.start()

    return {
      stop: () => {
        const t = ctx.currentTime
        lfo.stop(t + 1.3)
        master.gain.cancelScheduledValues(t)
        master.gain.setValueAtTime(master.gain.value, t)
        master.gain.linearRampToValueAtTime(0, t + 1.2)
        stopAt(src, t + 1.3)
      },
    }
  }

  if (marker === 'pattern') {
    // soft repeating chime on a spiral-ish rhythm, plus a gentle
    // stereo-panned drip
    let dripTimer: ReturnType<typeof setTimeout>
    const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    let panPhase = 0
    const scheduleDrip = () => {
      dripTimer = setTimeout(() => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = 880
        const g = ctx.createGain()
        const t = ctx.currentTime
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(0.07, t + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
        osc.connect(g)
        if (panner) {
          panPhase += 0.9
          panner.pan.value = Math.sin(panPhase) * 0.6
          g.connect(panner)
          panner.connect(master)
        } else {
          g.connect(master)
        }
        osc.start(t)
        osc.stop(t + 1)
        scheduleDrip()
      }, 3800 + Math.random() * 800)
    }
    scheduleDrip()

    return {
      stop: () => {
        clearTimeout(dripTimer)
        const t = ctx.currentTime
        master.gain.cancelScheduledValues(t)
        master.gain.setValueAtTime(master.gain.value, t)
        master.gain.linearRampToValueAtTime(0, t + 1.2)
      },
    }
  }

  if (marker === 'exile') {
    // near-silence: sparse, cold wind with long gaps
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer(ctx, 6)
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 2200
    const gustGain = ctx.createGain()
    gustGain.gain.value = 0

    let gustTimer: ReturnType<typeof setTimeout>
    const scheduleGust = () => {
      gustTimer = setTimeout(() => {
        const t = ctx.currentTime
        gustGain.gain.cancelScheduledValues(t)
        gustGain.gain.setValueAtTime(0, t)
        gustGain.gain.linearRampToValueAtTime(0.025, t + 1.5)
        gustGain.gain.linearRampToValueAtTime(0, t + 4)
        scheduleGust()
      }, 9000 + Math.random() * 9000)
    }
    scheduleGust()

    src.connect(filter)
    filter.connect(gustGain)
    gustGain.connect(master)
    src.start()

    return {
      stop: () => {
        clearTimeout(gustTimer)
        const t = ctx.currentTime
        master.gain.cancelScheduledValues(t)
        master.gain.setValueAtTime(master.gain.value, t)
        master.gain.linearRampToValueAtTime(0, t + 1.2)
        stopAt(src, t + 1.3)
      },
    }
  }

  // figure: a single deep sustained tone, struck softly and re-struck
  // on a slow interval -- immense, still, unmistakably present
  let strikeTimer: ReturnType<typeof setTimeout>
  const scheduleStrike = () => {
    strikeTimer = setTimeout(() => {
      const t = ctx.currentTime
      ;[1, 2.003, 3.01].forEach((mult, i) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = 65 * mult
        const g = ctx.createGain()
        const vol = i === 0 ? 0.09 : 0.03
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(vol, t + 0.3)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 9)
        osc.connect(g)
        g.connect(master)
        osc.start(t)
        osc.stop(t + 9.2)
      })
      scheduleStrike()
    }, 15000 + Math.random() * 4000)
  }
  scheduleStrike()

  return {
    stop: () => {
      clearTimeout(strikeTimer)
      const t = ctx.currentTime
      master.gain.cancelScheduledValues(t)
      master.gain.setValueAtTime(master.gain.value, t)
      master.gain.linearRampToValueAtTime(0, t + 1.2)
    },
  }
}
