'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LINEAGES, type LineageKey } from '../../lib/lineages';
import {
  readPairings,
  groupPairings,
  interpretRemove,
  interpretRelease,
  type PairingGroup,
  type PairingRow,
} from '../../lib/figureClient';

// Figure Continuity: the seeker's own view of the pairings they have kept
// (docs/figure-continuity-spec.md v0.2, section 3.6; guard G12). A pairing
// describes a person or situation in the seeker's own life, so this page exists
// to let them SEE exactly what is held and TAKE IT BACK, at three scopes: one
// pairing, one myth's pairings, or everything.
//
// Posture, matching ThresholdLetters (the sibling page) and the rest of the
// codebase's "the seeker is the authority on their own life" stance:
//   - Every destructive step is confirmed inline, in plain words, and the two
//     answers carry equal weight. Nothing is released by a single stray tap.
//   - The server decides; the page only reports what it was told. A release that
//     did not happen is never shown as done, and the list is re-read from the
//     server after every change, so what is on screen is what is held.
//   - An unreadable list says so; it is never shown as "nothing kept".
//   - Labels (the seeker's words and the model's) render only as React text.
//   - There is deliberately NO export, download or copy. Pairings describe third
//     parties; the view lets you see and release them and does nothing else.

const C = {
  obsidian: '#0a0806',
  gold: '#d4a843',
  paleGold: '#e8c97a',
  bone: '#ede0c4',
  ash: '#c4b89a',
  smoke: '#a8916f',
};
const FONT = "'Gentium Plus', Georgia, 'Times New Roman', serif";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return iso;
  }
}

/** Which destructive step, if any, is waiting for the seeker's yes. */
export type Confirming =
  | null
  | { kind: 'row'; id: number }
  | { kind: 'chain'; chainId: string }
  | { kind: 'all' };

const same = (a: Confirming, b: Confirming) =>
  !!a && !!b && a.kind === b.kind &&
  (a.kind === 'all' || (a.kind === 'row' && b.kind === 'row' && a.id === b.id) || (a.kind === 'chain' && b.kind === 'chain' && a.chainId === b.chainId));

