// lib/i18n/useLocalizedLineages.ts
//
// The lineage display text (names, greetings, closings) in the seeker's
// language. Only DISPLAY fields are overlaid. `key`, palette, divider, the
// oracleRegister / overlay (which steer the model) and the border fragment in
// its original script are never replaced: what the Elder is told and what the
// ritual sends to the server stay exactly as authored.
'use client';

import { useMemo } from 'react';
import { LINEAGES, type Lineage, type LineageKey } from '../lineages';
import { en } from './messages/en';
import type { MessageKey, TFunction } from './translate';
import { useLanguage } from './LanguageContext';

type Overlaid = 'label' | 'tradition' | 'teacher' | 'sigil' | 'invocation' | 'greeting' | 'closing' | 'fragment_tr';

const FIELD_TO_PROP: Record<Overlaid, keyof Lineage> = {
  label: 'label',
  tradition: 'tradition',
  teacher: 'teacherTitle',
  sigil: 'sigilLabel',
  invocation: 'invocation',
  greeting: 'lineageGreeting',
  closing: 'ceremonialClosing',
  fragment_tr: 'borderFragmentTranslation',
};

export function localizeLineages(
  t: TFunction,
  base: Record<LineageKey, Lineage> = LINEAGES,
): Record<LineageKey, Lineage> {
  const out = {} as Record<LineageKey, Lineage>;
  for (const key of Object.keys(base) as LineageKey[]) {
    const next: Lineage = { ...base[key] };
    for (const [field, prop] of Object.entries(FIELD_TO_PROP) as Array<[Overlaid, keyof Lineage]>) {
      const mk = `lineage.${key}.${field}` as MessageKey;
      // Only keys that exist in English are overlaid (fragment_tr is omitted
      // for lineages with no translation line), so an absent field is never
      // invented in another language.
      if (mk in en) (next as unknown as Record<string, string>)[prop] = t(mk as never);
    }
    out[key] = next;
  }
  return out;
}

export function useLocalizedLineages(): Record<LineageKey, Lineage> {
  const { t, locale } = useLanguage();
  // `t` is rebuilt per catalog; `locale` keys the memo.
  return useMemo(() => (locale === 'en' ? LINEAGES : localizeLineages(t)), [t, locale]);
}
