import assert from 'node:assert/strict';
import { buildSystemPrompt } from './system-prompt-builder';
import { LINEAGE_ARCHETYPES } from './archetypes';
import { LINEAGES, type LineageKey } from './lineages';
import { lineageToVoiceKey } from './lineageToVoiceKey';
import { SEGMENT_MAX } from './segmentedDelivery';
import { READING_SHAPE_CLAUSE } from './readingShapeClause';
import { getPsychopompContext, detectSeekerPosture, formatPsychopompAnnotation } from './psychopompLayer';
import {
  mythFirstArcBlock,
  mythFirstClause,
  mythFirstContractMaterial,
  mythFirstDelivery,
  type MythFirstPlan,
} from './mythFirst';

function ok(name: string, fn: () => void) {
  fn();
  console.log(`  ok  ${name}`);
}

type Args = {
  youngMode?: boolean;
  readingMode?: boolean;
  prior?: string;
  steer?: string;
  trajectory?: string;
  opening?: string;
  segmentIndex?: number | null;
  figureContinuity?: string;
  plan?: MythFirstPlan | null;
};

function build(lineage: LineageKey, a: Args = {}): string {
  return buildSystemPrompt(
    lineage,
    a.youngMode ?? false,
    a.readingMode ?? true,
    'English',
    a.prior ?? '',
    a.steer ?? '',
    null,
    a.trajectory ?? '',
    a.opening ?? '',
    a.segmentIndex ?? null,
    a.figureContinuity ?? '',
    a.plan ?? null
  );
}

const LINEAGE_KEYS = Object.keys(LINEAGES) as LineageKey[];
const STORY_ARC = "The arc moves through: the myth pattern already alive in the seeker's";
const MF_MARK = 'MYTH-FIRST DELIVERY';
const MF_ARC = 'THE ARC OF THE READING — MYTH FIRST';

function planFor(lineage: LineageKey, i = 0): MythFirstPlan {
  const delivery = mythFirstDelivery(lineageToVoiceKey(lineage));
  assert.ok(delivery, `${lineage} has a delivery`);
  return { delivery, card: LINEAGE_ARCHETYPES[lineage].archetypes[i] };
}

// ── the default path is untouched ───────────────────────────────────────────

ok('a null plan equals an omitted plan, for every lineage, mode and segment, and carries no myth-first text', () => {
  let n = 0;
  for (const lineage of LINEAGE_KEYS) {
    for (const readingMode of [false, true]) {
      for (const youngMode of [false, true]) {
        for (const segmentIndex of [null, 0, 1, 2]) {
          const withNull = build(lineage, { readingMode, youngMode, segmentIndex, plan: null, opening: 'I am lost' });
          const omitted = buildSystemPrompt(lineage, youngMode, readingMode, 'English', '', '', null, '', 'I am lost', segmentIndex);
          assert.equal(withNull, omitted, `${lineage}`);
          assert.ok(!withNull.includes(MF_MARK) && !withNull.includes(MF_ARC), lineage);
          assert.ok(withNull.includes(STORY_ARC), `${lineage}: story-first arc present`);
          n++;
        }
      }
    }
  }
  assert.ok(n >= 100);
});

ok('the arc and Council headings the swap relies on are still in the default prompt, in order', () => {
  const p = build('norse');
  const a = p.indexOf('━━━ THE ARC OF THE READING ━━━');
  const c = p.indexOf('━━━ COUNCIL MODE ━━━');
  assert.ok(a > 0 && c > a, 'headings moved: update ARC_START/ARC_END in lib/system-prompt-builder.ts');
});

// ── a myth-first prompt ─────────────────────────────────────────────────────

