'use client';

// MythicJournal.tsx
//
// The returning-user hook: not just a timeline of stored myths, but a
// short synthesis passage that names the pattern across them. Renders the
// synthesis (or an honest "not enough sittings yet" state) above the
// existing per-archetype list, turning the page from a log into a mirror.

import { useEffect, useState } from 'react';
import { LINEAGES, type LineageKey } from '../../lib/lineages';

interface MythEntry {
  id: number;
  lineageKey: string;
  archetypeName: string;
  summary: string;
  peopleCircumstances: string;
  readingCount: number;
  updatedAt: string;
}

interface ArcEntry {
  archetypeName: string;
  count: number;
}

interface ShareSummary {
  id: string;
  line: string;
  marker: string;
  createdAt: string;
  responseCounts: Record<string, number>;
}

const C = {
  obsidian: '#0a0806',
  gold:     '#d4a843',
  bone:     '#ede0c4',
  ash:      '#c4b89a',
  smoke:    '#8a7a6a',
};

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export default function MythicJournal() {
  const [checked,  setChecked]  = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [myths,    setMyths]    = useState<MythEntry[] | null>(null);
  const [arc,      setArc]      = useState<Record<string, number>>({});
  const [synthesis, setSynthesis] = useState<string | null>(null);
  const [readingCount, setReadingCount] = useState(0);
  const [shares, setShares] = useState<ShareSummary[] | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (!data?.email) { setChecked(true); return; }
        setSignedIn(true);
        Promise.all([
          fetch('/api/myth').then(r => r.json()).then(d => setMyths(d?.myths ?? [])),
          fetch('/api/myth/arc').then(r => r.json()).then(d => {
            const counts: Record<string, number> = {};
            (d?.arc ?? []).forEach((a: ArcEntry) => { counts[a.archetypeName] = a.count; });
            setArc(counts);
          }),
          fetch('/api/journal').then(r => r.json()).then(d => {
            setSynthesis(d?.synthesis ?? null);
            setReadingCount(d?.readingCount ?? 0);
          }),
          fetch('/api/share/mine').then(r => r.json()).then(d => setShares(d?.shares ?? [])).catch(() => setShares([])),
        ]).finally(() => setChecked(true));
      })
      .catch(() => setChecked(true));
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
            YOUR MYTHIC JOURNAL
          </div>
          <div style={{ fontStyle: 'italic', color: C.ash, fontSize: '0.92rem' }}>
            Not just what was said — what has been shaping, sitting after sitting.
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
            Only a seeker who has signed in can gather a journal here.
            Sign in from the fire, and what you're given from then on will be gathered.
          </div>
        )}

        {checked && signedIn && (
          <>
            {synthesis ? (
              <div style={{
                background: 'rgba(212,168,67,0.05)',
                border: `1px solid ${C.gold}44`,
                padding: '28px 30px',
                marginBottom: 40,
              }}>
                <div style={{
                  fontSize: '0.56rem',
                  letterSpacing: '0.28em',
                  color: C.gold,
                  textTransform: 'uppercase',
                  opacity: 0.85,
                  marginBottom: 14,
                }}>
                  What the fire has seen across your sittings
                </div>
                <div style={{ fontStyle: 'italic', fontSize: '1.02rem', lineHeight: 1.95, color: C.bone }}>
                  {synthesis}
                </div>
              </div>
            ) : (
              <div style={{
                textAlign: 'center',
                color: C.ash,
                fontStyle: 'italic',
                fontSize: '0.92rem',
                lineHeight: 1.8,
                marginBottom: 40,
                opacity: 0.85,
              }}>
                The fire needs a few more sittings before it can show you the shape
                that's forming ({readingCount} so far). Return again, and it will
                begin to speak.
              </div>
            )}

            {myths !== null && myths.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                {myths.map(m => {
                  const lineage = LINEAGES[m.lineageKey as LineageKey];
                  const accent = lineage?.palette?.primary ?? C.gold;
                  const count = arc[m.archetypeName];
                  return (
                    <div key={m.id} style={{
                      background: 'rgba(8,6,4,0.93)',
                      border: `1px solid ${accent}44`,
                      padding: '22px 26px',
                    }}>
                      <div style={{ fontSize: '1.0rem', fontStyle: 'italic', color: C.bone, marginBottom: 6 }}>
                        {m.archetypeName}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: C.smoke, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                        {lineage?.tradition ?? m.lineageKey} · {m.readingCount} reading{m.readingCount === 1 ? '' : 's'}
                      </div>
                      {count >= 2 && (
                        <div style={{ fontSize: '0.72rem', color: accent, fontStyle: 'italic', marginBottom: 10 }}>
                          This is the {ordinal(count)} time the {m.archetypeName} has shown up.
                        </div>
                      )}
                      <div style={{ fontSize: '0.86rem', color: C.ash, lineHeight: 1.7 }}>
                        {m.summary}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {shares !== null && shares.length > 0 && (
              <div style={{ marginTop: 48 }}>
                <div style={{
                  fontSize: '0.56rem',
                  letterSpacing: '0.28em',
                  color: C.gold,
                  textTransform: 'uppercase',
                  opacity: 0.85,
                  marginBottom: 18,
                  textAlign: 'center',
                }}>
                  Threads you've offered outward
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {shares.map(s => {
                    const total = Object.values(s.responseCounts).reduce((a, b) => a + b, 0);
                    return (
                      <div key={s.id} style={{
                        border: `1px solid ${C.smoke}33`,
                        padding: '14px 18px',
                        fontSize: '0.82rem',
                        color: C.ash,
                      }}>
                        <div style={{ fontStyle: 'italic', marginBottom: 6 }}>"{s.line}"</div>
                        <div style={{ fontSize: '0.68rem', color: C.smoke }}>
                          {total === 0 ? 'No one has answered this one back yet.' : `${total} glyph${total === 1 ? '' : 's'} received back.`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
