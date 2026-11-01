// Run: tsx lib/cholQij.test.ts
import assert from 'node:assert/strict';
import { todaysDaySign } from './chol-qij';

function ok(name: string, fn: () => void) { fn(); console.log(`  ok  ${name}`); }
const sign = (iso: string) => { const s = todaysDaySign(new Date(iso)); return `${s.number} ${s.nahual.name}`; };

ok('anchor: 2020-04-22 = 5 Kawoq', () => assert.equal(sign('2020-04-22T18:00:00Z'), '5 Kawoq'));
ok('2026-11-01 = 10 Aq\'ab\'al (matches 2012-12-21 = 4 Ajpu correlation)', () =>
  assert.equal(sign('2026-11-01T18:00:00Z'), "10 Aq'ab'al"));
ok('turns at Guatemala midnight (06:00Z), not UTC midnight', () => {
  assert.equal(sign('2026-11-02T05:59:00Z'), "10 Aq'ab'al");
  assert.equal(sign('2026-11-02T06:00:00Z'), "11 K'at");
});
ok('days before the anchor wrap correctly', () => assert.equal(sign('2020-04-21T18:00:00Z'), '4 Tijax'));
