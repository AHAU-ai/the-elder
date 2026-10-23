'use client';

// ThreadList.tsx
//
// The seeker's own threads (the roots of the Tree) with the two things they
// can always do to them, weeks or months later (docs/thread-revision.md):
//   "That wasn't that"   set the thread down; it is never spoken or drawn again
//   "Say it differently" restate it in their own words
//
// No inference lives here: nothing is suggested, scored or pre-filled. A reword
// starts empty on purpose, so the words are the seeker's and not an edit of
// something the Elder said. Failures are loud: a revision that did not happen
// is never shown as done.

import { useState } from 'react';
import { useLanguage } from '../../lib/i18n/LanguageContext';

const C = { gold: '#d4a843', paleGold: '#e8c97a', bone: '#ede0c4', ash: '#c4b89a', smoke: '#a8916f', dim: '#5c5140' };

export interface ThreadItem {
  id: number;
  value: string;
  markerType: string;
}

type Mode = { kind: 'confirm' | 'reword'; id: number } | null;

export default function ThreadList({
  threads,
  onReleased,
  onReworded,
}: {
  threads: ThreadItem[];
  onReleased: (id: number) => void;
  onReworded: (id: number, value: string) => void;
}) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<'error' | 'conflict' | null>(null);
  const [busy, setBusy] = useState(false);

  if (threads.length === 0) return null;

  async function send(id: number, action: 'release' | 'reword') {
    setBusy(true);
    setProblem(null);
    try {
      const r = await fetch('/api/user/thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'release' ? { trajectoryId: id, action } : { trajectoryId: id, action, value: text }),
      });
      const d = (await r.json().catch(() => ({}))) as { released?: boolean; reworded?: boolean; value?: string; error?: string };
      if (r.status === 409 || d.error === 'conflict') { setProblem('conflict'); return; }
      if (!r.ok || d.error) { setProblem('error'); return; }
      if (action === 'release' && d.released) onReleased(id);
      else if (action === 'reword' && d.reworded) onReworded(id, d.value ?? text);
      else { setProblem('error'); return; }
      setMode(null);
      setText('');
    } catch {
      setProblem('error');
    } finally {
      setBusy(false);
    }
  }

  const btn = {
    fontFamily: "'Inter', Arial, sans-serif", fontSize: '0.62rem', letterSpacing: '0.14em',
    textTransform: 'uppercase' as const, color: C.smoke, padding: '10px 4px', minHeight: 40,
  };

  return (
    <section aria-label={t('tree.threads_title')} style={{ marginTop: 28, width: '100%', maxWidth: 560 }}>
      <div style={{ fontSize: 12, color: C.paleGold, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
        {t('tree.threads_title')}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {threads.map((th) => {
          const open = mode?.id === th.id ? mode.kind : null;
          return (
            <li key={th.id} style={{ borderLeft: `1px solid ${C.gold}55`, padding: '8px 12px', textAlign: 'left' }}>
              <div style={{ color: C.bone, fontSize: 15, lineHeight: 1.6 }}>{th.value}</div>
              {open === null && (
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                  <button type="button" style={btn} onClick={() => { setMode({ kind: 'confirm', id: th.id }); setProblem(null); }}>
                    {t('tree.thread_not_that')}
                  </button>
                  <button type="button" style={btn} onClick={() => { setMode({ kind: 'reword', id: th.id }); setText(''); setProblem(null); }}>
                    {t('tree.thread_reword')}
                  </button>
                </div>
              )}
              {open === 'confirm' && (
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ color: C.ash, fontStyle: 'italic', fontSize: 13 }}>{t('tree.thread_released_note')}</span>
                  <button type="button" style={{ ...btn, color: C.gold }} disabled={busy} onClick={() => send(th.id, 'release')}>
                    {t('tree.thread_confirm')}
                  </button>
                  <button type="button" style={btn} onClick={() => setMode(null)}>{t('tree.thread_cancel')}</button>
                </div>
              )}
              {open === 'reword' && (
                <div style={{ marginTop: 6 }}>
                  <label style={{ display: 'block', color: C.ash, fontStyle: 'italic', fontSize: 13 }}>
                    {t('tree.thread_reword_prompt')}
                    <input
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      maxLength={120}
                      style={{ display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', background: 'transparent', color: C.bone, border: `1px solid ${C.gold}55`, fontFamily: 'inherit', fontSize: 15 }}
                    />
                  </label>
                  <div style={{ display: 'flex', gap: 18 }}>
                    <button type="button" style={{ ...btn, color: C.gold }} disabled={busy || text.trim().length < 3} onClick={() => send(th.id, 'reword')}>
                      {t('tree.thread_save')}
                    </button>
                    <button type="button" style={btn} onClick={() => setMode(null)}>{t('tree.thread_cancel')}</button>
                  </div>
                </div>
              )}
              {mode?.id === th.id && problem && (
                <div role="alert" style={{ color: C.smoke, fontStyle: 'italic', fontSize: 13 }}>
                  {problem === 'conflict' ? t('tree.thread_conflict') : t('tree.thread_error')}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
