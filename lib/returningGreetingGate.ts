// Per-voice gate for the returning-seeker greeting (brainstorm item #2,
// full pass), mirroring lib/readingShapeClause.ts's own gate exactly —
// same reasoning, same shape. Acknowledging a seeker's return, in this
// tradition's own voice, before they've asked anything is a FORM claim
// about how this tradition greets someone who comes back — the same
// category readingShapeClause.ts already gates for closing convention.
// Until a voice has real tradition-bearer authorization on record, this
// stays dark for it; the seeker instead gets the existing, unchanged,
// non-return-aware lineageGreeting (lib/lineages.ts) either way.
//
// To re-enable for a voice: add its voiceKey here in the SAME commit
// that adds/updates that lineage's `returningGreeting` field in
// lib/lineages.ts, with the authorization it rests on named in a comment
// right there — do not add a voice to either without that paper trail.
export const RETURNING_GREETING_REVIEWED_VOICES: ReadonlySet<string> = new Set<string>([
  "ojer_tzij", // authorized — Vincent Stanzione (src/resilience/flags.ts)
  "babalawo",  // authorized by the babalawo holder, June 16 2026
  "mekubal",   // authorized by the mekubal holder, July 15 2026
  // bhikkhu deliberately excluded: voice itself is authorized (Shalom
  // Ormsby, July 31 2026), but the one FORM-claim review actually run for
  // this voice (docs/reading-shape-voice-review.md's closing-shape
  // clause) came back CONTRADICTED — the same caution applies here until
  // a real review of a return-greeting convention specifically is done.
  // Every other voice: no tradition-bearer review of ANY form convention
  // on record — see app/tradition-bearers for the live status list.
]);

/** Whether the return-aware greeting should be spoken for this voice. */
export function returningGreetingApplies(voiceKey: string): boolean {
  return RETURNING_GREETING_REVIEWED_VOICES.has(voiceKey);
}
