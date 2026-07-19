/**
 * lib/dt1-directional-transformation.ts
 *
 * DT-1: Directional Transformation (Nested Pairing)
 * Ratified via capsule AC-2026-07-17-MARKER-TRICKSTER
 * Scope: ojer_tzij only
 *
 * This file holds the governance-critical constants that define DT-1 behavior.
 * Changes to DT1_CLOSURE_LEXEMES or DT1_TRANSIT_PALETTE update CONTRACT_HASH
 * automatically — no manual version bump needed, and diffs are isolated.
 */

/**
 * DT-1 Closure Lexemes (prohibited)
 *
 * These terms must NOT appear in the resolution span of an ojer_tzij
 * paired-marker render. They imply a softening of the genuine ending
 * that DT-1 R4 and R5 require.
 *
 * Querent input containing these words is not linted; instrument-generated
 * resolution language is.
 *
 * Governance: Changes to this list are contract changes and show as
 * isolated diffs in git — no hidden schema migrations.
 */
export const DT1_CLOSURE_LEXEMES = [
  'heal',
  'cure',
  'mend',
  'resolve',
  'closure',
  'overcome',
  'transcend',
  'integrate',
  'reconcile',
  'make whole',
  'put behind',
  'move past',
] as const;

/**
 * DT-1 Transit Palette (affirmative)
 *
 * Non-exhaustive list of approved terms in paired-marker resolution.
 * These terms affirm appropriation (R4) and persistence-within-ending (R5)
 * without softening the genuine closure.
 *
 * Governance: Changes are contract changes; diffs isolate them.
 */
export const DT1_TRANSIT_PALETTE = [
  'carried across',
  'crossing',
  'transit',
  'turned',
  'turned to use',
  'taken up',
  'taken into service',
  'repurposed',
  'returned transformed',
  'fuel of the new',
  'material of what begins',
  'change',
  'transform',
] as const;

export const DT1_REQUIREMENTS = [
  'R1. Paired markers MUST frame a wound traversal (opening at threshold, closing after crossing).',
  "R2. Opening marker MUST be drawn from vokutun stem (D1-1 terms: 'broken-opening', 'split-beginning', etc.).",
  'R3. Resolution span (between paired markers) MUST NOT contain any closure lexeme (12 prohibited terms).',
  'R4. Appropriation move MUST employ transit/persistence palette (13 affirmative terms OR semantic equivalent; semantic equiv flags for human review, never auto-passes).',
  'R5. Wound material MUST be referenced again after threshold crossing (enforces continuity, confirms R5 compliance).',
] as const;

export const DT1_CONTRACT_TEXT = [
  'DT-1: Directional Transformation',
  '',
  'Ratified via capsule AC-2026-07-17-MARKER-TRICKSTER by Vincent Stanzione (2026-07-18).',
  'Scope: ojer_tzij lineage only (D2).',
  '',
  'Five Normative Requirements (R1-R5):',
  ...DT1_REQUIREMENTS,
  '',
  'Closure Lexemes (Prohibited in Resolution Span):',
  ...DT1_CLOSURE_LEXEMES.map((term) => `- ${term}`),
  '',
  'Transit Palette (Affirmative Language for Appropriation/Persistence):',
  ...DT1_TRANSIT_PALETTE.map((term) => `- ${term}`),
].join('\n');
