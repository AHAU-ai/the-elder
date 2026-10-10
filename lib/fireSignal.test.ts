import assert from 'node:assert/strict';
import {
  DEFAULT_FIRE_SIGNAL, getFireSignal, publishFireSignal, releaseFireSignal, subscribeFireSignal,
} from './fireSignal';

async function main() {
  let calls = 0;
  const unsub = subscribeFireSignal(() => { calls++; });

  const a = Symbol('a');
  const b = Symbol('b');

  publishFireSignal(a, { soundEnabled: true, intensity: 0.4, pulse: 0 });
  assert.equal(getFireSignal().intensity, 0.4);
  assert.equal(calls, 1);

  // Identical publish is a no-op (no re-render of the fire).
  publishFireSignal(a, { soundEnabled: true, intensity: 0.4, pulse: 0 });
  assert.equal(calls, 1);

  // Handover: old driver releases, new one publishes in the same tick --
  // the fire must never fall back to the default in between.
  releaseFireSignal(a);
  publishFireSignal(b, { soundEnabled: true, intensity: 0.7, pulse: 0 });
  await Promise.resolve();
  assert.equal(getFireSignal().intensity, 0.7);
  assert.equal(calls, 2);

  // A stale release from a previous owner is ignored.
  releaseFireSignal(a);
  await Promise.resolve();
  assert.equal(getFireSignal().intensity, 0.7);

  // Real release returns to the default.
  releaseFireSignal(b);
  await Promise.resolve();
  assert.equal(getFireSignal(), DEFAULT_FIRE_SIGNAL);
  assert.equal(calls, 3);

  unsub();
  publishFireSignal(a, { soundEnabled: false, intensity: 1, pulse: 2 });
  assert.equal(calls, 3);
  releaseFireSignal(a);
  await Promise.resolve();
  console.log('fireSignal: all tests passed');
}

main();
