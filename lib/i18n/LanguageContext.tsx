// lib/i18n/LanguageContext.tsx
'use client';

import React, {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  isLocale,
  localeInfo,
  type Locale,
  type LocaleInfo,
} from './languages';
import {
  createTranslator,
  pluralize,
  splitTemplate,
  type MessageKey,
  type Messages,
  type Placeholders,
  type PluralBase,
  type TFunction,
} from './translate';
import { en } from './messages/en';
import { loadMessages } from './loadMessages';

type Slots<K extends MessageKey> = Record<Placeholders<(typeof en)[K]>, React.ReactNode>;

export type LanguageContextType = {
  /** The language currently on screen. */
  locale: Locale;
  /** Switch language. Persists the choice and swaps every string in the app. */
  setLocale: (locale: Locale) => void;
  /** Translate a key: t('council.asks'), t('x.y', { name }). */
  t: TFunction;
  /** Plural-aware translate for `_one` / `_other` pairs: tp('time.days_ago', 3). */
  tp: (base: PluralBase, count: number, vars?: Record<string, string | number>) => string;
  /** Translate a message whose placeholders are filled by elements, not text:
   *  tr('council.speaks_within', { lineage: <em>{name}</em> }). */
  tr: <K extends MessageKey>(key: K, slots: Slots<K>) => React.ReactNode;
  /** The exact `languageName` the divine route validates and the prompt uses. */
  languageName: string;
  info: LocaleInfo;
  /** BCP 47 tag for Intl formatters (K'iche' borrows es-GT). */
  intlLocale: string;
  /** False while the chosen language's catalog is still being fetched. */
  ready: boolean;
};

function build(locale: Locale, messages: Messages, setLocale: (l: Locale) => void, ready: boolean): LanguageContextType {
  const info = localeInfo(locale);
  return {
    locale,
    setLocale,
    t: createTranslator(messages),
    tp: (base, count, vars) => pluralize(messages, info.intlLocale, base, count, vars),
    tr: (key, slots) => {
      const parts = splitTemplate(messages[key]);
      return (
        <>
          {parts.map((p, i) =>
            typeof p === 'string' ? (
              <Fragment key={i}>{p}</Fragment>
            ) : (
              <Fragment key={i}>{(slots as Record<string, React.ReactNode>)[p.slot]}</Fragment>
            ),
          )}
        </>
      );
    },
    languageName: info.serverName,
    info,
    intlLocale: info.intlLocale,
    ready,
  };
}

// Outside a <LanguageProvider> (hermetic server-render tests, Storybook-style
// isolation) a component speaks English and cannot change language. This keeps
// every component renderable on its own, and keeps the tests that assert exact
// English output meaningful.
const FALLBACK: LanguageContextType = build(DEFAULT_LOCALE, en as Messages, () => {}, true);

const LanguageContext = createContext<LanguageContextType>(FALLBACK);

/** Remove the "hold the first paint" flag set by the inline <head> script. */
function releaseFirstPaint() {
  try {
    document.documentElement.removeAttribute('data-i18n-pending');
  } catch {
    /* no document (tests) */
  }
}

function applyDocumentLanguage(locale: Locale) {
  try {
    document.documentElement.lang = localeInfo(locale).htmlLang;
    document.documentElement.dataset.locale = locale;
  } catch {
    /* no document (tests) */
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [messages, setMessages] = useState<Messages>(en as Messages);
  const [ready, setReady] = useState(true);
  // A newer selection supersedes an older one still downloading.
  const requestId = useRef(0);

  const apply = useCallback((next: Locale) => {
    const id = ++requestId.current;
    setReady(next === DEFAULT_LOCALE);
    loadMessages(next)
      .then((m) => {
        if (id !== requestId.current) return;
        setMessages(m);
        setLocaleState(next);
        setReady(true);
        applyDocumentLanguage(next);
        releaseFirstPaint();
      })
      .catch(() => {
        // The chunk could not be fetched (offline, deploy in flight). Stay in
        // the current language rather than half-switching; never leave the
        // screen held.
        if (id !== requestId.current) return;
        setReady(true);
        releaseFirstPaint();
      });
  }, []);

  // Resolve the stored choice once on mount.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      /* storage unavailable (private mode): default language */
    }
    if (isLocale(stored) && stored !== DEFAULT_LOCALE) apply(stored);
    else {
      applyDocumentLanguage(DEFAULT_LOCALE);
      releaseFirstPaint();
    }
  }, [apply]);

  // Another tab changed the language: follow it.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== LOCALE_STORAGE_KEY || !isLocale(e.newValue)) return;
      apply(e.newValue);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [apply]);

  const setLocale = useCallback(
    (next: Locale) => {
      if (!isLocale(next)) return;
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, next);
      } catch {
        /* the choice still applies for this visit */
      }
      apply(next);
    },
    [apply],
  );

  const value = useMemo(() => build(locale, messages, setLocale, ready), [locale, messages, setLocale, ready]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextType {
  return useContext(LanguageContext);
}

// Convenience alias
export const useTranslation = useLanguage;
