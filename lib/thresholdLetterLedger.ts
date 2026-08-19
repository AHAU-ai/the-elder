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
export const DELIVERY_DELAY_DAYS = 3;
export const MAX_EMAIL_ATTEMPTS = 5;

export interface DeliveryCandidate {
  createdAt: Date;
  deliveryEmailSentAt: Date | null;
  emailAttempts: number;
}

export function isEligibleForEmailDelivery(letter: DeliveryCandidate, now: Date): boolean {
  if (letter.deliveryEmailSentAt) return false;
  if (letter.emailAttempts >= MAX_EMAIL_ATTEMPTS) return false;
  const dueAt = letter.createdAt.getTime() + DELIVERY_DELAY_DAYS * 24 * 60 * 60 * 1000;
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
           tl.created_at, tl.delivery_email_sent_at, tl.email_attempts
    FROM threshold_letter tl
    JOIN elder_user eu ON eu.id = tl.user_id
    WHERE tl.delivery_email_sent_at IS NULL
      AND tl.email_attempts < ${MAX_EMAIL_ATTEMPTS}
      AND eu.letters_by_email = true
      AND tl.created_at <= ${now.toISOString()}::timestamptz - (${DELIVERY_DELAY_DAYS} || ' days')::interval
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
    }))
    .filter((row: DeliveryRow) => isEligibleForEmailDelivery(row, now));
}

export async function markLetterEmailSent(letterId: number): Promise<void> {
  await sql`UPDATE threshold_letter SET delivery_email_sent_at = now() WHERE id = ${letterId}`;
}

export async function markLetterEmailAttemptFailed(letterId: number): Promise<void> {
  await sql`UPDATE threshold_letter SET email_attempts = email_attempts + 1 WHERE id = ${letterId}`;
}

export async function setLettersByEmail(userId: number, enabled: boolean): Promise<void> {
  await sql`UPDATE elder_user SET letters_by_email = ${enabled} WHERE id = ${userId}`;
}

export async function getLettersByEmail(userId: number): Promise<boolean> {
  const rows = await sql`SELECT letters_by_email FROM elder_user WHERE id = ${userId}`;
  return rows[0]?.letters_by_email === true;
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
  chainId: string | null = null
): Promise<void> {
  const gift = returnGift.trim();
  if (!gift) return;

  // Insert-then-trim-excess in one transaction so concurrent callers for the
  // same user can't both pass a stale count check and push the row count
  // past MAX_LETTERS_PER_USER (the previous count/delete/insert as separate
  // round-trips was racy under concurrent requests).
  await sql.transaction([
    sql`
      INSERT INTO threshold_letter
        (user_id, lineage_key, volatilization_phrase, return_phrase, return_gift, threshold_image, marker, chain_id)
      VALUES
        (${userId}, ${lineageKey}, ${volatilizationPhrase}, ${returnPhrase}, ${gift}, ${thresholdImage}, ${marker}, ${chainId})
    `,
    sql`
      DELETE FROM threshold_letter
      WHERE user_id = ${userId}
        AND id NOT IN (
          SELECT id FROM threshold_letter
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT ${MAX_LETTERS_PER_USER}
        )
    `,
  ]);
}
