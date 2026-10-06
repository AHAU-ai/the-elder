// lib/returning/figureMapping.ts
//
// The Figure Continuity ledger (migration 030; docs/figure-continuity-spec.md
// v0.2, section 4). Stores a seeker's CHOSEN pairings of a person/situation in
// their own life with a character in their figure's home myth: minimal,
// per-chain, deletable. It never drafts or infers a pairing -- an offer row is
// created by the divine pipeline (FC-D) and only a seeker's control press
// (confirmOffer) makes it a mapping.
//
// Fail-closed contract:
//   - Every function takes userId from the caller (the signed session) and
//     scopes every statement by it. Nothing here reads identity from input,
//     and a malformed id is refused before it reaches the database.
//   - The CHAIN decides everything about an offer's home. The caller supplies
//     only a chain id; lineage_key, myth_title and the figure label are read
//     from that user's own visit_record rows, so a caller cannot spoof the
//     lineage (G3) or attach an offer to a chain the seeker does not own, to a
//     chain with no confirmed figure, or to a chain that has been released.
//   - A 'corpus' counterpart must be an approved corpus_passage of the chain's
//     own lineage; otherwise the offer is refused (no melting pot).
//   - Nothing throws into the reading path (spec G9). A database error is
//     returned as { ok:false, reason:'db_error' } so the caller can name it
//     (held:false) rather than swallow it or fail the reading. Only the
//     driver's message is logged, never labels or row data (G6).
//   - Labels are re-sanitized here on every write; the signal parser is not
//     trusted to have done it (figureMappingLabels.ts).
//
// Concurrency, on the neon HTTP driver (sql.transaction is a batch of
// statements run in one transaction; it cannot branch on an earlier result).
// createOffer and confirmOffer both take the same per-user advisory
// transaction lock first, which serializes a user's writes: that makes the
// outstanding-offer cap and the confirmed cap strict (not "usually"), and
// READ COMMITTED takes each later statement's snapshot after the lock is
// held. The partial unique index figure_mapping_one_offer stays as the
// database-level backstop for one live offer per chain.

import { sql } from './db';
import { lineageToVoiceKey } from '@/lib/lineageToVoiceKey';
import {
  sanitizeLabel,
  SUBJECT_LABEL_MAX,
  COUNTERPART_LABEL_MAX,
  FIGURE_LABEL_MAX,
} from './figureMappingLabels';

export const MAX_CONFIRMED_MAPPINGS = 30;
export const MAX_OUTSTANDING_OFFERS = 20;
export const OFFER_TTL_HOURS = 24;

// Advisory-lock namespace, so the per-user lock key cannot collide with any
// other advisory lock keyed by a bare user id.
const USER_LOCK_NS = 7301;
// pg_advisory_xact_lock(bigint): namespace in the high bits, user id below.
const LOCK_NS_SHIFT = 4294967296;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PASSAGE_ID_MAX = 200;
const CHAIN_SCAN_LIMIT = 100;

export type SubjectKind = 'person' | 'situation';
export type CounterpartBasis = 'corpus' | 'model_report';
export type MappingFailure =
  | 'invalid'     // malformed input, or a corpus counterpart that is not approved and in-lineage
  | 'no_chain'    // no such chain for this user (never existed, someone else's, or released)
  | 'no_figure'   // the chain holds no confirmed figure
  | 'limit'       // too many outstanding offers
  | 'duplicate'   // this pairing is already confirmed
  | 'conflict'    // lost a write race the lock did not cover
  | 'db_error';

export interface OfferInput {
  kind: SubjectKind;
  subject: string;
  counterpart: string;
  basis: CounterpartBasis;
  counterpartPassageId?: string | null;
}

export interface FigureMapping {
  id: number;
  chainId: string;
  lineageKey: string;
  mythTitle: string;
  figureLabel: string;
  subjectKind: SubjectKind;
  subjectLabel: string;
  counterpartLabel: string;
  counterpartBasis: CounterpartBasis;
  confirmedAt: string;
}

export type CreateOfferResult = { ok: true; id: number } | { ok: false; reason: MappingFailure };
export type ConfirmResult =
  | { ok: true; outcome: 'confirmed' | 'noop' | 'capReached' }
  | { ok: false; reason: 'db_error' };
export type CountResult = { ok: true; count: number } | { ok: false; reason: 'db_error' };

