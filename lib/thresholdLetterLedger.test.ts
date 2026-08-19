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

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
} else {
  console.log('\nAll thresholdLetterLedger tests passed.');
}
