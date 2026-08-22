'use client';

// app/components/Hearth.tsx
//
// The quiet path: a place for a seeker who wants NOTHING from The Elder --
// no reading, no marker, no request. Just their own fire and their own
// already-written words, held quietly.
//
// Structural promise, not just a description: this component makes ZERO
// write calls and never calls the generation endpoint. Verified by
// scripts/verify-hearth-read-only.mjs (static source check, run in CI)
// rather than left as a claim -- see that script for what it actually
// asserts and why a runtime test alone wouldn't prove absence.
//
// No sound by default (see the design note this responds to: silence is
// the correct default for a seeker who has asked for nothing -- autoplay,
// even calm, is itself a small ask). No CTA pressure, no empty-state
// copy that reads as "you haven't done anything yet" -- that would
// reintroduce the achievement-framing problem from the gamification pass.
// If there's nothing kept, this shows the fire and nothing else.

import { useEffect, useState } from 'react';
import FireAtmosphere from './FireAtmosphere';
import { WordReveal } from './WordReveal';
import { LINEAGES, type LineageKey } from '../../lib/lineages';

interface LetterEntry {
  id: number;
  lineageKey: string;
  volatilizationPhrase: string;
  returnPhrase: string;
  returnGift: string;
  createdAt: string;
}

interface MythStatement {
  bodyText: string;
  version: number;
}

const C = {
  gold:  '#d4a843',
  ash:   '#c4b89a',
  smoke: '#a8916f',
  bone:  '#fdf6e8',
};

// Calmest fire register -- no session-scoped intensity climbs here (this
// isn't a reading in progress), no per-marker distinction (see the
// FireAtmosphere design note: a single, deliberately understated scalar,
// not addressable embers a seeker could start reading as progress).
const HEARTH_FIRE_INTENSITY = 0.08;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

function lineageLabel(key: string): string {
  return LINEAGES[key as LineageKey]?.label ?? key;
}

export default function Hearth() {
  const [checked, setChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [letters, setLetters] = useState<LetterEntry[]>([]);
  const [mythStatement, setMythStatement] = useState<MythStatement | null>(null);

  useEffect(() => {
    // GET only -- see the module comment. Nothing on this page ever
    // fires a POST/PUT/DELETE or calls generation.
    fetch('/api/hearth')
      .then(r => r.json())
      .then(data => {
        setSignedIn(!!data?.signedIn);
        setLetters(data?.letters ?? []);
        setMythStatement(data?.mythStatement ?? null);
      })
      .catch(() => {})
      .finally(() => setChecked(true));
  }, []);

  const hasNothingKept = letters.length === 0 && !mythStatement;

  return (
    <div style={{ minHeight: '100vh', background: '#0a0806', position: 'relative' }}>
      <FireAtmosphere intensity={HEARTH_FIRE_INTENSITY} soundEnabled={false} />

      <div style={{
        position: 'relative', zIndex: 2, maxWidth: 560, margin: '0 auto',
        padding: '14vh 24px 10vh', minHeight: '100vh',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        {!checked ? null : !signedIn ? (
          <div style={{ textAlign: 'center', fontStyle: 'italic', color: C.smoke, fontSize: '0.85rem' }}>
            The fire keeps for those it knows.
          </div>
        ) : hasNothingKept ? (
          // Deliberately just the fire -- no "you haven't kept anything
          // yet" copy. See the module comment for why.
          <div />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
            {mythStatement && (
              <div>
                <div style={{ fontSize: '0.56rem', letterSpacing: '0.28em', color: C.gold, textTransform: 'uppercase', opacity: 0.7, marginBottom: 14, textAlign: 'center' }}>
                  Your Core Myth Statement
                </div>
                <div style={{ fontStyle: 'italic', color: C.bone, fontSize: '0.98rem', lineHeight: 1.9, textAlign: 'center' }}>
                  <WordReveal text={mythStatement.bodyText} breathSynced carved />
                </div>
              </div>
            )}

            {letters.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                {mythStatement && (
                  <div style={{ fontSize: '0.56rem', letterSpacing: '0.28em', color: C.gold, textTransform: 'uppercase', opacity: 0.7, textAlign: 'center' }}>
                    Your Kept Letters
                  </div>
                )}
                {letters.map(l => (
                  <div key={l.id} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.62rem', letterSpacing: '0.12em', color: C.smoke, textTransform: 'uppercase', marginBottom: 8 }}>
                      {lineageLabel(l.lineageKey)} &middot; {formatDate(l.createdAt)}
                    </div>
                    <div style={{ fontStyle: 'italic', color: C.ash, fontSize: '0.88rem', lineHeight: 1.8 }}>
                      {l.returnPhrase}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* The one quiet way back -- never multiple competing CTAs, never
            forced. Present regardless of what's above. */}
        <a
          href="/"
          style={{
            display: 'block', textAlign: 'center', marginTop: 64,
            color: C.smoke, fontFamily: "'Gentium Plus',Georgia,serif",
            fontSize: '0.68rem', letterSpacing: '0.14em', fontStyle: 'italic',
            opacity: 0.5, textDecoration: 'none',
          }}
        >
          back to the threshold
        </a>
      </div>
    </div>
  );
}
