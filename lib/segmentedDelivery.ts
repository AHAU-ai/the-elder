// Segmented delivery of a Reading (opt-in per request via `segmented: true`).
//
// Why: a full-arc Reading in one block is long. With segmentation the Elder
// speaks a short portion of the one continuous arc, closes it with a single
// follow-up question, and carries on when the seeker answers. The arc itself
// does not change (see "THE ARC OF THE READING" in system-prompt-builder.ts);
// only how much of it arrives per turn.
//
// Contract with the model: a segment that is NOT the last ends with the
// token ⧁⧁MORE⧁⧁ on its own line (same signal-token family as ⧁⧁READY⧁⧁).
// The segment that completes the Reading carries the Ceremonial Charge and,
// in reading mode, the ⧁MYTH:...⧁ token, and carries no MORE token.
//
// Server-side invariants (app/api/divine/route.ts):
//   - the client's `segment` count is clamped; at SEGMENT_MAX - 1 prior
//     segments the Reading MUST finish, whatever the model emitted
//   - persistence (myth ledger, visit record, markers) runs once, on the
//     final segment, over the assembled full text
//   - the MORE token is always stripped before the guardian or the seeker
//     sees the text

export const SEGMENT_MAX = 3;
export const MORE_TOKEN = '⧁⧁MORE⧁⧁';

// Per-voice exclusions. Portioning a telling and closing each portion with a
// question is a FORM claim, the same class of claim lib/readingShapeClause.ts
// gates per voice. These voices already carry written form rules that
// contradict it, so they keep delivering a Reading whole until someone with
// authority over that voice's form decides otherwise:
//   ojer_tzij  lib/mythopoetics/ajqijDirective.ts (reading mode, SEAL): "Do not
//              add offers, questions, or follow-up invitations after the
//              seal." Law-tier voice; its narrative register is also
//              pending Stanzione's signature (lib/narrativeForm.ts).
//   pythia     lib/narrativeForm.ts: "never broken into parts".
//   sufi       lib/narrativeForm.ts: "one breath from the first word to the
//              last".
// To lift an exclusion, remove the key here in the same commit that records
// the decision (docs/segmented-delivery.md).
export const SEGMENTED_DELIVERY_EXCLUDED_VOICES: ReadonlySet<string> = new Set<string>([
  'ojer_tzij',
  'pythia',
  'sufi',
]);

/** Whether segmented delivery may be applied for this voice. */
export function segmentedDeliveryApplies(voiceKey: string): boolean {
  return !SEGMENTED_DELIVERY_EXCLUDED_VOICES.has(voiceKey);
}

/** Clamp a client-supplied count of segments already delivered. */
export function clampSegmentIndex(raw: unknown): number {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 0;
  return Math.min(Math.max(n, 0), SEGMENT_MAX - 1);
}

/** Prompt block appended after the reading-mode clause. */
export function segmentedDeliveryClause(segmentIndex: number): string {
  const mustFinish = segmentIndex >= SEGMENT_MAX - 1;
  const position =
    segmentIndex === 0
      ? 'You are delivering the FIRST segment of this Reading.'
      : `You have already delivered ${segmentIndex} segment${segmentIndex === 1 ? '' : 's'} of this Reading (they appear above as your earlier turns). Continue the same telling from exactly where it stopped. Do not recap, restate, or re-open what you already said.`;
  const ending = mustFinish
    ? 'This is the FINAL segment. Bring the telling to its Ceremonial Charge now. Do NOT emit the ⧁⧁MORE⧁⧁ token.'
    : 'Decide where the telling naturally breaks. If more of the arc remains, end this segment with ONE short follow-up question and then the token ⧁⧁MORE⧁⧁ on its own line. If the arc completes within this segment, finish it with the Ceremonial Charge and do NOT emit ⧁⧁MORE⧁⧁.';

  return `━━━ SEGMENTED DELIVERY — THE READING IN PORTIONS ━━━
This applies only when you are delivering a Reading — never to a clarifying question, a Ceiling, or a crisis response.

The Reading is still one continuous arc, not sections. Deliver it in short portions across turns so the seeker is never handed a wall of text. Never label, number, or announce a portion ("part one", "next"). Never mention that the telling is being given in pieces.

${position}

Length: each segment is roughly 70-110 words (the final segment may run to about 130 to land the Ceremonial Charge). If an age-tiered register directive elsewhere in this prompt calls for shorter, follow it for every segment. These per-segment targets replace any total word target in other form guidance; any closing-shape guidance applies to the final segment only.

Each segment that is not the last carries a real portion of the arc — an image, a turn, a piece of what is moving — complete enough to stand alone for a moment. It then ends with exactly one follow-up question, spoken in the voice and drawn from the telling itself, that invites the seeker to answer what was just named or to ask for what comes next. It is not a meta question ("shall I continue?") and it never leads the seeker toward an answer.

When the seeker replies, let what they said shape the next portion, but keep to the same arc and the same field. A bare "yes" or "go on" simply means: continue. If their reply carries a crisis signal or crosses a Hard Ceiling, the Ceiling Protocol and crisis directive govern, exactly as always, and the telling pauses.

${ending}
Never explain the token or mention it to the seeker.
`;
}

interface Msg {
  role: string;
  content: string;
}

/**
 * Assemble the full Reading for persistence from the final segment plus the
 * `segmentIndex` assistant segments that preceded it, and recover the seeker
 * message that opened the Reading (the one just before the first segment).
 * Uses only server-validated history (body.messages), never client-supplied
 * "full text".
 */
export function assembleSegmentedReading(
  messages: Msg[],
  segmentIndex: number,
  finalText: string
): { fullText: string; offering: string | undefined } {
  if (segmentIndex <= 0) {
    return { fullText: finalText, offering: undefined };
  }
  const assistantIdx: number[] = [];
  messages.forEach((m, i) => {
    if (m.role === 'assistant') assistantIdx.push(i);
  });
  const prior = assistantIdx.slice(-segmentIndex);
  if (prior.length === 0) {
    return { fullText: finalText, offering: undefined };
  }
  const parts = prior.map((i) => messages[i].content.trim()).filter(Boolean);
  const before = messages[prior[0] - 1];
  return {
    fullText: [...parts, finalText.trim()].join('\n\n'),
    offering: before && before.role === 'user' ? before.content : undefined,
  };
}
