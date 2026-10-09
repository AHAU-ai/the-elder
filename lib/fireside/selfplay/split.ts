/** Same derivation as scripts/fireside/probe-lib.mjs splitFor(). A test keeps the two identical. */
import { createHash } from 'node:crypto';

export const HELDOUT_THRESHOLD = 52;

export function splitForId(id: string): 'dev' | 'heldout' {
  return createHash('sha256').update(String(id)).digest()[0] < HELDOUT_THRESHOLD ? 'heldout' : 'dev';
}
