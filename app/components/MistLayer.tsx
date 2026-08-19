'use client'

interface MistLayerProps {
  /** 0–1, from usePresence(). Stillness lets the mist gather; movement thins it back down — the room settles when the seeker does. */
  density?: number;
}

export function MistLayer({ density = 0.6 }: MistLayerProps) {
  const d = Math.min(1, Math.max(0, density));
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', inset: 0, overflow: 'hidden',
        pointerEvents: 'none', zIndex: 0,
        opacity: 0.4 + d * 0.6,
        transition: 'opacity 2.4s ease',
      }}
    >
      <style>{`
        @keyframes mistRise {
          0%   { transform: translateY(0);      opacity: 0; }
          14%  {                                opacity: 0.055; }
          86%  {                                opacity: 0.055; }
          100% { transform: translateY(-100vh); opacity: 0; }
        }
      `}</style>
      {([
        [8,  200, 38,  0  ],
        [25, 150, 45, -9  ],
        [48, 280, 32, -16 ],
        [67, 170, 42, -24 ],
        [82, 220, 37, -5  ],
        [15, 130, 50, -31 ],
        [58, 190, 41, -19 ],
        [38, 240, 34, -13 ],
      ] as [number,number,number,number][]).map(([left, size, dur, delay], i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            bottom: '-18%',
            left: `${left}%`,
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(196,184,154,0.18) 0%, transparent 70%)',
            filter: `blur(${Math.round(size * 0.42)}px)`,
            animation: `mistRise ${dur}s ease-in-out ${delay}s infinite`,
          }}
        />
      ))}
    </div>
  )
}
