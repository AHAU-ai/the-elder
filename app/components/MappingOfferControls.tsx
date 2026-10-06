'use client';

import { useEffect, useRef, useState } from 'react';
import { interpretConfirm, interpretRemove, type MappingOffer, type OfferResult } from '@/lib/figureClient';

// Figure Continuity: the two controls under an offered pairing
// (docs/figure-continuity-spec.md v0.2, section 3.4). The Elder has already
// asked, in prose, whether the pairing fits; these are the seeker's own answer,
// and the ONLY thing that ever turns an offer into a kept pairing (spec G4).
// The model's words never confirm anything.
//
// Posture, matching StageUpOffer / MarkerOffer (the seeker is the authority on
// their own life):
//   - "That fits" and "Not quite" carry EQUAL visual weight. Nothing here wants
//     a yes.
//   - What would be kept is shown plainly, in the seeker's own words, so the
//     choice is informed: pairings describe people in their life.
//   - No sound, no change to the fire, no pulse, on either answer. A failed
//     answer says so and leaves both controls available; it never flares.
//   - Appears only when the parent says the reading has settled, then fades in.
//     The global prefers-reduced-motion rule already collapses the fade.
//
// The server decides every outcome (guarded first-answer-wins, 24h expiry, cap,
// release of a chain); this component only reports what it was told.

interface Props {
  offer: MappingOffer;
  accent?: string;
  /** The seeker's answer so far, held by the parent: the reading can unmount and remount this
   *  component (a follow-up turn does), and an answered offer must not be asked again. */
  result?: OfferResult;
  onResult?: (result: OfferResult) => void;
}

type State =
  | { phase: 'offered'; note?: string }
  | { phase: 'working' }
  | { phase: 'confirmed' }
  | { phase: 'declined' }
  | { phase: 'passed' }
  | { phase: 'cap'; message: string };

const C = {
  paleGold: '#e8c97a',
  ash: '#c4b89a',
  smoke: '#a8916f',
};

const FONT = "'Gentium Plus', Georgia, serif";

// An offer is brought into view at most once per sitting. The controls sit after the whole
// ceremonial closing, often a screen or more below the question the Elder just asked, and the
// pairing is only ever kept by pressing them: a seeker who answers "yes" in the text box keeps
// nothing. Scrolling is minimal ('nearest': nothing happens if they are already on screen), only
// happens once the reading has settled and the controls have appeared, and is instant under
// prefers-reduced-motion.
const broughtIntoView = new Set<number>();

function stateFor(result: OfferResult | undefined): State {
  if (!result) return { phase: 'offered' };
  if (result.kind === 'cap') return { phase: 'cap', message: result.message };
  return { phase: result.kind };
}

