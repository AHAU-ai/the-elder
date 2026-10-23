/**
 * mythPortraitDerive.test.ts -- invariants for "Your myth, so far".
 * Pure-logic tests (no DB, no model) so they run in CI.
 * Run: npx tsx lib/returning/mythPortraitDerive.test.ts
 */
import assert from 'node:assert/strict';
import { derivePortrait, STATION_ORDER, type PortraitInput } from './mythPortraitDerive';

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (e) {
    console.error(`FAIL ${name}\n`, e);
    process.exit(1);
  }
}

const base: PortraitInput = { myths: [], material: [], eligible: false, hasStatement: false, required: 3 };

test('a brand-new seeker: nothing lit, one door -> the fire', () => {
  const p = derivePortrait(base);
  assert.deepEqual(p.stations, { arrival: false, return: false, naming: false, telling: false });
  assert.deepEqual(p.nextDoor, { kind: 'arrival' });
  assert.equal(p.figures.length, 0);
  assert.equal(p.horizon.open, false);
});

test('one sitting: arrival lit, return is NOT inferred from a single reading', () => {
  const p = derivePortrait({ ...base, myths: [{ lineageKey: 'ojer_tzij', archetypeName: 'The Ember-Keeper', readingCount: 1 }] });
  assert.equal(p.stations.arrival, true);
  assert.equal(p.stations.return, false);
  assert.deepEqual(p.nextDoor, { kind: 'return', figure: 'The Ember-Keeper' });
});

test('returned means sat with it more than once, and nothing stronger', () => {
  const p = derivePortrait({ ...base, myths: [{ lineageKey: 'stoic', archetypeName: 'The Steward', readingCount: 2 }] });
  assert.equal(p.figures[0].returned, true);
  assert.equal(p.stations.return, true);
  // Exactly two keys on a figure's relation: no depth/stage leaks through.
  assert.deepEqual(Object.keys(p.figures[0]).sort(), ['archetypeName', 'lineageKey', 'returned']);
});

test('return door names the most recently touched figure (input is newest-first)', () => {
  const p = derivePortrait({
    ...base,
    myths: [
      { lineageKey: 'a', archetypeName: 'Newest', readingCount: 1 },
      { lineageKey: 'b', archetypeName: 'Older', readingCount: 1 },
    ],
  });
  assert.deepEqual(p.nextDoor, { kind: 'return', figure: 'Newest' });
});

test('lineages stay apart: one entry per lineage, none merged or dropped', () => {
  const p = derivePortrait({
    ...base,
    myths: [
      { lineageKey: 'a', archetypeName: 'Same Name', readingCount: 4 },
      { lineageKey: 'b', archetypeName: 'Same Name', readingCount: 1 },
    ],
  });
  assert.equal(p.figures.length, 2);
  assert.deepEqual(p.figures.map((f) => f.lineageKey), ['a', 'b']);
  assert.deepEqual(p.figures.map((f) => f.returned), [true, false]);
});

test('stations light independently of road order (naming without arrival)', () => {
  const p = derivePortrait({ ...base, material: [{ kind: 'becoming', id: 7, label: 'I am becoming someone who stays.' }] });
  assert.equal(p.stations.naming, true);
  assert.equal(p.stations.arrival, false);
  // The one door is the first untouched station, not the next after the last lit one.
  assert.deepEqual(p.nextDoor, { kind: 'arrival' });
});

test('naming door appears only once a figure has been returned to', () => {
  const p = derivePortrait({ ...base, myths: [{ lineageKey: 'a', archetypeName: 'X', readingCount: 3 }] });
  assert.deepEqual(p.nextDoor, { kind: 'naming' });
});

test('gathered material is a flat, order-preserving, unconnected copy', () => {
  const material = [
    { kind: 'marker' as const, id: 1, label: 'the door I keep leaving ajar' },
    { kind: 'becoming' as const, id: 2, label: 'I am becoming steadier' },
    { kind: 'marker' as const, id: 3, label: 'the weight of the borrowed coat' },
  ];
  const p = derivePortrait({ ...base, material });
  assert.deepEqual(p.gathered, material);
  assert.notEqual(p.gathered[0], material[0], 'rows are copied, not shared');
  for (const row of p.gathered) assert.deepEqual(Object.keys(row).sort(), ['id', 'kind', 'label']);
});

test('the page at the end: open only when eligible and unwritten', () => {
  assert.equal(derivePortrait({ ...base, eligible: true }).horizon.open, true);
  assert.equal(derivePortrait({ ...base, eligible: true, hasStatement: true }).horizon.open, false);
  assert.equal(derivePortrait({ ...base, eligible: false }).horizon.open, false);
});

test('a written statement lights telling and carries the required count through', () => {
  const p = derivePortrait({ ...base, eligible: true, hasStatement: true, required: 3 });
  assert.equal(p.stations.telling, true);
  assert.equal(p.horizon.written, true);
  assert.equal(p.horizon.required, 3);
});

test('the telling station never has a door of its own (no pressure toward the page)', () => {
  const p = derivePortrait({
    myths: [{ lineageKey: 'a', archetypeName: 'X', readingCount: 5 }],
    material: [{ kind: 'becoming', id: 1, label: 'x' }, { kind: 'becoming', id: 2, label: 'y' }, { kind: 'becoming', id: 3, label: 'z' }],
    eligible: true,
    hasStatement: false,
    required: 3,
  });
  assert.equal(p.nextDoor, null);
  assert.equal(p.horizon.open, true);
});

test('nothing in the payload is a score, level, percentage, or streak', () => {
  const p = derivePortrait({
    myths: [{ lineageKey: 'a', archetypeName: 'X', readingCount: 9 }],
    material: [{ kind: 'becoming', id: 1, label: 'x' }],
    eligible: false,
    hasStatement: false,
    required: 3,
  });
  const json = JSON.stringify(p);
  assert.ok(!/percent|score|level|streak|progress|stage/i.test(json), json);
  assert.ok(!json.includes('9'), 'the raw reading count must not leave the server');
});

test('station order is fixed and complete', () => {
  assert.deepEqual([...STATION_ORDER], ['arrival', 'return', 'naming', 'telling']);
});

console.log(`mythPortraitDerive: ${passed} passed`);
