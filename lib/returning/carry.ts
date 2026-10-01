// lib/returning/carry.ts
//
// R2/R3 — what a seeker chooses to carry out of a reading, and what the return
// screen gives back. Two optional parts, both the seeker's own act:
//   R2  one "way of looking" from a fixed, curated menu (looking only: every
//       practice begins "notice"); no task, no goal, no follow-up.
//   R3  one line in the seeker's own words (<= 200 chars).
// On a later visit the screen returns exactly what they chose, dated, and claims
// nothing about it.
//
// Contract (specs/adr/ADR-0015.md, enforced by scripts/check-carry-register.mjs):
//   1. The menu and all copy are static. No model writes, rephrases or reads any
//      of it, and the seeker's line is never sent to a model except the welfare
//      classifier that already gates every free-text field (see the route).
//   2. No tracking: no completion, no streak, no "how did it go", no reminder.
//   3. The copy never speaks in the Elder's voice and never interprets.
//   4. Silent unless the seeker actually carried something, at least
//      MIN_SHOW_HOURS ago (a same-sitting echo is not a return).
//
// Pure module: no server imports, so the client shares the copy and the menu.
// The governance gate (carryEnabled()) is applied by the route, not here.

export const CARRY_PRACTICES = [
  { key: 'appear', text: 'notice where it shows up' },
  { key: 'absent', text: 'notice where it does not' },
  { key: 'near', text: 'notice who is near when it does' },
  { key: 'before', text: 'notice what comes just before it' },
] as const;
export type CarryPracticeKey = (typeof CARRY_PRACTICES)[number]['key'];

export const MAX_LINE_CHARS = 200;
// A line written minutes ago is not a return; wait for an actual return.
export const MIN_SHOW_HOURS = 12;
const HOUR_MS = 3_600_000;

export const CARRY_COPY = {
  offerOpen: 'carry something out of this place',
  offerLead: 'If you like, carry one way of looking.',
  linePrompt: 'Or one line in your own words. It is kept for you, and you can release it later.',
  carry: 'Carry this',
  notNow: 'Not now',
  held: 'carried',
  returnHeading: 'What you carried',
  returnPractice: 'In {when} you set out to {practice}.',
  returnLineOnly: 'In {when} you wrote:',
  returnLineAlso: 'And you wrote:',
  returnFootnote: 'Kept for you. You can release it whenever you like.',
  setDown: 'Set this down',
  release: 'Release this',
  releaseFailed: 'It could not be released just now. It is still kept for you.',
} as const;

export interface CarryRow {
  id: string | number;
  createdAt: string;
  practiceKey: unknown;
  line: unknown;
}

export interface CarryView {
  id: string;
  practiceKey: CarryPracticeKey | null;
  line: string | null;
  at: string;
}

function isPracticeKey(k: unknown): k is CarryPracticeKey {
  return typeof k === 'string' && CARRY_PRACTICES.some((p) => p.key === k);
}

export function practiceText(key: CarryPracticeKey): string {
  return CARRY_PRACTICES.find((p) => p.key === key)!.text;
}

/** Flatten control characters, collapse whitespace, cap length. null if nothing is left. */
export function sanitizeLine(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, MAX_LINE_CHARS)
    .trim();
  return s.length ? s : null;
}

export type CarryInput =
  | { ok: true; practiceKey: CarryPracticeKey | null; line: string | null }
  | { ok: false };

/** Validate a POST body. At least one of practice / line is required; an unknown practice key is a rejection, never a silent drop. */
export function validateCarryInput(body: unknown): CarryInput {
  if (!body || typeof body !== 'object') return { ok: false };
  const { practice, line } = body as { practice?: unknown; line?: unknown };
  if (practice !== undefined && practice !== null && !isPracticeKey(practice)) return { ok: false };
  if (line !== undefined && line !== null && typeof line !== 'string') return { ok: false };
  const practiceKey = isPracticeKey(practice) ? practice : null;
  const clean = sanitizeLine(line);
  if (!practiceKey && !clean) return { ok: false };
  return { ok: true, practiceKey, line: clean };
}

/** The carry to give back on a return: the most recent one at least MIN_SHOW_HOURS old, or null. */
export function pickCarryForReturn(rows: CarryRow[], now: number): CarryView | null {
  if (!Array.isArray(rows)) return null;
  let best: { v: CarryView; t: number } | null = null;
  for (const r of rows) {
    const t = Date.parse(r?.createdAt);
    if (!Number.isFinite(t)) continue;
    if (now - t < MIN_SHOW_HOURS * HOUR_MS) continue;
    const practiceKey = isPracticeKey(r.practiceKey) ? r.practiceKey : null;
    const line = sanitizeLine(r.line);
    if (!practiceKey && !line) continue;
    if (!best || t > best.t) best = { t, v: { id: String(r.id), practiceKey, line, at: new Date(t).toISOString() } };
  }
  return best ? best.v : null;
}

/** What GET /api/user/carry returns. `enabled` is the route's governance gate; it also tells the client whether to offer at all. */
export function buildCarryResponse(rows: CarryRow[], enabled: boolean, now: number): { enabled: boolean; carry: CarryView | null } {
  if (!enabled) return { enabled: false, carry: null };
  try {
    return { enabled: true, carry: pickCarryForReturn(rows, now) };
  } catch {
    return { enabled: true, carry: null };
  }
}

export function fillCarry(template: string, vars: { when?: string; practice?: string }): string {
  return template.replace('{when}', vars.when ?? '').replace('{practice}', vars.practice ?? '');
}
