'use client';
import { useState, useEffect, useCallback } from 'react';
import { LINEAGES, LineageKey, Lineage, matchLineageByText } from '../lib/lineages';
import { routeInquiry, type RoutedCandidate } from '../lib/mythRoutingIndex';
import { WordReveal } from './components/WordReveal';
import LineageConfirm from './components/LineageConfirm';

const FONT_HEADER = "'Inter', Arial, sans-serif";
const FONT_BODY   = "'Gentium Plus', Georgia, 'Times New Roman', serif";

// Wisdom-quote overlay pacing (ActivationOverlay below). QUOTE_REVEAL_DELAY_MS
// must match the delayMs passed to WordReveal for the quote -- it's read here
// too so the post-reveal hold calculation isn't guessing at how long the
// reveal itself already took.
const QUOTE_REVEAL_DELAY_MS = 220;
const READING_MS_PER_WORD   = 280; // ~215 wpm comfortable reading pace
const MIN_HOLD_MS           = 1500;
const FADE_MS                = 1000;
const MAX_TOTAL_MS          = 15000; // reveal + hold + fade, whole overlay lifecycle

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

function ElderLogo({ size = 88 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <circle cx="50" cy="50" r="47" stroke="#d4a843" strokeWidth="0.6" opacity="0.35" />
      <circle cx="50" cy="50" r="38" stroke="#d4a843" strokeWidth="0.6" opacity="0.5" />
      <path
        d="M50 20 C 58 34, 58 42, 50 50 C 42 58, 42 66, 50 80"
        stroke="#d4a843"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M50 20 C 42 34, 42 42, 50 50 C 58 58, 58 66, 50 80"
        stroke="#d4a843"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="50" cy="50" r="3.2" fill="#d4a843" />
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
  const [fadingOut, setFadingOut]             = useState(false);

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

  // If there's no quote to read, fall back to the old fixed-delay pacing.
  useEffect(() => {
    if (!ready || question !== null) return;
    const t = setTimeout(() => onComplete(null), 1200);
    return () => clearTimeout(t);
  }, [ready, question, onComplete]);

  // Word-count-based hold, capped so the whole overlay lifecycle (reveal +
  // hold + fade) never exceeds MAX_TOTAL_MS regardless of quote length --
  // was a flat 20s hold + 2s fade on top of the reveal itself, which ran
  // ~25-30s total for a typical question. READING_MS_PER_WORD is a rough
  // comfortable-reading-pace estimate (~215 wpm); MIN_HOLD_MS keeps even a
  // short quote from vanishing the instant it finishes revealing.
  const [quoteFullyRevealed, setQuoteFullyRevealed] = useState(false);
  useEffect(() => {
    if (!quoteFullyRevealed || !question) return;
    const wordCount = question.split(' ').length;
    const revealMs = wordCount * QUOTE_REVEAL_DELAY_MS;
    const holdMs = Math.max(
      MIN_HOLD_MS,
      Math.min(wordCount * READING_MS_PER_WORD, MAX_TOTAL_MS - revealMs - FADE_MS)
    );
    const holdTimer = setTimeout(() => {
      setFadingOut(true);
      setTimeout(() => onComplete(question), FADE_MS);
    }, holdMs);
    return () => clearTimeout(holdTimer);
  }, [quoteFullyRevealed, question, onComplete]);

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
        animationName: fadingOut ? 'none' : 'lineageReveal',
        animationDuration: '0.6s',
        animationTimingFunction: 'ease',
        animationFillMode: 'forwards',
        opacity: fadingOut ? 0 : 1,
        transition: fadingOut ? `opacity ${FADE_MS}ms ease` : 'none',
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
            animationName: 'lineageReveal',
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
            animationName: 'lineageReveal',
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
            textShadow: `0 0 20px ${lineage.palette.primary}44`,
          }}
        >
          <WordReveal
            text={question}
            delayMs={QUOTE_REVEAL_DELAY_MS}
            wordDurationMs={500}
            onComplete={() => setQuoteFullyRevealed(true)}
          />
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
          animationName: 'lineageReveal',
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

