// lib/figureClient.ts
//
// Client-side helpers for Figure Continuity (docs/figure-continuity-spec.md
// v0.2, sections 3.1 and 3.4). Pure and dependency-free so they can be unit
// tested without a browser, and safe to import from client components.
//
// Everything here is DEFENSIVE about server input: the response shapes come
// from our own routes, but a stale deploy, a proxy error page or a malformed
// body must degrade to "no figure feature this sitting", never to a crash or
// to rendering something unvetted. Values that reach the screen are only ever
// rendered as React text (never as HTML), and are length-bounded here.

export interface MappingOffer {
  id: number;
  kind: 'person' | 'situation';
  subject: string;
  counterpart: string;
}

export interface FigureArrivalOffer {
  figureLabel: string;
  lineageKey: string;
}

const LABEL_MAX = 200; // generous: the server caps at 60/80/120; this only bounds a bad body

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max = LABEL_MAX): string | null =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max ? v.trim() : null;

/** The `mappingOffer` of a /api/divine response, or null if absent or malformed. */
export function readMappingOffer(data: unknown): MappingOffer | null {
  if (!isRecord(data) || !isRecord(data.mappingOffer)) return null;
  const o = data.mappingOffer;
  const id = o.id;
  const subject = text(o.subject);
  const counterpart = text(o.counterpart);
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return null;
  if (o.kind !== 'person' && o.kind !== 'situation') return null;
  if (!subject || !counterpart) return null;
  return { id, kind: o.kind, subject, counterpart };
}

/** True when the response says the ledger could not hold a pairing this turn (spec G9). */
export function readMappingHeld(data: unknown): boolean {
  return isRecord(data) && data.mappingHeld === false;
}

/** The `figureContinuity` of the arrival lookup (/api/user/history?head=1), or null. */
export function readFigureArrival(data: unknown): FigureArrivalOffer | null {
  if (!isRecord(data) || !isRecord(data.figureContinuity)) return null;
  const figureLabel = text(data.figureContinuity.figureLabel);
  const lineageKey = text(data.figureContinuity.lineageKey, 64);
  if (!figureLabel || !lineageKey) return null;
  return { figureLabel, lineageKey };
}

/**
 * Offer the three-way arrival choice only on the myth the figure is at home in:
 * the capability reports the lineage of the chain a deepen would continue, so a
 * card of any other lineage proceeds exactly as it always has.
 */
export function offersFigureArrival(arrival: FigureArrivalOffer | null, cardLineageKey: string): boolean {
  return !!arrival && typeof cardLineageKey === 'string' && arrival.lineageKey === cardLineageKey;
}

/**
 * The extra fields a /api/divine request carries. Continuing as the figure
 * means continuing the figure's chain, so a Reading turn sends chainAction
 * 'deepen' as well as figureContinue; the server derives the chain itself and
 * evaluates every gate, so this is only ever a request, never a grant. Nothing
 * is added unless the seeker chose to continue AND this is a Reading turn.
 */
export function divineFigureFields(opts: {
  figureContinue?: boolean;
  isReadingMode: boolean;
  chainAction?: 'deepen';
}): { chainAction?: 'deepen'; figureContinue?: true } {
  const out: { chainAction?: 'deepen'; figureContinue?: true } = {};
  if (opts.chainAction) out.chainAction = opts.chainAction;
  if (opts.figureContinue === true && opts.isReadingMode) {
    out.chainAction = 'deepen';
    out.figureContinue = true;
  }
  return out;
}

/** What the seeker's answer resolved to. Kept by the parent so it survives the controls unmounting. */
export type OfferResult = { kind: 'confirmed' } | { kind: 'declined' } | { kind: 'passed' } | { kind: 'cap'; message: string };

export type ConfirmOutcome =
  | { kind: 'confirmed' }
  | { kind: 'noop' }
  | { kind: 'capReached'; message: string }
  | { kind: 'rateLimited' }
  | { kind: 'failed' };

const CAP_FALLBACK = 'The fire keeps only so many pairings at a time. Release one to keep another.';

/** Interpret POST /api/figure-mappings/[id]/confirm. Anything unrecognized is a failure, never a success. */
export function interpretConfirm(status: number, body: unknown): ConfirmOutcome {
  if (status === 429) return { kind: 'rateLimited' };
  if (status === 409 && isRecord(body) && body.outcome === 'capReached') {
    return { kind: 'capReached', message: text(body.message, 300) ?? CAP_FALLBACK };
  }
  if (status === 200 && isRecord(body)) {
    if (body.outcome === 'confirmed') return { kind: 'confirmed' };
    if (body.outcome === 'noop') return { kind: 'noop' };
  }
  return { kind: 'failed' };
}

export type RemoveOutcome = 'removed' | 'gone' | 'failed';

/** Interpret DELETE /api/figure-mappings/[id]?offer=1 ("Not quite"). 404 means it is already gone, which is what the seeker wanted. */
export function interpretRemove(status: number): RemoveOutcome {
  if (status === 200) return 'removed';
  if (status === 404) return 'gone';
  return 'failed';
}
