// lib/mythRoutingIndex.ts
//
// A1 (design action items, 2026-08-19): myth routing index.
//
// A metadata-only table used to route a seeker's free-text inquiry to a
// lineage. Every field here is a POINTER — a figure's name, a handful of
// motif tags, a one-word register — never a passage, teaching, or any
// content that could itself function as a reading. This file's job ends
// the instant it has named a lineage; it must never be mistaken for (or
// grown into) a corpus, and nothing in the divination/generation path may
// import it. If that boundary ever needs checking mechanically, mirror
// check-purpose-register.mjs's "boundary" check against this file the way
// it does against lib/purposeStatement.ts.
//
// This supersedes matchLineageByText()'s ad-hoc scoring in lib/lineages.ts
// (which scored against UI copy -- invocation text, sigil labels -- never
// designed as a routing index) with a table actually authored for this
// purpose. It is still keyword/substring matching, NOT semantic search or
// embedding retrieval: see lib/corpusRetrieval.ts's own header for where
// real semantic routing already exists (mekubal only, today) and would
// eventually replace this. Swapping the matching strategy later means
// replacing routeInquiry()'s body, not its return shape or call sites.
//
// Every candidate this function returns is PROPOSED, never applied
// silently — A2's confirm-step UI (app/components/LineageConfirm.tsx) is
// the only place a routed lineage becomes the seeker's actual choice, and
// it requires the seeker's explicit accept.

import type { LineageKey } from './lineages';

export interface MythRoutingEntry {
  lineageKey: Exclude<LineageKey, 'default' | 'chukchi'>;
  /** Canonical figures a seeker might name by name. Pointers only. */
  figures: readonly string[];
  /** Short motif/theme tags a free-text inquiry might brush against. */
  motifTags: readonly string[];
  /** One-word register naming the lineage's characteristic mode. */
  register: string;
}

// SCAFFOLDING NOTE: 'chukchi' is intentionally absent (see lib/lineages.ts
// and lib/archetypes.ts -- not yet selectable, no authored content to
// point to). 'default' is absent because free-text routing should never
// land a seeker on "no lineage" as if it were itself a tradition; the
// "enter without a lineage" door on LineageSelector already covers that
// path explicitly.
export const MYTH_ROUTING_INDEX: readonly MythRoutingEntry[] = [
  {
    lineageKey: 'maya',
    figures: ['Hunahpu', 'Xbalanque', 'Ixchel', 'Huracan', "Ajq'ij"],
    motifTags: ['underworld ordeal', 'sacred calendar', 'twin heroes', 'corn/death cycle', 'daykeeping'],
    register: 'ordeal',
  },
  {
    lineageKey: 'norse',
    figures: ['Odin', 'Freyja', 'the Norns', 'the Volva'],
    motifTags: ['fate/wyrd', 'sacrifice for knowledge', 'runes', 'the hanged god', 'seeress'],
    register: 'fated',
  },
  {
    lineageKey: 'taoist',
    figures: ['Laozi', 'Zhuangzi', 'the Cook of Prince Hui'],
    motifTags: ['wu wei', 'yielding', 'the uncarved block', 'naturalness', 'effortless mastery'],
    register: 'yielding',
  },
  {
    lineageKey: 'greek',
    figures: ['the Pythia', 'Apollo', 'Orpheus', 'Dionysus', 'Athena'],
    motifTags: ['oracle', 'tragic flaw', 'descent for love', 'ecstatic revelation', 'strategic clarity'],
    register: 'oracular',
  },
  {
    lineageKey: 'egyptian',
    figures: ['Osiris', 'Isis', 'Ra', 'Set', 'Ma\'at'],
    motifTags: ['dismemberment and gathering', 'weighing the heart', 'nightly underworld journey', 'necessary chaos'],
    register: 'judged',
  },
  {
    lineageKey: 'dreamtime',
    figures: ['ancestral beings'],
    motifTags: ['songlines', 'country', 'the Dreaming', 'displacement from land', 'ceremony left unfinished'],
    register: 'ancestral',
  },
  {
    lineageKey: 'vedic',
    figures: ['Arjuna', 'Krishna', 'Shiva', 'Ganesha'],
    motifTags: ['dharma in conflict', 'maya/illusion', 'renunciation of outcome', 'the obstacle as teacher'],
    register: 'dharmic',
  },
  {
    lineageKey: 'yoruba',
    figures: ['Eshu', 'Oshun', 'Ogun', 'Sango'],
    motifTags: ['the crossroads', "one's Ori/destiny", 'trickster misdirection', 'iron and labor', 'consequence returning'],
    register: 'divinatory',
  },
  {
    lineageKey: 'sufi',
    figures: ['Rumi', 'Hafiz', 'Al-Hallaj', 'Ibn Arabi'],
    motifTags: ['longing/separation', 'annihilation in the divine', 'the reed\'s cry', 'unity of being'],
    register: 'mystical',
  },
  {
    lineageKey: 'stoic',
    figures: ['Marcus Aurelius', 'Epictetus', 'Seneca', 'Zeno'],
    motifTags: ['dichotomy of control', 'preferred indifferents', 'memento mori', 'ruin as origin'],
    register: 'examined',
  },
  {
    lineageKey: 'mekubal',
    figures: ['Rashbi', 'the Shekhinah'],
    motifTags: ['broken vessels', 'gathering scattered sparks', 'exile accompanied', 'repair/tikkun'],
    register: 'kabbalistic',
  },
  {
    lineageKey: 'buddhist',
    figures: ['Siddhartha', 'Kisa Gotami', 'Angulimala', 'Mara'],
    motifTags: ['first encounter with suffering', 'grief as universal', 'kamma as pattern not sentence', 'temptation at the threshold'],
    register: 'liberative',
  },
] as const;

export interface RoutedCandidate {
  lineageKey: MythRoutingEntry['lineageKey'];
  /** One-line, human-readable reason surfaced by the confirm-step UI. */
  reason: string;
  /** Relative score, not a calibrated probability -- only used for ranking. */
  score: number;
}

/**
 * Score free text against the routing index and return ranked candidates,
 * strongest first. Returns [] rather than guessing when nothing scores —
 * silence is the correct output when the index genuinely doesn't recognize
 * the inquiry, not a forced best-of-a-bad-set pick.
 *
 * This function only PROPOSES. See app/components/LineageConfirm.tsx for
 * the required confirm step (A2) before a proposal becomes a selection.
 */
export function routeInquiry(text: string): RoutedCandidate[] {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return [];

  const results: RoutedCandidate[] = [];

  for (const entry of MYTH_ROUTING_INDEX) {
    let score = 0;
    let matchedFigure: string | null = null;
    let matchedMotif: string | null = null;

    for (const figure of entry.figures) {
      const f = figure.toLowerCase();
      if (q.includes(f) || tokens.some((t) => f.includes(t) && t.length > 3)) {
        score += 8;
        matchedFigure = matchedFigure ?? figure;
      }
    }
    for (const motif of entry.motifTags) {
      const motifTokens = motif.toLowerCase().split(/[\s/]+/);
      const hit = motifTokens.some((mt) => tokens.includes(mt));
      if (hit) {
        score += 3;
        matchedMotif = matchedMotif ?? motif;
      }
    }
    if (tokens.includes(entry.lineageKey) || tokens.includes(entry.register)) {
      score += 5;
    }

    if (score > 0) {
      const reason = matchedFigure
        ? `you named ${matchedFigure}`
        : matchedMotif
        ? `this touches ${matchedMotif}`
        : `this echoes a ${entry.register} register`;
      results.push({ lineageKey: entry.lineageKey, reason, score });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
