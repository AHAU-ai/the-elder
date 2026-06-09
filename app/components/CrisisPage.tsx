'use client'

import { C, FadeIn, GlyphDivider } from './LintelShared'
import { MistLayer } from './MistLayer'

interface Props {
  onReturn: () => void
}

export default function CrisisPage({ onReturn }: Props) {
  return (
    <div style={{
      minHeight: '100vh',
      background: C.obsidian,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
      padding: '40px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <MistLayer />

      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        height: 1,
        background: `linear-gradient(90deg, transparent, ${C.ember}, transparent)`,
        opacity: 0.4,
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 540, position: 'relative', zIndex: 1 }}>

        <FadeIn delay={0}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <div style={{
              fontFamily: "'Cinzel Decorative', 'Cinzel', Georgia, serif",
              fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
              color: C.gold,
              letterSpacing: '0.32em',
              marginBottom: 6,
              opacity: 0.6,
            }}>
              THE ELDER
            </div>
            <div style={{
              fontFamily: "'Cinzel', Georgia, serif",
              fontSize: '0.52rem',
              letterSpacing: '0.44em',
              color: C.smoke,
              textTransform: 'uppercase',
              marginBottom: 32,
            }}>
              A Pause at the Fire
            </div>
            <div style={{
              fontStyle: 'italic',
              color: C.bone,
              fontSize: 'clamp(1.1rem, 3vw, 1.45rem)',
              lineHeight: 2.0,
              maxWidth: 460,
              margin: '0 auto',
              textShadow: '0 0 30px rgba(212,168,67,0.08)',
            }}>
              The fire sees you.
              <br />
              <span style={{ color: C.ash, fontSize: '0.92em' }}>
                And it knows this is not the moment for myth.
              </span>
            </div>
          </div>
        </FadeIn>

        <GlyphDivider opacity={0.25} />

        <FadeIn delay={400}>
          <div style={{
            fontStyle: 'italic',
            color: C.ash,
            fontSize: '1rem',
            lineHeight: 2.1,
            textAlign: 'center',
            marginBottom: 36,
            padding: '0 8px',
          }}>
            What you are carrying right now is heavier than symbol.
            <br />
            It asks for a human voice — not an ancient one.
            <br />
            <br />
            <span style={{ color: C.bone }}>
              The threshold here leads toward a living hand.
            </span>
          </div>
        </FadeIn>

        <FadeIn delay={700}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 40 }}>

            <div style={{
              border: '1px solid rgba(212,168,67,0.22)',
              background: 'rgba(212,168,67,0.025)',
              padding: '20px 24px',
            }}>
              <div style={{
                fontFamily: "'Cinzel', Georgia, serif",
                fontSize: '0.58rem',
                letterSpacing: '0.3em',
                color: C.gold,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}>
                Call or Text
              </div>
              <div style={{
                color: C.bone,
                fontSize: '1.5rem',
                letterSpacing: '0.12em',
                fontFamily: "'Cinzel', Georgia, serif",
                marginBottom: 6,
              }}>
                988
              </div>
              <div style={{
                fontStyle: 'italic',
                color: C.ash,
                fontSize: '0.85rem',
                lineHeight: 1.8,
              }}>
                Suicide &amp; Crisis Lifeline — free, confidential, 24 hours.
                <br />
                Call or text from anywhere in the US.
              </div>
            </div>

            <div style={{
              border: '1px solid rgba(212,168,67,0.15)',
              background: 'rgba(212,168,67,0.015)',
              padding: '20px 24px',
            }}>
              <div style={{
                fontFamily: "'Cinzel', Georgia, serif",
                fontSize: '0.58rem',
                letterSpacing: '0.3em',
                color: C.gold,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}>
                Text Only
              </div>
              <div style={{
                color: C.bone,
                fontSize: '1rem',
                letterSpacing: '0.06em',
                fontFamily: 'Georgia, serif',
                marginBottom: 6,
              }}>
                Text HOME to 741741
              </div>
              <div style={{
                fontStyle: 'italic',
                color: C.ash,
                fontSize: '0.85rem',
                lineHeight: 1.8,
              }}>
                Crisis Text Line — free, confidential, 24 hours.
                <br />
                If speaking feels too hard, this is the door.
              </div>
            </div>

            <div style={{
              border: '1px solid rgba(138,122,106,0.18)',
              padding: '16px 24px',
            }}>
              <div style={{
                fontFamily: "'Cinzel', Georgia, serif",
                fontSize: '0.55rem',
                letterSpacing: '0.28em',
                color: C.smoke,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}>
                Outside the US
              </div>
              <div style={{
                fontStyle: 'italic',
                color: C.smoke,
                fontSize: '0.82rem',
                lineHeight: 1.8,
              }}>
                findahelpline.com — crisis lines in 40+ countries,
                <br />
                searchable by country and language.
              </div>
            </div>

          </div>
        </FadeIn>

        <FadeIn delay={1000}>
          <div style={{
            textAlign: 'center',
            fontStyle: 'italic',
            color: 'rgba(196,184,154,0.55)',
            fontSize: '0.88rem',
            lineHeight: 2.0,
            marginBottom: 36,
          }}>
            The myths will still be here when you return.
            <br />
            The fire does not go out.
          </div>
        </FadeIn>

        <FadeIn delay={1200}>
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={onReturn}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(138,122,106,0.5)',
                fontFamily: 'Georgia, serif',
                fontStyle: 'italic',
                fontSize: '0.72rem',
                letterSpacing: '0.14em',
                cursor: 'pointer',
                padding: '8px 0',
                borderBottom: '1px solid rgba(138,122,106,0.2)',
                transition: 'color 0.3s, border-bottom-color 0.3s',
              }}
              onMouseEnter={e => {
                const el = e.target as HTMLButtonElement
                el.style.color = C.smoke
                el.style.borderBottomColor = 'rgba(138,122,106,0.4)'
              }}
              onMouseLeave={e => {
                const el = e.target as HTMLButtonElement
                el.style.color = 'rgba(138,122,106,0.5)'
                el.style.borderBottomColor = 'rgba(138,122,106,0.2)'
              }}
            >
              Return to the threshold when you are ready
            </button>
          </div>
        </FadeIn>

        <FadeIn delay={1400}>
          <div style={{
            textAlign: 'center',
            marginTop: 52,
            fontSize: '0.48rem',
            letterSpacing: '0.2em',
            color: C.smoke,
            opacity: 0.3,
            textTransform: 'uppercase',
            lineHeight: 2,
          }}>
            Temporal Bridges Institute · AHAU AI
          </div>
        </FadeIn>

      </div>
    </div>
  )
}
