'use client'

// app/components/Becoming.tsx
//
// The fifth beat, rendered between ThresholdLetter's four authored lines
// and its closing ring. Where those four lines tell the seeker what they
// carry back, this one line speaks AS the archetype, through the seeker —
// and then hands them one sentence to complete in their own words, rather
// than asking them to accept a label.
//
// Deliberately NOT a claim the app makes and keeps: the invocation line
// renders once, in this beat, and is never stored or resurfaced as
// something the app asserts about the seeker later. Only the seeker's own
// completed sentence — attributed to them, in their own words — is
// eligible to persist.
//
// Persistence (signed-in seekers only, same "sign-in to be gathered"
// posture MythicJournal.tsx states outright): posts directly to
// POST /api/becoming-statement the moment "Carry This" is chosen, which
// writes a becoming_statement row (migration 027) and makes it eligible
// Core Myth Statement material from that point on -- see
// lib/returning/coreMythStatement.ts's assembleConfirmedMaterial. This is
// a SEPARATE channel from onKeep: onKeep hands the caller the raw
// sentence for its own use (e.g. surfacing it elsewhere in the UI) and is
// never itself the persistence path -- do not wire onKeep to
// ThresholdLetter's onKeepAsCard, which is the unrelated ShareableCard
// flow for the oracle's own return-gift line.
//
// Skippable at every stage: a seeker who doesn't want to write anything
// can move straight to the closing ring. This is an offer, not a gate.
// An anonymous (not signed in) seeker gets the full invocation + writing
// experience but nothing is saved -- same as everywhere else in this app.

import { useEffect, useRef, useState } from 'react'
import { C, GlyphDivider } from './LintelShared'
import { WordReveal } from './WordReveal'
import SeekerSeal from './SeekerSeal'
import { MARKER_GLYPHS, type MarkerType } from '../../lib/mythopoetics/cardConfig'
import type { BecomingVars } from '../../lib/mythopoetics/becoming'
import type { VoiceKey } from '../../src/resilience/flags'

interface Props {
  voiceKey: VoiceKey
  archetypeName?: string | null
  accent?: string
  /** The marker this reading already suggested (ThresholdLetter derives
   *  it from content.returnGift via suggestMarker — the same function
   *  CouncilTabs.tsx uses for the ShareableCard flow, just computed
   *  earlier here since the reading's own text is already in hand).
   *  Used only for the closing merge visual below; never sent anywhere. */
  marker: MarkerType
  /** Whether the seeker is signed in — gates persistence only (see file
   *  header). The writing experience itself is identical either way. */
  signedIn?: boolean
  /** Fires once the beat is done — whether completed, skipped, or errored.
   *  Caller (ThresholdLetter) starts its own closing-ring timers from here
   *  instead of a fixed offset from mount. */
  onDone: () => void
  /** Called with the seeker's completed sentence only if they choose to
   *  keep it. Never called for a skip. Informational only — NOT the
   *  persistence path (see file header). */
  onKeep?: (fullSentence: string) => void
}

type Phase = 'loading' | 'invocation' | 'writing' | 'kept' | 'skipped'

const EMPTY: BecomingVars = {
  invocationLine: '',
  completionStem: 'I am the one who',
  isAuthorized: false,
}

const MAX_COMPLETION_CHARS = 140 // one sentence, not an essay — see CoreMythStatement for the longer form

