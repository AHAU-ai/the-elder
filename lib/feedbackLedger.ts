/**
 * feedbackLedger.ts
 *
 * The seeker-facing half of the learning loop: ReadingSignal.tsx already
 * asks "did the fire find you" after every reading and writes a
 * landed / did_not_land signal to altar_record. Until now nothing ever
 * read that signal back. This module lets a signed-in seeker's recent
 * signals for a lineage steer how the NEXT reading in that lineage is
 * delivered — sharpening toward concreteness when readings haven't been
 * landing, reinforcing register when they have.
 *
 * Fails closed like consentLedger.ts / mythLedger.ts: any DB error yields
 * an empty tally, which buildFeedbackSteer turns into no clause at all —
 * silence, not a guess.
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export interface FeedbackTally {
  landed: number;
  didNotLand: number;
}

/** Tally of a user's most recent signals for a given lineage. */
export async function getRecentFeedbackTally(
  userId: number,
  lineageKey: string,
  limit: number = 6
): Promise<FeedbackTally> {
  const rows = await sql`
    SELECT signal FROM altar_record
    WHERE user_id = ${userId} AND lineage = ${lineageKey}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  let landed = 0;
  let didNotLand = 0;
  for (const row of rows) {
    if (row.signal === 'landed') landed++;
    else if (row.signal === 'did_not_land') didNotLand++;
  }
  return { landed, didNotLand };
}

/**
 * Turn a tally into a system-prompt directive. Stays silent below 2 signals
 * — not enough evidence to act on — and silent on an even split, since
 * there's nothing clear to steer toward.
 */
export function buildFeedbackSteer(tally: FeedbackTally): string {
  const total = tally.landed + tally.didNotLand;
  if (total < 2) return '';

  if (tally.didNotLand > tally.landed) {
    return `━━━ FEEDBACK FROM RECENT READINGS ━━━\nThe last few readings offered to this seeker in this field did not land as strongly as they could have (${tally.didNotLand} of ${total} recent readings marked "did not land"). Ground this reading more concretely in what the seeker has actually told you — specific people, specific moments — rather than general mythic abstraction. Sharpen precision; do not soften the register.\n\n`;
  }
  if (tally.landed > tally.didNotLand) {
    return `━━━ FEEDBACK FROM RECENT READINGS ━━━\nRecent readings have landed well for this seeker in this field (${tally.landed} of ${total}). Continue trusting this register and level of specificity.\n\n`;
  }
  return '';
}
