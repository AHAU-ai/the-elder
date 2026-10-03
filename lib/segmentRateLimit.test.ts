// A segmented Reading is one divination, not one per segment. Exercises the
// real limiter (in-memory path: DATABASE_URL must be unset) through the same
// bucket helper /api/divine uses.
import assert from 'node:assert/strict';
import { checkRateLimit } from './rate-limit';
import { SEGMENT_MAX, divineRateBucket } from './segmentedDelivery';

delete process.env.DATABASE_URL;

const LIMIT = 10;
const charge = (ip: string, seg: number | null) => {
  const b = divineRateBucket(ip, seg, LIMIT);
  return checkRateLimit(b.key, b.limit);
};

async function main() {
  // Bucket selection
  assert.deepEqual(divineRateBucket('1.1.1.1', null, LIMIT), { key: '1.1.1.1', limit: LIMIT });
  assert.deepEqual(divineRateBucket('1.1.1.1', 0, LIMIT), { key: '1.1.1.1', limit: LIMIT });
  assert.deepEqual(divineRateBucket('1.1.1.1', 1, LIMIT), { key: 'divine-cont:1.1.1.1', limit: LIMIT * (SEGMENT_MAX - 1) });
  assert.equal(divineRateBucket('1.1.1.1', 2, LIMIT).key, 'divine-cont:1.1.1.1');
  console.log('  ok  bucket selection');

  // Honest use: LIMIT full Readings, each with SEGMENT_MAX - 1 continuations
  const honest = '2.2.2.2';
  for (let r = 0; r < LIMIT; r++) {
    assert.equal((await charge(honest, 0)).allowed, true, `reading ${r} first segment`);
    for (let c = 1; c < SEGMENT_MAX; c++) {
      assert.equal((await charge(honest, c)).allowed, true, `reading ${r} continuation ${c}`);
    }
  }
  assert.equal((await charge(honest, 0)).allowed, false, 'LIMIT+1th Reading is refused');
  console.log('  ok  10 full Readings of 3 segments each are allowed, the 11th is refused');

  // Continuations never consume the main bucket
  const fresh = '3.3.3.3';
  for (let i = 0; i < LIMIT * (SEGMENT_MAX - 1); i++) await charge(fresh, 1);
  const main1 = await charge(fresh, 0);
  assert.equal(main1.allowed, true);
  assert.equal(main1.remaining, LIMIT - 1);
  console.log('  ok  continuations leave the main bucket untouched');

  // Forged `segment` is bounded: it cannot exceed the continuation allowance
  const forger = '4.4.4.4';
  let allowed = 0;
  for (let i = 0; i < 100; i++) if ((await charge(forger, 1)).allowed) allowed++;
  assert.equal(allowed, LIMIT * (SEGMENT_MAX - 1));
  console.log('  ok  forged continuations are capped at the continuation allowance');

  // Buckets are per IP
  assert.equal((await charge('5.5.5.5', 1)).allowed, true);
  console.log('  ok  other IPs are unaffected');

  console.log('All segmentRateLimit tests passed.');
}

main().catch((e) => { console.error(e); process.exit(1); });
