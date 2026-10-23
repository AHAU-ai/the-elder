import assert from 'node:assert/strict';
import { assessDwelling, closingLineViolations, OVER_DWELLING, QUIET_CLOSING_LINE, QUIET_DISCLOSURE, QUIET_VEIL_MAX } from './overDwelling';
import { BANK_VEIL_MAX } from './hearthBank';
import { readDwelling } from './returning/dwelling';
import { overDwellingGuardActive } from './compliance/overDwellingGate';

const H = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 23, 12);
const P = { windowMs: 24 * H, threshold: 3 };

// Counts visits only, in a rolling window.
assert.equal(assessDwelling([], NOW, P).quiet, false);
assert.equal(assessDwelling([NOW - H, NOW - 2 * H], NOW, P).quiet, false, 'two is below three');
assert.equal(assessDwelling([NOW - H, NOW - 2 * H, NOW - 3 * H], NOW, P).quiet, true);
assert.equal(assessDwelling([NOW - 25 * H, NOW - 26 * H, NOW - H], NOW, P).quiet, false, 'old sittings fall out of the window');
assert.equal(assessDwelling([NOW - 24 * H, NOW - 2 * H, NOW - H], NOW, P).quiet, false, 'exactly a window ago is out');

// Ends exactly when the count drops below the threshold; no lingering penalty.
const t = [NOW - 10 * H, NOW - 5 * H, NOW - H];
const a = assessDwelling(t, NOW, P);
assert.equal(a.untilMs, 14 * H, 'quiet until the oldest of the three ages out');
assert.equal(assessDwelling(t, NOW + a.untilMs, P).quiet, false, 'and not a moment longer');
assert.equal(assessDwelling(t, NOW + a.untilMs - 1, P).quiet, true);
// A fourth sitting extends it only as far as needed.
const t4 = [NOW - 12 * H, ...t];
assert.equal(assessDwelling(t4, NOW, P).untilMs, 14 * H, 'with four, the two oldest must age out');

// A clock oddity never quiets the fire.
assert.equal(assessDwelling([NaN, Infinity, NOW + H, NOW + 2 * H, NOW + 3 * H], NOW, P).quiet, false);
assert.equal(assessDwelling([NOW, NOW, NOW], NOW, { windowMs: 24 * H, threshold: 0 }).quiet, false, 'a zero threshold is off, not always-on');

// The fire stays clearly lit, below the M5 ceiling.
assert.ok(QUIET_VEIL_MAX < BANK_VEIL_MAX, 'quiet veil is lower than the banked fire');

// Nothing is chosen for the reviewer.
assert.equal(QUIET_CLOSING_LINE, null, 'no closing line until the reviewer adopts one');
assert.equal(QUIET_DISCLOSURE, null, 'no disclosure until the reviewer adopts one');
assert.equal(OVER_DWELLING.threshold, 3);

// The packet's candidate lines are in register under the mechanical check...
for (const ok of ['This will keep.', 'The fire holds what was said.', 'What was spoken here stays.']) {
  assert.deepEqual(closingLineViolations(ok), [], ok);
}
// ...and the check bites on each thing the packet forbids.
for (const bad of ['Welcome.', 'You have come three times.', 'Rest now.', 'That is enough for today.', 'Come again soon.', 'Back so soon?', 'The fire has missed you.', 'Three sittings today.', 'Take a breath.']) {
  assert.notDeepEqual(closingLineViolations(bad), [], bad);
}

async function main() {
  // Inert by default: no approval, no flag, no disclosure.
  assert.equal(overDwellingGuardActive(), false);
  let asked = false;
  const times = async () => { asked = true; return [NOW - H, NOW - 2 * H, NOW - 3 * H]; };
  const off = await readDwelling(7, NOW, { times });
  assert.deepEqual(off, { quiet: false, untilMs: 0, line: null });
  assert.equal(asked, false, 'while dark it does not even query the ledger');
  console.log('overDwelling: ok');
}
main().catch((e) => { console.error(e); process.exit(1); });
