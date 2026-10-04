'use client';

// LetterEmailChoice.tsx
//
// The one place a signed-in seeker chooses whether, and how long after, a kept
// Threshold Letter is emailed back to them -- once each, ever (the cron's
// by-construction guarantee). The delay is a closed set (lib/letterDelay.ts);
// there is no recurring option and no short one.
//
// Offered in two honest moments: right after a letter is kept (letterId given:
// the choice applies to THIS letter as well as future ones), and at the start
// of a later sitting beside the letter that came back (no letterId: future
// letters). Explicit opt-in only; it fetches the current preference on mount
// so it never lies about what was already chosen or stopped.

import { useEffect, useState } from 'react';
import {
  LETTER_DELAY_CHOICES,
  LETTER_DELAY_LABELS,
  LETTER_DELAY_OFF_LABEL,
  DEFAULT_LETTER_DELAY_DAYS,
  parseLetterDelay,
  type LetterDelayDays,
} from '../../lib/letterDelay';

const SMOKE = '#a8916f';

export default function LetterEmailChoice({
  accent,
  letterId = null,
}: {
  accent: string;
  /** The letter just kept, when offered at the moment of keeping. */
  letterId?: number | null;
}) {
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
            ? {
                lettersByEmail: true,
                lettersEmailDelayDays: next.delay,
                ...(letterId !== null ? { forLetterId: letterId } : {}),
              }
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

  if (pref === null) return null;

  return (
    <div
      role="radiogroup"
      aria-label="Send letters like this to you by email, once each, after a delay you choose"
      title="Each kept letter is emailed to you once, after the delay you choose"
      style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px 12px', opacity: savingPref ? 0.6 : 1 }}
    >
      <span style={{ fontSize: '0.6rem', letterSpacing: '0.1em', color: SMOKE }}>
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
              color: selected ? accent : SMOKE,
              fontSize: '0.6rem',
              letterSpacing: '0.1em',
              cursor: savingPref ? 'default' : 'pointer',
              textDecoration: selected ? 'none' : 'underline',
              textUnderlineOffset: 3,
              opacity: selected ? 1 : 0.8,
            }}
          >
            {selected ? '● ' : ''}{label}
          </button>
        );
      })}
    </div>
  );
}
