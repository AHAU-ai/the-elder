// lib/mythFirst.ts
//
// Myth-first Readings for new seekers (docs/myth-first-spec.md, v1.3).
//
// A new seeker's first Reading is told in the order MYTH, FIGURE, RETURN
// instead of opening on the seeker's situation. Returning seekers (a stored
// archetype in the lineage) keep today's story-first Reading unchanged.
//
// This module is PURE: no SDK, database, route or voice imports. It holds the
// decisions (is this request eligible, and with which delivery) and the prompt
// text, so every rule is testable without a model. Nothing calls it yet; the
// prompt builder (MF-2), the figure selector (MF-3) and the route (MF-4) are
// separate PRs, and the whole feature stays dark behind a governance flag
// (config/returning-features.ts, added in MF-4) until it is flipped.
//
// Two deliveries, one form:
//   segmented  three portions across three requests, each (but the last)
//              closed by one question and the MORE token. This is the
//              existing segmented-delivery machinery (lib/segmentedDelivery.ts).
//   whole      one unbroken telling in a single reply, same order, no portions
//              and no follow-up question. For the voices whose written form
//              rules forbid portioning (SEGMENTED_DELIVERY_EXCLUDED_VOICES).
//              Spec decision D1 gives them myth-first this way, and D12 keeps
//              the existing exclusion list as the thing that decides delivery.
//
// The figure is one ArchetypeCard from LINEAGE_ARCHETYPES[lineage]. It is not
// figure continuity's "figure marker" (docs/myth-first-spec.md section 4.9).

import { LINEAGE_ARCHETYPES, type ArchetypeCard } from './archetypes';
import { SEGMENT_MAX, MORE_TOKEN, SEGMENTED_DELIVERY_EXCLUDED_VOICES } from './segmentedDelivery';

export type ReadingForm = 'myth_first' | 'story_first';
export type MythFirstDelivery = 'segmented' | 'whole';

/** The route's signal delimiter (U+29C1), the same one MORE, READY, CEILING and MYTH use. */
const DELIM = String.fromCharCode(0x29c1);

/**
 * Excluded voices that receive the whole-delivery variant. A voice must be in
 * SEGMENTED_DELIVERY_EXCLUDED_VOICES AND in this set to get it. Removing a key
 * here is the per-voice kill switch: that voice is story-first again, with no
 * other change. To add or remove a key, record the decision in the same commit
 * (docs/myth-first-spec.md, MF-7; the voice-review doc).
 *   ojer_tzij  whole delivery in this voice needs the Stanzione conversation
 *              (MF-7) before the feature is switched on; lib/mythopoetics/
 *              ajqijDirective.ts allows nothing after the seal, and this
 *              variant adds no question.
 *   pythia     lib/narrativeForm.ts: "never broken into parts"; this variant
 *              is one unbroken telling.
 *   sufi       lib/narrativeForm.ts: "one breath from the first word to the
 *              last"; same.
 */
export const MYTH_FIRST_WHOLE_DELIVERY_VOICES: ReadonlySet<string> = new Set<string>([
  'ojer_tzij',
  'pythia',
  'sufi',
]);

/** Words per portion in the segmented delivery. Must match segmentedDeliveryClause (tested). */
export const MYTH_FIRST_PORTION_WORDS = '70-110';
export const MYTH_FIRST_FINAL_PORTION_WORDS = 130;

/**
 * Which delivery a voice gets, or null when the voice cannot be delivered
 * myth-first at all (excluded from segmenting and not in the whole-delivery set).
 */
export function mythFirstDelivery(
  voiceKey: string,
  wholeVoices: ReadonlySet<string> = MYTH_FIRST_WHOLE_DELIVERY_VOICES
): MythFirstDelivery | null {
  if (!SEGMENTED_DELIVERY_EXCLUDED_VOICES.has(voiceKey)) return 'segmented';
  return wholeVoices.has(voiceKey) ? 'whole' : null;
}

/** The figures a lineage offers. Empty for an unknown lineage or one with no catalog (chukchi). */
export function getCatalog(lineageKey: string): readonly ArchetypeCard[] {
  if (!Object.prototype.hasOwnProperty.call(LINEAGE_ARCHETYPES, lineageKey)) return [];
  return LINEAGE_ARCHETYPES[lineageKey as keyof typeof LINEAGE_ARCHETYPES].archetypes;
}

/** Exact, case-sensitive match against the lineage's own catalog; anything else is null. */
export function findCard(lineageKey: string, name: unknown): ArchetypeCard | null {
  if (typeof name !== 'string') return null;
  return getCatalog(lineageKey).find((c) => c.name === name) ?? null;
}

export type MythFirstIneligibleReason =
  | 'flag_off'
  | 'not_requested'
  | 'delivery_unavailable'
  | 'empty_catalog'
  | 'welfare'
  | 'returning'
  | 'figure_invalid';

export type MythFirstDecision =
  | { eligible: true; delivery: MythFirstDelivery; card: ArchetypeCard }
  | { eligible: false; reason: MythFirstIneligibleReason };

