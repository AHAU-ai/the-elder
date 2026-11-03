// lib/forkTale.ts
//
// "Fork the tale": a non-final portion of a segmented Reading may close its
// one follow-up question as a fork -- "the road splits: follow the one who
// laughs, or the one who waits?" -- and the seeker steers the telling by
// choosing. The choice is sent back as the seeker's ordinary reply, so the
// next portion is shaped by it exactly as any answer shapes it
// (lib/segmentedDelivery.ts). Nothing here changes the arc, the field, the
// persistence, or any gate.
//
// Contract with the model: next to the ⧁⧁MORE⧁⧁ token, a forking portion adds
//   ⧁FORK:<option one>|<option two>⧁
// The options must also appear, word for word, inside the closing question.
// That is the safety property: every word the seeker sees on a fork button is
// already in the portion's visible text, which the dual guardian reviews. The
// token only says which two phrases of the question are the choices.
//
// Server-side invariants (app/api/divine/route.ts):
//   - the token is ALWAYS stripped, on every path, before the guardian or the
//     seeker sees the text
//   - a fork is honored only on a non-final segmented portion (moreToCome),
//     only on a request where welfare is clear (never crisis or distress), and
//     never on a myth-first portion (that telling is fixed by the figure's own
//     account and may not be steered)
//   - a malformed fork (not exactly two options, too long, duplicated, or not
//     found inside the closing question) is dropped and the portion falls back
//     to the ordinary "go on / say more" replies. Failure is never visible.
//
// Flip FORK_THE_TALE_ENABLED to false to take the feature fully dark: the
// prompt clause disappears and the server ignores any token.

export const FORK_THE_TALE_ENABLED = true;

export const FORK_TOKEN_GLOBAL = /⧁FORK:[^⧁]*⧁/g;
const FORK_TOKEN = /⧁FORK:([^⧁]*)⧁/;

export const FORK_MAX_WORDS = 8;
export const FORK_MAX_CHARS = 60;

/** The last question in a portion: same rule as splitQuestion in ReadingSegment.tsx. */
export function lastQuestion(text: string): string | null {
  const trimmed = text.trim();
  const m = trimmed.match(/([^.!?…\n]*\?[”"')\]]*)\s*$/);
  if (!m) return null;
  const q = m[1].trim();
  // A reply that is only a question has no telling to separate it from.
  return trimmed.slice(0, trimmed.length - m[0].length).trim() ? q : null;
}

/** Remove every FORK token. */
export function stripForkTokens(text: string): string {
  return text.replace(FORK_TOKEN_GLOBAL, '');
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * The two choices a model-emitted token names, validated against the portion's
 * visible text, or null. `raw` is the model's output with the token still in it;
 * `visible` is the text the seeker will see (token already stripped).
 */
export function parseFork(raw: string, visible: string): [string, string] | null {
  if (!FORK_THE_TALE_ENABLED) return null;
  const m = raw.match(FORK_TOKEN);
  if (!m) return null;
  const parts = m[1].split('|').map(p => p.trim().replace(/^["“'‘]|["”'’]$/g, '').trim());
  if (parts.length !== 2) return null;
  const [a, b] = parts;
  for (const p of parts) {
    if (!p || p.length > FORK_MAX_CHARS) return null;
    if (p.split(/\s+/).length > FORK_MAX_WORDS) return null;
    if (/[?|⧁]/.test(p)) return null;
  }
  if (norm(a) === norm(b)) return null;
  const q = lastQuestion(visible);
  if (!q) return null;
  const nq = norm(q);
  if (!nq.includes(norm(a)) || !nq.includes(norm(b))) return null;
  return [a, b];
}

/** Whether a fork may be honored for this request. */
export function forkAllowed(i: {
  moreToCome: boolean;
  mythFirst: boolean;
  welfareClear: boolean;
}): boolean {
  return FORK_THE_TALE_ENABLED && i.moreToCome && !i.mythFirst && i.welfareClear;
}

/** Prompt paragraph appended to the non-final segmented-delivery clause. */
export function forkClause(mustFinish: boolean): string {
  if (!FORK_THE_TALE_ENABLED || mustFinish) return '';
  return `
A FORK, ONLY IF THE TELLING TRULY REACHES ONE: if, and only if, the telling you have just given arrives at two real ways it could go on, you may make this portion's closing question a fork and let the seeker choose. Do it at most once in a Reading; if an earlier portion above already forked, do not fork again. Most portions should not fork.
- Both ways must come from this voice's own field and from images already present in the telling. Do not introduce a new figure, name or episode for the sake of a choice, and never draw a way from another tradition.
- Both ways are real continuations of the same arc. Neither is the right one, neither is a warning, and the question must not lean toward either.
- Phrase each way in the voice, in a few words, as part of the one closing question (for example: "The road splits here. Do you follow the one who laughs, or the one who waits?"). Each way is at most ${FORK_MAX_WORDS} words and appears word for word inside that question.
- Then, on its own line before the ⧁⧁MORE⧁⧁ token, emit ⧁FORK:first way|second way⧁ with exactly those two phrases. Never explain the token or mention it to the seeker.
- When the seeker answers by naming one way, carry on down that way, shaped by what they chose. The arc and the field do not change. Do not fork on a Ceiling, a crisis, or any sign of distress.
`;
}
