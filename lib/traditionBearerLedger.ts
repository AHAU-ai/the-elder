/**
 * traditionBearerLedger.ts
 *
 * Persists inquiries from people who say they can speak for a lineage
 * The Elder draws on (migrations/027_tradition_bearer_inquiry.sql). This
 * is the intake for the "how a tradition-bearer joins" surface
 * (app/tradition-bearers/page.tsx) -- deliberately just a lead, not an
 * authorization. Saving a row here never flips a voice flag
 * (src/resilience/flags.ts) or an AUTHORIZED_ACCENTS entry
 * (lib/mythopoetics/cardConfig.ts) by itself; a real grant still requires
 * the same thing every authorized voice on record already required --
 * Jesse (or whoever holds that relationship) actually corresponding with
 * this person and recording a real, specific answer, the way
 * docs/reading-shape-voice-review.md's Track 1 does for Stanzione.
 *
 * Fails closed like guidedJournalLedger.ts / thresholdLetterLedger.ts:
 * a DB error here must never break the page it's attached to.
 */

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let _sql: NeonQueryFunction<false, false> | null = null;
function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  if (!_sql) _sql = neon(process.env.DATABASE_URL!);
  return _sql(strings, ...values);
}

export type InquiryStatus = 'new' | 'contacted' | 'in_review' | 'resolved';

export interface TraditionBearerInquiry {
  id: number;
  lineageKey: string;
  name: string;
  relationship: string;
  contact: string;
  message: string;
  status: InquiryStatus;
  createdAt: string;
}

function rowToInquiry(row: any): TraditionBearerInquiry {
  return {
    id: Number(row.id),
    lineageKey: row.lineage_key,
    name: row.name,
    relationship: row.relationship,
    contact: row.contact,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function saveTraditionBearerInquiry(
  lineageKey: string,
  name: string,
  relationship: string,
  contact: string,
  message: string
): Promise<void> {
  await sql`
    INSERT INTO tradition_bearer_inquiry (lineage_key, name, relationship, contact, message)
    VALUES (${lineageKey}, ${name}, ${relationship}, ${contact}, ${message})
  `;
}

/** For an internal review surface, not exposed publicly. */
export async function listTraditionBearerInquiries(
  status?: InquiryStatus
): Promise<TraditionBearerInquiry[]> {
  const rows = status
    ? await sql`
        SELECT id, lineage_key, name, relationship, contact, message, status, created_at
        FROM tradition_bearer_inquiry
        WHERE status = ${status}
        ORDER BY created_at DESC
      `
    : await sql`
        SELECT id, lineage_key, name, relationship, contact, message, status, created_at
        FROM tradition_bearer_inquiry
        ORDER BY created_at DESC
      `;
  return rows.map(rowToInquiry);
}
