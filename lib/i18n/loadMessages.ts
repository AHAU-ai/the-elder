// lib/i18n/loadMessages.ts
//
// Catalogs are code-split: English ships with the app (it is also the type
// source), every other language is fetched the first time it is selected, so a
// seeker who never opens K'iche' never downloads it.

import type { Locale } from './languages';
import type { Messages } from './translate';
import { en } from './messages/en';

const LOADERS: Record<Locale, () => Promise<Messages>> = {
  en: async () => en as Messages,
  es: async () => (await import('./messages/es')).es,
  ki: async () => (await import('./messages/ki')).ki,
  fr: async () => (await import('./messages/fr')).fr,
  pt: async () => (await import('./messages/pt')).pt,
  de: async () => (await import('./messages/de')).de,
  da: async () => (await import('./messages/da')).da,
  nl: async () => (await import('./messages/nl')).nl,
  ja: async () => (await import('./messages/ja')).ja,
  ko: async () => (await import('./messages/ko')).ko,
  zh: async () => (await import('./messages/zh')).zh,
};

export function loadMessages(locale: Locale): Promise<Messages> {
  return LOADERS[locale]();
}
