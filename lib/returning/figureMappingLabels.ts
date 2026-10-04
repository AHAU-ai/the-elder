// lib/returning/figureMappingLabels.ts
//
// Pure label hygiene for Figure Continuity (docs/figure-continuity-spec.md
// v0.2, sections 4-5, guard G13). Kept separate from the ledger so it can be
// unit-tested without a database. Labels are model output that is stored and
// later re-fed to the model, and the dual guardian never sees them, so they
// are cleaned and bounded here, and the ledger re-applies this on every write
// (defense in depth) rather than trusting the signal parser to have done it.

export const SUBJECT_LABEL_MAX = 60;
export const COUNTERPART_LABEL_MAX = 80;
export const FIGURE_LABEL_MAX = 120;

// \p{C} covers control, format (zero-width, bidi overrides), surrogate and
// private-use characters. U+2028/U+2029 are line/paragraph separators (\p{Z})
// and U+29C1 is the route's own signal delimiter; none belong in a label.
// Built from code points, not escapes or raw characters: a raw U+2028 inside a
// regex literal is a JS line terminator and breaks the parse.
const CONTROL = /\p{C}/gu;
const SEPARATORS = new RegExp('[' + String.fromCharCode(0x2028, 0x2029, 0x29c1) + ']', 'g');

/**
 * Clean a label. Returns null (fail closed) if nothing is left after
 * cleaning or if the result is longer than `max` -- an over-length label is
 * rejected, never silently truncated mid-word into something the seeker never
 * saw. Length is counted in code points, matching Postgres char_length.
 */
export function sanitizeLabel(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(CONTROL, ' ').replace(SEPARATORS, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0) return null;
  if ([...cleaned].length > max) return null;
  return cleaned;
}
