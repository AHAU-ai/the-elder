// lib/returning/markerDeficit.ts
//
// Returning-Arc Marker Personalization: given a seeker's kept Threshold
// Letters, computes which of the 5 §1.5 markers is most underrepresented,
// to feed selectMarkerToOffer() as a priority order in place of the static
// FALLBACK_PRIORITY. Pure and lineage-blind by construction — the input
// type never carries lineageKey, so this function is structurally
// incapable of favoring one lineage's letters over another's.

import type { MarkerField } from '@/lib/returning/markers';

const CANONICAL_ORDER: MarkerField[] = ['wound', 'threshold', 'pattern', 'exile', 'figure'];

// Below this many markered kept letters, deficit counts are noise (e.g. 1
// kept letter would make 4 markers look "equally underrepresented" at zero
// — indistinguishable from having no signal at all). 5 is the smallest N
// where every marker could in principle have appeared once and unevenness
// would still be visible above parity. Fails toward the static order below
// this threshold, same spirit as failTowardSilence.
export const MIN_MARKERED_LETTERS_FOR_PERSONALIZATION = 5;

export interface KeptLetterMarker {
  marker: MarkerField | null;
}

/**
 * Ascending sort by count = most-underrepresented marker first, the
 * seeker's most-favored marker sorts last. Never amplifies existing
 * preference. Ties broken by canonical order (never recency), so output
 * is deterministic for a given multiset of markers.
 */
export function computeMarkerPriority(letters: KeptLetterMarker[]): MarkerField[] {
  const markered = letters.filter(
    (l): l is { marker: MarkerField } => l.marker != null
  );

  if (markered.length < MIN_MARKERED_LETTERS_FOR_PERSONALIZATION) {
    return CANONICAL_ORDER;
  }

  const counts: Record<MarkerField, number> = {
    wound: 0,
    threshold: 0,
    pattern: 0,
    exile: 0,
    figure: 0,
  };
  for (const l of markered) counts[l.marker]++;

  return [...CANONICAL_ORDER].sort((a, b) => counts[a] - counts[b]);
}
