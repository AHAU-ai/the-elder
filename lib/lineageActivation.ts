// lib/lineageActivation.ts
//
// When does a lineage tap show the full-screen "crossing" overlay
// (ActivationOverlay in app/LineageSelector.tsx) before the council opens?
//
// The overlay is a 3-15 second ceremonial beat and a billed /api/threshold
// call. For a seeker who has nothing saved yet it is the longest wait between
// "I chose" and "I can ask", and the question it generates is not used
// anywhere downstream (Threshold.tsx stores it and never reads it). So a
// first-time seeker goes straight through. A returning seeker, who has saved
// myths or a core myth statement, keeps the crossing.

export function shouldSkipActivation(input: {
  savedMythCount: number;
  hasCoreMythStatement: boolean;
}): boolean {
  return input.savedMythCount === 0 && !input.hasCoreMythStatement;
}
