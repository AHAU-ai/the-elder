'use client';

// app/components/T.tsx
//
// Server-rendered pages (about, letters/stopped) cannot call the language hook.
// <T k="…" /> is the small client island that says one catalog message in the
// seeker's language, so those pages stay server components.

import { useLanguage } from '../../lib/i18n/LanguageContext';
import type { MessageKey, Vars } from '../../lib/i18n/translate';

type Props<K extends MessageKey> = { k: K } & ([keyof Vars<K>] extends [never] ? { vars?: undefined } : { vars: Vars<K> });

export default function T<K extends MessageKey>(props: Props<K>) {
  const { t } = useLanguage();
  const { k, vars } = props as { k: MessageKey; vars?: Record<string, string | number> };
  return <>{(t as (key: MessageKey, v?: Record<string, string | number>) => string)(k, vars)}</>;
}
