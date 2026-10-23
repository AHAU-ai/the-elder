// app/components/LanguageToggle.tsx
//
// The language control. Mounted ONCE, in the root layout, so it is on every
// screen -- the portal door, the breath, the lineage choice, the council, every
// room. A seeker whose language is not English has to be able to change it from
// the very first thing they see.
//
// It used to live inside Threshold's lineage-select beat only, at 70% opacity
// in a corner. It is now deliberately prominent: a 44px pill with a gold border
// and a glow, showing the ACTIVE language in its own script plus a short code
// badge, and a menu that marks the active language with a check.
//
// Keyboard: Enter/Space/ArrowDown opens; arrows, Home/End and typing a letter
// move; Escape closes and returns focus to the button; Tab closes. Each option
// carries its own `lang` so a screen reader pronounces the native names.
'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FIRE_MEDITATION_ROUTE } from '@/lib/fireMeditation';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LOCALES, type Locale } from '@/lib/i18n/languages';
import { draftNoteFor } from '@/lib/i18n/reviewStatus';

const NOTE_DISMISSED_KEY = 'the-elder-draft-note-dismissed';

function LanguageToggleControl() {
  const { locale, setLocale, t, info } = useLanguage();
  const [open, setOpen] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [noteHidden, setNoteHidden] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const typed = useRef({ text: '', at: 0 });
  const previousLocale = useRef<Locale>(locale);
  const menuId = useId();

  const note = draftNoteFor(locale);

  // Close on a press anywhere outside.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // On open, move focus to the active language.
  useEffect(() => {
    if (!open) return;
    const index = Math.max(0, LOCALES.findIndex((l) => l.code === locale));
    const id = requestAnimationFrame(() => itemRefs.current[index]?.focus());
    return () => cancelAnimationFrame(id);
    // Only when the menu opens; not on every locale change while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Tell assistive tech when the language actually changed (not on first load).
  useEffect(() => {
    if (previousLocale.current === locale) return;
    previousLocale.current = locale;
    setAnnounce(t('lang.announce', { name: info.nativeLabel }));
  }, [locale, t, info.nativeLabel]);

  // The draft note can be dismissed for the rest of the visit.
  useEffect(() => {
    try {
      setNoteHidden(sessionStorage.getItem(NOTE_DISMISSED_KEY) === locale);
    } catch {
      setNoteHidden(false);
    }
  }, [locale]);

  const dismissNote = useCallback(() => {
    setNoteHidden(true);
    try {
      sessionStorage.setItem(NOTE_DISMISSED_KEY, locale);
    } catch {
      /* the note simply returns next visit */
    }
  }, [locale]);

  const focusItem = useCallback((index: number) => {
    const n = LOCALES.length;
    itemRefs.current[((index % n) + n) % n]?.focus();
  }, []);

  const choose = useCallback(
    (code: Locale) => {
      setLocale(code);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [setLocale],
  );

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusItem(current + 1);
        return;
      case 'ArrowUp':
        e.preventDefault();
        focusItem(current - 1);
        return;
      case 'Home':
        e.preventDefault();
        focusItem(0);
        return;
      case 'End':
        e.preventDefault();
        focusItem(LOCALES.length - 1);
        return;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      case 'Tab':
        setOpen(false);
        return;
    }
    // Type-ahead on the native or English name.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      typed.current.text = now - typed.current.at > 700 ? e.key : typed.current.text + e.key;
      typed.current.at = now;
      const q = typed.current.text.toLowerCase();
      const from = Math.max(current, 0);
      const order = [...LOCALES.keys()].map((i) => (from + 1 + i) % LOCALES.length);
      const hit = order.find((i) => {
        const l = LOCALES[i];
        return l.nativeLabel.toLowerCase().startsWith(q) || l.label.toLowerCase().startsWith(q);
      });
      if (hit !== undefined) focusItem(hit);
    }
  }

  return (
    <div className="elder-lang" ref={rootRef} data-open={open ? 'true' : 'false'}>
      <style>{CSS}</style>

      <button
        ref={triggerRef}
        type="button"
        className="elder-lang__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${t('lang.select')}: ${info.nativeLabel}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
      >
        <GlobeIcon />
        <span className="elder-lang__badge" aria-hidden="true">
          {locale.toUpperCase()}
        </span>
        <span className="elder-lang__name" lang={info.htmlLang}>
          {info.nativeLabel}
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={t('lang.menu')}
          className="elder-lang__menu"
          onKeyDown={onMenuKeyDown}
        >
          {LOCALES.map((l, i) => {
            const active = l.code === locale;
            return (
              <button
                key={l.code}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                lang={l.htmlLang}
                tabIndex={active ? 0 : -1}
                className="elder-lang__item"
                onClick={() => choose(l.code)}
              >
                <span className="elder-lang__native">{l.nativeLabel}</span>
                <span className="elder-lang__meta">
                  {l.nativeLabel !== l.label && (
                    <span className="elder-lang__english" lang="en">
                      {l.label}
                    </span>
                  )}
                  {active && <CheckIcon />}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {note && !noteHidden && !open && (
        <div className="elder-lang__note" role="note">
          <button
            type="button"
            className="elder-lang__note-close"
            onClick={dismissNote}
            aria-label={t('common.dismiss')}
          >
            ×
          </button>
          <div lang={info.htmlLang}>{note.native}</div>
          <div className="elder-lang__note-en" lang="en">
            {note.english}
          </div>
        </div>
      )}

      {/* Announces the change to screen readers; invisible. */}
      <span className="elder-lang__sr" role="status" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{
        flexShrink: 0,
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s',
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// Above every ceremony layer (BreathGate 100, LineageSelector 200,
// ShareableCard 1000) so the control is never covered, below ThresholdPause
// (9000, a transient full-screen wait) and the sound button (9998).
const CSS = `
.elder-lang{
  position:fixed;
  top:max(12px,env(safe-area-inset-top));
  right:max(12px,env(safe-area-inset-right));
  z-index:1200;
  font-family:'Inter',Arial,sans-serif;
  color:#f3e8cf;
}
.elder-lang__trigger{
  display:inline-flex;align-items:center;gap:8px;
  min-height:44px;padding:0 14px 0 12px;
  border-radius:999px;
  border:1.5px solid rgba(232,201,122,.72);
  background:rgba(10,8,6,.88);
  color:#f3e8cf;
  font:inherit;font-size:.92rem;font-weight:500;letter-spacing:.02em;
  cursor:pointer;
  box-shadow:0 0 0 1px rgba(0,0,0,.45),0 4px 18px rgba(0,0,0,.55),0 0 20px rgba(212,168,67,.24);
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
  transition:border-color .2s,box-shadow .2s,background .2s;
}
.elder-lang__trigger:hover{
  border-color:#e8c97a;
  box-shadow:0 0 0 1px rgba(0,0,0,.45),0 4px 18px rgba(0,0,0,.55),0 0 28px rgba(212,168,67,.4);
}
.elder-lang__trigger:focus-visible{outline:2px solid #fff;outline-offset:3px}
.elder-lang__trigger[aria-expanded="true"]{background:rgba(28,20,10,.96);border-color:#e8c97a}
.elder-lang__badge{
  display:inline-block;min-width:26px;padding:2px 6px;border-radius:6px;
  background:rgba(212,168,67,.22);color:#ffe9a8;
  font-size:.68rem;font-weight:700;letter-spacing:.08em;text-align:center;
}
.elder-lang__menu{
  position:absolute;right:0;top:calc(100% + 8px);
  width:min(92vw,300px);max-height:min(70vh,480px);overflow-y:auto;
  padding:6px;border-radius:16px;
  border:1px solid rgba(232,201,122,.5);
  background:rgba(14,10,6,.97);
  box-shadow:0 16px 48px rgba(0,0,0,.72);
  -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);
}
.elder-lang__item{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  width:100%;min-height:46px;padding:8px 12px;
  border:0;border-radius:10px;background:transparent;
  color:#d9ccb0;text-align:left;font:inherit;font-size:1rem;cursor:pointer;
}
.elder-lang__item:hover{background:rgba(212,168,67,.12);color:#fff4d8}
.elder-lang__item:focus-visible{outline:none;background:rgba(212,168,67,.14);color:#fff4d8;box-shadow:inset 0 0 0 2px #e8c97a}
.elder-lang__item[aria-checked="true"]{background:rgba(212,168,67,.2);color:#ffe9a8;box-shadow:inset 3px 0 0 #e8c97a}
.elder-lang__item[aria-checked="true"]:focus-visible{box-shadow:inset 3px 0 0 #e8c97a,inset 0 0 0 2px #e8c97a}
.elder-lang__meta{display:inline-flex;align-items:center;gap:10px;flex-shrink:0}
.elder-lang__english{font-size:.74rem;letter-spacing:.04em;opacity:.65}
.elder-lang__note{
  position:relative;margin:8px 0 0 auto;max-width:260px;padding:9px 28px 9px 11px;
  border-radius:10px;border:1px solid rgba(200,96,26,.6);background:rgba(10,8,6,.92);
  color:#ead9b3;font-size:.72rem;line-height:1.45;
}
.elder-lang__note-en{margin-top:4px;opacity:.8}
.elder-lang__note-close{
  position:absolute;top:2px;right:4px;width:24px;height:24px;border:0;background:transparent;
  color:#ead9b3;font-size:1.1rem;line-height:1;cursor:pointer;border-radius:6px;
}
.elder-lang__note-close:hover,.elder-lang__note-close:focus-visible{background:rgba(212,168,67,.18);outline:none}
.elder-lang__sr{
  position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;
  clip:rect(0,0,0,0);white-space:nowrap;border:0;
}
@media (max-width:420px){
  .elder-lang__name{display:none}
  .elder-lang__trigger{padding:0 12px 0 11px}
}
@media (prefers-reduced-motion:reduce){
  .elder-lang__trigger,.elder-lang__trigger svg{transition:none!important}
}
@media print{.elder-lang{display:none}}
`;

// The Fire Meditation is wordless by design, so the control (all words) steps
// aside there. Everywhere else it is on every screen, as above.
export default function LanguageToggle() {
  const pathname = usePathname();
  if (pathname === FIRE_MEDITATION_ROUTE) return null;
  return <LanguageToggleControl />;
}
