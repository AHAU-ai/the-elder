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

// ── the seeker's own pairings view (FC-F, spec 3.6) ─────────────────────────

/** Whether the server says to show the pairings view and its link (/api/auth/me). Absent while the feature is dark. */
export function readPairingsCapability(data: unknown): boolean {
  return isRecord(data) && isRecord(data.figureContinuity) && data.figureContinuity.pairings === true;
}

export interface PairingRow {
  id: number;
  chainId: string;
  lineageKey: string;
  mythTitle: string;
  figureLabel: string;
  subjectKind: 'person' | 'situation';
  subjectLabel: string;
  counterpartLabel: string;
  counterpartBasis: 'corpus' | 'model_report';
  confirmedAt: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readPairingRow(v: unknown): PairingRow | null {
  if (!isRecord(v)) return null;
  const id = v.id;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) return null;
  if (typeof v.chainId !== 'string' || !UUID_RE.test(v.chainId)) return null;
  if (v.subjectKind !== 'person' && v.subjectKind !== 'situation') return null;
  if (v.counterpartBasis !== 'corpus' && v.counterpartBasis !== 'model_report') return null;
  const subjectLabel = text(v.subjectLabel);
  const counterpartLabel = text(v.counterpartLabel);
  const figureLabel = text(v.figureLabel);
  const lineageKey = text(v.lineageKey, 64);
  if (!subjectLabel || !counterpartLabel || !figureLabel || !lineageKey) return null;
  const confirmedAt = typeof v.confirmedAt === 'string' && !Number.isNaN(Date.parse(v.confirmedAt)) ? v.confirmedAt : null;
  if (!confirmedAt) return null;
  // The myth title is display-only and may be empty (a chain with no archetype yet).
  const mythTitle = typeof v.mythTitle === 'string' && v.mythTitle.length <= LABEL_MAX ? v.mythTitle.trim() : '';
  return { id, chainId: v.chainId, lineageKey, mythTitle, figureLabel, subjectKind: v.subjectKind, subjectLabel, counterpartLabel, counterpartBasis: v.counterpartBasis, confirmedAt };
}

/**
 * The `mappings` of GET /api/figure-mappings. Returns null if the body is not the expected shape (the
 * page then says it could not read, rather than showing an empty list that looks like "nothing kept").
 * A row that fails validation is skipped and counted, so the page can say so instead of hiding it.
 */
export function readPairings(data: unknown): { rows: PairingRow[]; skipped: number } | null {
  if (!isRecord(data) || !Array.isArray(data.mappings)) return null;
  const rows: PairingRow[] = [];
  let skipped = 0;
  for (const raw of data.mappings) {
    const row = readPairingRow(raw);
    if (row) rows.push(row); else skipped++;
  }
  return { rows, skipped };
}

export interface PairingGroup {
  chainId: string;
  lineageKey: string;
  mythTitle: string;
  figureLabel: string;
  rows: PairingRow[];
}

/** Group by chain (a pairing belongs to one telling of one myth), newest first at both levels. */
export function groupPairings(rows: PairingRow[]): PairingGroup[] {
  const newest = (r: PairingRow) => Date.parse(r.confirmedAt) || 0;
  const byChain = new Map<string, PairingGroup>();
  for (const row of [...rows].sort((a, b) => newest(b) - newest(a) || b.id - a.id)) {
    let g = byChain.get(row.chainId);
    if (!g) {
      g = { chainId: row.chainId, lineageKey: row.lineageKey, mythTitle: row.mythTitle, figureLabel: row.figureLabel, rows: [] };
      byChain.set(row.chainId, g);
    }
    g.rows.push(row);
  }
  return [...byChain.values()];
}

export type ReleaseOutcome = { kind: 'released'; count: number } | { kind: 'failed' };

/** Interpret DELETE /api/figure-mappings/release. Anything unrecognized is a failure: never report a release that did not happen. */
export function interpretRelease(status: number, body: unknown): ReleaseOutcome {
  if (status === 200 && isRecord(body) && typeof body.released === 'number' && Number.isSafeInteger(body.released) && body.released >= 0) {
    return { kind: 'released', count: body.released };
  }
  return { kind: 'failed' };
}
