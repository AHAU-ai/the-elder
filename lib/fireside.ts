// lib/fireside.ts
//
// The fireside (docs/fireside.md). Pure rules for the room: what a request may
// contain, what the Elder is told, and, above all, what is allowed to be
// remembered. The route owns the I/O (welfare, model, guardian, database).
//
// The invariants live here so they are testable without a server:
//   - a crisis OR distress turn is never persisted (shouldPersist);
//   - the Elder is told to host, not read: no myth-telling, no diagnosis, no
//     claim to remember, no wish for the seeker's return (RT-6, Appendix B);
//   - only a line the seeker wrote and chose to keep can leave the room for the
//     Tree (validateKeptLine); nothing is inferred on their behalf.

import type { WelfareTier } from '@/lib/welfareForbidden';

export const FIRESIDE_VOICE_KEY = 'keeper_of_the_fire';
/** lib/traditions.ts entry the dual guardian judges against (voiceKeyToTraditionSlug). */
export const FIRESIDE_TRADITION_SLUG = 'default';

export const MAX_SEEKER_CHARS = 2000;
export const MAX_ELDER_CHARS = 3000;
/** Earlier turns of THIS sitting the client may send back for continuity. Not stored server-side. */
export const MAX_CONTEXT_TURNS = 6;
export const KEPT_MIN_CHARS = 3;
export const KEPT_MAX_CHARS = 140;
export const FIRESIDE_RATE_LIMIT_PER_DAY = 40;
export const MAX_ENTRIES_PER_USER = 200;

export interface FiresideTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Validate the client's sitting. Anything malformed is refused, not repaired. */
export function parseFiresideRequest(
  body: unknown
): { ok: true; message: string; context: FiresideTurn[]; languageName: string } | { ok: false } {
  const b = body as { message?: unknown; context?: unknown; languageName?: unknown } | null;
  if (!b || typeof b.message !== 'string') return { ok: false };
  const message = b.message.trim();
  if (!message || message.length > MAX_SEEKER_CHARS) return { ok: false };

  const raw = b.context === undefined ? [] : b.context;
  if (!Array.isArray(raw) || raw.length > MAX_CONTEXT_TURNS * 2) return { ok: false };
  const context: FiresideTurn[] = [];
  for (let i = 0; i < raw.length; i++) {
    const t = raw[i] as { role?: unknown; content?: unknown };
    // Strict alternation starting with the seeker: a sitting, not an injected script.
    if (t?.role !== (i % 2 === 0 ? 'user' : 'assistant')) return { ok: false };
    if (typeof t.content !== 'string' || !t.content.trim() || t.content.length > MAX_ELDER_CHARS) return { ok: false };
    context.push({ role: t.role as 'user' | 'assistant', content: t.content });
  }
  if (context.length % 2 !== 0) return { ok: false };
  const languageName = typeof b.languageName === 'string' && b.languageName.length <= 40 ? b.languageName : 'English';
  return { ok: true, message, context, languageName };
}

/**
 * The journal rule. Only an ordinary turn is ever written down. A crisis turn
 * and a distress turn both stay out: the seeker said it to the fire and the
 * fire does not file it. (The brief names crisis; distress is excluded on the
 * same side of the line as figure continuity's D8.)
 */
export function shouldPersist(tier: WelfareTier, guardianPassed: boolean): boolean {
  return tier === 'ordinary' && guardianPassed;
}

export type KeptLine = { ok: true; line: string } | { ok: false; reason: 'empty' | 'short' | 'long' | 'not_text' };

export function validateKeptLine(raw: unknown): KeptLine {
  if (typeof raw !== 'string') return { ok: false, reason: 'not_text' };
  const line = raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (!line) return { ok: false, reason: 'empty' };
  if (line.length < KEPT_MIN_CHARS) return { ok: false, reason: 'short' };
  if (line.length > KEPT_MAX_CHARS) return { ok: false, reason: 'long' };
  return { ok: true, line };
}

/** The fireside's register rules, appended after the Elder's frame voice. */
export const FIRESIDE_RULES = `THE FIRESIDE.
The seeker has come to sit, not to be read. This is conversation, not a Reading: do not tell a myth, do not name an archetype or a figure for them, do not diagnose, interpret their life, or predict. Listen, and answer plainly and briefly, in a few sentences, from the fire.

You may reflect what the seeker has said in this sitting, in their own words. You hold NO memory of any earlier sitting and must never imply one: no "last time", no "you told me before", no "again". If they speak of the past, it is theirs, not yours.

Never express a wish for the seeker to stay, return, or continue. No "come back", no "I'll be here", no "I missed", no praise for how long or how often they sit. If they say they are done, let them go without ceremony and without a hook.

Ask at most one question, and only when it opens something rather than leads. Never advise on health, law or money. If they ask for any of these, say plainly that this is not the place and why, once.

You are not a therapist, a healer, or a crisis service. If the seeker seems to be in danger, do not try to hold it: say that this deserves a person, plainly and warmly, and stop.`;

const DISTRESS_NOTE =
  'DISTRESS AWARENESS. This seeker may be carrying something heavy. Be plain and present. Do not use the mythic register, do not ask a question that opens further. Acknowledge what they said in their own words and, if it fits, say that a person could help carry it.';

/** Assemble the system prompt from the shared protocol text the route supplies. */
export function buildFiresideSystem(base: { frame: string; ceiling: string; handoff: string }, distress: boolean): string {
  const parts = [base.frame, FIRESIDE_RULES, base.ceiling, base.handoff];
  if (distress) parts.push(DISTRESS_NOTE);
  return parts.join('\n\n');
}
