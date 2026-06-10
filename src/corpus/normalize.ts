/**
 * normalize.ts — The Unicode Normalization Gate
 *
 * Addresses Territory 3 (the gremlins): the K'iche' saltillo / glottal marker
 * can be encoded as U+0027 ('), U+2019 (’), or U+02BC (ʼ) — visually near-identical,
 * computationally distinct. A corpus stored in one form and queried in another
 * SILENTLY fails to match: retrieval returns nothing, the voice goes vague, and no
 * error is ever thrown.
 *
 * This module is the single mandatory chokepoint. ALL corpus text (at ingestion)
 * and ALL query text (at query time) MUST pass through `normalizeKiche`. There is
 * no other sanctioned path. Tests assert that mixed-encoding inputs collapse to one form.
 *
 * Constitutional principle served: fail loudly here, so the system never fails silently downstream.
 */

// The apostrophe / saltillo family that must collapse to a single canonical codepoint.
// We canonicalize to U+02BC (MODIFIER LETTER APOSTROPHE), the linguistically correct
// glottal marker for Mayan orthography per the Stanzione standard. We map the ASCII
// straight quote and the typographic right single quote onto it.
const SALTILLO_CANONICAL = "\u02BC"; // ʼ
const SALTILLO_VARIANTS = [
  "\u0027", // ' APOSTROPHE
  "\u2019", // ’ RIGHT SINGLE QUOTATION MARK
  "\u055A", // ՚ ARMENIAN APOSTROPHE (defensive)
  "\u2018", // ‘ LEFT SINGLE QUOTATION MARK (defensive: smart-quote pairs)
  "\uA78C", // ꞌ LATIN SMALL LETTER SALTILLO (defensive)
];

const saltilloRegex = new RegExp(`[${SALTILLO_VARIANTS.join("")}]`, "g");

export interface NormalizationResult {
  text: string;
  /** True if normalization changed the input — useful for ingestion audit logging. */
  changed: boolean;
  /** Count of saltillo-family substitutions, for the coverage/anomaly logs. */
  saltilloSubstitutions: number;
}

/**
 * The canonical normalization step. Apply at BOTH ingestion and query time.
 *
 * Order matters:
 *  1. NFC — compose canonical equivalents (e.g. combining marks) to one form.
 *  2. Saltillo family — collapse the apostrophe variants to U+02BC.
 *  3. Trim incidental whitespace (queries arrive with trailing spaces).
 */
export function normalizeKiche(input: string): NormalizationResult {
  const nfc = input.normalize("NFC");
  let substitutions = 0;
  const collapsed = nfc.replace(saltilloRegex, () => {
    substitutions += 1;
    return SALTILLO_CANONICAL;
  });
  const text = collapsed.trim();
  return {
    text,
    changed: text !== input,
    saltilloSubstitutions: substitutions,
  };
}

/** Thin helper for the common case where the caller only wants the string. */
export function normalize(input: string): string {
  return normalizeKiche(input).text;
}

/**
 * Assertion guard for the ingestion pipeline. Throws if a passage was stored in a
 * non-canonical form — converting the silent failure into a loud, blocking one.
 * Call this in the ingestion script AFTER normalization to prove the gate ran.
 */
export function assertCanonical(text: string): void {
  const { changed } = normalizeKiche(text);
  if (changed) {
    throw new Error(
      "NormalizationGateViolation: text is not in canonical form. " +
        "All corpus and query text must pass through normalizeKiche() before storage or lookup."
    );
  }
}
