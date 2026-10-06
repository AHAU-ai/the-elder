/**
 * figureClient.test.ts -- hermetic tests for the client helpers of Figure
 * Continuity (lib/figureClient.ts): defensive parsing of server responses, the
 * arrival rule, the request fields, and how confirm / remove responses are read.
 *
 * Run: npx tsx lib/figureClient.test.ts
 */
import assert from 'node:assert/strict';
import {
  readMappingOffer,
  readMappingHeld,
  readFigureArrival,
  offersFigureArrival,
  divineFigureFields,
  interpretConfirm,
  interpretRemove,
  readPairingsCapability,
  readPairings,
  groupPairings,
  interpretRelease,
} from './figureClient';

const goodOffer = { id: 12, kind: 'person', subject: 'my sister', counterpart: 'the Maize Maiden' };

// ── readMappingOffer: only a well-formed offer, never anything else ──
assert.deepEqual(readMappingOffer({ text: 'x', mappingOffer: goodOffer }), goodOffer);
assert.deepEqual(readMappingOffer({ mappingOffer: { ...goodOffer, kind: 'situation' } })?.kind, 'situation');
assert.deepEqual(readMappingOffer({ mappingOffer: { ...goodOffer, subject: '  my sister  ' } })?.subject, 'my sister', 'trimmed');
const bad: Array<[string, unknown]> = [
  ['undefined', undefined],
  ['null', null],
  ['a string', 'mappingOffer'],
  ['an array', []],
  ['no offer key', { text: 'x' }],
  ['offer is null', { mappingOffer: null }],
  ['offer is an array', { mappingOffer: [goodOffer] }],
  ['offer is a string', { mappingOffer: 'x' }],
  ['id zero', { mappingOffer: { ...goodOffer, id: 0 } }],
  ['id negative', { mappingOffer: { ...goodOffer, id: -4 } }],
  ['id fractional', { mappingOffer: { ...goodOffer, id: 1.5 } }],
  ['id a string', { mappingOffer: { ...goodOffer, id: '12' } }],
  ['id unsafe', { mappingOffer: { ...goodOffer, id: 2 ** 53 } }],
  ['id NaN', { mappingOffer: { ...goodOffer, id: Number.NaN } }],
  ['bad kind', { mappingOffer: { ...goodOffer, kind: 'dragon' } }],
  ['missing subject', { mappingOffer: { ...goodOffer, subject: undefined } }],
  ['empty subject', { mappingOffer: { ...goodOffer, subject: '   ' } }],
  ['subject not a string', { mappingOffer: { ...goodOffer, subject: 7 } }],
  ['counterpart an object', { mappingOffer: { ...goodOffer, counterpart: {} } }],
  ['oversize subject', { mappingOffer: { ...goodOffer, subject: 'x'.repeat(201) } }],
];
for (const [name, data] of bad) assert.equal(readMappingOffer(data), null, `rejected: ${name}`);
// markup in a label is returned as plain text; it is only ever rendered as React text
assert.equal(readMappingOffer({ mappingOffer: { ...goodOffer, subject: '<b>x</b>' } })?.subject, '<b>x</b>');
// extra keys from a server are not passed through
assert.deepEqual(Object.keys(readMappingOffer({ mappingOffer: { ...goodOffer, userId: 5, secret: 'x' } }) ?? {}).sort(), ['counterpart', 'id', 'kind', 'subject']);

// ── readMappingHeld ──
assert.equal(readMappingHeld({ mappingHeld: false }), true);
for (const v of [{ mappingHeld: true }, { mappingHeld: 0 }, { mappingHeld: 'false' }, {}, null, undefined, 'x']) {
  assert.equal(readMappingHeld(v), false, `not held: ${JSON.stringify(v)}`);
}

// ── readFigureArrival ──
assert.deepEqual(readFigureArrival({ head: {}, figureContinuity: { figureLabel: 'The Hero Twin', lineageKey: 'maya' } }), { figureLabel: 'The Hero Twin', lineageKey: 'maya' });
for (const v of [null, undefined, {}, { figureContinuity: null }, { figureContinuity: 'x' }, { figureContinuity: { figureLabel: 'x' } },
  { figureContinuity: { lineageKey: 'maya' } }, { figureContinuity: { figureLabel: '', lineageKey: 'maya' } },
  { figureContinuity: { figureLabel: 'x'.repeat(201), lineageKey: 'maya' } }, { figureContinuity: { figureLabel: 5, lineageKey: 'maya' } }]) {
  assert.equal(readFigureArrival(v), null, `no arrival: ${JSON.stringify(v)?.slice(0, 50)}`);
}

