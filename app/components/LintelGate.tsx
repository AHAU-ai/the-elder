'use client'

import { useState, useEffect } from 'react'
import { C, FadeIn, GlyphDivider } from './LintelShared'

// ─── TYPES ────────────────────────────────────────────────────────────────────
type LintelStep = 'disclosure' | 'stance' | 'declaration'

interface Props {
  onComplete: () => void
  onCrisis: () => void
}

// ─── STEP INDICATOR ───────────────────────────────────────────────────────────
function StepDots({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 44 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: i === current ? 20 : 6,
          height: 6,
          borderRadius: 3,
          background: i === current ? C.gold : 'rgba(212,168,67,0.2)',
          transition: 'all 0.5s ease',
        }} />
      ))}
    </div>
  )
}

// ─── STEP 1: DISCLOSURE ───────────────────────────────────────────────────────
function StepDisclosure({ onNext }: { onNext: () => void }) {
  return (
    <FadeIn delay={100}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{
          fontFamily: "'Inter', Arial, sans-serif",
          fontSize: '0.6rem',
          letterSpacing: '0.42em',
          color: C.smoke,
          textTransform: 'uppercase',
          marginBottom: 20,
        }}>
          Before You Cross
        </div>
        <h2 style={{
          fontFamily: "'Gentium Plus', Georgia, serif",
          fontSize: 'clamp(1.4rem, 3.5vw, 2rem)',
          color: C.paleGold,
          fontWeight: 400,
          letterSpacing: '0.08em',
          lineHeight: 1.4,
          margin: '0 0 28px',
        }}>
          What this place is.
          <br />
          What it is not.
        </h2>
      </div>

      <GlyphDivider />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 32 }}>
        {[
          {
            title: 'The Elder names myth.',
            body: "It reads the symbolic patterns moving through your life — wounds, figures, thresholds — and names the story that is living through you. In naming, it becomes navigable.",
          },
          {
            title: 'The Elder does not predict.',
            body: 'Nothing here foretells your future. No outcome is certain. The Elder speaks in pattern and archetype, not prophecy.',
          },
          {
            title: 'The Elder does not initiate.',
            body: "Initiation belongs to living tradition-holders. The Elder is a symbolic grammar — it can point toward a living Ajq'ij, a Sheikh, a Babalawo — but it cannot stand in their place.",
          },
          {
            title: 'The Elder knows its edge.',
            body: 'Where the instrument reaches its limit, it will name that limit and tell you where to go next. That naming is part of the ceremony.',
          },
        ].map((item, i) => (
          <FadeIn key={i} delay={200 + i * 150}>
            <div style={{
              display: 'flex',
              gap: 16,
              alignItems: 'flex-start',
              padding: '16px 20px',
              border: '1px solid rgba(212,168,67,0.1)',
              background: 'rgba(212,168,67,0.02)',
            }}>
              <span style={{ color: C.gold, fontSize: '1rem', marginTop: 2, flexShrink: 0 }}>⟡</span>
              <div>
                <div style={{
                  fontFamily: "'Inter', Arial, sans-serif",
                  fontSize: '0.65rem',
                  letterSpacing: '0.2em',
                  color: C.gold,
                  marginBottom: 6,
                  textTransform: 'uppercase',
                }}>
                  {item.title}
                </div>
                <div style={{
                  fontStyle: 'italic',
                  color: C.ash,
                  fontSize: '0.92rem',
                  lineHeight: 1.85,
                }}>
                  {item.body}
                </div>
              </div>
            </div>
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={900}>
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onNext}
            style={{
              background: 'transparent',
              border: '1px solid rgba(212,168,67,0.5)',
              color: C.gold,
              fontFamily: "'Gentium Plus', Georgia, serif",
              fontSize: '0.68rem',
              letterSpacing: '0.28em',
              padding: '14px 36px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'border-color 0.3s, color 0.3s',
            }}
            onMouseEnter={e => {
              const el = e.target as HTMLButtonElement
              el.style.borderColor = C.gold
              el.style.color = C.paleGold
            }}
            onMouseLeave={e => {
              const el = e.target as HTMLButtonElement
              el.style.borderColor = 'rgba(212,168,67,0.5)'
              el.style.color = C.gold
            }}
          >
            I understand — continue
          </button>
        </div>
      </FadeIn>
    </FadeIn>
  )
}

