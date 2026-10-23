/**
 * thresholdLetterLedger.test.ts — Invariant tests for delayed Threshold
 * Letter email delivery eligibility (migrations/016). Pure-logic tests
 * (no DB/model) so they run in CI — mirrors lib/returning/markerDeficit.test.ts's
 * house style. Run: npx tsx lib/thresholdLetterLedger.test.ts
 */
import {
  isEligibleForEmailDelivery,
  DELIVERY_DELAY_DAYS,
  MAX_EMAIL_ATTEMPTS,
  type DeliveryCandidate,
} from './thresholdLetterLedger';

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    console.error(`FAIL  ${name}`);
    failures++;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-08-18T12:00:00Z');

function candidate(overrides: Partial<DeliveryCandidate>): DeliveryCandidate {
  return {
    createdAt: NOW,
    deliveryEmailSentAt: null,
    emailAttempts: 0,
    ...overrides,
  };
}

// 1. Design constants — locking these in as tests means a future accidental
// edit (e.g. someone "simplifying" the delay to 1 day) fails loudly instead
// of silently changing product behavior.
check('DELIVERY_DELAY_DAYS is 3', DELIVERY_DELAY_DAYS === 3);
check('MAX_EMAIL_ATTEMPTS is 5', MAX_EMAIL_ATTEMPTS === 5);

// 2. Freshly kept letter (created "now") is not yet due.
{
  const letter = candidate({ createdAt: NOW });
  check('letter created now: not yet eligible', !isEligibleForEmailDelivery(letter, NOW));
}

// 3. Letter created exactly at the delay boundary minus one second: still not due.
{
  const letter = candidate({ createdAt: new Date(NOW.getTime() - (DELIVERY_DELAY_DAYS * DAY_MS - 1000)) });
  check('letter 1s short of the delay: not yet eligible', !isEligibleForEmailDelivery(letter, NOW));
}

// 4. Letter created exactly at the delay boundary: due (inclusive boundary).
{
  const letter = candidate({ createdAt: new Date(NOW.getTime() - DELIVERY_DELAY_DAYS * DAY_MS) });
  check('letter exactly at the delay boundary: eligible', isEligibleForEmailDelivery(letter, NOW));
}

// 5. Old letter, well past the delay: due.
{
  const letter = candidate({ createdAt: new Date(NOW.getTime() - 10 * DAY_MS) });
  check('letter well past the delay: eligible', isEligibleForEmailDelivery(letter, NOW));
}

// 6. Already sent: never eligible again, no matter how old.
{
  const letter = candidate({
    createdAt: new Date(NOW.getTime() - 30 * DAY_MS),
    deliveryEmailSentAt: new Date(NOW.getTime() - 20 * DAY_MS),
  });
  check('already-sent letter: never eligible again', !isEligibleForEmailDelivery(letter, NOW));
}

// 7. At the attempt cap: not eligible (gives up rather than retrying forever).
{
  const letter = candidate({
    createdAt: new Date(NOW.getTime() - 10 * DAY_MS),
    emailAttempts: MAX_EMAIL_ATTEMPTS,
  });
  check('at MAX_EMAIL_ATTEMPTS: not eligible', !isEligibleForEmailDelivery(letter, NOW));
}

// 8. One under the attempt cap: still eligible (retries are allowed up to the cap).
{
  const letter = candidate({
    createdAt: new Date(NOW.getTime() - 10 * DAY_MS),
    emailAttempts: MAX_EMAIL_ATTEMPTS - 1,
  });
  check('one under MAX_EMAIL_ATTEMPTS: still eligible', isEligibleForEmailDelivery(letter, NOW));
}

// 9. Per-letter promised delay (migration 028): a letter kept under a longer
// promise is not due at the short boundary, and is due at its own.
{
  const kept90 = candidate({ createdAt: new Date(NOW.getTime() - 10 * DAY_MS), deliveryDelayDays: 90 });
  check('90-day letter at 10 days: not eligible', !isEligibleForEmailDelivery(kept90, NOW));
  const kept90Due = candidate({ createdAt: new Date(NOW.getTime() - 90 * DAY_MS), deliveryDelayDays: 90 });
  check('90-day letter at exactly 90 days: eligible', isEligibleForEmailDelivery(kept90Due, NOW));
  const kept30 = candidate({ createdAt: new Date(NOW.getTime() - 29 * DAY_MS), deliveryDelayDays: 30 });
  check('30-day letter at 29 days: not eligible', !isEligibleForEmailDelivery(kept30, NOW));
  const legacy = candidate({ createdAt: new Date(NOW.getTime() - DELIVERY_DELAY_DAYS * DAY_MS), deliveryDelayDays: null });
  check('legacy (null) letter behaves as the original 3 days', isEligibleForEmailDelivery(legacy, NOW));
  const bogus = candidate({ createdAt: new Date(NOW.getTime() - 1 * DAY_MS), deliveryDelayDays: 1 });
  check('an out-of-set delay never shortens the wait (falls back to 3)', !isEligibleForEmailDelivery(bogus, NOW));
  const sent = candidate({ createdAt: new Date(NOW.getTime() - 400 * DAY_MS), deliveryDelayDays: 90, deliveryEmailSentAt: NOW });
  check('a letter with a custom delay is still never sent twice', !isEligibleForEmailDelivery(sent, NOW));
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
} else {
  console.log('\nAll thresholdLetterLedger tests passed.');
}
