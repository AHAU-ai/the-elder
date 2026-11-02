/**
 * feedbackLedger.ts
 *
 * The seeker-facing half of the learning loop: ReadingSignal.tsx asks after
 * every reading and writes a landed / sitting / did_not_land signal to
 * altar_record (via /api/altar). This module lets a signed-in seeker's recent
 * DECISIVE signals for a lineage steer how the NEXT reading in that lineage
 * is delivered — sharpening toward concreteness when readings haven't been
 * landing, reinforcing register when they have.
 *
 * The pure tally/steer logic lives in feedbackSteer.ts (testable without a
 * database); this file is only the query.
 *
 * Fails closed like consentLedger.ts / mythLedger.ts: any DB error yields
 * an empty tally, which buildFeedbackSteer turns into no clause at all —
 * silence, not a guess.
 */

import { neon } from '@neondatabase/serverless';
import { tallySignals, type FeedbackTally } from '@/lib/feedbackSteer';

export { buildFeedbackSteer, tallySignals } from '@/lib/feedbackSteer';
export type { FeedbackTally } from '@/lib/feedbackSteer';

const sql = neon(process.env.DATABASE_URL!);

/**
 * Tally of a user's most recent DECISIVE signals for a given lineage.
 * "sitting" rows are excluded in SQL, not just in the tally, so a run of
 * still-sitting responses can't crowd real signals out of the window.
 */
export async function getRecentFeedbackTally(
  userId: number,
  lineageKey: string,
  limit: number = 6
): Promise<FeedbackTally> {
  const rows = await sql`
    SELECT signal FROM altar_record
    WHERE user_id = ${userId}
      AND lineage = ${lineageKey}
      AND signal IN ('landed', 'did_not_land')
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return tallySignals(rows);
}
