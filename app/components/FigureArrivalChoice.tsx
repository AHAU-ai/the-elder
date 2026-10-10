'use client';

// Figure Continuity: the arrival choice (docs/figure-continuity-spec.md v0.2,
// section 3.1). Shown once, when a returning seeker picks the myth their
// confirmed figure is at home in, and ONLY when the server reported the
// capability (/api/user/history?head=1 -> figureContinuity). The choice is made
// each visit and is never persisted: stepping out leaves the figure and every
// kept pairing untouched.
//
// Three equal choices, no default pressed for them:
//   - Continue as {figure}
//   - Step out of the figure for this sitting
//   - Choose a different figure (back to the myths)
//
// The copy is the vessel speaking plainly, not any lineage's authored voice
// (this codebase never invents un-authored lineage copy; see StageUpOffer's
// own note on the same point). The figure is the seeker's own confirmed words,
// rendered as React text only.

interface Props {
  figureLabel: string;
  accent?: string;
  onContinue: () => void;
  onStepOut: () => void;
  onChoose: () => void;
}

const FONT = "'Gentium Plus', Georgia, 'Times New Roman', serif";

export default function FigureArrivalChoice({ figureLabel, accent = '#d4a843', onContinue, onStepOut, onChoose }: Props) {
  return (
    <div
      role="group"
      aria-labelledby="figure-arrival-heading"
      style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: 520,
        textAlign: 'center',
        fontFamily: FONT,
      }}
    >
      <div
        id="figure-arrival-heading"
        className="fire-shadow"
        style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(1.3rem, 3.4vw, 1.9rem)',
          color: '#d4a843',
          letterSpacing: '0.18em',
          marginBottom: 14,
        }}
      >
        WHO SITS AT THE FIRE TONIGHT
      </div>

      <div style={{ fontStyle: 'italic', color: '#c4b89a', fontSize: '0.95rem', lineHeight: 1.8, marginBottom: 6, opacity: 0.85 }}>
        In this myth you named yourself
      </div>
      <div style={{ fontStyle: 'italic', color: '#e8c97a', fontSize: '1.25rem', lineHeight: 1.6, marginBottom: 30, textShadow: `0 0 22px ${accent}55` }}>
        &ldquo;{figureLabel}&rdquo;
      </div>

      <div style={{ display: 'grid', gap: 12, marginBottom: 22 }}>
        <ChoiceButton accent={accent} onClick={onContinue}>
          Continue as {figureLabel}
        </ChoiceButton>
        <ChoiceButton accent={accent} onClick={onStepOut}>
          Step out of the figure for this sitting
        </ChoiceButton>
        <ChoiceButton accent={accent} onClick={onChoose}>
          Choose a different figure
        </ChoiceButton>
      </div>

      <div style={{ fontSize: '0.74rem', color: '#a8916f', fontStyle: 'italic', lineHeight: 1.75, opacity: 0.85 }}>
        Stepping out leaves the figure, and anything you have kept, untouched.
        You choose again each time you return.
      </div>
    </div>
  );
}

function ChoiceButton({ accent, onClick, children }: { accent: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'rgba(212,168,67,0.04)',
        border: `1px solid ${accent}55`,
        color: '#e8c97a',
        fontFamily: FONT,
        fontStyle: 'italic',
        fontSize: '1.0rem',
        lineHeight: 1.5,
        padding: '14px 20px',
        minHeight: 48,
        cursor: 'pointer',
        borderRadius: 2,
        textAlign: 'center',
        transition: 'background 0.25s, border-color 0.25s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = `${accent}18`; e.currentTarget.style.borderColor = accent; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,168,67,0.04)'; e.currentTarget.style.borderColor = `${accent}55`; }}
    >
      {children}
    </button>
  );
}
