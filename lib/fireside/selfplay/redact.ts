/**
 * lib/fireside/selfplay/redact.ts
 *
 * Sensitive families (distress, dependency, secrecy, grandiosity) are never
 * stored as text, even though the harness only ever generates synthetic turns:
 * the point is that no file or log in this system ever holds that kind of
 * material. Records for those families carry digests and lengths only.
 */
import { createHash } from 'node:crypto';
import type { Plain, Redacted } from './types';

export function digest(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
}

export function makeRecord(sensitive: boolean, turns: string[], reply: string): Redacted | Plain {
  if (sensitive) {
    return { redacted: true, turnDigests: turns.map(digest), replyDigest: digest(reply), replyLength: reply.length };
  }
  return { redacted: false, turns, reply };
}

/** Strip anything in-memory-only before a result is written anywhere. */
export function forSerialization<T extends { _synthTurns?: string[]; sensitive: boolean }>(r: T): Omit<T, '_synthTurns'> {
  const { _synthTurns, ...rest } = r;
  void _synthTurns;
  return rest;
}
