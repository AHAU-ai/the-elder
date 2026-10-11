/**
 * lib/fireside/sealed.ts
 *
 * A fireside sitting keeps no seeker text on the server. Its state (the recent turns, the
 * welfare level, the counters) is sealed with AES-256-GCM and handed to the browser as an
 * opaque token. The browser cannot read it, edit it, or lower the welfare level in it:
 * any change breaks the authentication tag and the token is refused. This is how
 * "the client never supplies history" (V8) and "welfare level never falls" (V9) hold
 * without a database table.
 *
 * Limits, stated plainly: a token can be replayed within its lifetime (so a seeker could
 * rewind to an earlier state of their own sitting; the per-sitting turn cap and the daily
 * rate limit still apply), and the key must be kept secret and rotated deliberately
 * (rotating it ends every open sitting, which is acceptable: they last at most 90 minutes).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export type Mode = 'before' | 'after';
export type Level = 0 | 1 | 2; // 0 ordinary, 1 distress, 2 crisis (closed)

export interface TurnRecord { r: 's' | 'h'; t: string }

export interface SittingState {
  v: 1;
  mode: Mode;
  level: Level;
  seekerTurns: number;
  hostTurns: number;
  /** Epoch ms after which the sitting is closed. */
  exp: number;
  closed: boolean;
  turns: TurnRecord[];
}

type Env = Record<string, string | undefined>;

function keyFrom(env: Env): Buffer | null {
  const k = env.FIRESIDE_STATE_KEY;
  if (!k || k.length < 32) return null;
  return createHash('sha256').update(`fireside-state-v1:${k}`).digest();
}

const AAD = Buffer.from('fireside-sitting-v1');

export function sealState(state: SittingState, env: Env = process.env): string | null {
  const key = keyFrom(env);
  if (!key) return null;
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(AAD);
  const ct = Buffer.concat([c.update(JSON.stringify(state), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64url');
}

function validShape(s: unknown): s is SittingState {
  if (!s || typeof s !== 'object') return false;
  const o = s as Record<string, unknown>;
  if (o.v !== 1 || (o.mode !== 'before' && o.mode !== 'after')) return false;
  if (o.level !== 0 && o.level !== 1 && o.level !== 2) return false;
  if (!Number.isInteger(o.seekerTurns) || !Number.isInteger(o.hostTurns) || !Number.isFinite(o.exp as number)) return false;
  if (typeof o.closed !== 'boolean' || !Array.isArray(o.turns) || o.turns.length > 24) return false;
  return o.turns.every((t) => t && typeof t === 'object' && ((t as TurnRecord).r === 's' || (t as TurnRecord).r === 'h') && typeof (t as TurnRecord).t === 'string' && (t as TurnRecord).t.length <= 3000);
}

/** Returns the state, or null for any token that is malformed, forged, or sealed under another key. */
export function openState(token: unknown, env: Env = process.env): SittingState | null {
  const key = keyFrom(env);
  if (!key || typeof token !== 'string' || token.length < 40 || token.length > 60000) return null;
  try {
    const raw = Buffer.from(token, 'base64url');
    if (raw.length < 12 + 16 + 2) return null;
    const d = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
    d.setAAD(AAD);
    d.setAuthTag(raw.subarray(12, 28));
    const json = Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
    const parsed: unknown = JSON.parse(json);
    return validShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
