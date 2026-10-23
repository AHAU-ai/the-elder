// lib/returning/reflection.ts
//
// R1 — the return-visit reflection. When a signed-in seeker comes back, the
// threshold may show them, verbatim and dated, the first and the most recent
// words THEY confirmed or reshaped for one marker type ("wound", "figure", …).
// Nothing is interpreted, compared aloud, or summarized: the seeker reads their
// own two lines and sees for themselves whether anything moved.
//
// Contract (see specs/adr/ADR-0014.md, enforced by scripts/check-reflection-register.mjs):
//   1. Only words the seeker confirmed or reshaped (visit_record.markers_confirmed).
//      Model-proposed markers and declined markers are never read or shown.
//   2. The copy below is static. No model writes or rephrases any of it, and it
//      never speaks in the Elder's voice ("I remember", "I see") — it speaks as
//      the seeker's own record.
//   3. No counts, no claim that anything changed, grew, or progressed, and no
//      claim that two different marker types are connected.
//   4. Silent (null) unless there is something honest to show: two DIFFERENT
//      confirmed values of the SAME type, at least MIN_GAP_DAYS apart, where the
//      most recent one is not simply the first one again.
//
// Pure module: no server imports, so the client can share REFLECTION_COPY.
// The governance gate (trajectoryEnabled()) is applied by the route, not here.

export const REFLECTION_MARKER_TYPES = ['wound', 'threshold', 'pattern', 'exile', 'figure'] as const;
export type ReflectionMarkerType = (typeof REFLECTION_MARKER_TYPES)[number];

// Two confirmations inside one stretch of days are one sitting, not a view
// that stayed with the seeker between visits.
export const MIN_GAP_DAYS = 14;
const MAX_VALUE_CHARS = 120;
const DAY_MS = 86_400_000;

// Every string the seeker is shown that is not their own words. Static and
// curated; {type} and {when} are the only placeholders.
export const REFLECTION_COPY = {
  heading: 'In your own words',
  lineEarlier: 'Your {type}, as you named it in {when}:',
  lineLatest: 'And in {when}:',
  footnote: 'These are only the words you gave. Nothing here is a reading.',
  setDown: 'Set this down',
} as const;

export interface ConfirmedRow {
  /** visit_record.created_at */
  createdAt: string;
  /** visit_record.markers_confirmed — { [field]: { value, mode, confirmedAt } } */
  confirmed: unknown;
}

export interface ReflectionMoment {
  value: string;
  /** ISO timestamp the seeker gave these words */
  at: string;
}

export interface Reflection {
  markerType: ReflectionMarkerType;
  earlier: ReflectionMoment;
  latest: ReflectionMoment;
}

function sanitize(v: string): string {
  return v
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, MAX_VALUE_CHARS)
    .trim();
}

// Distinctness is judged on meaning-neutral form only: case, spacing and
// trailing punctuation. "The silence I keep." and "the silence I keep" are the
// same words; nothing cleverer is attempted.
function normalize(v: string): string {
  return v.toLowerCase().replace(/\s+/g, ' ').replace(/[\s.,;:!?"'’”]+$/g, '').trim();
}

interface Entry { value: string; norm: string; at: number }

function entriesFor(rows: ConfirmedRow[], type: ReflectionMarkerType): Entry[] {
  const out: Entry[] = [];
  for (const row of rows) {
    const c = row?.confirmed;
    if (!c || typeof c !== 'object') continue;
    const cell = (c as Record<string, unknown>)[type];
    if (!cell || typeof cell !== 'object') continue;
    const { value, mode, confirmedAt } = cell as { value?: unknown; mode?: unknown; confirmedAt?: unknown };
    if (mode !== 'confirmed' && mode !== 'reshaped') continue; // defence in depth: declines are never stored
    if (typeof value !== 'string') continue;
    const clean = sanitize(value);
    const norm = normalize(clean);
    if (!norm) continue;
    const t = Date.parse(typeof confirmedAt === 'string' ? confirmedAt : '') || Date.parse(row.createdAt);
    if (!Number.isFinite(t)) continue;
    out.push({ value: clean, norm, at: t });
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * The one reflection worth showing, or null. Deterministic: the marker type
 * with the longest honest span wins; ties fall to REFLECTION_MARKER_TYPES order.
 */
export function pickReflection(rows: ConfirmedRow[]): Reflection | null {
  if (!Array.isArray(rows) || rows.length < 2) return null;

  let best: { type: ReflectionMarkerType; first: Entry; last: Entry; span: number } | null = null;
  for (const type of REFLECTION_MARKER_TYPES) {
    const es = entriesFor(rows, type);
    if (es.length < 2) continue;
    const first = es[0];
    const last = es[es.length - 1];
    if (first.norm === last.norm) continue; // the most recent words are the first words again: nothing to show
    const span = last.at - first.at;
    if (span < MIN_GAP_DAYS * DAY_MS) continue;
    if (!best || span > best.span) best = { type, first, last, span };
  }
  if (!best) return null;

  return {
    markerType: best.type,
    earlier: { value: best.first.value, at: new Date(best.first.at).toISOString() },
    latest: { value: best.last.value, at: new Date(best.last.at).toISOString() },
  };
}

/** What /api/user/reflection returns. `enabled` is the route's governance gate. */
export function buildReflectionResponse(rows: ConfirmedRow[], enabled: boolean): { reflection: Reflection | null } {
  if (!enabled) return { reflection: null };
  try {
    return { reflection: pickReflection(rows) };
  } catch {
    return { reflection: null };
  }
}

export function fillCopy(template: string, vars: { type?: string; when?: string }): string {
  return template.replace('{type}', vars.type ?? '').replace('{when}', vars.when ?? '');
}
