'use client';
import { useState, useEffect, useCallback } from 'react';
import { LINEAGES, LineageKey, Lineage } from '../lib/lineages';

const FONT_HEADER = "'Cinzel', Georgia, serif";
const FONT_BODY   = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function LineageSigil({
  lineage,
  size = 40,
  activated = false,
}: {
  lineage: Lineage;
  size?: number;
  activated?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 70 70"
      width={size}
      height={size}
      fill="none"
      aria-label={lineage.sigilLabel}
      style={{
        display: 'block',
        filter: activated
          ? `drop-shadow(0 0 14px ${lineage.palette.primary}) drop-shadow(0 0 28px ${lineage.palette.primary}88)`
          : `drop-shadow(0 0 5px ${lineage.palette.primary}55)`,
        transition: 'filter 0.4s ease',
        animationName: activated ? 'sigilPulse' : 'none',
        animationDuration: '2.4s',
        animationTimingFunction: 'ease-in-out',
        animationIterationCount: 'infinite',
      }}
    >
      <path
        d={lineage.sigil}
        stroke={lineage.palette.primary}
        strokeWidth={activated ? '1.8' : '1.3'}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={activated ? 1 : 0.85}
        style={{ transition: 'stroke-width 0.3s ease, opacity 0.3s ease' }}
      />
    </svg>
  );
}

function ActivationOverlay({
  lineage,
  onComplete,
}: {
  lineage: Lineage;
  onComplete: (thresholdQuestion: string | null) => void;
}) {
  const [question, setQuestion]               = useState<string | null>(null);
  const [questionVisible, setQuestionVisible] = useState(false);
  const [timeMeaning, setTimeMeaning]         = useState<string | null>(null);
  const [ready, setReady]                     = useState(false);

  const fetchThreshold = useCallback(async () => {
    try {
      const tzOffset = new Date().getTimezoneOffset() * -1;
      const res = await fetch('/api/threshold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oracleRegister: lineage.oracleRegister,
          tradition: lineage.tradition,
          timeZoneOffset: tzOffset * 60,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.question) {
        setQuestion(data.question);
        setTimeMeaning(data.timeMeaning ?? null);
        setTimeout(() => setQuestionVisible(true), 200);
      }
    } catch {
      // Silent failure -- falls back to static invocation
    }
  }, [lineage.oracleRegister, lineage.tradition]);

  useEffect(() => {
    fetchThreshold();
    const minTimer = setTimeout(() => setReady(true), 2800);
    return () => clearTimeout(minTimer);
  }, [fetchThreshold]);

  useEffect(() => {
    if (!ready) return;
    if (question !== null) {
      const t = setTimeout(() => onComplete(question), 1800);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => onComplete(null), 1200);
      return () => clearTimeout(t);
    }
  }, [ready, question, onComplete]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: lineage.palette.background,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        animationName: 'elderReveal',
        animationDuration: '0.6s',
        animationTimingFunction: 'ease',
        animationFillMode: 'forwards',
      }}
    >
      {[200, 140, 90].map((size, i) => (
        <div
          key={size}
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: '50%',
            border: `1px solid ${lineage.palette.primary}${['33','28','20'][i]}`,
            animationName: 'sigilRing',
            animationDuration: '2.4s',
            animationTimingFunction: 'ease-in-out',
            animationIterationCount: 'infinite',
            animationDelay: `${i * 0.35}s`,
          }}
        />
      ))}

      <div style={{ position: 'relative', zIndex: 1, marginBottom: 28 }}>
        <LineageSigil lineage={lineage} size={84} activated />
      </div>

      {lineage.borderFragment && (
        <div
          style={{
            textAlign: 'center',
            marginBottom: 20,
            animationName: 'elderReveal',
            animationDuration: '1s',
            animationDelay: '0.5s',
            animationTimingFunction: 'ease',
            animationFillMode: 'both',
          }}
        >
          <div
            style={{
              fontFamily: FONT_BODY,
              fontSize: '1.5rem',
              color: lineage.palette.primary,
              letterSpacing: '0.14em',
              marginBottom: 8,
              textShadow: `0 0 32px ${lineage.palette.primary}88`,
            }}
          >
            {lineage.borderFragment}
          </div>
          <div
            style={{
              fontFamily: FONT_BODY,
              fontStyle: 'italic',
              fontSize: '0.82rem',
              color: lineage.palette.smoke,
              letterSpacing: '0.05em',
              opacity: 0.7,
            }}
          >
            {lineage.borderFragmentTranslation}
          </div>
        </div>
      )}

      {timeMeaning && (
        <div
          style={{
            fontFamily: FONT_BODY,
            fontStyle: 'italic',
            fontSize: '0.82rem',
            color: lineage.palette.smoke,
            maxWidth: 380,
            textAlign: 'center',
            lineHeight: 1.6,
            padding: '0 24px',
            marginBottom: 16,
            opacity: 0.6,
            animationName: 'elderReveal',
            animationDuration: '0.8s',
            animationDelay: '1s',
            animationTimingFunction: 'ease',
            animationFillMode: 'both',
          }}
        >
          {timeMeaning}
        </div>
      )}

      {questionVisible && question && (
        <div
          style={{
            fontFamily: FONT_BODY,
            fontStyle: 'italic',
            fontSize: '1.08rem',
            color: lineage.palette.accent,
            maxWidth: 440,
            textAlign: 'center',
            lineHeight: 1.8,
            padding: '0 28px',
            animationName: 'elderReveal',
            animationDuration: '1s',
            animationTimingFunction: 'ease',
            animationFillMode: 'both',
            textShadow: `0 0 20px ${lineage.palette.primary}44`,
          }}
        >
          {question}
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          bottom: 48,
          fontFamily: FONT_HEADER,
          fontSize: '0.55rem',
          letterSpacing: '0.44em',
          color: lineage.palette.smoke,
          textTransform: 'uppercase',
          opacity: 0.5,
          animationName: 'elderReveal',
          animationDuration: '1s',
          animationDelay: '0.3s',
          animationTimingFunction: 'ease',
          animationFillMode: 'both',
        }}
      >
        {lineage.tradition}
      </div>
    </div>
  );
}

