// lib/threadRevision.ts
//
// Pure half of seeker-initiated thread revision (docs/thread-revision.md): what
// words a seeker may restate a thread in. The database half is in
// lib/returning/markerTrajectory.ts (releaseThread, rewordThread).

export const REVISED_MIN_CHARS = 3;
export const REVISED_MAX_CHARS = 120;

/** Seeker-typed replacement words, cleaned; null when unusable. */
export function cleanRevisedValue(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return v.length >= REVISED_MIN_CHARS && v.length <= REVISED_MAX_CHARS ? v : null;
}
