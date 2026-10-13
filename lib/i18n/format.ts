// lib/i18n/format.ts
//
// Locale-aware number and date helpers that are not just word swaps.
import type { Locale } from './languages';

/** "3rd" in English; the conventional written ordinal elsewhere. Only the
 *  number-plus-mark part: the surrounding sentence lives in the catalog. */
export function formatOrdinal(locale: Locale, n: number): string {
  switch (locale) {
    case 'en': {
      const s = ['th', 'st', 'nd', 'rd'];
      const v = n % 100;
      return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
    }
    case 'es': return `${n}.ª`; // "vez" is feminine
    case 'pt': return `${n}.ª`;
    case 'fr': return n === 1 ? '1re' : `${n}e`;
    case 'de': return `${n}.`;
    case 'da': return `${n}.`;
    case 'nl': return `${n}e`;
    case 'ja': return `${n}回目`;
    case 'zh': return `第${n}`;
    case 'ki': return `${n}`; // K'iche' counts with a cardinal here
  }
}

export type RelativeUnit = 'days' | 'months' | 'years';

/** Whole elapsed units since an ISO timestamp; null if unparseable. */
export function elapsedSince(iso: string, now = Date.now()): { kind: 'unknown' } | { kind: 'today' } | { kind: 'yesterday' } | { kind: 'ago'; unit: RelativeUnit; count: number } {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return { kind: 'unknown' };
  const days = Math.floor((now - then) / 86400000);
  if (days <= 0) return { kind: 'today' };
  if (days === 1) return { kind: 'yesterday' };
  if (days < 30) return { kind: 'ago', unit: 'days', count: days };
  const months = Math.floor(days / 30);
  if (months < 12) return { kind: 'ago', unit: 'months', count: months };
  return { kind: 'ago', unit: 'years', count: Math.floor(months / 12) };
}
