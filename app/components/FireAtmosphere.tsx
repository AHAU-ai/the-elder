'use client';

import { useEffect, useRef, useState, useId, memo } from 'react';
import { initEmberSparks, initFireCursor, acquireHearthFire, releaseHearthFire, HearthFireControl } from './enhancements';
import { BREATH_CYCLE_MS } from '../../lib/breathTiming';
import { usePresence } from '../../lib/usePresence';

// C8 (design action items, 2026-08-19): the fire is ONE container -- The
// Elder's own constant presence, not a set piece re-skinned per lineage.
// Deliberately no voiceKey/lineage prop here, and none should ever be
// added: per-lineage differentiation belongs to the CONTENT the voice
// speaks and to this component's own intensity/pulse pacing (how bright,
// how it flares), never to a re-themed hearth (a different fire color,
// shape, or set of animations per tradition). See
// docs/fire-container-decision.md for the full reasoning. If a future
// change ever threads a lineage/voiceKey prop into FireAtmosphere or
// varies its palette by voice, that is this decision being reversed and
// needs the same governance attention C8 itself got, not a quiet PR.
interface FireAtmosphereProps {
  soundEnabled?: boolean;
  /** 0–1, grows as the reading/divination progresses. Raises the fire's baseline glow. */
  intensity?: number;
  /** Increment this to mark a question offered to the fire — like adding incense: a brief flare and a veil of smoke that lingers and slowly thickens. */
  pulse?: number;
  /** Set only at the entry-gate render site. Shortly after arrival (a sub-second timer, run once hydration lets the effect fire) the fire gives one subtle, self-decaying lean toward the seeker — a "someone just arrived" acknowledgement. Never touches the smoke veil (that's incense from questions, not presence). Default false. */
  arrivalNudge?: boolean;
}

// Signal-audit note (2026-09-23): this component previously also took
// `interrupted`, meant to make an error state read as "gutters, not
// surges" by cancelling any in-flight boost. Cut, not just left unwired:
// Threshold.tsx's PHASE_INTENSITY table already does that job, and does
// it more legibly -- phase 'error' drops the `intensity` prop itself
// (the dominant term below) to 0.22, well under every non-error phase. A
// boost-cancel is imperceptible next to that swing, and no call site
// ever passed `interrupted` anyway. arrivalNudge is unrelated and kept
// as-is -- a real, wired feature (app/layout.tsx), not dead code. See
// docs/fire-container-decision.md for why this component stays a single
// constant container rather than growing more per-state signals.

// Base (effective=0) durations of the four independent flicker layers, in
// seconds, in render order below. Used only to seed each layer's one-time
// random phase offset so several mounts of the one fire don't flicker in
// lockstep — the live durations stay the dynamic `${base - effective * k}s`
// expressions on the elements themselves.
const FLICKER_BASE_DURATIONS_S = [3.5, 7, 5.3, 6.7, 4.1];

// Smoke veil: incense thickening as questions are offered. Eased toward a
// ceiling rather than clamped — still visibly rising through the 4th–5th
// question, essentially flat past ~10, never a hard step at the cap.
const MAX_SMOKE_OPACITY = 0.6;
const SMOKE_DECAY_RATE = 0.28;