export default function LineageSelector({
  onSelect,
}: {
  onSelect: (key: LineageKey, thresholdQuestion: string | null) => void;
}) {
  const [hovered, setHovered]       = useState<LineageKey | null>(null);
  const [activating, setActivating] = useState<LineageKey | null>(null);

  const lineages          = Object.values(LINEAGES).filter(l => l.key !== 'default');
  const hoveredLineage    = hovered && hovered !== 'default' ? LINEAGES[hovered] : null;
  const activatingLineage = activating ? LINEAGES[activating] : null;

  function handleSelect(key: LineageKey) {
    setActivating(key);
  }

  const handleActivationComplete = useCallback(
    (thresholdQuestion: string | null) => {
      if (activating) onSelect(activating, thresholdQuestion);
    },
    [activating, onSelect]
  );

  return (
    <>
      <style>{`
        @keyframes sigilPulse {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          50%       { opacity: 1;    transform: scale(1.07); }
        }
        @keyframes sigilRing {
          0%, 100% { transform: scale(1);    opacity: 0.4; }
          50%       { transform: scale(1.14); opacity: 0.12; }
        }
        @keyframes elderReveal {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {activatingLineage && (
        <ActivationOverlay
          lineage={activatingLineage}
          onComplete={handleActivationComplete}
        />
      )}

      <div style={{ width: '100%', maxWidth: 600, margin: '0 auto', padding: '0 0 56px' }}>

        <div
          style={{
            textAlign: 'center',
            minHeight: 112,
            marginBottom: 28,
            padding: '0 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              fontFamily: FONT_BODY,
              fontStyle: 'italic',
              fontSize: '1.05rem',
              color: hoveredLineage ? hoveredLineage.palette.accent : '#c4b89a',
              lineHeight: 1.8,
              transition: 'color 0.35s ease, opacity 0.35s ease',
              opacity: hoveredLineage ? 1 : 0.4,
              maxWidth: 500,
            }}
          >
            {hoveredLineage
              ? hoveredLineage.invocation
              : 'Hover a tradition. Let it name itself to you.'}
          </div>
          {hoveredLineage?.borderFragment && (
            <div
              style={{
                fontFamily: FONT_BODY,
                fontSize: '0.9rem',
                color: hoveredLineage.palette.primary,
                letterSpacing: '0.1em',
                opacity: 0.7,
              }}
            >
              {hoveredLineage.borderFragment}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
            gap: 9,
            marginBottom: 20,
          }}
        >
          {lineages.map((l) => {
            const isHovered = hovered === l.key;
            return (
              <button
                key={l.key}
                onMouseEnter={() => setHovered(l.key)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(l.key)}
                onBlur={() => setHovered(null)}
                onClick={() => handleSelect(l.key)}
                aria-label={`Enter through the ${l.tradition} lineage`}
                style={{
                  background: isHovered
                    ? `rgba(${hexToRgb(l.palette.primary)}, 0.07)`
                    : 'transparent',
                  border: `1px solid ${isHovered ? l.palette.primary : 'rgba(212,168,67,0.13)'}`,
                  padding: '18px 8px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all 0.22s ease',
                  outline: 'none',
                }}
              >
                <LineageSigil lineage={l} size={38} activated={isHovered} />
                <div
                  style={{
                    fontFamily: FONT_HEADER,
                    fontSize: '0.56rem',
                    letterSpacing: '0.18em',
                    color: isHovered ? l.palette.primary : '#7a6a5a',
                    textTransform: 'uppercase',
                    transition: 'color 0.22s ease',
                    lineHeight: 1.5,
                    textAlign: 'center',
                  }}
                >
                  {l.label}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', paddingTop: 4 }}>
          <button
            onMouseEnter={() => setHovered('default')}
            onMouseLeave={() => setHovered(null)}
            onClick={() => handleSelect('default')}
            aria-label="Enter without a lineage"
            style={{
              background: 'transparent',
              border: 'none',
              color: hovered === 'default' ? '#c4b89a' : '#5a4a3a',
              fontFamily: FONT_BODY,
              fontStyle: 'italic',
              fontSize: '0.95rem',
              cursor: 'pointer',
              padding: '8px 0',
              transition: 'color 0.22s ease',
            }}
          >
            The ceremonial space is open \u2014 the fire knows where to find you
          </button>
        </div>
      </div>
    </>
  );
}