const validUserId = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n > 0;
const validRowId = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n > 0;
const validChainId = (s: unknown): s is string => typeof s === 'string' && UUID_RE.test(s);

// Postgres unique_violation, thrown by the index backstops.
const isUniqueViolation = (err: unknown) => (err as { code?: string } | null)?.code === '23505';

// Postgres undefined_table. The release paths call this ledger from routes that
// predate migration 030, and a release must never fail because the optional
// feature's table has not been created in that environment yet: no table means
// no mappings, so there is nothing to release.
const isMissingTable = (err: unknown) => (err as { code?: string } | null)?.code === '42P01';

function toMapping(r: Record<string, unknown>): FigureMapping {
  return {
    id: Number(r.id),
    chainId: String(r.chain_id),
    lineageKey: String(r.lineage_key),
    mythTitle: String(r.myth_title),
    figureLabel: String(r.figure_label),
    subjectKind: r.subject_kind as SubjectKind,
    subjectLabel: String(r.subject_label),
    counterpartLabel: String(r.counterpart_label),
    counterpartBasis: r.counterpart_basis as CounterpartBasis,
    confirmedAt: new Date(r.confirmed_at as string).toISOString(),
  };
}

/** Log the driver's message only: never labels, never row data. */
const logFailure = (where: string, err: unknown) =>
  console.error(`[figureMapping] ${where} failed:`, (err as Error)?.message);

/**
 * Lazily delete this user's unanswered offers older than the TTL. Called at
 * the start of createOffer and confirmOffer; there is no cron. Never throws.
 */
export async function purgeExpiredOffers(userId: number): Promise<void> {
  if (!validUserId(userId)) return;
  try {
    await sql`
      DELETE FROM figure_mapping
      WHERE user_id = ${userId}
        AND status = 'offered'
        AND created_at <= now() - make_interval(hours => ${OFFER_TTL_HOURS})
    `;
  } catch (err) {
    logFailure('purgeExpiredOffers', err);
  }
}

export interface ChainFigure {
  lineageKey: string;
  mythTitle: string;
  figureLabel: string;
}
export type ChainFigureResult =
  | ({ ok: true } & ChainFigure)
  | { ok: false; reason: 'invalid' | 'no_chain' | 'no_figure' | 'db_error' };

/**
 * A chain as this seeker's own visits describe it: the lineage and myth title
 * of its newest visit, and the newest confirmed figure (markers_confirmed). The
 * single source for "the figure's home chain" -- used by createOffer and by the
 * Figure Continuity context assembler (lib/returning/figureContinuity.ts), so
 * both agree on what a home chain is. Scoped to the user; never throws.
 */
export async function readChainFigure(userId: number, chainId: string): Promise<ChainFigureResult> {
  if (!validUserId(userId) || !validChainId(chainId)) return { ok: false, reason: 'invalid' };
  try {
    const visits = await sql`
      SELECT lineage_key, myth_title, archetype, markers_confirmed ->> 'figure' AS figure
      FROM visit_record
      WHERE user_id = ${userId} AND chain_id = ${chainId}
      ORDER BY depth DESC, created_at DESC
      LIMIT ${CHAIN_SCAN_LIMIT}
    `;
    if (visits.length === 0) return { ok: false, reason: 'no_chain' };
    let figureLabel: string | null = null;
    for (const v of visits) {
      figureLabel = sanitizeLabel(v.figure, FIGURE_LABEL_MAX);
      if (figureLabel) break;
    }
    if (!figureLabel) return { ok: false, reason: 'no_figure' };
    return {
      ok: true,
      lineageKey: String(visits[0].lineage_key),
      mythTitle: String(visits[0].myth_title || visits[0].archetype || '').slice(0, 200),
      figureLabel,
    };
  } catch (err) {
    logFailure('readChainFigure', err);
    return { ok: false, reason: 'db_error' };
  }
}

/**
 * Record a proposed pairing on one of the seeker's own chains. Deletes any
 * older unconfirmed offer for the same user and chain and inserts this one,
 * atomically. Returns the new row id.
 *
 * The chain id is the only chain input. Lineage, myth title and figure label
 * are read from the seeker's own visit rows; the chain must exist for this
 * user and hold a confirmed figure ('no_chain' / 'no_figure'). A pairing the
 * seeker already confirmed (same subject and counterpart, case-insensitive)
 * is 'duplicate'. The seeker has not answered anything at this point.
 */
