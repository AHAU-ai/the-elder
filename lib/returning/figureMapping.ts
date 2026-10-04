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
//     scopes every statement by it. Nothing here reads identity from input.
//   - Nothing throws into the reading path (spec G9). A database error is
//     returned as { ok:false, reason:'db_error' } so the caller can name it
//     (held:false) rather than swallow it or fail the reading.
//   - Labels are re-sanitized here on every write; the signal parser is not
//     trusted to have done it (figureMappingLabels.ts).
//
// Concurrency, on the neon HTTP driver (sql.transaction is a batch of
// statements run in one transaction; it cannot branch on an earlier result):
//   - createOffer: DELETE-older-offer + INSERT in one transaction; the partial
//     unique index figure_mapping_one_offer makes a racing second insert fail
//     (-> 'conflict') instead of leaving two live offers.
//   - confirmOffer: a per-user advisory transaction lock, then ONE guarded
//     UPDATE that also checks the cap. The lock serializes a user's concurrent
//     confirms, and READ COMMITTED takes the UPDATE's snapshot after the lock
//     is held, so two confirms (even of different offers) cannot both pass the
//     cap check. First answer wins; a replay updates zero rows.

import { sql } from './db';
import {
  sanitizeLabel,
  SUBJECT_LABEL_MAX,
  COUNTERPART_LABEL_MAX,
  FIGURE_LABEL_MAX,
} from './figureMappingLabels';

export const MAX_CONFIRMED_MAPPINGS = 30;
export const OFFER_TTL_HOURS = 24;

// Advisory-lock namespace for confirmOffer, so the per-user lock key cannot
// collide with any other advisory lock keyed by a bare user id.
const CONFIRM_LOCK_NS = 7301;

export type SubjectKind = 'person' | 'situation';
export type CounterpartBasis = 'corpus' | 'model_report';
export type MappingFailure = 'invalid' | 'duplicate' | 'conflict' | 'db_error';

export interface ChainContext {
  chainId: string;
  lineageKey: string;
  mythTitle: string;
  figureLabel: string;
}

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

// Postgres unique_violation, thrown by the index backstops.
const isUniqueViolation = (err: unknown) => (err as { code?: string } | null)?.code === '23505';

/**
 * Lazily delete this user's unanswered offers older than the TTL. Called at
 * the start of createOffer and confirmOffer; there is no cron. Never throws.
 */
export async function purgeExpiredOffers(userId: number): Promise<void> {
  try {
    await sql`
      DELETE FROM figure_mapping
      WHERE user_id = ${userId}
        AND status = 'offered'
        AND created_at <= now() - make_interval(hours => ${OFFER_TTL_HOURS})
    `;
  } catch (err) {
    console.error('[figureMapping] purgeExpiredOffers failed:', (err as Error)?.message);
  }
}

/**
 * Record a proposed pairing. Deletes any older unconfirmed offer for the same
 * user and chain and inserts this one, atomically. Returns the new row id.
 * A pairing the seeker already confirmed (same subject and counterpart,
 * case-insensitive) is 'duplicate'; losing a race to another offer is
 * 'conflict'. The seeker has not answered anything yet at this point.
 */
export async function createOffer(
  userId: number,
  chain: ChainContext,
  offer: OfferInput
): Promise<CreateOfferResult> {
  const subject = sanitizeLabel(offer.subject, SUBJECT_LABEL_MAX);
  const counterpart = sanitizeLabel(offer.counterpart, COUNTERPART_LABEL_MAX);
  const figure = sanitizeLabel(chain.figureLabel, FIGURE_LABEL_MAX);
  const mythTitle = typeof chain.mythTitle === 'string' ? chain.mythTitle.slice(0, 200) : '';
  if (
    !subject || !counterpart || !figure ||
    (offer.kind !== 'person' && offer.kind !== 'situation') ||
    (offer.basis !== 'corpus' && offer.basis !== 'model_report') ||
    !chain.chainId || !chain.lineageKey
  ) {
    return { ok: false, reason: 'invalid' };
  }
  const passageId = offer.basis === 'corpus' ? (offer.counterpartPassageId ?? null) : null;

  await purgeExpiredOffers(userId);
  try {
    const results = await sql.transaction([
      sql`
        DELETE FROM figure_mapping
        WHERE user_id = ${userId} AND chain_id = ${chain.chainId} AND status = 'offered'
      `,
      sql`
        INSERT INTO figure_mapping
          (user_id, chain_id, lineage_key, myth_title, figure_label, subject_kind,
           subject_label, counterpart_label, counterpart_passage_id, counterpart_basis, status)
        VALUES
          (${userId}, ${chain.chainId}, ${chain.lineageKey}, ${mythTitle}, ${figure}, ${offer.kind},
           ${subject}, ${counterpart}, ${passageId}, ${offer.basis}, 'offered')
        RETURNING id
      `,
    ]);
    const row = (results[1] as Array<{ id: string | number }>)[0];
    if (!row) return { ok: false, reason: 'db_error' };
    return { ok: true, id: Number(row.id) };
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Either the same pairing is already confirmed (figure_mapping_uniq) or a
      // concurrent offer for this chain won the slot (figure_mapping_one_offer).
      const detail = String((err as { constraint?: string; message?: string }).constraint
        ?? (err as Error).message ?? '');
      return { ok: false, reason: detail.includes('figure_mapping_one_offer') ? 'conflict' : 'duplicate' };
    }
    console.error('[figureMapping] createOffer failed:', (err as Error)?.message);
    return { ok: false, reason: 'db_error' };
  }
}