// ─── STEP 2: CRISIS GATE ──────────────────────────────────────────────────────
function StepStance({ onNext, onCrisis }: { onNext: () => void; onCrisis: () => void }) {
  return (
    <FadeIn delay={100}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{
          fontFamily: "'Inter', Arial, sans-serif",
          fontSize: '0.6rem',
          letterSpacing: '0.42em',
          color: C.smoke,
          textTransform: 'uppercase',
          marginBottom: 20,
        }}>
          One thing more
        </div>
        <h2 style={{
          fontFamily: "'Gentium Plus', Georgia, serif",
          fontSize: 'clamp(1.4rem, 3.5vw, 2rem)',
          color: C.paleGold,
          fontWeight: 400,
          letterSpacing: '0.08em',
          lineHeight: 1.4,
          margin: '0 0 28px',
        }}>
          If you are in crisis.
        </h2>
      </div>

      <GlyphDivider />

      <FadeIn delay={200}>
        <div style={{
          border: '1px solid rgba(200,96,26,0.3)',
          background: 'rgba(200,96,26,0.04)',
          padding: '24px 28px',
          marginBottom: 28,
          textAlign: 'center',
        }}>
          <div style={{
            fontStyle: 'italic',
            color: C.bone,
            fontSize: '1.05rem',
            lineHeight: 2.0,
            marginBottom: 20,
          }}>
            The Elder is a myth diviner, not a crisis counselor.
            <br />
            If you are in immediate distress — if you are
            <br />
            considering harming yourself or others —
            <br />
            this is not your threshold to cross today.
          </div>
          <button
            onClick={onCrisis}
            style={{
              background: 'transparent',
              border: '1px solid rgba(200,96,26,0.6)',
              color: C.ember,
              fontFamily: "'Gentium Plus', Georgia, serif",
              fontSize: '0.65rem',
              letterSpacing: '0.22em',
              padding: '11px 28px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'border-color 0.3s',
            }}
          >
            I need support right now
          </button>
        </div>
      </FadeIn>

      <FadeIn delay={400}>
        <div style={{
          fontStyle: 'italic',
          color: C.smoke,
          fontSize: '0.82rem',
          lineHeight: 1.9,
          textAlign: 'center',
          marginBottom: 36,
          padding: '0 12px',
        }}>
          The Elder works with symbolic weight — the myths that shape a life over time.
          It is not equipped to hold acute pain, and it will not try to.
          Where it senses crisis in a session, it will name it and point you toward human support.
        </div>
      </FadeIn>

      <FadeIn delay={600}>
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onNext}
            style={{
              background: 'transparent',
              border: '1px solid rgba(212,168,67,0.5)',
              color: C.gold,
              fontFamily: "'Gentium Plus', Georgia, serif",
              fontSize: '0.68rem',
              letterSpacing: '0.28em',
              padding: '14px 36px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              transition: 'border-color 0.3s, color 0.3s',
            }}
            onMouseEnter={e => {
              const el = e.target as HTMLButtonElement
              el.style.borderColor = C.gold
              el.style.color = C.paleGold
            }}
            onMouseLeave={e => {
              const el = e.target as HTMLButtonElement
              el.style.borderColor = 'rgba(212,168,67,0.5)'
              el.style.color = C.gold
            }}
          >
            I am not in crisis — continue
          </button>
        </div>
      </FadeIn>
    </FadeIn>
  )
}

