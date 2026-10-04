'use client';

// RecallLetter.tsx
//
// A dismissible callout surfaced once at the start of a new sitting,
// carrying forward one past kept Threshold Letter — closing the loop
// between sittings instead of leaving each one sealed off at /letters.
// Styled consistent with ThresholdLetters.tsx's letter-card treatment.

import { useEffect, useState } from 'react';
import { LINEAGES, type LineageKey } from '../../lib/lineages';
import {
  LETTER_DELAY_CHOICES,
  LETTER_DELAY_LABELS,
  LETTER_DELAY_OFF_LABEL,
  DEFAULT_LETTER_DELAY_DAYS,
  parseLetterDelay,
  type LetterDelayDays,
} from '../../lib/letterDelay';

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
  smoke: '#a8916f',
};

export default function RecallLetter({ letter, onDismiss }: { letter: LetterEntry; onDismiss: () => void }) {
  const lineage = LINEAGES[letter.lineageKey as LineageKey];
  const accent = lineage?.palette?.primary ?? C.gold;

  // A future kept letter can be emailed back, once, after a delay the seeker
  // chooses (a few days / a month / a season: lib/letterDelay.ts) instead of
  // only surfacing here if the seeker happens to return -- see
  // app/api/cron/deliver-threshold-letters. Explicit opt-in only, offered
  // right here rather than buried in a settings page: this is the exact
  // moment a seeker is feeling the value of a letter coming back to them,
  // so it's the one contextually honest place to ask. Fetches the current
  // preference on mount so the choice doesn't lie if they already set it
  // (or asked to stop) on a previous visit.
  const [pref, setPref] = useState<{ enabled: boolean; delay: LetterDelayDays } | null>(null);
  const [savingPref, setSavingPref] = useState(false);

  useEffect(() => {
    fetch('/api/user/preferences')
      .then(res => res.json())
      .then(data => setPref({
        enabled: !!data?.lettersByEmail,
        delay: parseLetterDelay(data?.lettersEmailDelayDays) ?? DEFAULT_LETTER_DELAY_DAYS,
      }))
      .catch(() => setPref({ enabled: false, delay: DEFAULT_LETTER_DELAY_DAYS }));
  }, []);

  async function choose(next: { enabled: boolean; delay: LetterDelayDays }) {
    if (pref === null || savingPref) return;
    const previous = pref;
    setSavingPref(true);
    setPref(next); // optimistic; this is a low-stakes preference
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          next.enabled
            ? { lettersByEmail: true, lettersEmailDelayDays: next.delay }
            : { lettersByEmail: false }
        ),
      });
      if (!res.ok) setPref(previous); // revert on failure (e.g. signed out)
    } catch {
      setPref(previous);
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

        {pref !== null && (
          <div
            role="radiogroup"
            aria-label="Send letters like this to you by email, once each, after a delay you choose"
            title="Each kept letter is emailed to you once, after the delay you choose"
            style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 12px', opacity: savingPref ? 0.6 : 1 }}
          >
            <span style={{ fontSize: '0.6rem', letterSpacing: '0.1em', color: C.smoke }}>
              let the fire send letters like this to you:
            </span>
            {([null, ...LETTER_DELAY_CHOICES] as const).map((d) => {
              const selected = d === null ? !pref.enabled : pref.enabled && pref.delay === d;
              const label = d === null ? LETTER_DELAY_OFF_LABEL : LETTER_DELAY_LABELS[d];
              return (
                <button
                  key={String(d)}
                  role="radio"
                  aria-checked={selected}
                  disabled={savingPref}
                  onClick={() => choose(d === null ? { enabled: false, delay: pref.delay } : { enabled: true, delay: d })}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: selected ? accent : C.smoke,
                    fontSize: '0.6rem',
                    letterSpacing: '0.1em',
                    cursor: savingPref ? 'default' : 'pointer',
                    textDecoration: selected ? 'none' : 'underline',
                    textUnderlineOffset: 3,
                    opacity: selected ? 1 : 0.8,
                  }}
                >
                  {selected ? '\u25CF ' : ''}{label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
