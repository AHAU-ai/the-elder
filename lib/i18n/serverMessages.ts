// lib/i18n/serverMessages.ts
//
// A few server responses carry a fixed English sentence the interface shows
// to the seeker as-is (a cap reached, a rate limit). The server stays
// byte-identical; the client recognises the exact sentence and shows the same
// meaning in the seeker's language. Anything it does not recognise is shown
// untouched, never guessed at, so an unknown or changed server message
// degrades to English rather than to a wrong translation.
//
// Every pattern is checked against the real server source by
// lib/i18n/i18n.test.ts, so a reworded server sentence fails a test instead of
// silently falling back to English.

import type { MessageKey, TFunction } from './translate';

export interface ServerMessagePattern {
  /** Exact English the server sends; capture groups feed `vars`. */
  re: RegExp;
  key: MessageKey;
  vars?: (m: RegExpMatchArray) => Record<string, string | number>;
  /** Source file that must still contain this sentence (guards drift). */
  source: string;
  /** A literal fragment of that sentence, as it appears in `source`. */
  fragment: string;
}

export const SERVER_MESSAGES: ServerMessagePattern[] = [
  {
    re: /^The fire keeps (\d+) pairings at a time\. Release one to keep another\.$/,
    key: 'mappings.cap',
    vars: (m) => ({ max: Number(m[1]) }),
    source: 'app/api/figure-mappings/[id]/confirm/route.ts',
    fragment: 'pairings at a time. Release one to keep another.',
  },
  {
    re: /^The fire keeps only so many pairings at a time\. Release one to keep another\.$/,
    key: 'mappings.cap_generic',
    source: 'lib/figureClient.ts',
    fragment: 'The fire keeps only so many pairings at a time. Release one to keep another.',
  },
];

/** Show a known server sentence in the seeker's language; otherwise as sent. */
export function localizeServerMessage(t: TFunction, text: string): string {
  for (const p of SERVER_MESSAGES) {
    const m = text.match(p.re);
    if (m) return (t as (k: MessageKey, v?: Record<string, string | number>) => string)(p.key, p.vars?.(m));
  }
  return text;
}
