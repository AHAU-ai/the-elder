'use client';

import { useEffect } from 'react';
import { initEmberSparks, initFireCursor } from './enhancements';

export default function FireAtmosphere() {
  useEffect(() => {
    const stopSparks = initEmberSparks(document.body);
    const stopCursor = initFireCursor();
    return () => {
      stopSparks();
      stopCursor();
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
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
  );
}