export async function createOffer(
  userId: number,
  chainId: string,
  offer: OfferInput
): Promise<CreateOfferResult> {
  const subject = sanitizeLabel(offer?.subject, SUBJECT_LABEL_MAX);
  const counterpart = sanitizeLabel(offer?.counterpart, COUNTERPART_LABEL_MAX);
  if (
    !validUserId(userId) || !validChainId(chainId) || !subject || !counterpart ||
    (offer.kind !== 'person' && offer.kind !== 'situation') ||
    (offer.basis !== 'corpus' && offer.basis !== 'model_report')
  ) {
    return { ok: false, reason: 'invalid' };
  }
  const requestedPassage =
    offer.basis === 'corpus' && typeof offer.counterpartPassageId === 'string'
      ? offer.counterpartPassageId
      : null;
  if (offer.basis === 'corpus' && (!requestedPassage || requestedPassage.length > PASSAGE_ID_MAX)) {
    return { ok: false, reason: 'invalid' };
  }

  await purgeExpiredOffers(userId);
  try {
    // The chain, as this seeker's own visits describe it.
    const chain = await readChainFigure(userId, chainId);
    // tsconfig is not strict, so `.ok` does not narrow the union; cast explicitly.
    if (!chain.ok) return { ok: false, reason: (chain as { reason: MappingFailure }).reason };
    const { lineageKey, mythTitle, figureLabel } = chain as ChainFigure;

    // A 'corpus' counterpart must be an approved, open passage of this chain's
    // own voice. The chain stores the visit vocabulary (lineage_key, e.g.
    // 'norse') while corpus_passage.lineage_key holds voice keys (e.g. 'volva');
    // comparing them directly would refuse every real corpus counterpart.
    let passageId: string | null = null;
    if (requestedPassage) {
      const ok = await sql`
        SELECT 1 FROM corpus_passage
        WHERE passage_id = ${requestedPassage}
          AND review_status = 'approved'
          AND ceremonial_sensitivity = 'open'
          AND lineage_key = ${lineageToVoiceKey(lineageKey)}
      `;
      if (ok.length === 0) return { ok: false, reason: 'invalid' };
      passageId = requestedPassage;
    }

    const results = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(${USER_LOCK_NS}::bigint * ${LOCK_NS_SHIFT}::bigint + ${userId}::bigint)`,
      sql`
        DELETE FROM figure_mapping
        WHERE user_id = ${userId} AND chain_id = ${chainId} AND status = 'offered'
      `,
      sql`
        INSERT INTO figure_mapping
          (user_id, chain_id, lineage_key, myth_title, figure_label, subject_kind,
           subject_label, counterpart_label, counterpart_passage_id, counterpart_basis, status)
        SELECT ${userId}, ${chainId}, ${lineageKey}, ${mythTitle}, ${figureLabel}, ${offer.kind},
               ${subject}, ${counterpart}, ${passageId}, ${offer.basis}, 'offered'
        WHERE EXISTS (SELECT 1 FROM visit_record WHERE user_id = ${userId} AND chain_id = ${chainId})
          AND (SELECT count(*) FROM figure_mapping
               WHERE user_id = ${userId} AND status = 'offered') < ${MAX_OUTSTANDING_OFFERS}
        RETURNING id
      `,
    ]);
    const row = (results[2] as Array<{ id: string | number }>)[0];
    if (row) return { ok: true, id: Number(row.id) };

    // Zero rows inserted: the chain vanished since the read above, or the
    // seeker is at the outstanding-offer cap. Say which.
    const stillThere = await sql`SELECT 1 FROM visit_record WHERE user_id = ${userId} AND chain_id = ${chainId} LIMIT 1`;
    return { ok: false, reason: stillThere.length === 0 ? 'no_chain' : 'limit' };
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Either the same pairing is already confirmed (figure_mapping_uniq) or a
      // concurrent offer for this chain won the slot (figure_mapping_one_offer).
      const detail = String((err as { constraint?: string; message?: string }).constraint
        ?? (err as Error).message ?? '');
      return { ok: false, reason: detail.includes('figure_mapping_one_offer') ? 'conflict' : 'duplicate' };
    }
    logFailure('createOffer', err);
    return { ok: false, reason: 'db_error' };
  }
}

/**
 * The seeker's "That fits". Guarded first-answer-wins: the UPDATE only matches
 * a live, unexpired, still-'offered' row owned by this user whose chain still
 * exists, and only while the user is under the cap. Outcomes: 'confirmed' (one
 * row changed), 'noop' (replay, wrong owner, expired, released chain, or unknown
 * id -- deliberately indistinguishable), 'capReached' (a live offer exists but
 * the user already holds the maximum; nothing is evicted).
 */
export async function confirmOffer(userId: number, id: number): Promise<ConfirmResult> {
  if (!validUserId(userId) || !validRowId(id)) return { ok: true, outcome: 'noop' };
  await purgeExpiredOffers(userId);
  try {
    const results = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(${USER_LOCK_NS}::bigint * ${LOCK_NS_SHIFT}::bigint + ${userId}::bigint)`,
      sql`
        UPDATE figure_mapping fm
        SET status = 'confirmed', confirmed_at = now()
        WHERE fm.id = ${id}
          AND fm.user_id = ${userId}
          AND fm.status = 'offered'
          AND fm.created_at > now() - make_interval(hours => ${OFFER_TTL_HOURS})
          AND EXISTS (SELECT 1 FROM visit_record v
                      WHERE v.user_id = fm.user_id AND v.chain_id = fm.chain_id)
          AND (SELECT count(*) FROM figure_mapping
               WHERE user_id = ${userId} AND status = 'confirmed') < ${MAX_CONFIRMED_MAPPINGS}
        RETURNING fm.id
      `,
    ]);
    if ((results[1] as unknown[]).length > 0) return { ok: true, outcome: 'confirmed' };

    // Zero rows: classify. A live offer on a live chain plus a full ledger is
    // the cap; anything else is a neutral no-op. (A race between this read and
    // a concurrent delete only changes which of the two benign answers returns.)
    const live = await sql`
      SELECT 1 FROM figure_mapping fm
      WHERE fm.id = ${id} AND fm.user_id = ${userId} AND fm.status = 'offered'
        AND fm.created_at > now() - make_interval(hours => ${OFFER_TTL_HOURS})
        AND EXISTS (SELECT 1 FROM visit_record v WHERE v.user_id = fm.user_id AND v.chain_id = fm.chain_id)
    `;
    if (live.length > 0) return { ok: true, outcome: 'capReached' };
    return { ok: true, outcome: 'noop' };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: true, outcome: 'noop' }; // equivalent pairing already confirmed
    logFailure('confirmOffer', err);
    return { ok: false, reason: 'db_error' };
  }
}

