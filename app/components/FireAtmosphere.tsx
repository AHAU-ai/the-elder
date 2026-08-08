'use client';

import { useEffect, useRef, useState, memo } from 'react';
import { initEmberSparks, initFireCursor, initHearthFire, HearthFireControl } from './enhancements';
import { BREATH_CYCLE_MS } from '../../lib/breathTiming';

interface FireAtmosphereProps {
  soundEnabled?: boolean;
  /** 0–1, grows as the reading/divination progresses. Raises the fire's baseline glow. */
  intensity?: number;
  /** Increment this to mark a question offered to the fire — like adding incense: a brief flare and a veil of smoke that lingers and slowly thickens. */
  pulse?: number;
  /** True while the ceremony is in a failure state (e.g. phase 'error'). Immediately cancels any in-progress flare so the fire dims rather than glowing brighter as it fails. */
  interrupted?: boolean;
}

function FireAtmosphere({ soundEnabled = false, intensity = 0, pulse = 0, interrupted = false }: FireAtmosphereProps) {
  const hearthRef = useRef<HearthFireControl | null>(null);
  const [muted, setMutedState] = useState(false);
  const [boost, setBoost] = useState(0);
  const [smokeCount, setSmokeCount] = useState(0);
  const boostTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstPulse = useRef(true);

  useEffect(() => {
    if (isFirstPulse.current) { isFirstPulse.current = false; return; }
    setBoost(1);
    setSmokeCount(c => c + 1);
    if (boostTimer.current) clearTimeout(boostTimer.current);
    boostTimer.current = setTimeout(() => setBoost(0), 2600);
    return () => { if (boostTimer.current) clearTimeout(boostTimer.current); };
  }, [pulse]);

  // A failure (e.g. rate limit, bad response) can land inside the flare's own
  // decay window. Rather than let the boost fight the dimmed baseline for up
  // to 2.6s, cut it immediately so the fire visibly gutters, not glows, at
  // the moment the ceremony signals it's broken. The smoke veil is left
  // alone — incense already offered doesn't un-thicken because the reading failed.
  useEffect(() => {
    if (!interrupted) return;
    if (boostTimer.current) clearTimeout(boostTimer.current);
    setBoost(0);
  }, [interrupted]);

  const level = Math.min(1, Math.max(0, intensity));
  const effective = Math.min(1.4, level + boost * 0.6);
  const smokeVeil = Math.min(0.65, level * 0.4 + Math.min(smokeCount, 6) * 0.05);

  useEffect(() => {
    const stopSparks = initEmberSparks(document.body);
    const stopCursor = initFireCursor();
    return () => { stopSparks(); stopCursor(); };
  }, []);

  useEffect(() => {
    if (!soundEnabled) return;
    const hearth = initHearthFire();
    hearthRef.current = hearth;
    hearth.start();

    // Autoplay policies keep the AudioContext suspended until it starts
    // inside a user gesture — start() above runs on mount, before any
    // interaction, so resume it again the first time the visitor touches
    // the page.
    function onFirstInteraction() {
      hearth.resume();
      window.removeEventListener('pointerdown', onFirstInteraction);
      window.removeEventListener('keydown', onFirstInteraction);
    }
    window.addEventListener('pointerdown', onFirstInteraction);
    window.addEventListener('keydown', onFirstInteraction);

    return () => {
      hearth.stop();
      window.removeEventListener('pointerdown', onFirstInteraction);
      window.removeEventListener('keydown', onFirstInteraction);
    };
  }, [soundEnabled]);

  function toggleMute() {
    const next = !muted;
    setMutedState(next);
    hearthRef.current?.setMuted(next);
  }

  return (
    <>
      <div
        style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
          filter: `brightness(${1 + effective * 0.45}) saturate(${1 + effective * 0.25})`,
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
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '65vh',
          background: 'radial-gradient(ellipse 120% 85% at 50% 115%, rgba(220,75,10,0.80) 0%, rgba(160,48,6,0.55) 28%, rgba(80,22,3,0.28) 52%, transparent 72%)',
          animationName: 'elderFire', animationDuration: `${7 - effective * 2.2}s`,
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, width: '42%', height: '80vh',
          background: 'radial-gradient(ellipse 85% 100% at 28% 115%, rgba(200,62,8,0.65) 0%, rgba(140,42,5,0.35) 45%, transparent 70%)',
          animationName: 'elderFireL', animationDuration: `${5.3 - effective * 1.7}s`,
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, right: 0, width: '42%', height: '75vh',
          background: 'radial-gradient(ellipse 85% 100% at 72% 115%, rgba(190,58,6,0.60) 0%, rgba(130,38,4,0.32) 45%, transparent 70%)',
          animationName: 'elderFireR', animationDuration: `${6.7 - effective * 2.1}s`,
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: '20%', right: '20%', height: '90vh',
          background: 'radial-gradient(ellipse 70% 100% at 50% 115%, rgba(255,108,16,0.55) 0%, rgba(200,68,10,0.30) 38%, rgba(120,36,5,0.15) 62%, transparent 78%)',
          animationName: 'elderFireC', animationDuration: `${4.1 - effective * 1.3}s`,
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
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
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
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
          background: 'radial-gradient(ellipse 80% 60% at 50% 100%, rgba(180,175,165,0.30) 0%, rgba(140,135,128,0.16) 35%, transparent 70%)',
          animationName: 'elderSmokeRise', animationDuration: '11s',
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: '25%', width: '30%', height: '95vh',
          background: 'radial-gradient(ellipse 60% 90% at 50% 100%, rgba(160,155,148,0.22) 0%, transparent 65%)',
          animationName: 'elderSmokeRise', animationDuration: '15.5s',
          animationDelay: '-4s',
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, right: '22%', width: '28%', height: '90vh',
          background: 'radial-gradient(ellipse 55% 85% at 50% 100%, rgba(150,145,138,0.20) 0%, transparent 65%)',
          animationName: 'elderSmokeRise', animationDuration: '13.2s',
          animationDelay: '-8s',
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
        }} />
      </div>

      <style>{`
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
      `}</style>

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
