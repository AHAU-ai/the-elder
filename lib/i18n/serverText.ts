// lib/i18n/serverText.ts
//
// Server-side counterpart of the language layer: lets an API route say its
// fixed seeker-facing sentences (a silence, a limit, a crisis message) in the
// language the request named. The model's own output is steered by the
// LANGUAGE DIRECTIVE in the system prompt; this is for the strings the server
// writes itself.
//
// SAFETY COPY RULE. A crisis or safety message is the one place a machine
// draft must never *replace* reviewed words. Until a named native speaker has
// reviewed a language (reviewStatus.ts), its safety copy is sent as the
// translation followed by the English original, so a translation error can
// add confusion but can never remove the reviewed message. Flipping a locale to
// 'native-reviewed' drops the English tail for that language only.

import { localeFromLanguageName, type Locale } from './languages';
import { loadMessages } from './loadMessages';
import { LOCALE_REVIEW } from './reviewStatus';
import { createTranslator, type MessageKey, type TFunction } from './translate';
import { en } from './messages/en';
import type { FailureClass } from '../../src/resilience/failTowardSilence';

export interface ServerText {
  locale: Locale;
  t: TFunction;
  /** A fixed sentence in the request's language (no English tail). */
  say: (key: MessageKey, vars?: Record<string, string | number>) => string;
  /** Safety copy: translation, plus the English original until the language is native-reviewed. */
  safety: (key: MessageKey, english: string) => string;
  /** The in-register silence for a failure class. */
  silence: (failureClass: FailureClass) => string;
}

const SAFETY_SEPARATOR = '\n\n— — —\n\n';

export async function serverText(languageName: unknown): Promise<ServerText> {
  const locale = localeFromLanguageName(languageName);
  let messages;
  try {
    messages = await loadMessages(locale);
  } catch {
    // A catalog that cannot load must never block a safety message: fall back to English.
    return serverText('English');
  }
  const t = createTranslator(messages);
  const say = (key: MessageKey, vars?: Record<string, string | number>) =>
    (t as (k: MessageKey, v?: Record<string, string | number>) => string)(key, vars);
  const safety = (key: MessageKey, english: string) => {
    const local = say(key);
    if (locale === 'en' || local === english) return english;
    return LOCALE_REVIEW[locale].status === 'native-reviewed' ? local : local + SAFETY_SEPARATOR + english;
  };
  const silence = (fc: FailureClass) => {
    const key = `server.silence_${fc}` as MessageKey;
    return fc === 'safety_intercept' ? safety(key, englishOf(key)) : say(key);
  };
  return { locale, t, say, safety, silence };
}

function englishOf(key: MessageKey): string {
  return (en as Record<string, string>)[key];
}
