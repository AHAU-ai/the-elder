'use client';

// Fireside.tsx
//
// The fireside room (docs/fireside.md): talk with the Elder as host. Not a
// Reading. The page holds the CURRENT sitting in memory and sends it back each
// turn; the server keeps no session. What reaches the seeker's record is
// decided on the server (ordinary, guardian-passed turns only), and what
// reaches the Tree is only a line the seeker writes and chooses to carry.
//
// Never offers a streak, a count, a "welcome back", or a reason to return.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import FireAtmosphere from './FireAtmosphere';
import {
  KEPT_MAX_CHARS,
  MAX_CONTEXT_TURNS,
  MAX_SEEKER_CHARS,
  type FiresideTurn,
} from '../../lib/fireside';

const C = {
  obsidian: '#0a0806',
  gold: '#d4a843',
  bone: '#ede0c4',
  ash: '#c4b89a',
  smoke: '#a8916f',
};

interface Exchange {
  key: string;
  seeker: string;
  elder: string;
  /** Server id when this exchange was written down; null when it was not. */
  entryId: number | null;
  kept: string | null;
}

type Phase = 'checking' | 'signed_out' | 'unlit' | 'ready';

export default function Fireside() {
  const { t, languageName } = useLanguage();
  const [phase, setPhase] = useState<Phase>('checking');
  const [sitting, setSitting] = useState<Exchange[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [carrying, setCarrying] = useState<string | null>(null);
  const [carryText, setCarryText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/fireside', { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) return { signedOut: true } as const;
        return (await r.json()) as { lit?: boolean };
      })
      .then((d) => {
        if (cancelled) return;
        if ('signedOut' in d) setPhase('signed_out');
        else setPhase(d.lit ? 'ready' : 'unlit');
      })
      .catch(() => { if (!cancelled) setPhase('unlit'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'end' }); }, [sitting.length, busy]);

  const speak = useCallback(async () => {
    const message = draft.trim();
    if (!message || busy) return;
    setBusy(true);
    setFailed(false);
    // The last few exchanges of THIS sitting, strictly alternating, for continuity only.
    const context: FiresideTurn[] = sitting
      .slice(-MAX_CONTEXT_TURNS)
      .flatMap((x) => [
        { role: 'user' as const, content: x.seeker },
        { role: 'assistant' as const, content: x.elder },
      ]);
    try {
      const r = await fetch('/api/fireside', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context, languageName }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { text?: string; entryId?: number | null };
      if (!d.text) throw new Error('empty');
      setSitting((s) => [...s, { key: `${Date.now()}`, seeker: message, elder: d.text as string, entryId: d.entryId ?? null, kept: null }]);
      setDraft('');
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }, [draft, busy, sitting, languageName]);

  const carry = useCallback(async (x: Exchange) => {
    const line = carryText.trim();
    if (x.entryId === null || !line) return;
    try {
      const r = await fetch('/api/fireside', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: x.entryId, line }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as { line?: string };
      setSitting((s) => s.map((e) => (e.key === x.key ? { ...e, kept: d.line ?? line } : e)));
      setCarrying(null);
      setCarryText('');
    } catch {
      setFailed(true);
    }
  }, [carryText]);

  const release = useCallback(async (x: Exchange) => {
    if (x.entryId !== null) {
      try {
        const r = await fetch(`/api/fireside?id=${x.entryId}`, { method: 'DELETE' });
        // Loud: an exchange that was not released must not disappear from view as if it were.
        if (!r.ok) throw new Error(String(r.status));
      } catch {
        setFailed(true);
        return;
      }
    }
    setSitting((s) => s.filter((e) => e.key !== x.key));
  }, []);

  const smallButton = {
    fontFamily: "'Inter', Arial, sans-serif",
    fontSize: '0.62rem',
    letterSpacing: '0.16em',
    textTransform: 'uppercase' as const,
    color: C.smoke,
    padding: '10px 4px',
    minHeight: 40,
  };

  return (
    <div style={{
      minHeight: 'var(--vh-full)', background: C.obsidian, color: C.bone,
      fontFamily: "'Gentium Plus', Georgia, 'Times New Roman', serif",
      padding: '54px 20px 90px', position: 'relative',
    }}>
      <FireAtmosphere intensity={0.14} soundEnabled={false} />
      <div style={{ maxWidth: 640, margin: '0 auto', position: 'relative', zIndex: 2 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 400,
            fontSize: 'clamp(1.6rem, 4vw, 2.3rem)', color: C.gold, letterSpacing: '0.2em', marginBottom: 12,
          }}>
            {t('fireside.title')}
          </h1>
          {phase === 'ready' && (
            <p style={{ fontStyle: 'italic', color: C.ash, fontSize: '0.92rem', lineHeight: 1.8 }}>
              {t('fireside.intro')}
            </p>
          )}
        </div>

        {phase === 'checking' && <p style={{ textAlign: 'center', color: C.smoke }}>&hellip;</p>}
        {phase === 'signed_out' && (
          <p style={{ textAlign: 'center', color: C.ash, fontStyle: 'italic' }}>{t('fireside.signin')}</p>
        )}
        {phase === 'unlit' && (
          <p style={{ textAlign: 'center', color: C.ash, fontStyle: 'italic' }}>{t('fireside.not_lit')}</p>
        )}

        {phase === 'ready' && (
          <>
            <div aria-live="polite">
              {sitting.map((x) => (
                <div key={x.key} style={{ marginBottom: 30 }}>
                  <p style={{ color: C.smoke, fontSize: '0.95rem', lineHeight: 1.8, marginBottom: 12, whiteSpace: 'pre-wrap' }}>
                    {x.seeker}
                  </p>
                  <p style={{ color: C.bone, fontSize: '1.02rem', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{x.elder}</p>
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                    {x.entryId === null && (
                      <span style={{ ...smallButton, color: C.smoke, opacity: 0.8 }}>{t('fireside.not_kept')}</span>
                    )}
                    {x.entryId !== null && x.kept === null && carrying !== x.key && (
                      <button type="button" style={smallButton} onClick={() => { setCarrying(x.key); setCarryText(''); }}>
                        {t('fireside.carry')}
                      </button>
                    )}
                    {x.kept !== null && (
                      <span style={{ ...smallButton, color: C.gold }}>◇ {t('fireside.carried')}: “{x.kept}”</span>
                    )}
                    <button type="button" style={smallButton} onClick={() => release(x)}>
                      {t('fireside.release')}
                    </button>
                  </div>
                  {carrying === x.key && (
                    <div style={{ marginTop: 10 }}>
                      <label style={{ display: 'block', color: C.ash, fontStyle: 'italic', fontSize: '0.85rem', marginBottom: 6 }}>
                        {t('fireside.carry_prompt')}
                        <input
                          value={carryText}
                          onChange={(e) => setCarryText(e.target.value)}
                          maxLength={KEPT_MAX_CHARS}
                          style={{
                            display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', background: 'transparent',
                            color: C.bone, border: `1px solid ${C.gold}55`, fontFamily: 'inherit', fontSize: '1rem',
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        style={{ ...smallButton, color: C.gold }}
                        disabled={carryText.trim().length < 3}
                        onClick={() => carry(x)}
                      >
                        {t('fireside.carry_save')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {busy && <p style={{ color: C.smoke, fontStyle: 'italic' }}>{t('fireside.waiting')}</p>}
              {failed && <p role="alert" style={{ color: C.smoke, fontStyle: 'italic' }}>{t('fireside.error')}</p>}
              <div ref={endRef} />
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); void speak(); }}
              style={{ marginTop: 20 }}
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t('fireside.placeholder')}
                aria-label={t('fireside.placeholder')}
                maxLength={MAX_SEEKER_CHARS}
                rows={4}
                style={{
                  width: '100%', padding: '14px 16px', background: 'rgba(237,224,196,0.03)',
                  color: C.bone, border: `1px solid ${C.gold}33`, fontFamily: 'inherit', fontSize: '1.02rem', lineHeight: 1.7,
                }}
              />
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <button
                  type="submit"
                  disabled={busy || !draft.trim()}
                  style={{ ...smallButton, color: C.gold, border: `1px solid ${C.gold}44`, padding: '10px 26px' }}
                >
                  {t('fireside.send')}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