export default function MappingOfferControls({ offer, accent = '#d4a843', result, onResult }: Props) {
  const [state, setState] = useState<State>(() => stateFor(result));
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const settle = (next: State, r: OfferResult) => { setState(next); onResultRef.current?.(r); };
  const [visible, setVisible] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mounted.current = true;
    const t = setTimeout(() => setVisible(true), 60);
    // Only an offer still waiting for an answer is brought into view, and only the first time.
    const docTop = () => (groupRef.current ? groupRef.current.getBoundingClientRect().top + window.scrollY : 0);
    let placedAt = 0;
    const bring = () => {
      let reduce = false;
      try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* keep the animated path */ }
      groupRef.current?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      placedAt = docTop();
    };
    const s = setTimeout(() => {
      if (result || broughtIntoView.has(offer.id)) return;
      broughtIntoView.add(offer.id);
      bring();
    }, 400);
    // The reading above can still be settling its own layout for a moment after the controls appear
    // (the closing grows by a few hundred pixels). If the controls' place in the document has MOVED
    // since the first scroll, bring them into view once more. A seeker who has scrolled away
    // themselves has not moved the controls in the document, so they are never pulled back.
    const s2 = setTimeout(() => {
      if (placedAt === 0 || Math.abs(docTop() - placedAt) <= 24) return;
      bring();
    }, 1400);
    return () => { mounted.current = false; clearTimeout(t); clearTimeout(s); clearTimeout(s2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each press is one request; a second press while one is in flight does nothing.
  async function answer(action: 'confirm' | 'decline') {
    if (busy.current) return;
    busy.current = true;
    setState({ phase: 'working' });
    try {
      if (action === 'confirm') {
        const res = await fetch(`/api/figure-mappings/${offer.id}/confirm`, { method: 'POST' });
        const body = await res.json().catch(() => null);
        const outcome = interpretConfirm(res.status, body);
        if (!mounted.current) return;
        if (outcome.kind === 'confirmed') settle({ phase: 'confirmed' }, { kind: 'confirmed' });
        else if (outcome.kind === 'noop') settle({ phase: 'passed' }, { kind: 'passed' });
        else if (outcome.kind === 'capReached') settle({ phase: 'cap', message: outcome.message }, { kind: 'cap', message: outcome.message });
        else if (outcome.kind === 'rateLimited') setState({ phase: 'offered', note: 'The fire needs a moment. Try again a little later.' });
        else setState({ phase: 'offered', note: 'The fire could not answer. Nothing was kept; you may try again.' });
      } else {
        const res = await fetch(`/api/figure-mappings/${offer.id}?offer=1`, { method: 'DELETE' });
        const outcome = interpretRemove(res.status);
        if (!mounted.current) return;
        if (outcome === 'failed') setState({ phase: 'offered', note: 'The fire could not answer. You may try again.' });
        else settle({ phase: 'declined' }, { kind: 'declined' });
      }
    } catch {
      if (mounted.current) setState({ phase: 'offered', note: 'The fire could not answer. Nothing changed; you may try again.' });
    } finally {
      busy.current = false;
    }
  }

  const settled = state.phase === 'confirmed' || state.phase === 'declined' || state.phase === 'passed' || state.phase === 'cap';
  const working = state.phase === 'working';

  return (
    <div
      ref={groupRef}
      role="group"
      aria-label="Keep this pairing?"
      style={{
        maxWidth: 460,
        margin: '20px auto 0',
        padding: '0 20px',
        textAlign: 'center',
        fontFamily: FONT,
        opacity: visible ? 1 : 0,
        transition: 'opacity 1.1s ease',
        // Leaves room beneath when scrolled into view ('nearest'), so the answers do not sit flush
        // against the bottom edge of the screen.
        scrollMarginBottom: 96,
      }}
    >
      <div aria-hidden style={{ width: 1, height: 22, margin: '0 auto 14px', background: `linear-gradient(to bottom, transparent, ${accent}66, transparent)` }} />

      {!settled && (
        <>
          <p style={{ margin: '0 0 14px', fontStyle: 'italic', color: C.ash, fontSize: '0.86rem', lineHeight: 1.75 }}>
            To keep: &ldquo;{offer.subject}&rdquo; echoes &ldquo;{offer.counterpart}&rdquo;.
            <br />
            <span style={{ color: C.smoke, fontSize: '0.74rem' }}>
              Kept until you release it. Nothing is kept unless you say so.
            </span>
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <AnswerButton label="That fits" accent={accent} disabled={working} onClick={() => answer('confirm')} />
            <AnswerButton label="Not quite" accent={accent} disabled={working} onClick={() => answer('decline')} />
          </div>
        </>
      )}

      <div role="status" aria-live="polite" style={{ minHeight: 20, marginTop: settled ? 0 : 12 }}>
        {state.phase === 'offered' && state.note && (
          <span style={{ fontStyle: 'italic', color: C.smoke, fontSize: '0.78rem', lineHeight: 1.7 }}>{state.note}</span>
        )}
        {state.phase === 'confirmed' && (
          <span style={{ fontStyle: 'italic', color: C.paleGold, fontSize: '0.86rem', letterSpacing: '0.03em' }}>kept</span>
        )}
        {state.phase === 'declined' && (
          <span style={{ fontStyle: 'italic', color: C.smoke, fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>set down</span>
        )}
        {state.phase === 'passed' && (
          <span style={{ fontStyle: 'italic', color: C.smoke, fontSize: '0.8rem', lineHeight: 1.7 }}>that one has passed</span>
        )}
        {state.phase === 'cap' && (
          <span style={{ fontStyle: 'italic', color: C.ash, fontSize: '0.82rem', lineHeight: 1.75 }}>{state.message}</span>
        )}
      </div>
    </div>
  );
}

function AnswerButton({ label, accent, disabled, onClick }: { label: string; accent: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        background: 'transparent',
        border: `1px solid ${accent}77`,
        color: C.paleGold,
        fontFamily: FONT,
        fontStyle: 'italic',
        fontSize: '0.95rem',
        padding: '9px 20px',
        minHeight: 44,
        minWidth: 120,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        borderRadius: 2,
        transition: 'background 0.25s, border-color 0.25s, opacity 0.25s',
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = `${accent}18`; e.currentTarget.style.borderColor = accent; } }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = `${accent}77`; }}
    >
      {label}
    </button>
  );
}