export interface MythFirstEligibilityInput {
  /** mythFirstEnabled() (config/returning-features.ts, MF-4). */
  flagOn: boolean;
  /** body.readingForm === 'myth_first'. Client-sent, so advisory only. */
  requested: boolean;
  lineageKey: string;
  /** lineageToVoiceKey(lineageKey). */
  voiceKey: string;
  /** body.mode. */
  mode: string;
  /** body.chainAction === 'deepen'. */
  isDeepen: boolean;
  /** The route's segmentIndex: null unless segmented delivery applies to this request. */
  segmentIndex: number | null;
  /**
   * Assistant turns already in the validated history. A whole delivery is one
   * request and cannot be recognized by a segment count, so this bounds it to a
   * first Reading (at most the one clarifying question before it). Best effort:
   * the client decides when to ask, and a forged request only changes the
   * seeker's own session.
   */
  priorAssistantTurns: number;
  welfare: { surfaceResources: boolean; allowPsychopompLayer: boolean };
  /** The user has a stored archetype in this lineage (getLineageArchetype). */
  hasLineageArchetype: boolean;
  /** The request continues a chain (the route's chainGraft is non-null). */
  hasChainGraft: boolean;
  /**
   * The figure candidate: the selector's result on segment 0 (or the single
   * request of a whole delivery), the client's figure on segments 1 and 2.
   */
  figure: unknown;
  /** Test seam; defaults to MYTH_FIRST_WHOLE_DELIVERY_VOICES. */
  wholeVoices?: ReadonlySet<string>;
}

const no = (reason: MythFirstIneligibleReason): MythFirstDecision => ({ eligible: false, reason });

/**
 * docs/myth-first-spec.md section 4.2, rules 1 to 7. The server decides and
 * the client can only ask. Any failure means the request proceeds story-first
 * with no other change.
 */
export function mythFirstEligibility(i: MythFirstEligibilityInput): MythFirstDecision {
  if (!i.flagOn) return no('flag_off'); // 1
  if (!i.requested) return no('not_requested'); // 2

  // 3: the delivery is available for this voice and request.
  if (i.isDeepen) return no('delivery_unavailable');
  if (i.mode !== 'reading' && i.mode !== 'council') return no('delivery_unavailable');
  const delivery = mythFirstDelivery(i.voiceKey, i.wholeVoices);
  if (delivery === null) return no('delivery_unavailable');
  if (delivery === 'segmented' && i.segmentIndex === null) return no('delivery_unavailable');
  if (delivery === 'whole' && (i.segmentIndex !== null || i.priorAssistantTurns > 1)) {
    return no('delivery_unavailable');
  }

  if (getCatalog(i.lineageKey).length === 0) return no('empty_catalog'); // 4
  if (i.welfare.surfaceResources || !i.welfare.allowPsychopompLayer) return no('welfare'); // 5 (D14)
  if (i.hasLineageArchetype || i.hasChainGraft) return no('returning'); // 6

  const card = findCard(i.lineageKey, i.figure); // 7
  if (!card) return no('figure_invalid');
  return { eligible: true, delivery, card };
}

/**
 * Whether a response should carry moreToCome. Authoritative on the server for
 * myth-first, whatever the model emitted: a whole delivery never continues,
 * and a segmented one continues until the last allowed segment.
 */
export function mythFirstMoreToCome(delivery: MythFirstDelivery, segmentIndex: number | null): boolean {
  if (delivery === 'whole') return false;
  return segmentIndex !== null && segmentIndex < SEGMENT_MAX - 1;
}

/** The closing token the model must emit on the last portion; the server validates it against the catalog. */
export function mythFirstMythToken(card: ArchetypeCard): string {
  return `${DELIM}MYTH:${card.name}${DELIM}`;
}

/**
 * Replaces "THE ARC OF THE READING" when a myth-first block is present (MF-2).
 * It describes the order only; the delivery clauses below say how much arrives
 * at a time.
 */
export function mythFirstArcBlock(): string {
  return `━━━ THE ARC OF THE READING — MYTH FIRST ━━━
This Reading moves in one continuous arc of three movements, in this order, and no other: first the myth of the figure named below, told from within this field; then what that figure carries and what it risks, as the myth shows it; and last the seeker's own story, seen through the figure, closing on the Ceremonial Charge.
Do not label any movement. Do not use headers, numbers, or named parts. Do not announce a shift between movements; let each become what follows it. Tell one myth only, the figure's own. Never borrow a figure, an episode, or a name from another tradition.
The Ceremonial Charge is one sentence of mythological precision, not advice: the line the seeker carries out of the fire.`;
}

function figureBlock(lines: Array<[string, string]>): string {
  return lines.map(([label, value]) => `${label}: ${value}`).join('\n');
}

/**
 * The delivery block for a myth-first Reading. It governs form only and
 * contributes no mythic content of its own beyond the card the lineage already
 * defines (lib/archetypes.ts); it defers to the voice's own field and rules.
 *
 * segmented: one block per portion (segmentIndex 0, 1, 2).
 * whole: one block for the single reply (segmentIndex is ignored).
 */