interface ViewProps {
  groups: PairingGroup[];
  /** Rows the server sent that this page could not read; said aloud, never hidden. */
  skipped: number;
  confirming: Confirming;
  working: boolean;
  notice: string | null;
  onAsk: (c: Confirming) => void;
  onCancel: () => void;
  onRemove: (id: number) => void;
  onReleaseChain: (chainId: string) => void;
  onReleaseAll: () => void;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** The loaded page body. Pure: everything it shows comes from its props. */
export function PairingsView(p: ViewProps) {
  const total = p.groups.reduce((n, g) => n + g.rows.length, 0);
  const none = total === 0 && p.skipped === 0;

  return (
    <>
      <div role="status" aria-live="polite" style={{ minHeight: 22, textAlign: 'center', marginBottom: 18 }}>
        {p.notice && <span style={{ fontStyle: 'italic', color: C.paleGold, fontSize: '0.86rem' }}>{p.notice}</span>}
      </div>

      {none && (
        <div style={{ textAlign: 'center', color: C.ash, fontStyle: 'italic', fontSize: '0.95rem', lineHeight: 1.8 }}>
          Nothing is kept here yet. A pairing is kept only when you say that it fits.
        </div>
      )}

      {p.skipped > 0 && (
        <div style={{ textAlign: 'center', color: C.ash, fontStyle: 'italic', fontSize: '0.86rem', lineHeight: 1.8, marginBottom: 22 }}>
          {p.skipped === 1 ? 'One pairing' : `${p.skipped} pairings`} could not be shown here. You can still release everything below.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {p.groups.map(group => {
          const lineage = LINEAGES[group.lineageKey as LineageKey];
          const accent = lineage?.palette?.primary ?? C.gold;
          const chainConfirm: Confirming = { kind: 'chain', chainId: group.chainId };
          return (
            <section
              key={group.chainId}
              aria-label={`Pairings kept in ${group.mythTitle || 'this myth'}, as ${group.figureLabel}`}
              style={{ background: 'rgba(8,6,4,0.93)', border: `1px solid ${accent}44`, padding: '24px 26px', position: 'relative' }}
            >
              <div style={{ fontSize: '0.56rem', letterSpacing: '0.28em', color: accent, textTransform: 'uppercase', opacity: 0.85, marginBottom: 6 }}>
                {lineage?.tradition ?? group.lineageKey}
              </div>
              <div style={{ fontStyle: 'italic', color: C.paleGold, fontSize: '1.05rem', lineHeight: 1.6 }}>
                As &ldquo;{group.figureLabel}&rdquo;
              </div>
              {group.mythTitle && (
                <div style={{ fontSize: '0.78rem', color: C.smoke, marginBottom: 16 }}>{group.mythTitle}</div>
              )}

              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 18 }}>
                {group.rows.map(row => (
                  <PairingItem key={row.id} row={row} accent={accent} confirming={p.confirming} working={p.working}
                    onAsk={p.onAsk} onCancel={p.onCancel} onRemove={p.onRemove} />
                ))}
              </ul>

              <div style={{ marginTop: 22, paddingTop: 16, borderTop: `1px solid ${accent}22` }}>
                {same(p.confirming, chainConfirm) ? (
                  <ConfirmLine
                    question={`Release ${group.rows.length === 1 ? 'the pairing' : `all ${group.rows.length} pairings`} kept in this myth?`}
                    yes="Release" no="Keep them" accent={accent} working={p.working}
                    onYes={() => p.onReleaseChain(group.chainId)} onNo={p.onCancel}
                  />
                ) : (
                  <TextButton label={`Release this myth's ${plural(group.rows.length, 'pairing', 'pairings')}`} triggerKey={`chain-${group.chainId}`} disabled={p.working || !!p.confirming} onClick={() => p.onAsk(chainConfirm)} />
                )}
              </div>
            </section>
          );
        })}
      </div>

      {(total > 0 || p.skipped > 0) && (
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          {same(p.confirming, { kind: 'all' }) ? (
            <ConfirmLine
              question="Release every pairing the fire holds for you? This cannot be undone."
              yes="Release everything" no="Keep them" accent={C.gold} working={p.working}
              onYes={p.onReleaseAll} onNo={p.onCancel}
            />
          ) : (
            <TextButton label="Release everything" triggerKey="all" disabled={p.working || !!p.confirming} onClick={() => p.onAsk({ kind: 'all' })} />
          )}
        </div>
      )}
    </>
  );
}

function PairingItem({ row, accent, confirming, working, onAsk, onCancel, onRemove }: {
  row: PairingRow; accent: string; confirming: Confirming; working: boolean;
  onAsk: (c: Confirming) => void; onCancel: () => void; onRemove: (id: number) => void;
}) {
  const mine: Confirming = { kind: 'row', id: row.id };
  const asking = same(confirming, mine);
  return (
    <li style={{ borderLeft: `2px solid ${accent}66`, paddingLeft: 16 }}>
      <div style={{ fontSize: '1.0rem', lineHeight: 1.8, color: C.bone }}>
        <span style={{ fontStyle: 'italic' }}>&ldquo;{row.subjectLabel}&rdquo;</span>
        <span style={{ color: C.smoke }}> echoes </span>
        <span style={{ fontStyle: 'italic' }}>&ldquo;{row.counterpartLabel}&rdquo;</span>
      </div>
      <div style={{ fontSize: '0.7rem', color: C.smoke, marginTop: 2 }}>
        Kept {formatDate(row.confirmedAt)}
        {row.counterpartBasis === 'model_report' && (
          <span> &nbsp;&middot;&nbsp; the counterpart is the Elder&rsquo;s own recollection of the tradition, not a cited passage</span>
        )}
      </div>
      <div style={{ marginTop: 6 }}>
        {asking ? (
          <ConfirmLine
            question="Remove this pairing?" yes="Remove" no="Keep it" accent={accent} working={working}
            onYes={() => onRemove(row.id)} onNo={onCancel}
          />
        ) : (
          <TextButton
            label="Remove"
            triggerKey={`row-${row.id}`}
            ariaLabel={`Remove: ${row.subjectLabel} echoes ${row.counterpartLabel}`}
            disabled={working || !!confirming}
            onClick={() => onAsk(mine)}
          />
        )}
      </div>
    </li>
  );
}

function ConfirmLine({ question, yes, no, accent, working, onYes, onNo }: {
  question: string; yes: string; no: string; accent: string; working: boolean; onYes: () => void; onNo: () => void;
}) {
  return (
    <div role="group" aria-label={question} style={{ fontFamily: FONT }}>
      <div style={{ fontStyle: 'italic', color: C.ash, fontSize: '0.88rem', lineHeight: 1.7, marginBottom: 10 }}>{question}</div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'inherit', flexWrap: 'wrap' }}>
        <ChoiceButton label={yes} accent={accent} disabled={working} onClick={onYes} />
        {/* The non-destructive answer takes focus, so a keyboard or screen-reader user is never left on
            a control that has just disappeared, and a stray Enter keeps rather than releases. */}
        <ChoiceButton label={no} accent={accent} disabled={working} onClick={onNo} autoFocus />
      </div>
    </div>
  );
}

