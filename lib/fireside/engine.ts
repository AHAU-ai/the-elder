/**
 * lib/fireside/engine.ts
 *
 * The fireside turn pipeline, pure and dependency-injected so every branch is testable without
 * a network. The route supplies the real model calls.
 *
 * Order is the point (V1, V2, V9, V13, V14, V15):
 *   1. open the sealed state (forged or stale => refused)
 *   2. no welfare verdict, no generation: the welfare gate runs on EVERY turn, and if it cannot
 *      produce a verdict the turn fails closed with the plain failure copy
 *   3. the welfare level only ever rises within a sitting
 *   4. a crisis verdict never reaches the model: fixed copy, sitting closed
 *   5. generate, then check the output; a reply that fails the check is never shown
 *   6. the AI reminder is inserted by the server on a schedule, not left to the model
 */
import { assessWelfare } from '../welfareGate';
import type { ModelJudge } from '../welfareGate';
import { sealState, openState } from './sealed';
import type { Level, Mode, SittingState } from './sealed';
import {
  CAP_COPY, CRISIS_COPY, DISCLOSURE, EXPIRED_COPY, FAILURE_COPY, HISTORY_TURNS, MAX_SEEKER_CHARS, MAX_SEEKER_TURNS,
  OPENING, REMINDER, REMINDER_EVERY_HOST_TURNS, RESOURCE_LINE, SITTING_MS, buildHostSystem, checkHostOutput,
} from './host';

export interface ChatMessage { role: 'user' | 'assistant'; content: string }

export interface Deps {
  now: () => number;
  env: Record<string, string | undefined>;
  /** Welfare classifier call, injected into assessWelfare. */
  judge: ModelJudge;
  /** Host generation. Must return the raw reply text. */
  generate: (system: string, messages: ChatMessage[]) => Promise<string>;
}

export type OpenResult =
  | { ok: true; token: string; host: string; disclosure: string }
  | { ok: false; status: 500; error: string };

export function openSitting(mode: Mode, deps: Pick<Deps, 'now' | 'env'>): OpenResult {
  const state: SittingState = { v: 1, mode, level: 0, seekerTurns: 0, hostTurns: 0, exp: deps.now() + SITTING_MS, closed: false, turns: [] };
  const token = sealState(state, deps.env);
  if (!token) return { ok: false, status: 500, error: 'The fire is not available right now.' };
  return { ok: true, token, host: OPENING[mode], disclosure: DISCLOSURE };
}

export type TurnResult =
  | { kind: 'host'; token: string; host: string; resources: boolean }
  | { kind: 'crisis'; host: string; closed: true }
  | { kind: 'closed'; host: string; reason: 'turn_cap' | 'expired' }
  | { kind: 'failure'; token: string; host: string }
  | { kind: 'invalid'; status: 400; error: string };

const RANK: Record<'ordinary' | 'distress' | 'crisis', Level> = { ordinary: 0, distress: 1, crisis: 2 };

export async function takeTurn(token: unknown, message: unknown, deps: Deps): Promise<TurnResult> {
  const state = openState(token, deps.env);
  if (!state) return { kind: 'closed', host: EXPIRED_COPY, reason: 'expired' };

  // A sitting that ended in crisis stays ended, however the client asks.
  if (state.closed && state.level === 2) return { kind: 'crisis', host: CRISIS_COPY, closed: true };
  if (state.closed || deps.now() > state.exp) return { kind: 'closed', host: EXPIRED_COPY, reason: 'expired' };
  if (state.seekerTurns >= MAX_SEEKER_TURNS) return { kind: 'closed', host: CAP_COPY, reason: 'turn_cap' };

  if (typeof message !== 'string') return { kind: 'invalid', status: 400, error: 'A message is required.' };
  const text = message.trim();
  if (!text) return { kind: 'invalid', status: 400, error: 'A message is required.' };
  if (text.length > MAX_SEEKER_CHARS) return { kind: 'invalid', status: 400, error: `Please keep a message under ${MAX_SEEKER_CHARS} characters.` };

  const failure = (): TurnResult => ({ kind: 'failure', token: sealState(state, deps.env) ?? '', host: FAILURE_COPY });

  // 2. Welfare verdict first. assessWelfare owns its own failsafe (model failure => at least distress);
  //    anything that still throws means there is no verdict, so there is no generation.
  let tier: 'ordinary' | 'distress' | 'crisis';
  try {
    tier = (await assessWelfare(text, deps.judge)).tier;
  } catch {
    return failure();
  }

  // 3. Level only rises.
  const level = Math.max(state.level, RANK[tier]) as Level;

  // 4. Crisis never reaches the model.
  if (level === 2) {
    return { kind: 'crisis', host: CRISIS_COPY, closed: true };
  }

  // 5. Generate and check. One retry with a nudge; a reply that fails the check is never shown.
  const history: ChatMessage[] = state.turns.slice(-HISTORY_TURNS).map((t) => ({ role: t.r === 's' ? 'user' : 'assistant', content: t.t }));
  const system = buildHostSystem(state.mode, level) + `\n\nThe fire opened with: "${OPENING[state.mode]}"`;
  let reply = '';
  for (let attempt = 0; attempt < 2 && !reply; attempt++) {
    let raw = '';
    try {
      raw = await deps.generate(
        attempt === 0 ? system : system + '\n\nYour last attempt broke the rules. Keep to 80 words, one question, plain speech.',
        [...history, { role: 'user', content: text }],
      );
    } catch {
      return failure();
    }
    if (checkHostOutput(raw).ok) reply = raw.trim();
  }
  if (!reply) return failure();

  // 6. The server, not the model, keeps the AI disclosure alive.
  const hostTurns = state.hostTurns + 1;
  const remind = hostTurns % REMINDER_EVERY_HOST_TURNS === 0;
  const resources = level >= 1;
  let host = remind ? `${REMINDER} ${reply}` : reply;
  if (resources) host = `${host}\n\n${RESOURCE_LINE}`;

  const next: SittingState = {
    ...state,
    level,
    seekerTurns: state.seekerTurns + 1,
    hostTurns,
    turns: [...state.turns, { r: 's' as const, t: text }, { r: 'h' as const, t: reply }].slice(-20),
  };
  const sealed = sealState(next, deps.env);
  if (!sealed) return failure();
  return { kind: 'host', token: sealed, host, resources };
}
