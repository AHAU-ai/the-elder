'use client';

// RecallLetter.tsx
//
// A dismissible callout surfaced once at the start of a new sitting,
// carrying forward one past kept Threshold Letter — closing the loop
// between sittings instead of leaving each one sealed off at /letters.
// Styled consistent with ThresholdLetters.tsx's letter-card treatment.

import { LINEAGES, type LineageKey } from '../../lib/lineages';

interface LetterEntry {
  id: number;
  lineageKey: string;
  returnGift: string;
  thresholdImage: string;
  createdAt: string;
}

const C = {
  gold:  '#d4a843',
  bone:  '#ede0c4',
  ash:   '#c4b89a',
  smoke: '#8a7a6a',
};

export default function RecallLetter({ letter, onDismiss }: { letter: LetterEntry; onDismiss: () => void }) {
  const lineage = LINEAGES[letter.lineageKey as LineageKey];
  const accent = lineage?.palette?.primary ?? C.gold;

  return (
    <div style={{
      maxWidth: 560,
      width: '100%',
      margin: '0 auto 32px',
      background: 'rgba(8,6,4,0.93)',
      border: `1px solid ${accent}44`,
      padding: '22px 26px',
      position: 'relative',
    }}>
      <div style={{
        fontSize: '0.56rem',
        letterSpacing: '0.28em',
        color: accent,
        textTransform: 'uppercase',
        opacity: 0.85,
        marginBottom: 12,
      }}>
        Before you begin again, here is what you carried away last time
      </div>
      <div style={{
        fontSize: '0.98rem',
        lineHeight: 1.85,
        color: C.bone,
        borderLeft: `2px solid ${accent}66`,
        paddingLeft: 14,
      }}>
        {letter.returnGift}
      </div>
      {letter.thresholdImage && (
        <div style={{ marginTop: 12, fontSize: '0.76rem', fontStyle: 'italic', color: C.smoke }}>
          {letter.thresholdImage}
        </div>
      )}
      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          color: C.smoke,
          fontSize: '0.6rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          marginTop: 16,
          textDecoration: 'underline',
        }}
      >
        Continue
      </button>
    </div>
  );
}
