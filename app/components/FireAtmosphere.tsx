'use client';

import { useEffect, useRef, useState } from 'react';
import { initEmberSparks, initFireCursor, initHearthFire, HearthFireControl } from './enhancements';

interface FireAtmosphereProps {
  soundEnabled?: boolean;
}

export default function FireAtmosphere({ soundEnabled = false }: FireAtmosphereProps) {
  const hearthRef = useRef<HearthFireControl | null>(null);
  const [muted, setMutedState] = useState(false);

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
    return () => { hearth.stop(); };
  }, [soundEnabled]);

  function toggleMute() {
    const next = !muted;
    setMutedState(next);
    hearthRef.current?.setMuted(next);
  }

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}
        aria-hidden="true"
      >
        <div style={{
          position: 'absolute', bottom: '-4vh', left: '15%', right: '15%', height: '32vh',
          background: 'radial-gradient(ellipse 90% 90% at 50% 105%, rgba(255,145,28,0.75) 0%, rgba(240,100,14,0.42) 40%, transparent 68%)',
          animationName: 'elderFire', animationDuration: '3.5s',
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '65vh',
          background: 'radial-gradient(ellipse 120% 85% at 50% 115%, rgba(220,75,10,0.80) 0%, rgba(160,48,6,0.55) 28%, rgba(80,22,3,0.28) 52%, transparent 72%)',
          animationName: 'elderFire', animationDuration: '7s',
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, width: '42%', height: '80vh',
          background: 'radial-gradient(ellipse 85% 100% at 28% 115%, rgba(200,62,8,0.65) 0%, rgba(140,42,5,0.35) 45%, transparent 70%)',
          animationName: 'elderFireL', animationDuration: '5.3s',
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, right: 0, width: '42%', height: '75vh',
          background: 'radial-gradient(ellipse 85% 100% at 72% 115%, rgba(190,58,6,0.60) 0%, rgba(130,38,4,0.32) 45%, transparent 70%)',
          animationName: 'elderFireR', animationDuration: '6.7s',
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: '20%', right: '20%', height: '90vh',
          background: 'radial-gradient(ellipse 70% 100% at 50% 115%, rgba(255,108,16,0.55) 0%, rgba(200,68,10,0.30) 38%, rgba(120,36,5,0.15) 62%, transparent 78%)',
          animationName: 'elderFireC', animationDuration: '4.1s',
          animationTimingFunction: 'ease-in-out', animationIterationCount: 'infinite',
        }} />
      </div>

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
