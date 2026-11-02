/**
 * feedbackSteer.ts
 *
 * Pure half of the learning loop: turn a tally of a seeker's recent signals
 * into a system-prompt directive. No database, no I/O — split out of
 * feedbackLedger.ts so it can be tested without a connection string.
 *
 * Only DECISIVE signals count. "sitting" ("I need to sit with this") is
 * deliberately absent from the tally: a seeker who is still receiving a
 * Reading has not said it missed, and treating that as a miss would tell the
 * model to "sharpen" a Reading that is still doing its work.
 */

export interface FeedbackTally {
  landed: number;
  didNotLand: number;
}

/** Fewer decisive signals than this is not enough evidence to act on. */
export const MIN_DECISIVE_SIGNALS = 2;

/** Tally decisive signals from raw altar rows. Unknown / "sitting" rows are ignored. */
export function tallySignals(rows: ReadonlyArray<{ signal?: unknown }>): FeedbackTally {
  let landed = 0;
  let didNotLand = 0;
  for (const row of rows) {
    if (row.signal === 'landed') landed++;
    else if (row.signal === 'did_not_land') didNotLand++;
  }
  return { landed, didNotLand };
}

/**
 * Turn a tally into a system-prompt directive. Stays silent below
 * MIN_DECISIVE_SIGNALS — not enough evidence to act on — and silent on an even
 * split, since there's nothing clear to steer toward.
 */
export function buildFeedbackSteer(tally: FeedbackTally): string {
  const total = tally.landed + tally.didNotLand;
  if (total < MIN_DECISIVE_SIGNALS) return '';

  if (tally.didNotLand > tally.landed) {
    return `━━━ FEEDBACK FROM RECENT READINGS ━━━\nThe last few readings offered to this seeker in this field did not land as strongly as they could have (${tally.didNotLand} of ${total} recent readings marked "did not land"). Ground this reading more concretely in what the seeker has actually told you — specific people, specific moments — rather than general mythic abstraction. Sharpen precision; do not soften the register.\n\n`;
  }
  if (tally.landed > tally.didNotLand) {
    return `━━━ FEEDBACK FROM RECENT READINGS ━━━\nRecent readings have landed well for this seeker in this field (${tally.landed} of ${total}). Continue trusting this register and level of specificity.\n\n`;
  }
  return '';
}