// Free-text / dropdown entry, added alongside the sigil wheel above -- not a
// replacement for it. matchLineageByText is keyword-scored against each
// lineage's own metadata today (see lib/lineages.ts); it's the seam where
// real semantic corpus-routing gets swapped in later, once lineages beyond
// mekubal have real embedded corpus content -- this component only needs
// the returned LineageKey, so that swap won't touch anything here.
function NameItYourself({
  lineages,
  onSelect,
}: {
  lineages: Lineage[];
  onSelect: (key: LineageKey) => void;
}) {
  const [text, setText] = useState('');
  const [noMatch, setNoMatch] = useState(false);
  // A2: a free-text inquiry never routes straight to a lineage. It first
  // becomes a PROPOSAL (routeInquiry() from the myth routing index, or the
  // older keyword match as a fallback when the index itself finds
  // nothing) that the seeker must explicitly accept or decline in
  // LineageConfirm below. onSelect() -- which activates the crossing --
  // is only ever called from that confirm step's "Yes", never from here
  // directly.
  const [pendingCandidate, setPendingCandidate] = useState<RoutedCandidate | null>(null);

  function submitText() {
    const routed = routeInquiry(text);
    if (routed.length > 0) {
      setNoMatch(false);
      setPendingCandidate(routed[0]);
      return;
    }
    // Fallback: the older UI-copy keyword match still catches inquiries
    // the authored routing index doesn't cover (e.g. a lineage named
    // directly by its label/tradition string rather than a figure/motif).
    // Still routed through the same confirm step -- a fallback match is
    // no more "automatic" than a primary one.
    const key = matchLineageByText(text);
    if (key) {
      setNoMatch(false);
      setPendingCandidate({ lineageKey: key as RoutedCandidate['lineageKey'], reason: 'this is the closest name the fire recognizes', score: 0 });
    } else {
      setNoMatch(true);
    }
  }

  if (pendingCandidate) {
    return (
      <LineageConfirm
        candidate={pendingCandidate}
        onAccept={(key) => {
          setPendingCandidate(null);
          onSelect(key);
        }}
        onChooseDifferently={() => {
          setPendingCandidate(null);
          setText('');
        }}
      />
    );
  }

  // No separate "Or name it yourself" label here -- the single guide
  // sentence above the wheel (LineageSelector's own invocation text) now
  // states both paths ("choose a lineage below, or speak what you carry"),
  // so a second, redundant micro-header just added visual noise for no
  // extra clarity.
  return (
    <div style={{ textAlign: 'center', marginTop: 8, marginBottom: 28 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <select
          value=""
          onChange={e => {
            if (e.target.value) onSelect(e.target.value as LineageKey);
          }}
          aria-label="Choose a tradition from the list"
          style={{
            background: 'transparent',
            border: '1px solid rgba(212,168,67,0.3)',
            color: '#ede0c4',
            fontFamily: FONT_BODY,
            fontStyle: 'italic',
            // 1rem floor, not 0.9rem -- below 16px effective size, iOS
            // Safari auto-zooms the viewport on focus, which felt like a
            // bug on a touch device. Also just plainly easier to read.
            fontSize: '1rem',
            padding: '11px 12px',
            borderRadius: 4,
            outline: 'none',
          }}
        >
          <option value="" disabled>
            Choose from the list…
          </option>
          {lineages.map(l => (
            <option key={l.key} value={l.key} style={{ background: '#0a0806', color: '#ede0c4' }}>
              {l.label}
            </option>
          ))}
        </select>

        <span style={{ color: '#a8916f', fontFamily: FONT_BODY, fontStyle: 'italic', fontSize: '0.9rem' }}>
          or
        </span>

        <input
          type="text"
          value={text}
          onChange={e => { setText(e.target.value); if (noMatch) setNoMatch(false); }}
          onKeyDown={e => { if (e.key === 'Enter') submitText(); }}
          placeholder="Speak what you carry…"
          aria-label="Speak what you carry, and the fire will find your lineage"
          style={{
            flex: '1 1 220px',
            maxWidth: 280,
            background: 'transparent',
            border: '1px solid rgba(212,168,67,0.3)',
            color: '#ede0c4',
            fontFamily: FONT_BODY,
            fontStyle: 'italic',
            fontSize: '1rem',
            padding: '11px 12px',
            borderRadius: 4,
            outline: 'none',
          }}
        />

        <button
          onClick={submitText}
          disabled={!text.trim()}
          style={{
            background: 'transparent',
            border: '1px solid rgba(212,168,67,0.5)',
            color: '#e4d9bf',
            fontFamily: FONT_HEADER,
            fontSize: '0.68rem',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            padding: '11px 16px',
            borderRadius: 4,
            cursor: text.trim() ? 'pointer' : 'not-allowed',
            opacity: text.trim() ? 1 : 0.4,
          }}
        >
          Enter
        </button>
      </div>

      {noMatch && (
        <div
          style={{
            marginTop: 10,
            fontFamily: FONT_BODY,
            fontStyle: 'italic',
            fontSize: '0.9rem',
            color: '#c4b89a',
          }}
        >
          The fire does not know that name yet — choose a path above.
        </div>
      )}
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
        /* Named distinctly from the global elderReveal keyframe
           (app/globals.css) -- both were previously named "elderReveal"
           with different translateY values, and since neither is
           CSS-module-scoped, whichever stylesheet cascaded last silently
           won for every consumer of animationName:'elderReveal' app-wide.
           Found during the transition-consistency audit; renamed rather
           than deduplicated since this component's smaller 6px offset is
           deliberately subtler than the global 10px one. */
        @keyframes lineageReveal {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lineage-oval {
          aspect-ratio: 1.55;
        }
        .lineage-node {
          width: clamp(64px, 22vw, 92px);
        }
        .lineage-node-label {
          /* Raised floor from 0.44rem (~7px, unreadable on a small phone)
             to 0.6rem (~9.6px) -- still the smallest text on this screen
             by design (it's a label under a sigil, not the primary
             instruction), but no longer below a legible size. */
          font-size: clamp(0.6rem, 2vw, 0.68rem);
        }
        @media (max-width: 480px) {
          .lineage-oval {
            aspect-ratio: 1.02;
          }
        }
      `}</style>

      {activatingLineage && (
        <ActivationOverlay
          lineage={activatingLineage}
          onComplete={handleActivationComplete}
        />
      )}

      <div style={{ width: '100%', maxWidth: 700, margin: '0 auto', padding: '0 0 56px' }}>

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
              // clamp floor raised to 1rem (from a flat 1.05rem) so this
              // never shrinks below comfortably-readable on a small phone,
              // and the default (non-hover) state now renders at full
              // opacity instead of the old 0.4 -- that dimming was fighting
              // legibility on exactly the copy meant to orient a seeker who
              // hasn't touched anything yet.
              fontSize: 'clamp(1rem, 4.2vw, 1.25rem)',
              color: hoveredLineage ? hoveredLineage.palette.accent : '#e4d9bf',
              lineHeight: 1.8,
              transition: 'color 0.35s ease',
              maxWidth: 500,
            }}
          >
            {hoveredLineage
              ? hoveredLineage.invocation
              : 'Choose a lineage below, or speak what you carry and let the fire name it.'}
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
          className="lineage-oval"
          style={{
            position: 'relative',
            width: 'min(640px, 94vw)',
            margin: '0 auto 20px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              opacity: 0.85,
              pointerEvents: 'none',
            }}
          >
            <ElderLogo size={72} />
          </div>

          {lineages.map((l, i) => {
            const isHovered = hovered === l.key;
            const angle = (2 * Math.PI * i) / lineages.length - Math.PI / 2;
            const rx = 46;
            const ry = 44;
            const left = 50 + rx * Math.cos(angle);
            const top = 50 + ry * Math.sin(angle);
            return (
              <button
                key={l.key}
                onMouseEnter={() => setHovered(l.key)}
                onMouseLeave={() => setHovered(null)}
                onFocus={() => setHovered(l.key)}
                onBlur={() => setHovered(null)}
                onClick={() => handleSelect(l.key)}
                aria-label={`Enter through the ${l.tradition} lineage`}
                className="lineage-node"
                style={{
                  position: 'absolute',
                  left: `${left}%`,
                  top: `${top}%`,
                  transform: `translate(-50%, -50%) scale(${isHovered ? 1.08 : 1})`,
                  background: isHovered
                    ? `rgba(${hexToRgb(l.palette.primary)}, 0.09)`
                    : 'transparent',
                  border: `1px solid ${isHovered ? l.palette.primary : 'rgba(212,168,67,0.13)'}`,
                  padding: '14px 8px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 4,
                  transition: 'background 0.35s ease, border 0.35s ease, box-shadow 0.45s ease, transform 0.35s ease',
                  outline: 'none',
                  boxShadow: isHovered
                    ? `0 0 28px 6px rgba(${hexToRgb(l.palette.primary)}, 0.16), 0 0 10px 2px rgba(${hexToRgb(l.palette.primary)}, 0.10)`
                    : 'none',
                }}
              >
                <LineageSigil lineage={l} size={32} activated={isHovered} />
                <div
                  className="lineage-node-label"
                  style={{
                    fontFamily: FONT_HEADER,
                    letterSpacing: '0.16em',
                    color: isHovered ? l.palette.primary : '#a8916f',
                    textTransform: 'uppercase',
                    transition: 'color 0.22s ease',
                    lineHeight: 1.4,
                    textAlign: 'center',
                  }}
                >
                  {l.label}
                </div>
              </button>
            );
          })}
        </div>

        <NameItYourself lineages={lineages} onSelect={handleSelect} />

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
            The ceremonial space is open — the fire knows where to find you
          </button>
        </div>
      </div>
    </>
  );
}
