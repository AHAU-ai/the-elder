// lib/i18n/LanguageContext.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  Locale,
  TranslationKeys,
  translations,
  LOCALE_TO_LANGUAGE_NAME,
} from "./translations";

const STORAGE_KEY = "the-elder-locale";
const DEFAULT_LOCALE: Locale = "en";

type LanguageContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationKeys;
  languageName: string; // full name for AI prompt injection
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && translations[stored]) {
        setLocaleState(stored);
      }
    } catch {
      // localStorage unavailable (SSR or private mode) — use default
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {
      // silent fail
    }
  }, []);

  const value: LanguageContextType = {
    locale,
    setLocale,
    t: translations[locale],
    languageName: LOCALE_TO_LANGUAGE_NAME[locale],
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used inside <LanguageProvider>");
  }
  return ctx;
}

// Convenience alias
export const useTranslation = useLanguage;