ok('every lineage and card: the arc is swapped, the story-first arc and segmented block are gone, the delivery block is present', () => {
  let n = 0;
  for (const lineage of LINEAGE_KEYS) {
    const cards = LINEAGE_ARCHETYPES[lineage].archetypes;
    for (let i = 0; i < cards.length; i++) {
      const plan = planFor(lineage, i);
      const indexes = plan.delivery === 'whole' ? [null] : [0, 1, 2];
      for (const segmentIndex of indexes) {
        const p = build(lineage, { plan, segmentIndex });
        const where = `${lineage}/${plan.card.name}/${segmentIndex}`;
        assert.ok(p.includes(MF_ARC), where);
        assert.equal(p.split(MF_ARC).length - 1, 1, `${where}: arc appears once`);
        assert.ok(!p.includes(STORY_ARC), `${where}: story arc removed`);
        assert.ok(!p.includes('SEGMENTED DELIVERY'), `${where}: no old segmented block`);
        assert.ok(!p.includes('the whole arc, unbroken'), `${where}: no old reading-mode instruction`);
        assert.ok(!p.includes('Name the archetype to the seeker once'), `${where}: no story-first naming register`);
        assert.ok(p.includes(mythFirstClause(plan.delivery, segmentIndex, plan.card)), where);
        assert.ok(p.includes('━━━ COUNCIL MODE ━━━'), `${where}: Council heading kept`);
        assert.ok(p.includes(mythFirstArcBlock()), where);
        n++;
      }
    }
  }
  assert.ok(n > 100, `checked ${n} prompts`);
});

ok('the rest of the prompt is unchanged: head up to the arc, and the ceiling and hand-off tail, match story-first', () => {
  const plan = planFor('norse');
  const last = SEGMENT_MAX - 1; // seeker-derived blocks are on here, so the head is comparable
  const mf = build('norse', { plan, segmentIndex: last, opening: 'I am lost', prior: 'PRIORMARK' });
  const plain = build('norse', { segmentIndex: last, opening: 'I am lost', prior: 'PRIORMARK' });
  const head = (p: string) => p.slice(0, p.indexOf('\u2501\u2501\u2501 THE ARC OF THE READING'));
  assert.equal(head(mf), head(plain));
  assert.equal(mf.slice(-1500), plain.slice(-1500));
  assert.ok(mf.includes('\u2501\u2501\u2501 FORGE MODE \u2501\u2501\u2501'));
});

ok('council mode (before the Reading is delivered) keeps the clarifying-question rules and adds the delivery block', () => {
  const plan = planFor('norse');
  const p = build('norse', { plan, segmentIndex: 0, readingMode: false });
  assert.ok(p.includes('BEFORE YOU DECLINE'));
  assert.ok(p.includes('deliver the Reading now, in the order and form set out in MYTH-FIRST DELIVERY below'));
  assert.ok(p.includes(MF_MARK));
  assert.match(p, /never to a clarifying question/);
});

ok('reading mode: the segmented plan allows only the closing follow-up question; the whole plan allows none', () => {
  const seg = build('norse', { plan: planFor('norse'), segmentIndex: 0 });
  assert.ok(seg.includes('The only question you ask is the single follow-up that closes a portion.'));
  const whole = build('greek', { plan: planFor('greek'), segmentIndex: null });
  assert.ok(!whole.includes('The only question you ask'));
});

// ── seeker-derived blocks ───────────────────────────────────────────────────

ok('prior-myth, trajectory and feedback blocks: withheld on portions 0 and 1, applied on the final portion and in a whole delivery', () => {
  const marks = { prior: 'PRIORMARK', steer: 'STEERMARK', trajectory: 'TRAJMARK' };
  const has = (p: string) => ['PRIORMARK', 'STEERMARK', 'TRAJMARK'].map((m) => p.includes(m));
  const norse = planFor('norse');
  assert.deepEqual(has(build('norse', { ...marks, plan: norse, segmentIndex: 0 })), [false, false, false]);
  assert.deepEqual(has(build('norse', { ...marks, plan: norse, segmentIndex: 1 })), [false, false, false]);
  assert.deepEqual(has(build('norse', { ...marks, plan: norse, segmentIndex: SEGMENT_MAX - 1 })), [true, true, true]);
  assert.deepEqual(has(build('greek', { ...marks, plan: planFor('greek'), segmentIndex: null })), [true, true, true]);
  // and the story-first path still carries them on every segment
  assert.deepEqual(has(build('norse', { ...marks, segmentIndex: 0 })), [true, true, true]);
});