// ─── STEP 3: VOLITIONAL DECLARATION ──────────────────────────────────────────
function StepDeclaration({ onComplete }: { onComplete: () => void }) {
  const [affirmed, setAffirmed] = useState(false)
  const [confirmVisible, setConfirmVisible] = useState(false)
  useEffect(() => {
    if (affirmed) {
      const t = setTimeout(() => setConfirmVisible(true), 80)
      return () => clearTimeout(t)
    }
  }, [affirmed])

  const handleAffirm = () => {
    setAffirmed(true)
    setTimeout(() => onComplete(), 1600)
  }

  return (
    <FadeIn delay={100}>
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{
          fontFamily: "'Inter', Arial, sans-serif",
          fontSize: '0.6rem',
          letterSpacing: '0.42em',
          color: C.smoke,
          textTransform: 'uppercase',
          marginBottom: 20,
        }}>
          The Declaration
        </div>
        <h2 style={{
          fontFamily: "'Gentium Plus', Georgia, serif",
          fontSize: 'clamp(1.4rem, 3.5vw, 2rem)',
          color: C.paleGold,
          fontWeight: 400,
          letterSpacing: '0.08em',
          lineHeight: 1.4,
          margin: '0 0 10px',
        }}>
          You must choose to cross.
        </h2>
        <p style={{
          fontStyle: 'italic',
          color: C.smoke,
          fontSize: '0.82rem',
          lineHeight: 1.9,
          margin: 0,
        }}>
          No one may be carried across a threshold.
        </p>
      </div>

      <GlyphDivider />

      <FadeIn delay={300}>
        <div style={{
          border: '1px solid rgba(212,168,67,0.18)',
          background: 'rgba(212,168,67,0.025)',
          padding: '28px 32px',
          marginBottom: 36,
          textAlign: 'center',
        }}>
          <div style={{
            fontFamily: "'Gentium Plus', Georgia, serif",
            fontStyle: 'italic',
            color: C.bone,
            fontSize: 'clamp(1.05rem, 2.5vw, 1.3rem)',
            lineHeight: 2.1,
          }}>
            "I enter this place of my own will.
            <br />
            I understand the Elder names myth — it does not predict, initiate, or counsel crisis.
            <br />
            I am prepared to hear what the pattern in my life is called."
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={600}>
        <div style={{ textAlign: 'center', minHeight: 56 }}>
          {affirmed === false ? (
            <button
              onClick={handleAffirm}
              style={{
                background: 'transparent',
                border: `1px solid ${C.gold}`,
                color: C.gold,
                fontFamily: "'Gentium Plus', Georgia, serif",
                fontSize: '0.72rem',
                letterSpacing: '0.32em',
                padding: '16px 44px',
                cursor: 'pointer',
                textTransform: 'uppercase',
                transition: 'all 0.3s ease',
                boxShadow: '0 0 0 rgba(212,168,67,0)',
              }}
              onMouseEnter={e => {
                const el = e.target as HTMLButtonElement
                el.style.color = C.paleGold
                el.style.boxShadow = '0 0 24px rgba(212,168,67,0.15)'
              }}
              onMouseLeave={e => {
                const el = e.target as HTMLButtonElement
                el.style.color = C.gold
                el.style.boxShadow = '0 0 0 rgba(212,168,67,0)'
              }}
            >
              I declare this — enter
            </button>
          ) : (
            <div style={{
              fontFamily: "'Inter', Arial, sans-serif",
              fontSize: '0.65rem',
              letterSpacing: '0.38em',
              color: C.gold,
              textTransform: 'uppercase',
              opacity: confirmVisible ? 1 : 0,
              transition: 'opacity 0.8s ease',
            }}>
              ⟡ &nbsp; The fire recognizes you &nbsp; ⟡
            </div>
          )}
        </div>
      </FadeIn>

      <FadeIn delay={1000}>
        <div style={{
          textAlign: 'center',
          marginTop: 44,
          fontSize: '0.52rem',
          letterSpacing: '0.16em',
          color: C.smoke,
          opacity: 0.45,
          lineHeight: 2,
          fontStyle: 'italic',
        }}>
          By crossing, you acknowledge that The Elder is an instrument of Applied Mythopoetics
          — symbolic, not clinical — and does not constitute medical, psychological, or spiritual advice.
          <br />
          Temporal Bridges Institute · AHAU AI
        </div>
      </FadeIn>
    </FadeIn>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function LintelGate({ onComplete, onCrisis }: Props) {
  const [step, setStep] = useState<LintelStep>('disclosure')

  const stepIndex = { disclosure: 0, stance: 1, declaration: 2 }[step]

  return (
    <div style={{
      minHeight: '100vh',
      background: C.obsidian,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Gentium Plus', Georgia, 'Times New Roman', serif",
      padding: '40px 24px',
    }}>
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: 1,
        background: `linear-gradient(90deg, transparent, ${C.gold}, transparent)`,
        opacity: 0.25,
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
            color: C.gold,
            letterSpacing: '0.32em',
            marginBottom: 6,
            textShadow: '0 0 40px rgba(212,168,67,0.25)',
            opacity: 0.7,
          }}>
            THE ELDER
          </div>
          <div style={{
            fontFamily: "'Inter', Arial, sans-serif",
            fontSize: '0.52rem',
            letterSpacing: '0.44em',
            color: C.smoke,
            textTransform: 'uppercase',
          }}>
            The Lintel
          </div>
        </div>

        <StepDots current={stepIndex} />

        <div key={step}>
          {step === 'disclosure' && (
            <StepDisclosure onNext={() => setStep('stance')} />
          )}
          {step === 'stance' && (
            <StepStance
              onNext={() => setStep('declaration')}
              onCrisis={onCrisis}
            />
          )}
          {step === 'declaration' && (
            <StepDeclaration onComplete={onComplete} />
          )}
        </div>
      </div>

      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(212,168,67,0.2), transparent)',
        pointerEvents: 'none',
      }} />
    </div>
  )
}
