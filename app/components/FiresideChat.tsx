'use client';

// The fireside chat page body. Three stages: a gate (disclosure + adult confirmation + which door),
// the sitting, and a closed state. Everything the host says arrives from /api/fireside; the browser
// holds only an opaque sealed token and the words already shown. Honest failures are drawn plainly
// (never in the ceremonial italic), and the crisis line is on screen the whole time, with no request.

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import FireAtmosphere from './FireAtmosphere';

type Mode = 'before' | 'after';
type Line = { who: 'host' | 'you' | 'notice'; text: string };
type Stage = 'checking' | 'dark' | 'gate' | 'sitting' | 'closed';

const FONT = "'Gentium Plus', Georgia, 'Times New Roman', serif";
const PLAIN = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const MAX = 800;

const wrap: React.CSSProperties = { minHeight: 'var(--vh-full)', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1, padding: '28px 18px 20px', fontFamily: FONT, color: '#e8dcc0' };
const panel: React.CSSProperties = { width: '100%', maxWidth: 560 };
const gold = '#d4a843';

export default function FiresideChat() {
  const [stage, setStage] = useState<Stage>('checking');
  const [mode, setMode] = useState<Mode>('before');
  const [adult, setAdult] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [token, setToken] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [gateError, setGateError] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const w = new URLSearchParams(window.location.search).get('when');
      if (w === 'before' || w === 'after') setMode(w);
    } catch { /* default */ }
    fetch('/api/fireside', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => setStage(d?.enabled === true ? 'gate' : 'dark'))
      .catch(() => setStage('dark'));
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [lines, busy]);

  async function begin() {
    setGateError('');
    setBusy(true);
    try {
      const r = await fetch('/api/fireside', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'open', mode, adult: true }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.state) { setGateError(d?.error || 'The fire is not available right now.'); return; }
      setToken(d.state);
      setLines([{ who: 'notice', text: d.disclosure }, { who: 'host', text: d.host }]);
      setStage('sitting');
    } catch {
      setGateError('The fire is not available right now. Nothing was kept.');
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setLines((l) => [...l, { who: 'you', text }]);
    setDraft('');
    try {
      const r = await fetch('/api/fireside', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'turn', state: token, message: text }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setLines((l) => [...l, { who: 'notice', text: d?.error || 'Something went wrong. Nothing you wrote was kept. You can try again, or call or text 988 if you need someone now.' }]);
      } else if (d.kind === 'host') {
        setToken(d.state);
        setLines((l) => [...l, { who: 'host', text: d.host }]);
      } else if (d.kind === 'failure') {
        if (d.state) setToken(d.state);
        setLines((l) => [...l, { who: 'notice', text: d.host }]);
      } else {
        // crisis or closed: the sitting is over; the words are fixed copy from the server.
        setToken('');
        setLines((l) => [...l, { who: 'notice', text: d.host }]);
        setStage('closed');
      }
    } catch {
      setLines((l) => [...l, { who: 'notice', text: 'I could not reach the fire. Nothing you wrote was kept. You can try again, or call or text 988 if you need someone now.' }]);
    } finally {
      setBusy(false);
    }
  }

  const crisisFooter = (
    <p style={{ ...panel, marginTop: 18, fontFamily: PLAIN, fontSize: '0.8rem', lineHeight: 1.5, color: '#d6cbb0', textAlign: 'center', background: 'rgba(14,11,8,0.85)', padding: '8px 12px' }}>
      If you are in crisis, call or text <a href="tel:988" style={{ color: '#e8dcc0' }}>988</a> (US), any hour. In immediate danger, call 911.
    </p>
  );

  if (stage === 'checking') return (<><FireAtmosphere soundEnabled={false} intensity={0.4} /><div style={wrap} aria-busy="true" /></>);

  if (stage === 'dark') {
    return (
      <>
        <FireAtmosphere soundEnabled={false} intensity={0.3} />
        <main style={{ ...wrap, justifyContent: 'center', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 'normal', letterSpacing: '0.08em', color: gold }}>The Fireside</h1>
          <p style={{ ...panel, fontFamily: PLAIN, lineHeight: 1.6, color: '#c4b89a' }}>The fireside is not open yet. The fire is still being laid.</p>
          <Link href="/" style={{ color: gold, marginTop: 12 }}>Return to the fire</Link>
        </main>
      </>
    );
  }

  if (stage === 'gate') {
    return (
      <>
        <FireAtmosphere soundEnabled={false} intensity={0.45} />
        <main style={{ ...wrap, justifyContent: 'center' }}>
          <div style={{ ...panel, textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 'normal', letterSpacing: '0.1em', color: gold, marginBottom: 6 }}>The Fireside</h1>
            <p style={{ fontStyle: 'italic', color: '#c4b89a', marginTop: 0 }}>A quiet place to talk, before or after a reading.</p>

            <div role="radiogroup" aria-label="When are you coming to the fire?" style={{ display: 'inline-flex', margin: '14px 0' }}>
              {(['before', 'after'] as const).map((m, i) => (
                <button key={m} role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                  style={{ fontFamily: FONT, fontSize: '0.74rem', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '9px 16px', cursor: 'pointer', color: mode === m ? '#e8c97a' : 'rgba(168,145,111,0.7)', background: mode === m ? 'rgba(212,168,67,0.10)' : 'transparent', border: '1px solid ' + (mode === m ? 'rgba(212,168,67,0.45)' : 'rgba(212,168,67,0.18)'), borderLeft: i ? 'none' : undefined }}>
                  {m === 'before' ? 'Before the reading' : 'After the reading'}
                </button>
              ))}
            </div>

            <div style={{ fontFamily: PLAIN, fontSize: '0.88rem', lineHeight: 1.65, color: '#d6cbb0', textAlign: 'left', border: '1px solid rgba(212,168,67,0.25)', padding: '14px 16px', background: 'rgba(14,11,8,0.6)' }}>
              <p style={{ margin: '0 0 8px' }}><strong>You will be talking with an AI, not a person.</strong> It is a host: it listens and asks questions. It does not tell myths, give readings, or give advice.</p>
              <p style={{ margin: '0 0 8px' }}>This is not therapy, counseling or medical care, and it does not replace any of those.</p>
              <p style={{ margin: 0 }}>We do not store what you write. It is sent to an AI service to answer you, and the sitting ends when you close this page.</p>
            </div>

            <label style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', margin: '16px 0', fontFamily: PLAIN, fontSize: '0.9rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
              I am 18 or older
            </label>

            {gateError && <p role="alert" style={{ fontFamily: PLAIN, color: '#e0a090', fontSize: '0.88rem' }}>{gateError}</p>}

            <button onClick={begin} disabled={!adult || busy}
              style={{ fontFamily: FONT, fontSize: '0.74rem', letterSpacing: '0.22em', textTransform: 'uppercase', padding: '12px 26px', cursor: adult && !busy ? 'pointer' : 'not-allowed', color: gold, background: 'transparent', border: '1px solid rgba(212,168,67,0.45)', opacity: adult && !busy ? 1 : 0.5 }}>
              {busy ? '…' : 'Come to the fire'}
            </button>
            <div style={{ marginTop: 14 }}><Link href="/" style={{ color: '#a8916f', fontSize: '0.85rem' }}>Not now</Link></div>
          </div>
          {crisisFooter}
        </main>
      </>
    );
  }

  const closed = stage === 'closed';
  return (
    <>
      <FireAtmosphere soundEnabled={false} intensity={0.5} />
      <main style={wrap}>
        <header style={{ ...panel, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <h1 style={{ fontSize: '1rem', fontWeight: 'normal', letterSpacing: '0.14em', textTransform: 'uppercase', color: gold, margin: 0 }}>The Fireside</h1>
          <Link href="/" style={{ color: '#c4b89a', fontSize: '0.85rem', fontFamily: PLAIN }}>Step away</Link>
        </header>

        <div role="log" aria-live="polite" aria-label="The conversation" style={{ ...panel, flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 12 }}>
          {lines.map((l, i) => l.who === 'notice' ? (
            <p key={i} style={{ margin: 0, fontFamily: PLAIN, fontSize: '0.86rem', lineHeight: 1.6, color: '#d6cbb0', border: '1px solid rgba(212,168,67,0.3)', padding: '10px 12px', background: 'rgba(14,11,8,0.7)', whiteSpace: 'pre-wrap' }}>{l.text}</p>
          ) : l.who === 'host' ? (
            <p key={i} style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.75, color: '#f0e4c4', whiteSpace: 'pre-wrap' }}><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>The host says: </span>{l.text}</p>
          ) : (
            <p key={i} style={{ margin: 0, alignSelf: 'flex-end', maxWidth: '85%', fontFamily: PLAIN, fontSize: '0.95rem', lineHeight: 1.55, color: '#d6cbb0', background: 'rgba(212,168,67,0.08)', padding: '8px 12px', whiteSpace: 'pre-wrap' }}><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>You say: </span>{l.text}</p>
          ))}
          {busy && <p aria-label="The host is listening" style={{ margin: 0, color: '#a8916f', fontStyle: 'italic' }}>…</p>}
          <div ref={endRef} />
        </div>

        {closed ? (
          <div style={{ ...panel, textAlign: 'center', padding: '8px 0' }}>
            <Link href="/" style={{ color: gold }}>Return to the fire</Link>
          </div>
        ) : (
          <form style={{ ...panel, display: 'flex', gap: 8, alignItems: 'flex-end' }} onSubmit={(e) => { e.preventDefault(); send(); }}>
            <label htmlFor="fireside-input" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Your words</label>
            <textarea
              id="fireside-input" value={draft} maxLength={MAX} rows={2} disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="In your own words…"
              style={{ flex: 1, resize: 'none', fontFamily: PLAIN, fontSize: '1rem', lineHeight: 1.5, color: '#f0e4c4', background: 'rgba(14,11,8,0.75)', border: '1px solid rgba(212,168,67,0.3)', padding: '10px 12px' }}
            />
            <button type="submit" disabled={busy || !draft.trim()}
              style={{ fontFamily: FONT, fontSize: '0.72rem', letterSpacing: '0.18em', textTransform: 'uppercase', padding: '12px 16px', color: gold, background: 'transparent', border: '1px solid rgba(212,168,67,0.45)', cursor: busy || !draft.trim() ? 'not-allowed' : 'pointer', opacity: busy || !draft.trim() ? 0.5 : 1 }}>
              Send
            </button>
          </form>
        )}
        {crisisFooter}
      </main>
    </>
  );
}
