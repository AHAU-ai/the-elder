'use client';

// app/components/CeremonyGround.tsx
//
// The one persistent ground the whole opening sequence stands on. Mounted
// once in the root layout, next to FireAtmosphere, and never unmounted --
// so the breath, the age beat and lineage-select are all the same room,
// not screens that swap.
//
// The scattered ember field lives here, behind everything, continuous.
// It was originally lifted from the now-removed ElderFrontDoor, which was
// the only opening beat that had one while every other beat had a bare
// obsidian fill -- the space visibly changed character between beats.
//
// Deliberately NOT lineage-aware (see docs/fire-container-decision.md --
// one container, no per-tradition re-skin). No intensity/pulse prop
// either: the fire's felt surge lives in FireAtmosphere; this is just the
// still ground it burns on.

import type React from 'react';
import { useMemo, useState, useEffect } from 'react';

const C = {
  obsidian: '#0a0806',
  gold:     '#d4a843',
  ember:    '#c8601a',
};

function randBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// Every ember gets its own position, size, drift, duration and delay, so
// nothing sits on a grid and nothing repeats visibly.
function makeEmberField(count: number) {
  return [...Array(count)].map((_, i) => ({
    id: `cg-ember-${i}`,
    x: randBetween(3, 97),
    y: randBetween(5, 97),
    size: randBetween(0.7, 2.2),
    driftX: randBetween(-16, 16),
    driftY: randBetween(-24, -6),
    duration: randBetween(5, 11),
    delay: randBetween(0, 6),
    baseOpacity: randBetween(0.1, 0.36),
    color: Math.random() > 0.65 ? C.ember : C.gold,
  }));
}

export default function CeremonyGround() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const embers = useMemo(() => (reduced ? [] : makeEmberField(26)), [reduced]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 0,
        pointerEvents: 'none', overflow: 'hidden',
        // The obsidian floor the fire sits on. Every opening beat renders
        // transparently over this now instead of painting its own opaque
        // fill, so FireAtmosphere (behind) and this ember field stay
        // visible through all of them.
        background:
          `radial-gradient(ellipse 120% 80% at 50% 118%, #1a0f07 0%, ${C.obsidian} 55%, #070504 100%)`,
      }}
    >
      <style>{`
        @keyframes cgEmberDrift {
          0%   { transform: translate(0, 0);                   opacity: var(--o); }
          50%  { transform: translate(var(--dx), var(--dy));   opacity: calc(var(--o) * 1.8); }
          100% { transform: translate(0, 0);                   opacity: var(--o); }
        }
        .cg-ember { animation: cgEmberDrift var(--dur) ease-in-out var(--delay) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .cg-ember { animation: none !important; }
        }
      `}</style>

      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
        {embers.map(e => (
          <circle
            key={e.id}
            className="cg-ember"
            style={{
              '--o': `${e.baseOpacity}`,
              '--dx': `${e.driftX}px`,
              '--dy': `${e.driftY}px`,
              '--dur': `${e.duration}s`,
              '--delay': `${e.delay}s`,
            } as React.CSSProperties}
            cx={`${e.x}%`} cy={`${e.y}%`} r={e.size} fill={e.color}
          />
        ))}
      </svg>
    </div>
  );
}
