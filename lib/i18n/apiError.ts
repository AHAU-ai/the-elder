// lib/i18n/apiError.ts
//
// What to show a seeker when an API call fails. The server sends English
// `error` text; the few sentences a seeker can actually reach (the daily
// limit, a missing provenance configuration) are said in their language here,
// and anything unrecognised is shown as the server sent it.

import { localizeServerMessage } from './serverMessages';
import type { PluralBase, TFunction } from './translate';

type TP = (base: PluralBase, count: number, vars?: Record<string, string | number>) => string;

export function apiErrorMessage(data: unknown, t: TFunction, tp: TP, fallback: string): string {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  if (d.rateLimited === true && typeof d.hours === 'number' && typeof d.limit === 'number') {
    return tp('server.rate_limited', d.hours, { limit: d.limit });
  }
  if (typeof d.error === 'string' && d.error) return localizeServerMessage(t, d.error);
  return fallback;
}