ok('psychopomp annotation follows the same rule', () => {
  const opening = 'I do not know where to begin and I am tired';
  let checked = 0;
  for (const lineage of LINEAGE_KEYS) {
    const layer = getPsychopompContext(lineageToVoiceKey(lineage));
    if (!layer || LINEAGE_ARCHETYPES[lineage].archetypes.length === 0) continue;
    const annotation = formatPsychopompAnnotation(layer, detectSeekerPosture(opening));
    if (!annotation) continue;
    const plan = planFor(lineage);
    const whole = plan.delivery === 'whole';
    const idx = (n: number) => (whole ? null : n);
    const first = build(lineage, { plan, segmentIndex: idx(0), opening });
    const last = build(lineage, { plan, segmentIndex: idx(SEGMENT_MAX - 1), opening });
    assert.equal(first.includes(annotation), whole, `${lineage} first`);
    assert.ok(last.includes(annotation), `${lineage} last`);
    assert.ok(build(lineage, { segmentIndex: 0, opening }).includes(annotation), `${lineage} story-first`);
    checked++;
  }
  assert.ok(checked >= 3, `checked ${checked} lineages with a layer`);
});

// ── mutual exclusion and the shape clause ───────────────────────────────────

ok('a figure-continuity clause and a myth-first plan never share a prompt (story-first wins)', () => {
  for (const lineage of ['norse', 'greek', 'maya'] as LineageKey[]) {
    const plan = planFor(lineage);
    const both = build(lineage, { plan, segmentIndex: plan.delivery === 'whole' ? null : 0, figureContinuity: 'FIGURE CONTINUITY. test clause' });
    assert.ok(both.includes('FIGURE CONTINUITY. test clause'));
    assert.ok(!both.includes(MF_MARK) && !both.includes(MF_ARC), lineage);
    assert.equal(
      both,
      build(lineage, { segmentIndex: plan.delivery === 'whole' ? null : 0, figureContinuity: 'FIGURE CONTINUITY. test clause' })
    );
  }
});

ok('the closing-shape clause is never added to a myth-first prompt', () => {
  // Note: READING_SHAPE_REVIEWED_VOICES holds the lineage key "norse" but the builder passes the
  // voice key ("volva"), so the clause is not applied to any voice on main today. This test does
  // not depend on that: with a plan the clause must be absent whichever way the gate resolves.
  for (const lineage of LINEAGE_KEYS) {
    if (LINEAGE_ARCHETYPES[lineage].archetypes.length === 0) continue;
    const plan = planFor(lineage);
    const p = build(lineage, { plan, segmentIndex: plan.delivery === 'whole' ? null : 0 });
    assert.ok(!p.includes(READING_SHAPE_CLAUSE), lineage);
  }
});

ok('KNOWN (MF-7): the Ajq\'ij reading directive still follows a maya whole delivery, unchanged', () => {
  const p = build('maya', { plan: planFor('maya'), segmentIndex: null });
  assert.ok(p.includes("Ajq'ij Voice Directive - Reading Mode"));
  assert.ok(p.includes('Do not add offers,'));
  // The directive says each section "must name the seeker's pattern". That pulls against the
  // myth-first order, so the Stanzione review in MF-7 decides; the voice file is not edited here.
  assert.ok(p.includes("Each section of the Reading must name the seeker's pattern"));
  assert.ok(p.indexOf(MF_MARK) < p.indexOf("Ajq'ij Voice Directive - Reading Mode"));
});

// ── contract material ───────────────────────────────────────────────────────

ok('contract material is empty while the flag is dark and versioned when lit', () => {
  const prev = process.env.MYTH_FIRST_ENABLED;
  try {
    delete process.env.MYTH_FIRST_ENABLED;
    assert.equal(mythFirstContractMaterial(), '');
    process.env.MYTH_FIRST_ENABLED = 'false';
    assert.equal(mythFirstContractMaterial(), '');
    process.env.MYTH_FIRST_ENABLED = 'TRUE';
    assert.equal(mythFirstContractMaterial(), ''); // exactly "true" only
    process.env.MYTH_FIRST_ENABLED = 'true';
    const lit = mythFirstContractMaterial();
    assert.ok(lit.includes(MF_ARC) && lit.includes(MF_MARK));
    assert.ok(lit.includes('{FIGURE}') && !lit.includes(LINEAGE_ARCHETYPES.norse.archetypes[0].name)); // catalog does not move the hash
  } finally {
    if (prev === undefined) delete process.env.MYTH_FIRST_ENABLED;
    else process.env.MYTH_FIRST_ENABLED = prev;
  }
});

console.log('mythFirst prompt tests passed');