/**
 * The seeker's "That fits". Guarded first-answer-wins: the UPDATE only matches
 * a live, unexpired, still-'offered' row owned by this user, and only while
 * the user is under the cap. Outcomes: 'confirmed' (one row changed), 'noop'
 * (replay, wrong owner, expired, or unknown id -- deliberately indistinguishable),
 * 'capReached' (a live offer exists but the user already holds the maximum;
 * nothing is evicted).
 */
export async function confirmOffer(userId: number, id: number): Promise<ConfirmResult> {
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: true, outcome: 'noop' };
  await purgeExpiredOffers(userId);
  try {
    const results = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(${CONFIRM_LOCK_NS}, ${userId})`,
      sql`
        UPDATE figure_mapping
        SET status = 'confirmed', confirmed_at = now()
        WHERE id = ${id}
          AND user_id = ${userId}
          AND status = 'offered'
          AND created_at > now() - make_interval(hours => ${OFFER_TTL_HOURS})
          AND (SELECT count(*) FROM figure_mapping
               WHERE user_id = ${userId} AND status = 'confirmed') < ${MAX_CONFIRMED_MAPPINGS}
        RETURNING id
      `,
    ]);
    if ((results[1] as unknown[]).length > 0) return { ok: true, outcome: 'confirmed' };

    // Zero rows: classify. A live offer plus a full ledger is the cap; anything
    // else is a neutral no-op. (A race between this read and a concurrent
    // delete only changes which of the two benign answers is returned.)
    const live = await sql`
      SELECT 1 FROM figure_mapping
      WHERE id = ${id} AND user_id = ${userId} AND status = 'offered'
        AND created_at > now() - make_interval(hours => ${OFFER_TTL_HOURS})
    `;
    if (live.length > 0) return { ok: true, outcome: 'capReached' };
    return { ok: true, outcome: 'noop' };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: true, outcome: 'noop' }; // equivalent pairing already confirmed
    console.error('[figureMapping] confirmOffer failed:', (err as Error)?.message);
    return { ok: false, reason: 'db_error' };
  }
}

/** "Not quite": delete the row, only while it is still an offer. No tombstone. */
export async function declineOffer(userId: number, id: number): Promise<CountResult> {
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: true, count: 0 };
  try {
    const rows = await sql`
      DELETE FROM figure_mapping
      WHERE id = ${id} AND user_id = ${userId} AND status = 'offered'
      RETURNING id
    `;
    return { ok: true, count: rows.length };
  } catch (err) {
    console.error('[figureMapping] declineOffer failed:', (err as Error)?.message);
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
    return rows.map(r => ({
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
    }));
  } catch (err) {
    console.error('[figureMapping] listConfirmed failed:', (err as Error)?.message);
    return null;
  }
}

/** Remove one mapping (confirmed or still an offer) the seeker owns. */
export async function removeMapping(userId: number, id: number): Promise<CountResult> {
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: true, count: 0 };
  try {
    const rows = await sql`
      DELETE FROM figure_mapping WHERE id = ${id} AND user_id = ${userId} RETURNING id
    `;
    return { ok: true, count: rows.length };
  } catch (err) {
    console.error('[figureMapping] removeMapping failed:', (err as Error)?.message);
    return { ok: false, reason: 'db_error' };
  }
}

/** Release every mapping and offer for one chain, regardless of status. */
export async function releaseMappingsForChain(userId: number, chainId: string): Promise<CountResult> {
  try {
    const rows = await sql`
      DELETE FROM figure_mapping WHERE user_id = ${userId} AND chain_id = ${chainId} RETURNING id
    `;
    return { ok: true, count: rows.length };
  } catch (err) {
    console.error('[figureMapping] releaseMappingsForChain failed:', (err as Error)?.message);
    return { ok: false, reason: 'db_error' };
  }
}

/** Release every mapping and offer this seeker holds. */
export async function releaseAllMappings(userId: number): Promise<CountResult> {
  try {
    const rows = await sql`DELETE FROM figure_mapping WHERE user_id = ${userId} RETURNING id`;
    return { ok: true, count: rows.length };
  } catch (err) {
    console.error('[figureMapping] releaseAllMappings failed:', (err as Error)?.message);
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
    console.error('[figureMapping] releaseMappingsIfChainEmpty failed:', (err as Error)?.message);
    return { ok: false, reason: 'db_error' };
  }
}
