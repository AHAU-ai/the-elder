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
// UNBEARERED VOICES: greek, sufi, norse, taoist, vedic, egyptian and stoic have
// NO named tradition-bearer; they are the seven voices tracked as unresolved under
// F15-AUTH. Their starters were added on the project owner's explicit instruction
// (2026-10-13), under this same "pending-bearer-review" flag, knowing that this
// goes past the restraint lib/lineages.ts records for those voices. They are drawn
// only from each voice's canonAnchors and are checked against its `forbidden`
// list (see lib/mythStarters.test.ts). When a bearer is named for one of these
// voices, its starters should be reviewed by them or removed.
//
// NOT COVERED: dreamtime (protocol-sensitive: restricted knowledge, needs its own
// decision), buddhist (no entry in lib/traditions.ts) and default.

import type { LineageKey } from './lineages';

export const MYTH_STARTERS_REVIEW = {
  status: 'pending-bearer-review',
  writtenOn: '2026-10-13',
  reviewedBy: null as string | null,
} as const;

/** Keyed by lineage key. Each lineage key names the voice of the same name in
 *  lib/traditions.ts, except maya, which is the kiche voice. */
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
  greek: [
    'What would the Pythia hear in the question I have not yet asked?',
    'What is the omphalos of my situation, the center everything turns around?',
    'Which of the Muses is missing from the work I am doing now?',
  ],
  sufi: [
    'Which maqam, which station of the path, am I standing in now?',
    'What am I being asked to entrust, as in tawakkul, and what to turn back from, as in tawbah?',
    'What do I most need to remember in this season, what would dhikr, remembrance, keep before me?',
  ],
  taoist: [
    'Where am I forcing something that wu wei, non-striving, would let move by itself?',
    'Where is my life leaning too far toward yin, or too far toward yang?',
    'What would ziran, naturalness, look like in this decision if I stopped adding to it?',
  ],
  vedic: [
    'What does dharma, the order I belong to, ask of me in this situation?',
    'What in this is the fruit of past action, karma, and what is mine to do now?',
    'What truth in my life is asking to be spoken aloud, as a mantra is?',
  ],
  egyptian: [
    "Where does my life keep Ma'at, balance and truth, and where does it tip away?",
    'What in my life is passing through the Duat, the dark crossing, right now?',
    'Where is my ka, my life-force, being fed, and where is it being drained?',
  ],
  stoic: [
    'Which part of this is up to me, and which is not?',
    'Which of the four virtues, wisdom, courage, justice or temperance, is this moment asking of me?',
    'Who is within my circle of care in this situation, and where does the circle need to widen?',
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
