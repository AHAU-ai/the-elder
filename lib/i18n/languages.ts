// lib/i18n/languages.ts
//
// The one place that knows which languages The Elder speaks. Pure data and
// pure functions: imported by the client (LanguageContext, LanguageToggle),
// by server routes (which receive a `languageName` and must validate it), and
// by the inline <head> script in app/layout.tsx.
//
// WHY `serverName` IS SPELLED THE WAY IT IS
// app/api/divine/route.ts and lib/returning/trajectoryContext.ts have always
// keyed on "K’iche’ Maya" (typographic apostrophes). The client used
// to send "K'iche' Maya" (straight apostrophes), which failed the server's
// allow-list and silently fell back to English -- so K'iche' never reached the
// model. Both sides now read this table, and the server also normalizes
// apostrophes (see languageNameFromInput) so a straight-apostrophe request
// from an older cached client still resolves.

export type Locale =
  | 'en'
  | 'es'
  | 'ki' // K'iche' Maya
  | 'fr'
  | 'pt'
  | 'de'
  | 'da'
  | 'nl'
  | 'ja'
  | 'zh';

export interface LocaleInfo {
  code: Locale;
  /** English name, for assistive text and logs. */
  label: string;
  /** The language's own name for itself -- what the toggle shows. */
  nativeLabel: string;
  /** BCP 47 tag for <html lang> and Intl. K'iche' is ISO 639-3 "quc". */
  htmlLang: string;
  /** Tag handed to Intl.* formatters. K'iche' has no CLDR data, so it borrows
   *  Guatemalan Spanish, the nearest registered locale (same choice as
   *  lib/returning/trajectoryContext.ts). */
  intlLocale: string;
  /** The exact `languageName` the divine route accepts and the prompt builder
   *  interpolates ("Respond in ${languageName}"). */
  serverName: string;
}

export const LOCALES: readonly LocaleInfo[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', htmlLang: 'en', intlLocale: 'en-US', serverName: 'English' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español', htmlLang: 'es', intlLocale: 'es', serverName: 'Spanish' },
  { code: 'ki', label: "K'iche'", nativeLabel: "K'iche'", htmlLang: 'quc', intlLocale: 'es-GT', serverName: 'K’iche’ Maya' },
  { code: 'fr', label: 'French', nativeLabel: 'Français', htmlLang: 'fr', intlLocale: 'fr', serverName: 'French' },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Português', htmlLang: 'pt', intlLocale: 'pt', serverName: 'Portuguese' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch', htmlLang: 'de', intlLocale: 'de', serverName: 'German' },
  { code: 'da', label: 'Danish', nativeLabel: 'Dansk', htmlLang: 'da', intlLocale: 'da', serverName: 'Danish' },
  { code: 'nl', label: 'Dutch', nativeLabel: 'Nederlands', htmlLang: 'nl', intlLocale: 'nl', serverName: 'Dutch' },
  { code: 'ja', label: 'Japanese', nativeLabel: '日本語', htmlLang: 'ja', intlLocale: 'ja', serverName: 'Japanese' },
  { code: 'zh', label: 'Chinese', nativeLabel: '中文', htmlLang: 'zh-Hans', intlLocale: 'zh-Hans', serverName: 'Simplified Chinese' },
] as const;

export const DEFAULT_LOCALE: Locale = 'en';

/** localStorage key (unchanged from the first version, so existing choices survive). */
export const LOCALE_STORAGE_KEY = 'the-elder-locale';

const BY_CODE: Record<string, LocaleInfo> = Object.fromEntries(LOCALES.map((l) => [l.code, l]));

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(BY_CODE, value);
}

export function localeInfo(locale: Locale): LocaleInfo {
  return BY_CODE[locale];
}

/** Fold straight and typographic apostrophes/quotes so "K'iche'" === "K’iche’". */
function foldApostrophes(s: string): string {
  return s.replace(/[‘’ʼ`´]/g, "'");
}

/**
 * Validate a `languageName` received over the wire and return the canonical
 * server spelling, or 'English' when it is missing or unknown. Never throws,
 * never returns user-controlled text (the result is always one of the ten
 * known names), so it is safe to interpolate into a prompt.
 */
export function languageNameFromInput(input: unknown): string {
  if (typeof input !== 'string') return 'English';
  const folded = foldApostrophes(input.trim());
  const hit = LOCALES.find((l) => foldApostrophes(l.serverName) === folded);
  return hit ? hit.serverName : 'English';
}

/** The locale behind a (validated or raw) server language name; 'en' if unknown. */
export function localeFromLanguageName(input: unknown): Locale {
  const name = languageNameFromInput(input);
  return LOCALES.find((l) => l.serverName === name)?.code ?? DEFAULT_LOCALE;
}
