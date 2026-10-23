import assert from 'node:assert/strict';
import { createPortalLure, LURE_LEVEL, LURE_FADE_IN_S } from './portalLure';

function ok(name: string, fn: () => void) {
  fn();
  console.log(`  ok  ${name}`);
}

ok('on the server (no window / no Web Audio) every call is a harmless no-op', () => {
  const lure = createPortalLure();
  lure.start();
  lure.resume();
  lure.setProximity(0.7);
  lure.setYield(0.4);
  lure.setMuted(true);
  assert.equal(lure.getState(), 'locked');
  assert.equal(lure.meter().rmsDb, -Infinity);
  const off = lure.subscribe(() => {});
  off();
  lure.stop();
});

ok('the ceiling is a modest gain and the fade-in is slow (an arrival, not a sound effect)', () => {
  assert.ok(LURE_LEVEL > 0 && LURE_LEVEL <= 1);
  assert.ok(LURE_FADE_IN_S >= 3);
});

console.log('portalLure: all passed');
