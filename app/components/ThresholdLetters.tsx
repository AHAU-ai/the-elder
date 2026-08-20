'use client';

import { useEffect, useState } from 'react';
import { LINEAGES, type LineageKey } from '../../lib/lineages';

interface LetterEntry {
  id: number;
  lineageKey: string;
  volatilizationPhrase: string;
  returnPhrase: string;
  returnGift: string;
  thresholdImage: string;
  createdAt: string;
}

const C = {
  obsidian: '#0a0806',
  gold:     '#d4a843',
  bone:     '#ede0c4',
  ash:      '#c4b89a',
  smoke:    '#a8916f',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function ThresholdLetters() {
  const [checked,   setChecked]   = useState(false);
  const [signedIn,  setSignedIn]  = useState(false);
  const [letters,   setLetters]   = useState<LetterEntry[] | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (!data?.email) { setChecked(true); return; }
        setSignedIn(true);
        return fetch('/api/threshold-letters')
          .then(r => r.json())
          .then(d => setLetters(d?.letters ?? []));
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: C.obsidian,
      color: C.bone,
      fontFamily: "'Gentium Plus', Georgia, 'Times New Roman', serif",
      padding: '54px 20px 90px',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(1.6rem, 4vw, 2.3rem)',
            color: C.gold,
            letterSpacing: '0.2em',
            marginBottom: 10,
          }}>
            KEPT LETTERS
          </div>
          <div style={{ fontStyle: 'italic', color: C.ash, fontSize: '0.92rem' }}>
            What the fire has given you, across every threshold you've crossed.
          </div>
          <div style={{ marginTop: 18 }}>
            <a href="/" style={{ color: C.smoke, fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', textDecoration: 'none', borderBottom: `1px solid ${C.smoke}` }}>
              Return to the Fire
            </a>
          </div>
        </div>

        {!checked && (
          <div style={{ textAlign: 'center', color: C.smoke, fontStyle: 'italic', fontSize: '0.9rem' }}>
            &hellip;
          </div>
        )}

        {checked && !signedIn && (
          <div style={{ textAlign: 'center', color: C.ash, fontStyle: 'italic', fontSize: '0.95rem', lineHeight: 1.8 }}>
            Only a seeker who has signed in and been given a gift can find it kept here.
            Sign in from the fire, and what you're given from then on will wait for you.
          </div>
        )}

        {checked && signedIn && letters !== null && letters.length === 0 && (
          <div style={{ textAlign: 'center', color: C.ash, fontStyle: 'italic', fontSize: '0.95rem', lineHeight: 1.8 }}>
            Nothing is kept here yet. When you're given a gift worth keeping,
            choose to keep it — and it will be here the next time you return.
          </div>
        )}

        {checked && signedIn && letters !== null && letters.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {letters.map(letter => {
              const lineage = LINEAGES[letter.lineageKey as LineageKey];
              const accent = lineage?.palette?.primary ?? C.gold;
              return (
                <div key={letter.id} style={{
                  background: 'rgba(8,6,4,0.93)',
                  border: `1px solid ${accent}44`,
                  padding: '26px 30px',
                  position: 'relative',
                }}>
                  <div style={{
                    fontSize: '0.56rem',
                    letterSpacing: '0.28em',
                    color: accent,
                    textTransform: 'uppercase',
                    opacity: 0.85,
                    marginBottom: 4,
                  }}>
                    {lineage?.tradition ?? letter.lineageKey} · {lineage?.teacherTitle ?? ''}
                  </div>
                  <div style={{ fontSize: '0.66rem', color: C.smoke, marginBottom: 18 }}>
                    {formatDate(letter.createdAt)}
                  </div>

                  {letter.volatilizationPhrase && (
                    <div style={{ fontStyle: 'italic', color: C.ash, fontSize: '0.92rem', lineHeight: 1.9, marginBottom: 10 }}>
                      {letter.volatilizationPhrase}
                    </div>
                  )}
                  {letter.returnPhrase && (
                    <div style={{ fontStyle: 'italic', color: C.ash, fontSize: '0.92rem', lineHeight: 1.9, marginBottom: 14 }}>
                      {letter.returnPhrase}
                    </div>
                  )}
                  <div style={{
                    fontSize: '1.02rem',
                    lineHeight: 1.9,
                    color: C.bone,
                    borderLeft: `2px solid ${accent}66`,
                    paddingLeft: 16,
                  }}>
                    {letter.returnGift}
                  </div>
                  {letter.thresholdImage && (
                    <div style={{ marginTop: 16, fontSize: '0.78rem', fontStyle: 'italic', color: C.smoke }}>
                      {letter.thresholdImage}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