// ── the arrival rule: only on the myth the figure is at home in ──
const arrival = { figureLabel: 'The Hero Twin', lineageKey: 'maya' };
assert.equal(offersFigureArrival(arrival, 'maya'), true);
assert.equal(offersFigureArrival(arrival, 'norse'), false, 'a card of another lineage goes straight in');
assert.equal(offersFigureArrival(null, 'maya'), false, 'no capability, no choice (the feature is dark)');
assert.equal(offersFigureArrival(arrival, undefined as unknown as string), false);
assert.equal(offersFigureArrival(arrival, ''), false);

// ── request fields: nothing unless the seeker chose to continue AND it is a Reading turn ──
assert.deepEqual(divineFigureFields({ isReadingMode: true }), {}, 'default: nothing added');
assert.deepEqual(divineFigureFields({ isReadingMode: true, figureContinue: false }), {});
assert.deepEqual(divineFigureFields({ isReadingMode: false, figureContinue: true }), {}, 'a council turn never carries it');
assert.deepEqual(divineFigureFields({ isReadingMode: true, figureContinue: true }), { chainAction: 'deepen', figureContinue: true });
assert.deepEqual(divineFigureFields({ isReadingMode: true, chainAction: 'deepen' }), { chainAction: 'deepen' }, 'an ordinary deepen is exactly what it was');
assert.deepEqual(divineFigureFields({ isReadingMode: false, chainAction: 'deepen' }), { chainAction: 'deepen' }, 'chainAction is passed through unchanged');
assert.deepEqual(divineFigureFields({ isReadingMode: true, figureContinue: true, chainAction: 'deepen' }), { chainAction: 'deepen', figureContinue: true });
assert.equal(divineFigureFields({ isReadingMode: true, figureContinue: 'yes' as unknown as boolean }).figureContinue, undefined, 'only literally true counts');

// ── interpretConfirm ──
assert.deepEqual(interpretConfirm(200, { outcome: 'confirmed' }), { kind: 'confirmed' });
assert.deepEqual(interpretConfirm(200, { outcome: 'noop' }), { kind: 'noop' });
assert.deepEqual(interpretConfirm(409, { outcome: 'capReached', max: 30, message: 'The fire keeps 30 pairings.' }), { kind: 'capReached', message: 'The fire keeps 30 pairings.' });
assert.equal((interpretConfirm(409, { outcome: 'capReached' }) as { message: string }).message.length > 0, true, 'a missing cap message falls back to plain words');
assert.equal((interpretConfirm(409, { outcome: 'capReached', message: 'x'.repeat(400) }) as { message: string }).message.includes('x'.repeat(400)), false, 'an oversize server message is not shown');
assert.deepEqual(interpretConfirm(429, { error: 'rate_limited' }), { kind: 'rateLimited' });
for (const [status, body] of [
  [200, { outcome: 'weird' }], [200, null], [200, 'ok'], [200, {}], [500, { error: 'confirm_failed' }], [401, { error: 'not_signed_in' }],
  [404, {}], [409, { outcome: 'other' }], [409, null], [0, null], [302, null],
] as Array<[number, unknown]>) {
  assert.equal(interpretConfirm(status, body).kind, 'failed', `failed, never a success: ${status} ${JSON.stringify(body)}`);
}
// a 200 with a success-looking body but from the wrong status never counts
assert.equal(interpretConfirm(500, { outcome: 'confirmed' }).kind, 'failed');
assert.equal(interpretConfirm(409, { outcome: 'confirmed' }).kind, 'failed');

// ── interpretRemove ──
assert.equal(interpretRemove(200), 'removed');
assert.equal(interpretRemove(404), 'gone', 'already gone is what the seeker wanted');
for (const s of [0, 401, 429, 500, 502, 302]) assert.equal(interpretRemove(s), 'failed', `failed: ${s}`);

