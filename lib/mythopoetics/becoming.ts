/**
 * becoming.ts
 *
 * The fifth beat: after the Threshold Letter names what the seeker
 * returns with (returnGift) and shows them the emblem of the passage
 * (thresholdImage), Becoming.tsx asks the seeker to speak FROM the
 * archetype for one sentence, rather than only being told about it.
 *
 * CONTENT ORIGIN:
 * One generic set of lines, used for every voiceKey. Deliberately NOT
 * tradition-specific: no named figure, deity, text, or lineage term
 * appears anywhere below (compare lib/lineages.ts's own 'default'
 * shamanic entry, which is the same category of content — invented,
 * non-tradition-attributed, and not subject to the named-bearer
 * sign-off that gates lib/psychopompLayer.ts's per-voice
 * ThresholdLetterVars). archetypeName and the marker/quote from the
 * reading itself are interpolated by the caller (Becoming.tsx /
 * ThresholdLetter.tsx), not hard-coded here, so the line stays generic
 * while still landing as specific to *this* reading.
 *
 * Because nothing here makes a claim on behalf of a real tradition,
 * isAuthorized is true by default. If this file is ever changed to
 * reintroduce tradition-specific language (a named deity, a term from
 * psychopompLayer.ts's per-voice overlay, a lineage-specific image),
 * that entry must go back to isAuthorized: false and through the same
 * named-accountability-holder review psychopompLayer.ts requires — see
 * that file's GOVERNANCE block. Don't let "it's all generic now" become
 * license to quietly re-specialize one voice later without re-adding
 * the gate.
 */

import type { VoiceKey } from '../../src/resilience/flags';

export interface BecomingVars {
  /** Second-person, present-tense line spoken as if something has
   *  passed through the seeker rather than only been told to them.
   *  Never a permanent label the app asserts back at the seeker later
   *  — rendered once, in this beat, then gone. */
  invocationLine: string;
  /** The stem of the sentence the seeker completes in their own words. */
  completionStem: string;
  /**
   * NOT the same contract as ThresholdLetterContent.isAuthorized
   * (lib/mythopoetics/thresholdLetter.ts) despite the identical name —
   * that flag is informational only: its FALLBACK content still renders
   * to the seeker either way, and the flag just marks it as generic
   * filler for telemetry. This flag is load-bearing: Becoming.tsx
   * checks it and renders NOTHING at all when false (see that
   * component's own gating effect and its `if (!content.isAuthorized)
   * return null`). Do not "simplify" Becoming.tsx's gate by reasoning
   * from the sibling file's pattern — they are deliberately different
   * because the risk profile is different: an un-mythologized fallback
   * line is safe to always show; unreviewed second-person tradition
   * content is not.
   */
  isAuthorized: boolean;
}

// One generic voice, deliberately not keyed to tradition. A few
// variants so it doesn't read identically on a seeker's second or
// third reading; picked deterministically from voiceKey + archetypeName
// by the caller if variety is wanted, or just GENERIC[0] if not —
// kept simple here as a single line per field since variety is a
// presentation concern, not a content one.
const GENERIC: BecomingVars = {
  invocationLine: 'You are the one who crossed and is still standing — not told about the passage now, but carrying it.',
  completionStem: 'I am the one who',
  isAuthorized: true,
};

// Every real voice key resolves to the same generic content. Kept as an
// explicit per-key map (rather than just returning GENERIC for anything)
// so a future reviewer can drop tradition-specific language into any one
// entry, flip that entry's isAuthorized back to false, and ship it
// without touching the others or this file's structure.
const ALL_VOICE_KEYS: VoiceKey[] = [
  'ojer_tzij', 'pythia', 'hem_netjer', 'volva', 'stoa', 'sage_of_the_way',
  'sufi', 'elder_of_country', 'babalawo', 'mekubal', 'vedic',
  'keeper_of_the_fire', 'bhikkhu', 'chukchi_shaman',
];

export const BECOMING_CONTENT: Record<VoiceKey, BecomingVars> = Object.fromEntries(
  ALL_VOICE_KEYS.map(k => [k, { ...GENERIC }])
) as Record<VoiceKey, BecomingVars>;

export function getBecomingContent(voiceKey: string): BecomingVars {
  return BECOMING_CONTENT[voiceKey as VoiceKey] ?? GENERIC;
}
