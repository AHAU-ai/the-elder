'use client'

// ThresholdLetterKept.tsx
//
// Brainstorm item #3: "give the threshold letter more weight at the
// moment it's offered." Before this component existed, CouncilTabs fired
// POST /api/threshold-letters as a silent side effect of the "Keep This
// Gift" button -- the seeker saw a share card open, never anything about
// a letter, an archive, or a later return. The mechanic (a kept letter
// can be emailed back days later, DELIVERY_DELAY_DAYS in
// thresholdLetterLedger.ts) already existed and already had a real,
// well-reasoned opt-in surface -- RecallLetter.tsx, offered on the FOLLOWING
// sitting. This is that same ask, moved to the moment it's actually about:
// right after the seeker chooses to keep something, not a visit later.
//
// Mirrors RecallLetter's opt-in toggle exactly (same preference endpoint,
// same optimistic-update shape) rather than introducing a second pattern
// for the same one bit of state.

import { useEffect, useState } from 'react'

const C = {
  gold: '#d4a843',
  bone: '#ede0c4',
  ash: '#c4b89a',
  smoke: '#a8916f',
}

export default function ThresholdLetterKept({ accent = C.gold }: { accent?: string }) {
  const [emailOptIn, setEmailOptIn] = useState<boolean | null>(null)
  const [savingPref, setSavingPref] = useState(false)

  useEffect(() => {
    fetch('/api/user/preferences')
      .then((res) => res.json())
      .then((data) => setEmailOptIn(!!data?.lettersByEmail))
      .catch(() => setEmailOptIn(false))
  }, [])

  async function toggleEmailOptIn() {
    if (emailOptIn === null || savingPref) return
    const next = !emailOptIn
    setSavingPref(true)
    setEmailOptIn(next) // optimistic; low-stakes preference toggle
    try {
      await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lettersByEmail: next }),
      })
    } catch {
      setEmailOptIn(!next) // revert on failure
    } finally {
      setSavingPref(false)
    }
  }

  return (
    <div style={{ textAlign: 'center', marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(212,168,67,0.1)' }}>
      <div style={{ fontStyle: 'italic', color: C.ash, fontSize: '0.8rem', lineHeight: 1.75, opacity: 0.88, marginBottom: 10 }}>
        This is kept. It will wait for you at{' '}
        <a href="/letters" style={{ color: accent, textDecoration: 'underline' }}>your letters</a>
        {emailOptIn ? ', and find its way back to you in a few days too.' : '.'}
      </div>

      {emailOptIn !== null && (
        <button
          onClick={toggleEmailOptIn}
          disabled={savingPref}
          title="A future kept letter will be emailed back to you a few days later"
          style={{
            display: 'inline-flex',
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
          {emailOptIn ? 'the fire will send letters like this to you, later' : 'let the fire send letters like this to you, later'}
        </button>
      )}
    </div>
  )
}