// ── FC-F: the pairings view ──
{
  const C1 = '11111111-1111-4111-8111-111111111111';
  const C2 = '22222222-2222-4222-8222-222222222222';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row = (over: Record<string, unknown> = {}): any => ({
    id: 1, chainId: C1, lineageKey: 'maya', mythTitle: 'The Twins', figureLabel: 'The Hero Twin',
    subjectKind: 'person', subjectLabel: 'my sister', counterpartLabel: 'the Maize Maiden',
    counterpartBasis: 'model_report', confirmedAt: '2026-10-05T12:00:00.000Z', ...over,
  });

  // capability
  assert.equal(readPairingsCapability({ email: 'a@b.c', figureContinuity: { pairings: true } }), true);
  for (const v of [null, undefined, {}, { email: 'x' }, { figureContinuity: null }, { figureContinuity: {} }, { figureContinuity: { pairings: 'true' } },
    { figureContinuity: { pairings: false } }, { figureContinuity: { pairings: 1 } }, 'x', []]) {
    assert.equal(readPairingsCapability(v), false, `no pairings view: ${JSON.stringify(v)}`);
  }

  // reading the list
  const ok = readPairings({ mappings: [row(), row({ id: 2, subjectKind: 'situation', counterpartBasis: 'corpus' })] });
  assert.equal(ok?.rows.length, 2);
  assert.equal(ok?.skipped, 0);
  assert.deepEqual(readPairings({ mappings: [] }), { rows: [], skipped: 0 }, 'an empty list is an empty list');
  for (const v of [null, undefined, {}, { mappings: null }, { mappings: 'x' }, { mappings: {} }, 'x', []]) {
    assert.equal(readPairings(v), null, `unreadable, never "empty": ${JSON.stringify(v)}`);
  }
  const badRows: Array<[string, Record<string, unknown>]> = [
    ['id zero', { id: 0 }], ['id string', { id: '3' }], ['id fractional', { id: 2.5 }],
    ['chain not a uuid', { chainId: 'abc' }], ['bad kind', { subjectKind: 'dragon' }], ['bad basis', { counterpartBasis: 'vibes' }],
    ['empty subject', { subjectLabel: '  ' }], ['no counterpart', { counterpartLabel: undefined }], ['no figure', { figureLabel: '' }],
    ['no lineage', { lineageKey: undefined }], ['bad date', { confirmedAt: 'not a date' }], ['no date', { confirmedAt: undefined }],
    ['oversize label', { subjectLabel: 'x'.repeat(201) }],
  ];
  for (const [name, over] of badRows) {
    const r = readPairings({ mappings: [row(), row({ id: 9, ...over })] });
    assert.equal(r?.rows.length, 1, `a bad row is skipped: ${name}`);
    assert.equal(r?.skipped, 1, `...and counted, not hidden: ${name}`);
  }
  assert.equal(readPairings({ mappings: [row({ mythTitle: undefined })] })?.rows[0].mythTitle, '', 'a missing myth title is just empty');
  assert.deepEqual(Object.keys(readPairings({ mappings: [row({ userId: 5, secret: 'x' })] })?.rows[0] ?? {}).sort(),
    ['chainId', 'confirmedAt', 'counterpartBasis', 'counterpartLabel', 'figureLabel', 'id', 'lineageKey', 'mythTitle', 'subjectKind', 'subjectLabel'], 'unknown keys are not passed through');

  // grouping
  const rows = readPairings({ mappings: [
    row({ id: 1, chainId: C1, confirmedAt: '2026-10-01T00:00:00.000Z', subjectLabel: 'oldest' }),
    row({ id: 2, chainId: C2, figureLabel: 'The Seeress', lineageKey: 'norse', mythTitle: 'The Wanderer', confirmedAt: '2026-10-04T00:00:00.000Z', subjectLabel: 'newest' }),
    row({ id: 3, chainId: C1, confirmedAt: '2026-10-03T00:00:00.000Z', subjectLabel: 'middle' }),
  ] })!.rows;
  const groups = groupPairings(rows);
  assert.equal(groups.length, 2, 'one group per chain');
  assert.equal(groups[0].chainId, C2, 'the group with the newest pairing is first');
  assert.deepEqual(groups[1].rows.map(r => r.subjectLabel), ['middle', 'oldest'], 'newest first within a group');
  assert.equal(groups[0].figureLabel, 'The Seeress');
  assert.deepEqual(groupPairings([]), []);
  assert.equal(groupPairings(rows).flatMap(g => g.rows).length, 3, 'grouping never drops a pairing');
  const tied = groupPairings([row({ id: 5, confirmedAt: '2026-10-01T00:00:00.000Z' }), row({ id: 6, confirmedAt: '2026-10-01T00:00:00.000Z' })]);
  assert.deepEqual(tied[0].rows.map(r => r.id), [6, 5], 'ties break by id, newest first');

  // releases
  assert.deepEqual(interpretRelease(200, { released: 3 }), { kind: 'released', count: 3 });
  assert.deepEqual(interpretRelease(200, { released: 0 }), { kind: 'released', count: 0 });
  for (const [s, b] of [[200, {}], [200, { released: -1 }], [200, { released: 1.5 }], [200, { released: '3' }], [200, null], [500, { released: 3 }], [401, { error: 'x' }], [400, { error: 'bad_request' }], [0, null]] as Array<[number, unknown]>) {
    assert.equal(interpretRelease(s, b).kind, 'failed', `never report a release that did not happen: ${s} ${JSON.stringify(b)}`);
  }
}

console.log('figureClient tests passed');