function ChoiceButton({ label, accent, disabled, onClick, autoFocus }: { label: string; accent: string; disabled: boolean; onClick: () => void; autoFocus?: boolean }) {
  return (
    <button
      type="button"
      autoFocus={autoFocus}
      disabled={disabled}
      onClick={onClick}
      style={{
        background: 'transparent', border: `1px solid ${accent}77`, color: C.paleGold, fontFamily: FONT, fontStyle: 'italic',
        fontSize: '0.92rem', padding: '9px 18px', minHeight: 44, minWidth: 108, borderRadius: 2,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
      }}
    >
      {label}
    </button>
  );
}

function TextButton({ label, ariaLabel, triggerKey, disabled, onClick }: { label: string; ariaLabel?: string; triggerKey: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      data-pairing-trigger={triggerKey}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      style={{
        background: 'none', border: 'none', fontFamily: FONT, fontStyle: 'italic', fontSize: '0.8rem', letterSpacing: '0.03em',
        color: C.smoke, textDecoration: 'underline', textUnderlineOffset: 3, padding: '10px 4px', minHeight: 44,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}

type Load = 'loading' | 'signedOut' | 'error' | 'ready';

const keyOf = (c: Confirming): string | null => (!c ? null : c.kind === 'all' ? 'all' : c.kind === 'row' ? `row-${c.id}` : `chain-${c.chainId}`);

export default function FigureMappings() {
  const [load, setLoad] = useState<Load>('loading');
  const [rows, setRows] = useState<PairingRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // After cancelling a confirmation focus returns to the control that opened it; after a completed
  // release it goes to the page heading (the control that was pressed no longer exists).
  const [returnFocusTo, setReturnFocusTo] = useState<string | 'heading' | null>(null);
  useEffect(() => {
    if (!returnFocusTo) return;
    if (returnFocusTo === 'heading') headingRef.current?.focus();
    else document.querySelector<HTMLElement>(`[data-pairing-trigger="${returnFocusTo}"]`)?.focus();
    setReturnFocusTo(null);
  }, [returnFocusTo]);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  /** Re-read the list from the server: what is shown is always what is held. Returns whether it could. */
  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/figure-mappings');
      if (res.status === 401) { if (mounted.current) setLoad('signedOut'); return true; }
      const body = await res.json().catch(() => null);
      const parsed = res.ok ? readPairings(body) : null;
      if (!mounted.current) return true;
      if (!parsed) return false;
      setRows(parsed.rows);
      setSkipped(parsed.skipped);
      setLoad('ready');
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const ok = await refresh();
      if (!ok && mounted.current) setLoad('error');
    })();
  }, [refresh]);

  // One destructive request at a time; the list is re-read afterwards and the notice says what happened.
  const act = useCallback(async (run: () => Promise<{ done: boolean; message: string }>) => {
    if (busy.current) return;
    busy.current = true;
    setWorking(true);
    setNotice(null);
    try {
      const outcome = await run();
      if (!mounted.current) return;
      if (outcome.done) {
        setConfirming(null);
        setReturnFocusTo('heading');
        const fresh = await refresh();
        if (mounted.current) setNotice(fresh ? outcome.message : `${outcome.message} The list could not be refreshed; what you see may be out of date.`);
      } else {
        setNotice(outcome.message);
      }
    } catch {
      if (mounted.current) setNotice('The fire could not answer. Nothing was released; you may try again.');
    } finally {
      busy.current = false;
      if (mounted.current) setWorking(false);
    }
  }, [refresh]);

  const failed = 'The fire could not answer. Nothing was released; you may try again.';

  const onRemove = (id: number) => act(async () => {
    const res = await fetch(`/api/figure-mappings/${id}`, { method: 'DELETE' });
    const outcome = interpretRemove(res.status);
    return outcome === 'failed' ? { done: false, message: failed } : { done: true, message: 'Removed.' };
  });
  const release = (chainId: string | null) => act(async () => {
    const res = await fetch('/api/figure-mappings/release', chainId
      ? { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chainId }) }
      : { method: 'DELETE' });
    const body = await res.json().catch(() => null);
    const outcome = interpretRelease(res.status, body);
    if (outcome.kind === 'failed') return { done: false, message: failed };
    return { done: true, message: outcome.count === 0 ? 'Nothing was left to release.' : `Released ${outcome.count} ${plural(outcome.count, 'pairing', 'pairings')}.` };
  });

  return (
    <div aria-busy={load === 'loading'} data-load={load} style={{
      // Above the root layout's fixed ground/fire layers, as ThresholdLetters and app/about do.
      position: 'relative', zIndex: 10, minHeight: 'var(--vh-full)', background: C.obsidian, color: C.bone,
      fontFamily: FONT, padding: '54px 20px 90px',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <div style={{ marginBottom: 18 }}>
          <Link href="/" style={{ color: C.smoke, fontStyle: 'italic', fontSize: '0.8rem', textDecoration: 'none' }}>&larr; back to the fire</Link>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 ref={headingRef} tabIndex={-1} style={{ outline: 'none',
            fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 400, margin: '0 0 10px',
            fontSize: 'clamp(1.6rem, 4vw, 2.3rem)', color: C.gold, letterSpacing: '0.2em',
          }}>
            KEPT PAIRINGS
          </h1>
          <div style={{ fontStyle: 'italic', color: C.ash, fontSize: '0.92rem', lineHeight: 1.8 }}>
            The people and situations in your life you have set beside a character in your myth.
            Kept only because you said they fit, and only until you release them.
          </div>
        </div>

        {load === 'loading' && (
          <div style={{ textAlign: 'center', color: C.smoke, fontStyle: 'italic', fontSize: '0.9rem' }}>&hellip;</div>
        )}

        {load === 'signedOut' && (
          <div style={{ textAlign: 'center', color: C.ash, fontStyle: 'italic', fontSize: '0.95rem', lineHeight: 1.8 }}>
            Pairings are kept for a seeker who has signed in. Sign in from the fire.
          </div>
        )}

        {load === 'error' && (
          <div role="alert" style={{ textAlign: 'center', color: C.ash, fontStyle: 'italic', fontSize: '0.95rem', lineHeight: 1.8 }}>
            The fire could not be reached, so nothing is shown here. That does not mean nothing is kept.
            Please try again in a moment.
          </div>
        )}

        {load === 'ready' && (
          <PairingsView
            groups={groupPairings(rows)}
            skipped={skipped}
            confirming={confirming}
            working={working}
            notice={notice}
            onAsk={c => { setNotice(null); setConfirming(c); }}
            onCancel={() => { setReturnFocusTo(keyOf(confirming)); setConfirming(null); }}
            onRemove={onRemove}
            onReleaseChain={chainId => release(chainId)}
            onReleaseAll={() => release(null)}
          />
        )}
      </div>
    </div>
  );
}
