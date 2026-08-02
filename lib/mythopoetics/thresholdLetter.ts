// lib/mythopoetics/thresholdLetter.ts
//
// Thin, safe accessor over lib/psychopompLayer.ts's ThresholdLetterVars —
// the four-line closing sequence (dissolution / return / gift / image)
// each authorized voice already has written, per Kerényi's psychopomp
// framework. This has never been surfaced in the UI before; it currently
// only feeds the model's system prompt.
//
// IMPORTANT GAP, found while building this: psychopompLayer.ts has no
// entry for 'bhikkhu' (the Theravada voice, authorized 2026-07-31 by
// Shalom Ormsby) — the VoiceKey union in that file predates it. It also
// still carries a stale 'ajqij' entry, a duplicate key retired elsewhere
// (fix/retire-ajqij-voicekey). Calling getPsychopompContext('bhikkhu')
// returns undefined today.
//
// Per Lineage Integrity of Voice, Claude/this file does NOT invent a
// returnGift for bhikkhu — that content requires Shalom's authorship,
// same as every other voice's. Missing-voice handling below is a
// generic, deliberately un-mythologized fallback, not a substitute
// lineage voice.

import { getPsychopompContext } from '@/lib/psychopompLayer';
import type { VoiceKey } from '@/src/resilience/flags';

export interface ThresholdLetterContent {
  volatilizationPhrase: string;
  returnPhrase: string;
  returnGift: string;
  thresholdImage: string;
  /** False for the generic fallback — lets the UI/telemetry distinguish
   *  real lineage content from the placeholder without seekers noticing
   *  a difference in register. */
  isAuthorized: boolean;
}

// Deliberately plain, deliberately not attributed to any tradition.
// Used only when a voice has no psychopompLayer entry yet.
const FALLBACK: ThresholdLetterContent = {
  volatilizationPhrase: 'You brought something to the fire, and the fire took it in.',
  returnPhrase: 'What you carried is not gone. It has changed shape.',
  returnGift: 'The pattern that was named — yours to carry from here.',
  thresholdImage: 'The fire, low now, still burning.',
  isAuthorized: false,
};

export function getThresholdLetterContent(voiceKey: VoiceKey): ThresholdLetterContent {
  const layer = getPsychopompContext(voiceKey);
  if (!layer) return FALLBACK;
  const { volatilizationPhrase, returnPhrase, returnGift, thresholdImage } = layer.thresholdLetterVars;
  return { volatilizationPhrase, returnPhrase, returnGift, thresholdImage, isAuthorized: true };
}