/** "Not quite": delete the row, only while it is still an offer. No tombstone. */
export async function declineOffer(userId: number, id: number): Promise<CountResult> {
  if (!validUserId(userId) || !validRowId(id)) return { ok: true, count: 0 };
  try {
    const rows = await sql`
      DELETE FROM figure_mapping
      WHERE id = ${id} AND user_id = ${userId} AND status = 'offered'
      RETURNING id
    `;
    return { ok: true, count: rows.length };
  } catch (err) {
    logFailure('declineOffer', err);
    return { ok: false, reason: 'db_error' };
  }
}

/**
 * Confirmed mappings for ONE chain, newest first. The chain scope is the
 * structural lineage lock (spec G10): there is no way to ask this function for
 * mappings across chains. Returns null on a database error so the caller can
 * tell "none" from "could not read" (spec G9).
 */
export async function listConfirmed(
  userId: number,
  chainId: string,
  limit: number
): Promise<FigureMapping[] | null> {
  if (!validUserId(userId) || !validChainId(chainId)) return [];
  const cap = Math.max(1, Math.min(Math.floor(limit) || 1, MAX_CONFIRMED_MAPPINGS));
  try {
    const rows = await sql`
      SELECT id, chain_id, lineage_key, myth_title, figure_label, subject_kind,
             subject_label, counterpart_label, counterpart_basis, confirmed_at
      FROM figure_mapping
      WHERE user_id = ${userId} AND chain_id = ${chainId} AND status = 'confirmed'
      ORDER BY confirmed_at DESC, id DESC
      LIMIT ${cap}
    `;
    return rows.map(toMapping);
  } catch (err) {
    logFailure('listConfirmed', err);
    return null;
  }
}

