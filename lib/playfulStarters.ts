// lib/playfulStarters.ts
//
// Light, odd, low-stakes openers for the free-text box on the lineage-select
// page. They exist to lower the cost of the first question: a seeker who is
// unsure what to "bring to the fire" can tap one and be playful.
//
// DELIBERATELY LINEAGE-NEUTRAL: no tradition vocabulary of any kind. They carry
// no content from any voice, so they need no tradition-bearer review and cannot
// leak one lineage's terms into another (the "melting pot" anti-pattern). The
// inquiry still routes through routeInquiry() and LineageConfirm like any other
// typed text; a tap only fills the box, it never submits.
//
// English-only, like lib/mythStarters.ts: other locales render nothing rather
// than ship untranslated copy.

export const PLAYFUL_STARTERS_EN: readonly string[] = [
  'What myth is my Monday?',
  'Which old story would hide my keys?',
  'If my week were a legend, what would its trial be?',
  'Who is the trickster in my life right now, and what are they teaching me?',
  'What would my tired self say to the hero I am pretending to be?',
  'Which door in my life am I pacing in front of?',
  'What is the dragon I keep feeding by avoiding it?',
  'What small thing am I carrying that is not mine?',
  'If my morning coffee were a sacred offering, who is it for?',
  'Which character in my story is quietly doing all the work?',
];

export function playfulStartersFor(locale: string): readonly string[] {
  return locale === 'en' ? PLAYFUL_STARTERS_EN : [];
}

/**
 * Pick up to `n` distinct starters, preferring ones not in `exclude` so an
 * "another" tap shows fresh lines. Falls back to the excluded ones only when
 * the pool is too small. `rng` is injectable for tests.
 */
export function pickPlayfulStarters(
  pool: readonly string[],
  n: number,
  exclude: readonly string[] = [],
  rng: () => number = Math.random,
): string[] {
  const fresh = pool.filter(s => !exclude.includes(s));
  const rest = pool.filter(s => exclude.includes(s));
  const shuffle = (a: string[]) => {
    const out = [...a];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  return [...shuffle(fresh), ...shuffle(rest)].slice(0, Math.max(0, n));
}