export default function Becoming({ voiceKey, archetypeName = null, accent = C.gold, marker, signedIn = false, onDone, onKeep }: Props) {
  const [content, setContent] = useState<BecomingVars>(EMPTY)
  const [phase, setPhase] = useState<Phase>('loading')
  const [completion, setCompletion] = useState('')
  const doneRef = useRef(false)
  // Guards keep() itself, separately from doneRef: keep() does a real
  // side effect (the POST below) before finish()/doneRef come into play,
  // so a double-fire in the same tick -- Enter then a fast click on
  // "Carry This" before React re-renders past the writing phase, or a
  // literal double-click -- could otherwise write two becoming_statement
  // rows for one sentence, silently inflating eligibility. This makes
  // keep() itself idempotent, not just its onDone call.
  const keptRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const ctrl = new AbortController()
    const timeout = setTimeout(() => ctrl.abort(), 8000)
    fetch(`/api/becoming-content?voice=${encodeURIComponent(voiceKey)}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then((d: BecomingVars) => { if (!cancelled) setContent(d) })
      .catch(() => {
        // A network failure, a timeout-driven abort, or malformed JSON
        // must still unblock the beat -- swallowing the error here used
        // to leave `content` pointing at the exact same EMPTY reference
        // forever, which meant the gating effect below (guarded on
        // `content === EMPTY`) never ran, finish()/onDone() never fired,
        // and the seeker was stuck on this screen permanently with no
        // closing ring and no way back to the fire. A fresh object (not
        // === EMPTY, so the guard clears) with isAuthorized: false routes
        // this through the exact same fail-closed path as "voice isn't
        // authorized yet" -- silent skip, beat proceeds.
        if (!cancelled) setContent({ ...EMPTY })
      })
      .finally(() => { if (!cancelled) clearTimeout(timeout) })
    return () => { cancelled = true; clearTimeout(timeout); ctrl.abort() }
  }, [voiceKey])

  // Separate effect: once content has arrived, decide whether to run the
  // beat at all. Split from the fetch effect so the authorization check
  // reads as its own explicit gate, not buried in a .finally().
  useEffect(() => {
    if (content === EMPTY) return
    if (!content.isAuthorized) {
      finish()
      return
    }
    setPhase('invocation')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content])

  function finish() {
    if (doneRef.current) return
    doneRef.current = true
    onDone()
  }

  function skip() {
    setPhase('skipped')
    finish()
  }

  function keep() {
    if (keptRef.current) return
    const trimmed = completion.trim()
    if (trimmed.length < 3) { skip(); return }
    keptRef.current = true
    const sentence = `${content.completionStem} ${trimmed}`.trim()
    // Persist immediately, best-effort -- same fire-and-forget posture as
    // MythicJournal.tsx's own writes. Not awaited: the visual payoff
    // (the seal/glyph merge below) shouldn't wait on a network round
    // trip, and a failed save here isn't worth interrupting the beat
    // over -- the seeker's sentence is still shown to them either way,
    // it just won't count toward Core Myth Statement eligibility this
    // time. Anonymous seekers skip this entirely, same "sign in to be
    // gathered" posture as the rest of the app.
    if (signedIn) {
      fetch('/api/becoming-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceKey,
          archetypeName,
          marker,
          completionStem: content.completionStem,
          completionText: trimmed,
        }),
      }).catch(() => {})
    }
    onKeep?.(sentence)
    setPhase('kept')
    finish()
  }

  if (phase === 'loading') return null
  // Unauthorized content or a hard skip: render nothing, caller's onDone
  // already fired via finish() above.
  if (!content.isAuthorized) return null

  return (
    <div style={{ maxWidth: 480, width: '100%', textAlign: 'center', margin: '18px auto 0' }}>
      {phase === 'invocation' && (
        <div>
          <div style={{
            fontFamily: "'Gentium Plus', Georgia, serif",
            fontStyle: 'italic',
            fontSize: '1.05rem',
            lineHeight: 1.9,
            color: C.paleGold,
            marginBottom: 28,
          }}>
            <WordReveal
              text={content.invocationLine}
              breathSynced
              carved
              onComplete={() => setTimeout(() => setPhase('writing'), 1800)}
            />
          </div>
        </div>
      )}

      {phase === 'writing' && (
        <div>
          <GlyphDivider symbol="⟡" opacity={0.35} />
          <div style={{
            fontFamily: "'Gentium Plus', Georgia, serif",
            fontStyle: 'italic',
            color: C.ash,
            fontSize: '0.92rem',
            margin: '18px 0 16px',
            lineHeight: 1.7,
          }}>
            Finish it in your own words — not what {archetypeName ? `the ${archetypeName}` : 'the reading'} said, what you now know.
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 6,
          }}>
            <span style={{
              fontFamily: "'Gentium Plus', Georgia, serif",
              fontStyle: 'italic',
              color: C.bone,
              fontSize: '1rem',
            }}>
              {content.completionStem}
            </span>
            <input
              autoFocus
              type="text"
              value={completion}
              onChange={e => setCompletion(e.target.value.slice(0, MAX_COMPLETION_CHARS))}
              placeholder="…"
              onKeyDown={e => { if (e.key === 'Enter') keep() }}
              style={{
                flex: '1 1 220px',
                minWidth: 160,
                background: 'transparent',
                border: 'none',
                borderBottom: `1px solid rgba(212,168,67,0.35)`,
                color: C.bone,
                fontFamily: "'Gentium Plus', Georgia, serif",
                fontStyle: 'italic',
                fontSize: '1rem',
                padding: '4px 2px',
                outline: 'none',
                textAlign: 'left',
              }}
            />
          </div>
          <div style={{ fontSize: '0.62rem', color: C.smoke, opacity: 0.6, marginBottom: 22 }}>
            {completion.trim().length}/{MAX_COMPLETION_CHARS}
          </div>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
            <button
              onClick={keep}
              disabled={completion.trim().length < 3}
              style={{
                background: 'transparent',
                border: `1px solid ${accent}`,
                color: accent,
                fontFamily: "'Gentium Plus', Georgia, serif",
                fontSize: '0.62rem',
                letterSpacing: '0.2em',
                padding: '9px 22px',
                cursor: completion.trim().length < 3 ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
                opacity: completion.trim().length < 3 ? 0.45 : 1,
              }}
            >
              Carry This
            </button>
            <button
              onClick={skip}
              style={{
                background: 'transparent',
                border: 'none',
                color: C.smoke,
                fontFamily: "'Gentium Plus', Georgia, serif",
                fontStyle: 'italic',
                fontSize: '0.76rem',
                cursor: 'pointer',
                opacity: 0.6,
              }}
            >
              not now
            </button>
          </div>
        </div>
      )}

      {/* The payoff: the seeker's own seal (SeekerSeal — deterministic,
          non-representational, seeded from what THEY just wrote, not the
          oracle's line) and the reading's marker glyph draw toward each
          other, touch, and settle side by side. Never fused into one new
          mark — see Becoming.tsx's file header on why this stays a
          brief touch-and-separate rather than a permanent merged glyph:
          the moment is real, the identity claim isn't permanent. */}
      {phase === 'kept' && (
        <div>
          <style>{`
            @keyframes elderBecomingConverge {
              0%   { transform: translateX(var(--start-x)); opacity: 0; }
              30%  { opacity: 1; }
              55%  { transform: translateX(0); }
              100% { transform: translateX(var(--end-x)); }
            }
            @keyframes elderBecomingFlare {
              0%   { opacity: 0; transform: translate(-50%,-50%) scale(0.4); }
              45%  { opacity: 0.85; }
              100% { opacity: 0; transform: translate(-50%,-50%) scale(2.4); }
            }
            @media (prefers-reduced-motion: reduce) {
              .elder-becoming-mark { animation: none !important; }
            }
          `}</style>
          <div style={{ position: 'relative', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>
            <div style={{
              position: 'absolute',
              width: 70, height: 70,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${accent}cc 0%, ${accent}00 70%)`,
              opacity: 0,
              animation: 'elderBecomingFlare 2.4s cubic-bezier(0.16,1,0.3,1) 1.1s 1 both',
              pointerEvents: 'none',
            }} />
            <span
              className="elder-becoming-mark"
              style={{
                position: 'relative',
                fontSize: 30,
                color: accent,
                textShadow: `0 0 16px ${accent}99`,
                marginRight: 14,
                '--start-x': '-14px',
                '--end-x': '0px',
                animation: 'elderBecomingConverge 2.6s cubic-bezier(0.16,1,0.3,1) both',
              } as React.CSSProperties}
            >
              {MARKER_GLYPHS[marker]}
            </span>
            <span
              className="elder-becoming-mark"
              style={{
                position: 'relative',
                '--start-x': '14px',
                '--end-x': '0px',
                animation: 'elderBecomingConverge 2.6s cubic-bezier(0.16,1,0.3,1) both',
              } as React.CSSProperties}
            >
              <SeekerSeal marker={marker} line={completion.trim() || content.completionStem} accent={accent} size={46} />
            </span>
          </div>
          <div style={{
            fontFamily: "'Gentium Plus', Georgia, serif",
            fontStyle: 'italic',
            color: C.ash,
            fontSize: '0.92rem',
            lineHeight: 1.8,
          }}>
            "{content.completionStem} {completion.trim()}"
          </div>
        </div>
      )}
    </div>
  )
}
