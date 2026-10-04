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

// Characters that are not in \p{C} or \s yet render as blank: combining
// grapheme joiner, Hangul and halfwidth Hangul fillers, Khmer inherent vowels,
// braille blank. Without this a label made only of one of them passes the
// "not empty" test and shows as nothing in the UI and the prompt.
const FILLERS = new RegExp(
  '[' + String.fromCharCode(0x034f, 0x115f, 0x1160, 0x17b4, 0x17b5, 0x2800, 0x3164, 0xffa0) + ']',
  'g'
);

// A label must carry at least one letter or number in some script. This
// rejects punctuation-only and emoji-only labels, which say nothing the seeker
// or the Elder could read back as a person or a situation.
const HAS_SUBSTANCE = /[\p{L}\p{N}]/u;

/**
 * Clean a label. Returns null (fail closed) if nothing readable is left after
 * cleaning (no letter or number) or if the result is longer than `max` -- an over-length label is
 * rejected, never silently truncated mid-word into something the seeker never
 * saw. Length is counted in code points, matching Postgres char_length.
 */
export function sanitizeLabel(raw: unknown, max: number): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(CONTROL, ' ').replace(SEPARATORS, ' ').replace(FILLERS, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0 || !HAS_SUBSTANCE.test(cleaned)) return null;
  if ([...cleaned].length > max) return null;
  return cleaned;
}
