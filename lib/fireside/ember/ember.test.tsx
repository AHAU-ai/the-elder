/**
 * Tests for the ember sigil: profile guard, determinism, geometry bounds, alt text, component.
 * Run: npx tsx lib/fireside/ember/ember.test.tsx
 */
import assert from 'node:assert/strict';
import * as ReactNS from 'react';

(globalThis as unknown as { React: typeof ReactNS }).React = ReactNS;

import {
  EMBER_MOTIFS, FORBIDDEN_KEY_PATTERN, PROFILE_KEYS, assertEmberProfile, assertSigilRecord, bandDuration, bandReaction,
  bandSegments, bandSilence, buildEmberProfile,
} from './profile';
import type { Band, EmberProfile, RawSittingShape } from './profile';
import { VIEW, renderSigilSvg, sigilGeometry } from './geometry';
import { SIGIL_DISCLAIMER, describeSigil } from './alt';

const bands: Band[] = [0, 1, 2, 3];
const raw: RawSittingShape = { durationSec: 700, segmentCount: 10, reactionCounts: [0, 2, 7], longestSilenceSec: 45, depthStage: 2, motifId: 'petals' };

async function main() {
  // ── bucketing edges ──
  assert.deepEqual([179, 180, 599, 600, 1499, 1500].map(bandDuration), [0, 1, 1, 2, 2, 3]);
  assert.deepEqual([3, 4, 8, 9, 16, 17].map(bandSegments), [0, 1, 1, 2, 2, 3]);
  assert.deepEqual([0, 1, 2, 3, 5, 6].map(bandReaction), [0, 1, 1, 2, 2, 3]);
  assert.deepEqual([9, 10, 39, 40, 119, 120].map(bandSilence), [0, 1, 1, 2, 2, 3]);
  assert.throws(() => bandDuration(-1), RangeError);
  assert.throws(() => bandDuration(NaN), RangeError);

  // ── building a profile copies nothing but the named numbers ──
  const smuggled = { ...raw, welfareLevel: 2, stepOut: true, emotion: 'sad', text: 'my words' } as unknown as RawSittingShape;
  const p = buildEmberProfile(smuggled);
  assert.deepEqual(p, { v: 1, durationBand: 2, segmentBand: 2, reactionBands: [0, 1, 3], silenceBand: 2, depthStage: 2, motif: 'petals' });
  assert.deepEqual(Object.keys(p).sort(), [...PROFILE_KEYS].sort());
  assert.ok(!JSON.stringify(p).match(/welfare|stepOut|emotion|my words/i), 'nothing smuggled survives');
  assert.equal(buildEmberProfile({ ...raw, depthStage: 9 }).depthStage, 3, 'depth is clamped');
  assert.throws(() => buildEmberProfile({ ...raw, motifId: 'dragon' }), /unknown motif/);

  // ── the guard refuses forbidden fields, extra keys and bad values ──
  for (const key of ['welfareLevel', 'welfare', 'tier', 'level', 'stepOut', 'step_out', 'flag', 'emotion', 'mood', 'feeling', 'sentiment', 'distress', 'crisis', 'riskScore', 'text', 'transcript', 'voiceId', 'label', 'name', 'email']) {
    assert.ok(FORBIDDEN_KEY_PATTERN.test(key), `pattern covers ${key}`);
    assert.throws(() => assertEmberProfile({ ...p, [key]: 1 }), /may not carry/, `refuses ${key}`);
  }
  assert.throws(() => assertEmberProfile({ ...p, extra: 1 }), /keys must be exactly/, 'unknown benign key refused too');
  assert.throws(() => assertEmberProfile({ ...p, nested: { welfare: 1 } }), /may not carry/, 'nested forbidden key refused');
  for (const k of PROFILE_KEYS) assert.ok(!FORBIDDEN_KEY_PATTERN.test(k), `allowed key ${k} is not forbidden`);
  const without = { ...p } as Record<string, unknown>; delete without.motif;
  assert.throws(() => assertEmberProfile(without), /keys must be exactly/);
  assert.throws(() => assertEmberProfile({ ...p, durationBand: 4 }), /0..3/);
  assert.throws(() => assertEmberProfile({ ...p, durationBand: 1.5 }), /0..3/);
  assert.throws(() => assertEmberProfile({ ...p, reactionBands: [0, 1] }), /three integers/);
  assert.throws(() => assertEmberProfile({ ...p, motif: 'x' }), /motif/);
  assert.throws(() => assertEmberProfile({ ...p, v: 2 }), /v must be 1/);
  assert.throws(() => assertEmberProfile(null), /object/);
  assert.throws(() => assertEmberProfile([]), /object/);
  assert.doesNotThrow(() => assertSigilRecord({ profile: p, seed: 123 }));
  assert.throws(() => assertSigilRecord({ profile: p, seed: -1 }), /seed/);
  assert.throws(() => assertSigilRecord({ profile: p, seed: 1.5 }), /seed/);
  assert.throws(() => assertSigilRecord({ profile: p, seed: 1, welfare: 1 }), /keys must be exactly/);

  // ── determinism ──
  const a = sigilGeometry(p, 42);
  assert.equal(JSON.stringify(a), JSON.stringify(sigilGeometry(p, 42)), 'same inputs, same geometry');
  assert.equal(renderSigilSvg(p, 42), renderSigilSvg(p, 42));
  assert.notEqual(renderSigilSvg(p, 42), renderSigilSvg(p, 43), 'the seed changes the drawing');
  assert.notEqual(renderSigilSvg(p, 42), renderSigilSvg({ ...p, durationBand: 3 }, 42), 'the profile changes the drawing');
  // Key order of an equal profile must not matter.
  const reordered = { motif: p.motif, depthStage: p.depthStage, silenceBand: p.silenceBand, reactionBands: p.reactionBands, segmentBand: p.segmentBand, durationBand: p.durationBand, v: 1 } as EmberProfile;
  assert.equal(renderSigilSvg(reordered, 42), renderSigilSvg(p, 42));

  // ── structure follows the bands ──
  for (const d of bands) for (const s of bands) {
    const g = sigilGeometry({ ...p, durationBand: d, segmentBand: s }, 7);
    assert.equal(g.rings.length, 1 + d);
    assert.equal(g.marks.length, 6 + s * 3);
  }
  for (const rb of bands) assert.equal(sigilGeometry({ ...p, reactionBands: [rb, 0, 0] }, 7).dots.length, rb);
  assert.ok(sigilGeometry({ ...p, depthStage: 3 }, 1).core.r > sigilGeometry({ ...p, depthStage: 0 }, 1).core.r);

  // ── full sweep: every profile x motif draws finite, in-bounds, and has alt text ──
  const FORBIDDEN_WORDS = /welfare|calm|sad|happy|anxi|distress|crisis|healing|heavy|joy|grief|fear|angry|peace|omen(?! )|fortune|destiny/i;
  let count = 0;
  const seen = new Set<string>();
  for (const motif of EMBER_MOTIFS) for (const d of bands) for (const s of bands) for (const r0 of bands) for (const r1 of bands) for (const r2 of bands) for (const si of bands) for (const de of bands) {
    const prof: EmberProfile = { v: 1, durationBand: d, segmentBand: s, reactionBands: [r0, r1, r2], silenceBand: si, depthStage: de, motif };
    const alt = describeSigil(prof);
    assert.ok(alt.endsWith(SIGIL_DISCLAIMER) && alt.length > 60, 'alt text present');
    const stripped = alt.replace(SIGIL_DISCLAIMER, '');
    assert.ok(!FORBIDDEN_WORDS.test(stripped), `alt text stays geometric: ${stripped}`);
    count++;
    if (count % 41 === 0) {
      const g = sigilGeometry(prof, count);
      const nums = [...[...g.rings, ...g.marks].flatMap((x) => (x.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)), ...g.dots.flatMap((x) => [x.cx, x.cy])];
      for (const n of nums) assert.ok(Number.isFinite(n) && n >= -2 && n <= VIEW + 2, `in bounds: ${n}`);
      for (const m of g.marks) assert.ok(m.d.length > 5 && !m.d.includes('NaN'), 'mark has a path');
      seen.add(renderSigilSvg(prof, count));
    }
  }
  assert.equal(count, 6 * 4 ** 7);
  assert.equal(seen.size, Math.floor(count / 41), 'sampled sigils are all distinct');

  // ── alt text spot checks ──
  assert.match(describeSigil(p), /^A sigil of this sitting: three rings with a gap in each ring, twelve marks as petal shapes/);
  assert.match(describeSigil({ ...p, durationBand: 0, silenceBand: 0, reactionBands: [0, 0, 0] }), /^A sigil of this sitting: one ring, twelve marks/);
  assert.ok(!describeSigil({ ...p, reactionBands: [0, 0, 0] }).includes('dot'));
  assert.match(describeSigil({ ...p, reactionBands: [1, 0, 0] }), /one small dot near/);

  // ── component ──
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: EmberSigil } = await import('../../../app/components/EmberSigil');
  const h = ReactNS.createElement;
  const html = renderToStaticMarkup(h(EmberSigil, { record: { profile: p, seed: 42 } }));
  assert.match(html, /<svg[^>]*role="img"[^>]*aria-labelledby="ember-sigil-title-1"/);
  assert.ok(html.includes(`<title id="ember-sigil-title-1">${describeSigil(p)}</title>`), 'title carries the description');
  assert.ok(html.includes(SIGIL_DISCLAIMER), 'caption says it is not an omen');
  assert.equal(html, renderToStaticMarkup(h(EmberSigil, { record: { profile: p, seed: 42 } })), 'server render is stable');
  assert.ok(!renderToStaticMarkup(h(EmberSigil, { record: { profile: p, seed: 42 }, caption: false })).includes('<figcaption'));
  assert.ok(renderToStaticMarkup(h(EmberSigil, { record: { profile: p, seed: 42 }, idSuffix: 'b' })).includes('ember-sigil-title-b'));
  // Same paths as the string renderer.
  const g = sigilGeometry(p, 42);
  for (const x of [...g.rings, ...g.marks]) assert.ok(html.includes(`d="${x.d}"`), 'component draws the geometry');
  for (const x of [...g.rings, ...g.marks]) assert.ok(renderSigilSvg(p, 42).includes(`d="${x.d}"`));
  // The component refuses a poisoned record rather than drawing it.
  assert.throws(() => renderToStaticMarkup(h(EmberSigil, { record: { profile: { ...p, welfareLevel: 2 }, seed: 1 } as never })), /may not carry/);
  assert.throws(() => renderToStaticMarkup(h(EmberSigil, { record: { profile: p, seed: 1, welfare: 1 } as never })), /keys must be exactly/);
  // Escaping in the string renderer.
  assert.ok(renderSigilSvg(p, 1, { title: 'a <b> "c"' }).includes('a &lt;b&gt; &quot;c&quot;'));

  console.log('ember sigil tests passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
