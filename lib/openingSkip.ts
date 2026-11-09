// Remembering that a seeker has already crossed the opening (door, breath,
// reception) so the same person is not walked through it again on a new tab
// or a return later the same day.
//
// Was tab-scoped only (sessionStorage 'elder_breathed'), so anonymous seekers
// replayed the whole opening on every new tab while signed-in members could
// bypass it for good. This is the anonymous counterpart: device-local, a hint
// only, and it lapses, so the door is still met again on a later day.

export const OPENING_SEEN_KEY = 'elder_opening_seen_at';
export const OPENING_SKIP_WINDOW_MS = 12 * 60 * 60 * 1000;

type Reader = Pick<Storage, 'getItem'>;
type Writer = Pick<Storage, 'setItem'>;

export function openingRecentlySeen(storage: Reader | null | undefined, now: number = Date.now()): boolean {
  if (!storage) return false;
  try {
    const raw = storage.getItem(OPENING_SEEN_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    const age = now - at;
    // A clock set backwards (negative age) is not "recent": the door shows.
    return age >= 0 && age < OPENING_SKIP_WINDOW_MS;
  } catch {
    return false;
  }
}

export function markOpeningSeen(storage: Writer | null | undefined, now: number = Date.now()): void {
  if (!storage) return;
  try { storage.setItem(OPENING_SEEN_KEY, String(now)); } catch { /* private mode: proceed */ }
}