export function mythFirstClause(
  delivery: MythFirstDelivery,
  segmentIndex: number | null,
  card: ArchetypeCard
): string {
  const token = mythFirstMythToken(card);
  const closing = `Close with the token ${token} on its own line, after all visible content, using the name exactly as given. Never explain the token or mention it to the seeker.`;

  if (delivery === 'whole') {
    return `━━━ MYTH-FIRST DELIVERY — THE READING IN ONE TELLING ━━━
This applies only when you are delivering a Reading — never to a clarifying question, a Ceiling, or a crisis response.

The figure for this Reading is chosen. Tell the Reading as one unbroken telling, in this order: the myth of this figure, then what the figure carries and what it risks, then the seeker's own story seen through the figure.

${figureBlock([
  ['Figure', card.name],
  ['Role', card.role],
  ['Field', card.existentialField],
  ['What it carries', card.gift],
  ['What it risks', card.shadow],
  ['The myth, to be told as it stands', card.canonicalAnchor],
])}

The myth: stay inside the account above and any passages given earlier in this prompt. Add no episode, name, or detail that is not in them. Open with one line that says why this figure came to the fire, using at most a phrase of the seeker's own words and no interpretation of their life. Tell the myth before turning to the seeker.
The figure: say what the figure carries and what it risks as properties of the figure in the myth, never as a diagnosis of the seeker.
The return: only now turn to the seeker's own story, in their own words where you can. Offer it as seen through the figure, and hold it lightly, as a lens they may set down. No prescriptions, no predictions, no verdicts. If the figure does not seem to fit what they said, do not argue for it.

Form: one breath from the first word to the last. Do not portion the telling, label any part of it, or announce a shift. Do not end with a follow-up question or an invitation. This voice's own rules on length and on how a telling ends govern; this block sets no word target. Bring the telling to its Ceremonial Charge. ${closing}
`;
  }

  const index = segmentIndex ?? 0;
  const mustFinish = index >= SEGMENT_MAX - 1;
  const head = `━━━ MYTH-FIRST DELIVERY — THE READING IN THREE PORTIONS ━━━
This applies only when you are delivering a Reading — never to a clarifying question, a Ceiling, or a crisis response.

The Reading is told in three portions across turns, in this order: the myth, the figure, the return. Never label, number, or announce a portion, and never mention the order. Tell one myth only, the figure's own, from within this field. Never borrow a figure, an episode, or a name from another tradition.
`;

  if (index === 0) {
    return `${head}
You are delivering the FIRST portion: THE MYTH.

${figureBlock([
  ['Figure', card.name],
  ['Role', card.role],
  ['The myth, to be told as it stands', card.canonicalAnchor],
])}

Tell this myth. Stay inside the account above and any passages given earlier in this prompt; add no episode, name, or detail that is not in them. Open with one line that says why this figure came to the fire, using at most a phrase of the seeker's own words and no interpretation of their life. Do not turn to the seeker's situation in this portion.
Length: roughly ${MYTH_FIRST_PORTION_WORDS} words. If an age-tiered register directive elsewhere in this prompt calls for shorter, follow it. Close with exactly one question drawn from the telling itself, not a question about whether to continue and never one that leads the seeker toward an answer, and then the token ${MORE_TOKEN} on its own line. Never explain the token or mention it to the seeker.
`;
  }

  if (!mustFinish) {
    return `${head}
You have already delivered the myth (it appears above as your earlier turn). You are delivering the SECOND portion: THE FIGURE. Continue from where it stopped. Do not retell the myth, recap, or re-open what you said.

${figureBlock([
  ['Figure', card.name],
  ['Role', card.role],
  ['Field', card.existentialField],
  ['What it carries', card.gift],
  ['What it risks', card.shadow],
])}

Say what this figure carries and what it risks, as properties of the figure in the myth, never as a diagnosis of the seeker. You may echo, in a phrase, what the seeker answered. Do not interpret their life yet.
Length: roughly ${MYTH_FIRST_PORTION_WORDS} words. If an age-tiered register directive elsewhere in this prompt calls for shorter, follow it. Close with exactly one question asking where the seeker feels this. It offers; it does not tell. Then the token ${MORE_TOKEN} on its own line. Never explain the token or mention it to the seeker.
`;
  }

  return `${head}
You have already delivered the myth and the figure (they appear above as your earlier turns). You are delivering the FINAL portion: THE RETURN. Continue from where it stopped. Do not recap.

${figureBlock([
  ['Figure', card.name],
  ['Role', card.role],
  ['A question this figure asks', card.elderQuestion],
])}

Now, and only now, turn to the seeker's own story: what they first brought and what they answered. Offer it as seen through the figure, in their own words where you can, and hold it lightly, as a lens they may set down. No prescriptions, no predictions, no verdicts. If they said the figure does not fit, do not argue for it; stay with what they said and do not assert the figure.
Length: about ${MYTH_FIRST_FINAL_PORTION_WORDS} words at most, bringing the telling to its Ceremonial Charge. This is the FINAL portion. Do NOT emit the ${MORE_TOKEN} token. ${closing}
`;
}