/**
 * Every confirmed mapping the seeker holds, newest first, for the seeker's OWN
 * view (FC-F) and the mappings route. Never used to build a prompt (spec G10:
 * prompts only ever see one chain's mappings, via listConfirmed). Only mappings
 * whose chain still has visits are returned, so anything stranded by a release
 * that predates cleanup is not shown. Null on a database error.
 */
export async function listAllConfirmed(userId: number, limit: number): Promise<FigureMapping[] | null> {
  if (!validUserId(userId)) return [];
  const cap = Math.max(1, Math.min(Math.floor(limit) || 1, MAX_CONFIRMED_MAPPINGS));
  try {
    const rows = await sql`
      SELECT fm.id, fm.chain_id, fm.lineage_key, fm.myth_title, fm.figure_label, fm.subject_kind,
             fm.subject_label, fm.counterpart_label, fm.counterpart_basis, fm.confirmed_at
      FROM figure_mapping fm
      WHERE fm.user_id = ${userId} AND fm.status = 'confirmed'
        AND EXISTS (SELECT 1 FROM visit_record v WHERE v.user_id = fm.user_id AND v.chain_id = fm.chain_id)
      ORDER BY fm.confirmed_at DESC, fm.id DESC
      LIMIT ${cap}
    `;
    return rows.map(toMapping);
  } catch (err) {
    logFailure('listAllConfirmed', err);
    return null;
  }
}

/** Remove one mapping (confirmed or still an offer) the seeker owns. */
export async function removeMapping(userId: number, id: number): Promise<CountResult> {
  if (!validUserId(userId) || !validRowId(id)) return { ok: true, count: 0 };
  try {
    const rows = await sql`
      DELETE FROM figure_mapping WHERE id = ${id} AND user_id = ${userId} RETURNING id
    `;
    return { ok: true, count: rows.length };
  } catch (err) {
    logFailure('removeMapping', err);
    return { ok: false, reason: 'db_error' };
  }
}

/** Release every mapping and offer for one chain, regardless of status. */
export async function releaseMappingsForChain(userId: number, chainId: string): Promise<CountResult> {
  if (!validUserId(userId) || !validChainId(chainId)) return { ok: true, count: 0 };
  try {
    const rows = await sql`
      DELETE FROM figure_mapping WHERE user_id = ${userId} AND chain_id = ${chainId} RETURNING id
    `;
    return { ok: true, count: rows.length };
  } catch (err) {
    if (isMissingTable(err)) return { ok: true, count: 0 };
    logFailure('releaseMappingsForChain', err);
    return { ok: false, reason: 'db_error' };
  }
}

/** Release every mapping and offer this seeker holds. */
export async function releaseAllMappings(userId: number): Promise<CountResult> {
  if (!validUserId(userId)) return { ok: true, count: 0 };
  try {
    const rows = await sql`DELETE FROM figure_mapping WHERE user_id = ${userId} RETURNING id`;
    return { ok: true, count: rows.length };
  } catch (err) {
    if (isMissingTable(err)) return { ok: true, count: 0 };
    logFailure('releaseAllMappings', err);
    return { ok: false, reason: 'db_error' };
  }
}

/**
 * Decision D9: releasing a single reading that leaves its chain with no
 * visits deletes that chain's mappings (they hold third-party descriptions,
 * and release signals the seeker wants it gone). One statement, so a visit
 * created concurrently keeps the chain's mappings alive.
 */
export async function releaseMappingsIfChainEmpty(userId: number, chainId: string): Promise<CountResult> {
  if (!validUserId(userId) || !validChainId(chainId)) return { ok: true, count: 0 };
  try {
    const rows = await sql`
      DELETE FROM figure_mapping fm
      WHERE fm.user_id = ${userId} AND fm.chain_id = ${chainId}
        AND NOT EXISTS (
          SELECT 1 FROM visit_record v WHERE v.user_id = ${userId} AND v.chain_id = ${chainId}
        )
      RETURNING fm.id
    `;
    return { ok: true, count: rows.length };
  } catch (err) {
    if (isMissingTable(err)) return { ok: true, count: 0 };
    logFailure('releaseMappingsIfChainEmpty', err);
    return { ok: false, reason: 'db_error' };
  }
}
