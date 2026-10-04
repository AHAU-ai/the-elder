/**
 * thresholdLetterLedger.ts
 *
 * Persists the Threshold Letter — the four-line closing sequence
 * (volatilization / return / gift / image) a seeker is given when they
 * choose to keep it — keyed by user. Only written on that deliberate
 * "Keep This Gift" gesture, never silently on every completed reading;
 * a returning seeker's kept letters, newest first, up to 20 per user —
 * the oldest is evicted to make room.
 *
 * Fails closed like mythLedger.ts / consentLedger.ts: any DB error here
 * must never break the closing screen it's attached to, so callers wrap
 * these in try/catch and swallow failures.
 */

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

// Lazy, not module-top-level `const sql = neon(...)` like this repo's other
// ledger files: this file also exports pure logic
// (isEligibleForEmailDelivery + the DELIVERY_DELAY_DAYS/MAX_EMAIL_ATTEMPTS
// constants) that lib/thresholdLetterLedger.test.ts imports directly.
// `neon()` throws immediately if DATABASE_URL is unset, so a
// module-top-level call would make importing this file for its pure
// functions alone require a live database connection string — which a
// unit test run (`npx tsx lib/thresholdLetterLedger.test.ts`, no DB
// involved) shouldn't need. Every DB-touching function below still
// behaves exactly as before; only the *timing* of the neon() call moved
// from import-time to first-use.
let _sql: NeonQueryFunction<false, false> | null = null;
function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  if (!_sql) _sql = neon(process.env.DATABASE_URL!);
  return _sql(strings, ...values);
}
sql.transaction = (queries: any[]) => {
  if (!_sql) _sql = neon(process.env.DATABASE_URL!);
  return (_sql as any).transaction(queries);
};

import { DEFAULT_LETTER_DELAY_DAYS, parseLetterDelay, type LetterDelayDays } from './letterDelay';

const MAX_LETTERS_PER_USER = 20;

export interface ThresholdLetterEntry {
  id: number;
  lineageKey: string;
  volatilizationPhrase: string;
  returnPhrase: string;
  returnGift: string;
  thresholdImage: string;
  createdAt: string;
  marker: string | null;
}

function rowToEntry(row: any): ThresholdLetterEntry {
  return {
    id: Number(row.id),
    lineageKey: row.lineage_key,
    volatilizationPhrase: row.volatilization_phrase,
    returnPhrase: row.return_phrase,
    returnGift: row.return_gift,
    thresholdImage: row.threshold_image,
    createdAt: row.created_at,
    marker: row.marker,
  };
}

// ── Delayed email delivery (migrations/016) ─────────────────────────────
//
// A kept Threshold Letter is eligible to be emailed back to its seeker
// once it's old enough (DELIVERY_DELAY_DAYS) and hasn't already been sent
// or exhausted its retry budget. Pulled out as a pure function — no DB,
// no Date.now() internally — so the actual decision logic has a unit test
// (lib/thresholdLetterLedger.test.ts) independent of a live database.
export const DELIVERY_DELAY_DAYS = DEFAULT_LETTER_DELAY_DAYS;
export const MAX_EMAIL_ATTEMPTS = 5;

export interface DeliveryCandidate {
  createdAt: Date;
  /** This letter's own promised delay (snapshot taken when it was kept, migration 028). null = the original DELIVERY_DELAY_DAYS. */
  deliveryDelayDays?: number | null;
  deliveryEmailSentAt: Date | null;
  emailAttempts: number;
}

export function isEligibleForEmailDelivery(letter: DeliveryCandidate, now: Date): boolean {
  if (letter.deliveryEmailSentAt) return false;
  if (letter.emailAttempts >= MAX_EMAIL_ATTEMPTS) return false;
  const delay = parseLetterDelay(letter.deliveryDelayDays) ?? DELIVERY_DELAY_DAYS;
  const dueAt = letter.createdAt.getTime() + delay * 24 * 60 * 60 * 1000;
  return now.getTime() >= dueAt;
}

export interface DeliveryRow extends DeliveryCandidate {
  id: number;
  userId: number;
  email: string;
  lineageKey: string;
  returnGift: string;
  thresholdImage: string;
}

/**
 * Letters kept by a user who has opted into email delivery
 * (elder_user.letters_by_email), old enough to be due, not yet sent, and
 * under the retry cap. The delay/attempts filtering happens in SQL for
 * the bulk of it (cheap, index-backed via
 * threshold_letter_delivery_pending_idx) but every row is re-checked
 * through isEligibleForEmailDelivery() before sending — the SQL WHERE
 * clause and the pure function must never be allowed to silently diverge.
 */
export async function getLettersDueForEmailDelivery(now: Date = new Date()): Promise<DeliveryRow[]> {
  const rows = await sql`
    SELECT tl.id, tl.user_id, eu.email, tl.lineage_key, tl.return_gift, tl.threshold_image,
           tl.created_at, tl.delivery_email_sent_at, tl.email_attempts, tl.delivery_delay_days
    FROM threshold_letter tl
    JOIN elder_user eu ON eu.id = tl.user_id
    WHERE tl.delivery_email_sent_at IS NULL
      AND tl.email_attempts < ${MAX_EMAIL_ATTEMPTS}
      AND eu.letters_by_email = true
      AND tl.created_at + make_interval(days => COALESCE(tl.delivery_delay_days, ${DELIVERY_DELAY_DAYS}::int)::int) <= ${now.toISOString()}::timestamptz
    ORDER BY tl.created_at ASC
    LIMIT 200
  `;
  return rows
    .map((row: any) => ({
      id: Number(row.id),
      userId: Number(row.user_id),
      email: row.email,
      lineageKey: row.lineage_key,
      returnGift: row.return_gift,
      thresholdImage: row.threshold_image,
      createdAt: new Date(row.created_at),
      deliveryEmailSentAt: row.delivery_email_sent_at ? new Date(row.delivery_email_sent_at) : null,
      emailAttempts: Number(row.email_attempts),
      deliveryDelayDays: row.delivery_delay_days === null || row.delivery_delay_days === undefined ? null : Number(row.delivery_delay_days),
    }))
    .filter((row: DeliveryRow) => isEligibleForEmailDelivery(row, now));
}

