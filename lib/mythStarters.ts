// lib/mythStarters.ts
//
// Tradition-voiced starter questions for the Myth tab (CouncilTabs.tsx).
//
// WHY THIS IS NOT IN lib/i18n/messages: these are questions a seeker can ask
// about their own life, phrased in a voice's own vocabulary (orí, tikkun, the
// Chol Q'ij ...). That is tradition-specific copy, and per lib/lineages.ts and
// governance/checklist.yaml (F15-AUTH) it should not ship past what the named
// tradition-bearer for each voice has reviewed. It is therefore:
//   * English-only for now. Other locales keep the localized generic topics,
//     because translating governed ceremonial vocabulary into ten languages
//     without bearer review is the exact failure lib/i18n/reviewStatus.ts
//     (ELD-049) exists to prevent.
//   * limited to voices whose governanceStatus is "active" in lib/traditions.ts.
//   * limited to terms already in that voice's canonAnchors, so a starter never
//     teaches a seeker vocabulary the voice's own guardian would not recognise.
//
// REVIEW STATE: written 2026-10-13, NOT yet reviewed by the tradition-bearers.
// Treat the wording as a draft: get each bearer's sign-off, then record it in
// the governance log before this branch is merged.
//
// NORSE EXCEPTION: the norse voice has NO named tradition-bearer; it is one of
// the seven voices tracked as unresolved under F15-AUTH. Its starters were added
// on the project owner's explicit instruction (2026-10-13), under this same
// "pending-bearer-review" flag, knowing that this goes past the restraint
// lib/lineages.ts records for those voices. They are drawn only from the voice's
// canonAnchors. When a Norse bearer is named, they should be reviewed or removed.

import type { LineageKey } from './lineages';

export const MYTH_STARTERS_REVIEW = {
  status: 'pending-bearer-review',
  writtenOn: '2026-10-13',
  reviewedBy: null as string | null,
} as const;

/** Keyed by lineage key (maya -> the kiche voice, yoruba -> babalawo, mekubal -> mekubal, norse -> norse). */
export const MYTH_STARTERS_EN: Partial<Record<LineageKey, readonly string[]>> = {
  maya: [
    'What is my nahual, my day sign, asking of me in this season?',
    "Where am I out of rhythm with the Chol Q'ij, the count of days?",
    'What do my ancestors want me to carry forward, and what to set down?',
  ],
  yoruba: [
    'What does my orí need me to hear right now?',
    'What in this situation is asking for balance, and what for offering?',
    'What path am I being asked to walk with more character?',
  ],
  mekubal: [
    'Where is something broken in this that asks for tikkun, repair?',
    'What in me is overflowing, and what is held back?',
    'Where do the scattered sparks, the nitzotzot, in my situation want gathering?',
  ],
  norse: [
    "What are the Norns weaving at Urðarbrunnr for the path I'm on?",
    "What would the völva, as far-seer, see at the threshold I'm standing at?",
    "Which root of my life needs water, as Yggdrasil's roots need the well?",
  ],
};

/**
 * Starters to show for a lineage in the given locale. Empty unless the locale is
 * English and the lineage has starters defined above, so callers can spread
 * the result in front of the generic topics without any further checks.
 */
export function mythStartersFor(lineage: LineageKey, locale: string): readonly string[] {
  if (locale !== 'en') return [];
  return MYTH_STARTERS_EN[lineage] ?? [];
}
