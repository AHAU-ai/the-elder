'use client';

// RecallLetter.tsx
//
// A dismissible callout surfaced once at the start of a new sitting,
// carrying forward one past kept Threshold Letter — closing the loop
// between sittings instead of leaving each one sealed off at /letters.
// Styled consistent with ThresholdLetters.tsx's letter-card treatment.

import { useEffect, useState } from 'react';
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

  // A future kept letter can be emailed back days later instead of only
  // surfacing here if the seeker happens to return — see
  // app/api/cron/deliver-threshold-letters. Explicit opt-in only, offered
  // right here rather than buried in a settings page: this is the exact
  // moment a seeker is feeling the value of a letter coming back to them,
  // so it's the one contextually honest place to ask. Fetches the current
  // preference on mount so the toggle doesn't lie if they already set it
  // (or asked to stop) on a previous visit.
  const [emailOptIn, setEmailOptIn] = useState<boolean | null>(null);
  const [savingPref, setSavingPref] = useState(false);

  useEffect(() => {
    fetch('/api/user/preferences')
      .then(res => res.json())
      .then(data => setEmailOptIn(!!data?.lettersByEmail))
      .catch(() => setEmailOptIn(false));
  }, []);

  async function toggleEmailOptIn() {
    if (emailOptIn === null || savingPref) return;
    const next = !emailOptIn;
    setSavingPref(true);
    setEmailOptIn(next); // optimistic; this is a low-stakes preference toggle
    try {
      await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lettersByEmail: next }),
      });
    } catch {
      setEmailOptIn(!next); // revert on failure
    } finally {
      setSavingPref(false);
    }
  }

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, flexWrap: 'wrap', gap: 10 }}>
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
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          Continue
        </button>

        {emailOptIn !== null && (
          <button
            onClick={toggleEmailOptIn}
            disabled={savingPref}
            title="A future kept letter will be emailed back to you a few days later"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              background: 'none',
              border: 'none',
              color: emailOptIn ? accent : C.smoke,
              fontSize: '0.6rem',
              letterSpacing: '0.1em',
              cursor: savingPref ? 'default' : 'pointer',
              opacity: savingPref ? 0.6 : 1,
              padding: 0,
            }}
          >
            <span style={{
              width: 9, height: 9, borderRadius: '50%',
              border: `1px solid ${emailOptIn ? accent : 'rgba(212,168,67,0.4)'}`,
              background: emailOptIn ? accent : 'transparent',
              boxShadow: emailOptIn ? `0 0 6px ${accent}` : 'none',
              transition: 'background 0.2s ease, box-shadow 0.2s ease',
            }} />
            let the fire send letters like this to you, later
          </button>
        )}
      </div>
    </div>
  );
}