export async function markLetterEmailSent(letterId: number): Promise<void> {
  await sql`UPDATE threshold_letter SET delivery_email_sent_at = now() WHERE id = ${letterId}`;
}

export async function markLetterEmailAttemptFailed(letterId: number): Promise<void> {
  await sql`UPDATE threshold_letter SET email_attempts = email_attempts + 1 WHERE id = ${letterId}`;
}

export interface LetterEmailPreference {
  /** Whether kept letters are emailed back at all. Explicit opt-in; never inferred. */
  enabled: boolean;
  /** The delay for letters kept from now on. Always a member of the closed set. */
  delayDays: LetterDelayDays;
}

/**
 * Set the seeker's letter-email preference. `enabled` alone leaves the saved
 * delay untouched; a delay alone leaves `enabled` untouched. Turning email off
 * stops every pending letter at once (the sweep is gated on letters_by_email),
 * whatever delay each was promised.
 */
export async function setLetterEmailPreference(
  userId: number,
  update: { enabled?: boolean; delayDays?: LetterDelayDays }
): Promise<void> {
  if (update.enabled !== undefined) {
    await sql`UPDATE elder_user SET letters_by_email = ${update.enabled} WHERE id = ${userId}`;
  }
  if (update.delayDays !== undefined) {
    await sql`UPDATE elder_user SET letters_email_delay_days = ${update.delayDays} WHERE id = ${userId}`;
  }
}

export async function getLetterEmailPreference(userId: number): Promise<LetterEmailPreference> {
  const rows = await sql`SELECT letters_by_email, letters_email_delay_days FROM elder_user WHERE id = ${userId}`;
  return {
    enabled: rows[0]?.letters_by_email === true,
    delayDays: parseLetterDelay(rows[0]?.letters_email_delay_days) ?? DEFAULT_LETTER_DELAY_DAYS,
  };
}

/** All kept Threshold Letters for a user, newest-first. */
export async function getUserThresholdLetters(userId: number): Promise<ThresholdLetterEntry[]> {
  const rows = await sql`
    SELECT id, lineage_key, volatilization_phrase, return_phrase, return_gift, threshold_image, created_at, marker
    FROM threshold_letter
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${MAX_LETTERS_PER_USER}
  `;
  return rows.map(rowToEntry);
}

/**
 * Save a kept Threshold Letter for a user, evicting the oldest (by
 * created_at) first if already at the cap. Each keep is its own row —
 * unlike myth_archetype, letters are not merged/deepened over time,
 * since each one closes a specific reading.
 */
export async function saveThresholdLetter(
  userId: number,
  lineageKey: string,
  volatilizationPhrase: string,
  returnPhrase: string,
  returnGift: string,
  thresholdImage: string,
  marker: string | null = null,
  chainId: string | null = null,
  // §Tiered Membership: Kept keeps MAX_LETTERS_PER_USER (20, spec cap);
  // Council passes null for "higher/no cap" -- skips the trim query
  // entirely rather than passing an arbitrarily large LIMIT, so Council
  // truly has no eviction, not just a cap nobody expects to hit.
  maxLetters: number | null = MAX_LETTERS_PER_USER
): Promise<number | null> {
  const gift = returnGift.trim();
  if (!gift) return null;

  const insert = sql`
    INSERT INTO threshold_letter
      (user_id, lineage_key, volatilization_phrase, return_phrase, return_gift, threshold_image, marker, chain_id, delivery_delay_days)
    VALUES
      (${userId}, ${lineageKey}, ${volatilizationPhrase}, ${returnPhrase}, ${gift}, ${thresholdImage}, ${marker}, ${chainId},
       -- snapshot of the seeker's chosen delay at the moment of keeping (migration 028)
       (SELECT letters_email_delay_days FROM elder_user WHERE id = ${userId}))
    RETURNING id
  `;

  const idOf = (rows: any): number | null => {
    const id = Number(rows?.[0]?.id);
    return Number.isInteger(id) && id > 0 ? id : null;
  };

  if (maxLetters === null) {
    return idOf(await insert);
  }

  // Insert-then-trim-excess in one transaction so concurrent callers for the
  // same user can't both pass a stale count check and push the row count
  // past maxLetters (the previous count/delete/insert as separate
  // round-trips was racy under concurrent requests).
  const results = await sql.transaction([
    insert,
    sql`
      DELETE FROM threshold_letter
      WHERE user_id = ${userId}
        AND id NOT IN (
          SELECT id FROM threshold_letter
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT ${maxLetters}
        )
    `,
  ]);
  return idOf(results?.[0]);
}

/**
 * Give one just-kept letter the delay the seeker chose for it right after
 * keeping it (the choice row offered at the moment of keeping). Scoped to the
 * seeker's own letter and only while it is still unsent, so it can never move
 * a letter that has already gone out or touch anyone else's.
 */
export async function setLetterDeliveryDelay(userId: number, letterId: number, delayDays: LetterDelayDays): Promise<boolean> {
  const rows = await sql`
    UPDATE threshold_letter
    SET delivery_delay_days = ${delayDays}
    WHERE id = ${letterId} AND user_id = ${userId} AND delivery_email_sent_at IS NULL
    RETURNING id
  `;
  return rows.length > 0;
}