function FireAtmosphere({ soundEnabled = false, intensity = 0, pulse = 0, arrivalNudge = false }: FireAtmosphereProps) {
  // Read internally rather than accept as a prop — usePresence ticks every
  // ~200ms, and taking it as a prop from Threshold/CouncilTabs meant those
  // large parent trees re-rendered on every tick, fighting the phase-
  // transition CSS animations and causing visible stutter. Contained here,
  // the tick only re-renders this one component.
  const presence = usePresence();
  // FireAtmosphere is mounted more than once at a time by design (the
  // persistent root-layout instance plus each phase's own instance in
  // Threshold), so the turbulence filter's id must be unique per mount --
  // duplicate SVG filter ids across concurrently-mounted instances would
  // have every instance's <filter> silently target whichever one the
  // browser resolves first.
  const turbulenceId = useId().replace(/:/g, '') + '-fire-turbulence';
  const hearthRef = useRef<HearthFireControl | null>(null);
  const [muted, setMutedState] = useState(false);
  const [boost, setBoost] = useState(0);
  const [smokeCount, setSmokeCount] = useState(0);
  const [nudgeBoost, setNudgeBoost] = useState(0);
  const boostTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nudgeFallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The pulse value this component has already reacted to. Seeded with the
  // initial prop so neither the first mount nor StrictMode's double-invoke
  // of this effect in dev counts as a question offered — only a real change
  // to `pulse` from the parent does.
  const reactedPulseRef = useRef(pulse);

  // One-time random phase offsets (negative animation-delay) so multiple
  // mounts of the one fire — the persistent root instance plus each beat's
  // own — don't animate in lockstep. Seeded at 0 so SSR and first client
  // render agree (reactStrictMode is on), then randomised once on mount;
  // the single re-render nudges an infinite ambient loop imperceptibly.
  const [breathPhaseOffset, setBreathPhaseOffset] = useState(0);
  const [flickerPhaseOffsets, setFlickerPhaseOffsets] = useState<number[]>(
    () => FLICKER_BASE_DURATIONS_S.map(() => 0),
  );
  useEffect(() => {
    setBreathPhaseOffset(-(Math.random() * BREATH_CYCLE_MS));
    setFlickerPhaseOffsets(FLICKER_BASE_DURATIONS_S.map(d => -(Math.random() * d)));
  }, []);

  useEffect(() => {
    if (reactedPulseRef.current === pulse) return;
    reactedPulseRef.current = pulse;
    setBoost(1);
    setSmokeCount(c => c + 1);
    if (boostTimer.current) clearTimeout(boostTimer.current);
    boostTimer.current = setTimeout(() => setBoost(0), 2600);
    return () => { if (boostTimer.current) clearTimeout(boostTimer.current); };
  }, [pulse]);

  // Presence nudge — one subtle lean toward the seeker shortly after arrival,
  // then a slow decay back. Deliberately gentle: 0.22 weight, roughly a
  // third of a question-pulse flare (boost * 0.6), and — unlike a pulse — it
  // leaves smokeCount untouched: nothing has been offered to the fire yet,
  // only noticed. Fires `delay` ms after this effect runs, i.e. after
  // hydration, so in practice ~1s+ post-arrival rather than exactly `delay`.
  useEffect(() => {
    if (!arrivalNudge) return;
    const delay = 700 + Math.random() * 200;
    const rise = setTimeout(() => {
      setNudgeBoost(1);
      nudgeFallTimer.current = setTimeout(() => setNudgeBoost(0), 2600);
    }, delay);
    return () => {
      clearTimeout(rise);
      if (nudgeFallTimer.current) clearTimeout(nudgeFallTimer.current);
      // Don't strand the lean at full if the effect tears down mid-rise
      // (prop toggled, unmount): the fire would sit permanently brighter.
      setNudgeBoost(0);
    };
  }, [arrivalNudge]);

  const level = Math.min(1, Math.max(0, intensity));
  // The fire leans toward the seeker, not just the ceremony's own clock —
  // sustained stillness/attention nudges the baseline warmer, capped low
  // enough that it reads as the fire noticing, not as another phase surge.
  const presenceLift = Math.min(1, Math.max(0, presence)) * 0.12;
  const effective = Math.min(1.4, level + presenceLift + boost * 0.6 + nudgeBoost * 0.22);
  const smokeVeil = Math.min(
    MAX_SMOKE_OPACITY,
    level * 0.18 + MAX_SMOKE_OPACITY * (1 - Math.exp(-smokeCount * SMOKE_DECAY_RATE)),
  );

  useEffect(() => {
    const stopSparks = initEmberSparks(document.body);
    const stopCursor = initFireCursor();
    return () => { stopSparks(); stopCursor(); };
  }, []);

  useEffect(() => {
    if (!soundEnabled) return;
    // Shared, refcounted hearth -- BreathGate may already hold it from the
    // breath. acquireHearthFire owns start() and the autoplay gesture-
    // resume; this component just needs the handle for the mute toggle.
    hearthRef.current = acquireHearthFire();
    return () => {
      releaseHearthFire();
      hearthRef.current = null;
    };
  }, [soundEnabled]);

  function toggleMute() {
    const next = !muted;
    setMutedState(next);
    hearthRef.current?.setMuted(next);
  }

  return (
    <>
      {/* Turbulence/displacement filter for the flame layers below. The old
          fire was five radial-gradient ellipses that only skewed/scaled in
          place -- smooth and legible, but real flame edges are chaotic
          noise, not a smoothly-interpolated skew. feTurbulence generates
          that noise; feDisplacementMap uses it to warp each gradient's
          silhouette frame to frame, so the same underlying shapes now read
          as something actually combusting rather than a pulsing glow.
          baseFrequency/seed animate via SMIL (no JS render cost) so the
          distortion pattern itself keeps shifting, not just its intensity.
          0 width/height -- this <svg> exists only to hold the <filter>
          def, never to render visibly itself. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <defs>
          <filter id={turbulenceId} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              numOctaves={3}
              seed={2}
              stitchTiles="stitch"
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                values="0.012 0.035;0.018 0.05;0.010 0.03;0.016 0.045;0.012 0.035"
                dur="6.5s"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale={22} xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      <div
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
          filter: `url(#${turbulenceId}) brightness(${1 + effective * 0.45}) saturate(${1 + effective * 0.25})`,
          transform: `scale(${1 + effective * 0.06})`,
          transformOrigin: '50% 100%',
          transition: 'filter 1.4s ease, transform 1.4s ease',
        }}
        aria-hidden="true"
      >
        <div style={{
          position: 'absolute', bottom: '-4vh', left: '15%', right: '15%', height: '32vh',
          background: 'radial-gradient(ellipse 90% 90% at 50% 105%, rgba(255,145,28,0.75) 0%, rgba(240,100,14,0.42) 40%, transparent 68%)',
          animationName: 'elderFire', animationDuration: `${3.5 - effective * 1.1}s`,
          animationDelay: `${flickerPhaseOffsets[0]}s`,
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
          mixBlendMode: 'screen',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '65vh',
          background: 'radial-gradient(ellipse 120% 85% at 50% 115%, rgba(220,75,10,0.80) 0%, rgba(160,48,6,0.55) 28%, rgba(80,22,3,0.28) 52%, transparent 72%)',
          animationName: 'elderFire', animationDuration: `${7 - effective * 2.2}s`,
          animationDelay: `${flickerPhaseOffsets[1]}s`,
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
          mixBlendMode: 'screen',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, width: '42%', height: '80vh',
          background: 'radial-gradient(ellipse 85% 100% at 28% 115%, rgba(200,62,8,0.65) 0%, rgba(140,42,5,0.35) 45%, transparent 70%)',
          animationName: 'elderFireL', animationDuration: `${5.3 - effective * 1.7}s`,
          animationDelay: `${flickerPhaseOffsets[2]}s`,
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
          mixBlendMode: 'screen',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, right: 0, width: '42%', height: '75vh',
          background: 'radial-gradient(ellipse 85% 100% at 72% 115%, rgba(190,58,6,0.60) 0%, rgba(130,38,4,0.32) 45%, transparent 70%)',
          animationName: 'elderFireR', animationDuration: `${6.7 - effective * 2.1}s`,
          animationDelay: `${flickerPhaseOffsets[3]}s`,
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
          mixBlendMode: 'screen',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: '20%', right: '20%', height: '90vh',
          background: 'radial-gradient(ellipse 70% 100% at 50% 115%, rgba(255,108,16,0.55) 0%, rgba(200,68,10,0.30) 38%, rgba(120,36,5,0.15) 62%, transparent 78%)',
          animationName: 'elderFireC', animationDuration: `${4.1 - effective * 1.3}s`,
          animationDelay: `${flickerPhaseOffsets[4]}s`,
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
          mixBlendMode: 'screen',
        }} />
        {/* Hot core — real flame is white-yellow at its hottest point, not
            just a brighter orange; the five layers above never got past
            orange-red, which read as a warm glow rather than combustion.
            Small, low, additive (screen), and fast -- the hottest part of
            a fire is also its most restless. */}
        <div style={{
          position: 'absolute', bottom: '-2vh', left: '38%', right: '38%', height: '22vh',
          background: 'radial-gradient(ellipse 80% 90% at 50% 100%, rgba(255,244,214,0.95) 0%, rgba(255,196,110,0.7) 30%, rgba(255,140,40,0.35) 58%, transparent 78%)',
          animationName: 'elderFireCore', animationDuration: `${1.1 - effective * 0.3}s`,
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
          mixBlendMode: 'screen',
        }} />
        {/* Crackle layers — the five layers above (plus the core) all move
            on slow, smooth ease-in-out cycles, which reads as a "breathing
            glow" rather than fire: real flame has fast, small, irregular
            flutter riding on top of that slower body motion. These two are
            short, jagged (a 5-step keyframe rather than a smooth curve),
            and asymmetric in placement so they don't visually average out
            into a third slow layer. */}
        <div style={{
          position: 'absolute', bottom: 0, left: '30%', width: '18%', height: '38vh',
          background: 'radial-gradient(ellipse 70% 90% at 50% 100%, rgba(255,180,70,0.55) 0%, rgba(230,110,20,0.28) 45%, transparent 70%)',
          animationName: 'elderFireCrackle', animationDuration: '0.45s',
          animationDelay: `${flickerPhaseOffsets[0] * 0.3}s`,
          animationTimingFunction: 'steps(5, end)', animationIterationCount: 'infinite',
          mixBlendMode: 'screen',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, right: '26%', width: '16%', height: '34vh',
          background: 'radial-gradient(ellipse 70% 90% at 50% 100%, rgba(255,170,60,0.5) 0%, rgba(220,100,15,0.25) 45%, transparent 70%)',
          animationName: 'elderFireCrackle', animationDuration: '0.6s',
          animationDelay: `${flickerPhaseOffsets[1] * 0.3}s`,
          animationTimingFunction: 'steps(4, end)', animationIterationCount: 'infinite',
          mixBlendMode: 'screen',
        }} />
        {/* Breath layer — the other four layers flicker on their own independent, arbitrary
            periods (texture); this one is the only thing in the fire tied to the same
            BREATH_CYCLE_MS rhythm as BreathGate/BreathingWait, so the fire's presence
            rises and settles in time with the rest of the ceremony rather than being a
            separate decorative system running beside it. */}
        <div style={{
          position: 'absolute', bottom: '-6vh', left: '5%', right: '5%', height: '95vh',
          background: 'radial-gradient(ellipse 100% 95% at 50% 108%, rgba(255,150,60,0.20) 0%, rgba(210,90,20,0.10) 45%, transparent 75%)',
          animationName: 'elderBreath', animationDuration: `${BREATH_CYCLE_MS}ms`,
          animationDelay: `${breathPhaseOffset}ms`,
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
          mixBlendMode: 'screen',
        }} />
      </div>

      {/* Incense veil — a thin smoke layer that thickens as questions are offered to the fire */}
      <div
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1, overflow: 'hidden',
          opacity: smokeVeil,
          transition: 'opacity 2.2s ease',
        }}
        aria-hidden="true"
      >
        <div style={{
          position: 'absolute', bottom: '5vh', left: '10%', right: '10%', height: '85vh',
          background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(205,178,132,0.30) 0%, rgba(165,132,92,0.16) 35%, transparent 70%)',
          animationName: 'elderSmokeRise', animationDuration: '11s',
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: '25%', width: '30%', height: '95vh',
          background: 'radial-gradient(ellipse 60% 90% at 50% 100%, rgba(188,155,104,0.22) 0%, transparent 65%)',
          animationName: 'elderSmokeRise', animationDuration: '15.5s',
          animationDelay: '-4s',
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, right: '22%', width: '28%', height: '90vh',
          background: 'radial-gradient(ellipse 55% 85% at 50% 100%, rgba(178,145,96,0.20) 0%, transparent 65%)',
          animationName: 'elderSmokeRise', animationDuration: '13.2s',
          animationDelay: '-8s',
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
        }} />
      </div>

      {/* Smoke from the fire — the fire sits below the frame, so this is the
          column of smoke it throws up past the edge of the screen. Unlike the
          incense veil (a flat opacity that thickens with questions), each
          plume here carries its own viscosity and transparency: the thick,
          slow, opaque bodies of smoke rise beside thin, fast, near-clear
          wisps, so the column reads as turbulent rather than uniform. The
          whole layer still rides the same intensity signal as everything
          else — a colder fire throws thinner smoke. */}
      <div
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1, overflow: 'hidden',
          opacity: 0.35 + level * 0.4,
          transition: 'opacity 2.4s ease',
        }}
        aria-hidden="true"
      >
        {[
          // x/width in %, then: viscosity 0–1 (blur + gradient softness + how
          // far the plume holds together), transparency 0–1 (higher = more
          // see-through), and the drift period.
          { left: 8,  width: 34, viscosity: 0.9,  transparency: 0.35, dur: 19,   delay: 0 },
          { left: 30, width: 22, viscosity: 0.35, transparency: 0.8,  dur: 12.5, delay: -3 },
          { left: 44, width: 40, viscosity: 1,    transparency: 0.25, dur: 24,   delay: -9 },
          { left: 58, width: 18, viscosity: 0.2,  transparency: 0.88, dur: 10,   delay: -5 },
          { left: 66, width: 30, viscosity: 0.65, transparency: 0.55, dur: 16,   delay: -12 },
        ].map((p, i) => {
          const alpha = (1 - p.transparency) * 0.42;
          const coreStop = 30 + p.viscosity * 35;   // thick smoke holds its body longer
          const edgeStop = 62 + p.viscosity * 20;
          return (
            <div
              key={i}
              style={{
                position: 'absolute', bottom: 0,
                left: `${p.left}%`, width: `${p.width}%`, height: '112vh',
                background: `radial-gradient(ellipse 65% 92% at 50% 100%, rgba(198,170,124,${alpha}) 0%, rgba(158,128,90,${alpha * 0.55}) ${coreStop}%, transparent ${edgeStop}%)`,
                filter: `blur(${6 + p.viscosity * 26}px)`,
                mixBlendMode: 'screen',
                animationName: i % 2 ? 'elderSmokeColumnAlt' : 'elderSmokeColumn',
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
                animationTimingFunction: 'ease-in-out',
                animationIterationCount: 'infinite',
              }}
            />
          );
        })}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes elderSmokeColumn {
          0%   { transform: translateY(14vh) translateX(-2%) scale(0.92); opacity: 0.35; }
          45%  { transform: translateY(-6vh) translateX(3%)  scale(1.08); opacity: 1; }
          100% { transform: translateY(-30vh) translateX(-1%) scale(1.3); opacity: 0; }
        }
        @keyframes elderSmokeColumnAlt {
          0%   { transform: translateY(16vh) translateX(2%)  scale(0.88); opacity: 0.3; }
          50%  { transform: translateY(-4vh) translateX(-3.5%) scale(1.12); opacity: 0.95; }
          100% { transform: translateY(-34vh) translateX(1%) scale(1.35); opacity: 0; }
        }
        @keyframes elderBreath {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.05); }
        }
        @keyframes elderSmokeRise {
          0%   { transform: translateY(6vh) translateX(0) scaleY(0.9); opacity: 0.55; }
          50%  { transform: translateY(-4vh) translateX(1.5%) scaleY(1.05); opacity: 1; }
          100% { transform: translateY(6vh) translateX(0) scaleY(0.9); opacity: 0.55; }
        }
        @media (prefers-reduced-motion: reduce) {
          [aria-hidden="true"] { animation: none !important; }
        }
      `,
        }}
      />

      {soundEnabled && (
        <button
          onClick={toggleMute}
          aria-label={muted ? 'Unmute fire' : 'Mute fire'}
          title={muted ? 'Unmute' : 'Mute'}
          style={{
            position: 'fixed',
            bottom: 22,
            right: 22,
            zIndex: 9998,
            background: 'rgba(10,8,6,0.72)',
            border: '1px solid rgba(212,168,67,0.22)',
            borderRadius: '50%',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            opacity: muted ? 0.45 : 0.72,
            transition: 'opacity 0.3s ease',
            fontSize: '1rem',
            color: '#d4a843',
            fontFamily: 'Georgia, serif',
          }}
        >
          {muted ? '∅' : '⦜'}
        </button>
      )}
    </>
  );
}

export default memo(FireAtmosphere);
