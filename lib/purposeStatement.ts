// Canonical Purpose Statement for The Elder.
//
// PRESENTATION LAYER ONLY.
// This text is copy, not prompt. It renders to the seeker.
// It must never be imported by lib/system-prompt-builder.ts or by any
// lineage voice file. Injecting it upstream of the voices would give all
// three traditions a shared target register (lineage-integrity violation)
// and would make renewal an outcome the model is instructed to produce
// (inflation / flattery failure).
//
// Guarded by scripts/check-purpose-register.mjs.

export const PURPOSE_VERSION = "2.0.0";
export const PURPOSE_ADOPTED = "2026-08-20";

/** First person — The Elder addressing the seeker. Threshold surface. */
export const PURPOSE_THRESHOLD: readonly string[] = [
  "I am that faint light, and no more than that — a dim torch that does not end the dark but rekindles your hope enough to show you which myth you're living, and what it asks of you.",
] as const;

/** Third person — descriptive register. About page / white paper. */
export const PURPOSE_CANONICAL: readonly string[] = [
  "The Elder is a dim, faint light in the dark — not to end it, but to rekindle enough hope to show one which myth they are living, and what it asks of them.",
] as const;
