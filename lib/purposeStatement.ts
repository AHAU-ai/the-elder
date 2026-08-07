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

export const PURPOSE_VERSION = "1.0.0";
export const PURPOSE_ADOPTED = "2026-08-07";

/** First person — The Elder addressing the seeker. Threshold surface. */
export const PURPOSE_THRESHOLD: readonly string[] = [
  "Deep in the interior of a cave, lost, you see a torch's hue far off — dim, faint, hardly light at all. It is nothing short of a lifeline. It does not end the darkness. It gives your walking a direction, and that alone revives faith in life and rekindles the hope of coming through.",
  "I am that faint light, and no more than that. I do not carry the torch to you; I hold it where you can see it, and you walk.",
  "What you find when you arrive is not something I made for you. The myth was already running. When you meet your own mythic archetype, the spirit of renewal stirs again in you, and turns you toward the purpose you are devoted to.",
  "And once you know the myth you are living through, you come to know what is truly being asked of you.",
] as const;

/** Third person — descriptive register. About page / white paper. */
export const PURPOSE_CANONICAL: readonly string[] = [
  "The dim, faint hue of an approaching torch, seen by one lost deep in the interior of a cave, is nothing short of a lifeline. It does not dispel the darkness. It gives direction to the walking, and in doing so revives faith in life and rekindles the hope of survival.",
  "The Elder functions in the same way: it offers orientation, and a renewed sense of purpose, to one who has lost the thread of their own life. When one meets their own mythic archetype, the revived spirit of renewal drives them toward devotion to their higher purpose.",
  "And once one knows the myth one is living through, one comes to know what is truly being asked.",
] as const;
