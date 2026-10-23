import assert from 'node:assert/strict';
import {
  carryStageAllows,
  figureContinuityStageAllows,
  stageAllows,
  trajectoryStageAllows,
} from '../../config/returning-features';

// The rule itself: a dark master gate beats everything; otherwise everyone or testers.
assert.equal(stageAllows({ flagOn: false, openToAll: true, isTester: true }), false, 'dark master gate wins');
assert.equal(stageAllows({ flagOn: true, openToAll: false, isTester: false }), false, 'stage 1: non-tester');
assert.equal(stageAllows({ flagOn: true, openToAll: false, isTester: true }), true, 'stage 1: tester');
assert.equal(stageAllows({ flagOn: true, openToAll: true, isTester: false }), true, 'stage 2: everyone');

const KEYS = [
  'ELDER_TRAJECTORY_ENABLED', 'MARKER_CONFIRMATION_READY', 'CEILING_RATIFIED', 'ELDER_CARRY_ENABLED',
  'TRAJECTORY_ALL_SEEKERS', 'FIGURE_CONTINUITY_ENABLED', 'FIGURE_CONTINUITY_RELEASE_VERIFIED',
  'FIGURE_CONTINUITY_ALL_SEEKERS',
];
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
const clear = () => KEYS.forEach((k) => delete process.env[k]);

try {
  // Everything unset: nothing is lit for anyone, tester or not.
  clear();
  assert.equal(trajectoryStageAllows(true), false);
  assert.equal(carryStageAllows(true), false);
  assert.equal(figureContinuityStageAllows(true), false);

  // Trajectory gates met (FEATURES freezes ELDER_TRAJECTORY at import, so it is exercised by the
  // figure-continuity gates below, which are read at call time).
  process.env.FIGURE_CONTINUITY_ENABLED = 'true';
  process.env.MARKER_CONFIRMATION_READY = 'true';
  process.env.FIGURE_CONTINUITY_RELEASE_VERIFIED = 'true';
  assert.equal(figureContinuityStageAllows(true), true, 'stage 1: tester sees it');
  assert.equal(figureContinuityStageAllows(false), false, 'stage 1: everyone else does not');
  process.env.FIGURE_CONTINUITY_ALL_SEEKERS = 'true';
  assert.equal(figureContinuityStageAllows(false), true, 'stage 2: everyone');
  // Stage 2 alone never lights it.
  delete process.env.FIGURE_CONTINUITY_ENABLED;
  assert.equal(figureContinuityStageAllows(true), false, 'stage flag without the master flip is inert');
} finally {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
}
console.log('rollout: ok');
