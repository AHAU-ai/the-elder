import assert from 'node:assert/strict';
import { LINEAGE_ARCHETYPES } from './archetypes';
import { lineageToVoiceKey } from './lineageToVoiceKey';
import {
  SEGMENT_MAX,
  MORE_TOKEN,
  SEGMENTED_DELIVERY_EXCLUDED_VOICES,
  segmentedDeliveryClause,
} from './segmentedDelivery';
import {
  MYTH_FIRST_WHOLE_DELIVERY_VOICES,
  MYTH_FIRST_PORTION_WORDS,
  MYTH_FIRST_FINAL_PORTION_WORDS,
  mythFirstDelivery,
  getCatalog,
  findCard,
  mythFirstEligibility,
  mythFirstMoreToCome,
  mythFirstMythToken,
  mythFirstArcBlock,
  mythFirstClause,
  type MythFirstEligibilityInput,
} from './mythFirst';

function ok(name: string, fn: () => void) {
  fn();
  console.log(`  ok  ${name}`);
}

const NORSE_CARD = LINEAGE_ARCHETYPES.norse.archetypes[0];

/** An input that is eligible; each test breaks exactly one thing. */
function base(over: Partial<MythFirstEligibilityInput> = {}): MythFirstEligibilityInput {
  return {
    flagOn: true,
    requested: true,
    lineageKey: 'norse',
    voiceKey: lineageToVoiceKey('norse'),
    mode: 'reading',
    isDeepen: false,
    segmentIndex: 0,
    priorAssistantTurns: 0,
    welfare: { surfaceResources: false, allowPsychopompLayer: true },
    hasLineageArchetype: false,
    hasChainGraft: false,
    figure: NORSE_CARD.name,
    ...over,
  };
}

function reason(i: MythFirstEligibilityInput) {
  const d = mythFirstEligibility(i);
  assert.equal(d.eligible, false);
  return d.eligible ? null : d.reason;
}

// ── delivery ────────────────────────────────────────────────────────────────

ok('whole-delivery voices are exactly the segmented-delivery exclusions', () => {
  assert.deepEqual([...MYTH_FIRST_WHOLE_DELIVERY_VOICES].sort(), [...SEGMENTED_DELIVERY_EXCLUDED_VOICES].sort());
  for (const v of MYTH_FIRST_WHOLE_DELIVERY_VOICES) assert.ok(SEGMENTED_DELIVERY_EXCLUDED_VOICES.has(v));
});

ok('delivery is whole for maya, greek and sufi and segmented for every other lineage', () => {
  for (const lineage of Object.keys(LINEAGE_ARCHETYPES)) {
    const voice = lineageToVoiceKey(lineage);
    const expected = ['maya', 'greek', 'sufi'].includes(lineage) ? 'whole' : 'segmented';
    assert.equal(mythFirstDelivery(voice), expected, lineage);
  }
});

ok('removing a voice from the whole-delivery set makes it ineligible (per-voice kill switch)', () => {
  const without = new Set(['pythia', 'sufi']);
  assert.equal(mythFirstDelivery('ojer_tzij', without), null);
  assert.equal(mythFirstDelivery('pythia', without), 'whole');
  const d = mythFirstEligibility(
    base({
      lineageKey: 'maya',
      voiceKey: 'ojer_tzij',
      segmentIndex: null,
      figure: LINEAGE_ARCHETYPES.maya.archetypes[0].name,
      wholeVoices: without,
    })
  );
  assert.deepEqual(d, { eligible: false, reason: 'delivery_unavailable' });
});

// ── catalog ─────────────────────────────────────────────────────────────────

ok('getCatalog returns the lineage cards; unknown and prototype keys are empty', () => {
  assert.equal(getCatalog('norse').length, LINEAGE_ARCHETYPES.norse.archetypes.length);
  assert.equal(getCatalog('nope').length, 0);
  assert.equal(getCatalog('constructor').length, 0);
  assert.equal(getCatalog('__proto__').length, 0);
  assert.equal(getCatalog('chukchi').length, 0);
});

ok('findCard is an exact match within the lineage only', () => {
  assert.equal(findCard('norse', NORSE_CARD.name), NORSE_CARD);
  assert.equal(findCard('norse', NORSE_CARD.name.toLowerCase()), null);
  assert.equal(findCard('norse', ` ${NORSE_CARD.name}`), null);
  assert.equal(findCard('norse', LINEAGE_ARCHETYPES.stoic.archetypes[0].name), null); // another lineage's card
  assert.equal(findCard('norse', undefined), null);
  assert.equal(findCard('norse', { name: NORSE_CARD.name }), null);
  assert.equal(findCard('norse', ''), null);
});

ok('no two cards in a lineage share a name (the token is validated by name)', () => {
  for (const [lineage, cat] of Object.entries(LINEAGE_ARCHETYPES)) {
    const names = cat.archetypes.map((c) => c.name);
    assert.equal(new Set(names).size, names.length, lineage);
  }
});

// ── eligibility: every rule failing alone ───────────────────────────────────

ok('a fully eligible segmented request is eligible with the card and delivery', () => {
  const d = mythFirstEligibility(base());
  assert.equal(d.eligible, true);
  if (d.eligible) {
    assert.equal(d.delivery, 'segmented');
    assert.equal(d.card, NORSE_CARD);
  }
});

ok('rule 1: flag off', () => assert.equal(reason(base({ flagOn: false })), 'flag_off'));
ok('rule 2: not requested', () => assert.equal(reason(base({ requested: false })), 'not_requested'));

ok('rule 3: delivery availability (segmented)', () => {
  assert.equal(reason(base({ segmentIndex: null })), 'delivery_unavailable'); // segmented not requested
  assert.equal(reason(base({ isDeepen: true })), 'delivery_unavailable');
  assert.equal(reason(base({ mode: 'forge' })), 'delivery_unavailable');
  assert.equal(reason(base({ mode: '' })), 'delivery_unavailable');
  assert.equal(mythFirstEligibility(base({ mode: 'council' })).eligible, true);
  for (const seg of [0, 1, 2]) assert.equal(mythFirstEligibility(base({ segmentIndex: seg })).eligible, true);
});

ok('rule 3: delivery availability (whole)', () => {
  const whole = (over: Partial<MythFirstEligibilityInput> = {}) =>
    base({
      lineageKey: 'greek',
      voiceKey: lineageToVoiceKey('greek'),
      segmentIndex: null,
      figure: LINEAGE_ARCHETYPES.greek.archetypes[0].name,
      ...over,
    });
  const d = mythFirstEligibility(whole());
  assert.equal(d.eligible, true);
  if (d.eligible) assert.equal(d.delivery, 'whole');
  assert.equal(reason(whole({ segmentIndex: 0 })), 'delivery_unavailable'); // a segmented request for a whole voice
  assert.equal(reason(whole({ isDeepen: true })), 'delivery_unavailable');
  assert.equal(reason(whole({ priorAssistantTurns: 2 })), 'delivery_unavailable'); // past the first Reading
  assert.equal(mythFirstEligibility(whole({ priorAssistantTurns: 1 })).eligible, true); // after the clarifying question
  assert.equal(mythFirstEligibility(whole({ mode: 'council' })).eligible, true);
});

ok('rule 4: empty catalog', () => {
  assert.equal(reason(base({ lineageKey: 'chukchi', voiceKey: lineageToVoiceKey('chukchi'), figure: 'x' })), 'empty_catalog');
  assert.equal(reason(base({ lineageKey: 'unknown' })), 'empty_catalog');
});

ok('rule 5: welfare (crisis tier and distress tier both turn it off)', () => {
  assert.equal(reason(base({ welfare: { surfaceResources: true, allowPsychopompLayer: true } })), 'welfare');
  assert.equal(reason(base({ welfare: { surfaceResources: false, allowPsychopompLayer: false } })), 'welfare');
  assert.equal(reason(base({ welfare: { surfaceResources: true, allowPsychopompLayer: false } })), 'welfare');
});

ok('rule 6: a returning seeker or a chain continuation stays story-first', () => {
  assert.equal(reason(base({ hasLineageArchetype: true })), 'returning');
  assert.equal(reason(base({ hasChainGraft: true })), 'returning');
});

ok('rule 7: the figure must be a card in this lineage', () => {
  assert.equal(reason(base({ figure: null })), 'figure_invalid');
  assert.equal(reason(base({ figure: 'NONE' })), 'figure_invalid');
  assert.equal(reason(base({ figure: 'Not A Card' })), 'figure_invalid');
  assert.equal(reason(base({ figure: LINEAGE_ARCHETYPES.stoic.archetypes[0].name })), 'figure_invalid'); // forged cross-lineage figure
});

ok('rules are checked in the documented order (earlier rule wins)', () => {
  assert.equal(reason(base({ flagOn: false, requested: false })), 'flag_off');
  assert.equal(reason(base({ requested: false, isDeepen: true })), 'not_requested');
  assert.equal(reason(base({ isDeepen: true, lineageKey: 'unknown' })), 'delivery_unavailable');
  assert.equal(reason(base({ lineageKey: 'unknown', hasLineageArchetype: true })), 'empty_catalog');
  assert.equal(reason(base({ welfare: { surfaceResources: true, allowPsychopompLayer: true }, hasLineageArchetype: true })), 'welfare');
  assert.equal(reason(base({ hasLineageArchetype: true, figure: null })), 'returning');
});

ok('every selectable lineage with a catalog is eligible with each of its cards', () => {
  for (const [lineage, cat] of Object.entries(LINEAGE_ARCHETYPES)) {
    if (cat.archetypes.length === 0) continue;
    const voice = lineageToVoiceKey(lineage);
    const delivery = mythFirstDelivery(voice);
    assert.ok(delivery, lineage);
    for (const card of cat.archetypes) {
      const d = mythFirstEligibility(
        base({ lineageKey: lineage, voiceKey: voice, segmentIndex: delivery === 'whole' ? null : 0, figure: card.name })
      );
      assert.equal(d.eligible, true, `${lineage}/${card.name}`);
    }
  }
});

// ── moreToCome ──────────────────────────────────────────────────────────────

ok('moreToCome is authoritative: segmented continues until the last allowed segment, whole never', () => {
  assert.equal(mythFirstMoreToCome('segmented', 0), true);
  assert.equal(mythFirstMoreToCome('segmented', 1), true);
  assert.equal(mythFirstMoreToCome('segmented', SEGMENT_MAX - 1), false);
  assert.equal(mythFirstMoreToCome('segmented', null), false);
  assert.equal(mythFirstMoreToCome('whole', null), false);
  assert.equal(mythFirstMoreToCome('whole', 0), false);
});

// ── prompt text ─────────────────────────────────────────────────────────────

const LABEL_WORDS = /part one|part two|part three|\bnext\b|first part|second part|section \d/i;
const FORBIDDEN_VOCAB = /\b(journey|energy|healing|transformation|authentic self|toxic|boundaries|closure|trauma response|self-care|vibration|manifestation|trust the process)\b/i;

ok('MYTH token is the exact card name between the route delimiter', () => {
  const t = mythFirstMythToken(NORSE_CARD);
  assert.equal(t, `⧁MYTH:${NORSE_CARD.name}⧁`);
  assert.ok(/^⧁MYTH:[^⧁]+⧁$/.test(t));
});

ok('segmented clause: MORE required on portions 0 and 1, forbidden on the last', () => {
  for (const seg of [0, 1]) {
    const c = mythFirstClause('segmented', seg, NORSE_CARD);
    assert.ok(c.includes(MORE_TOKEN), `segment ${seg}`);
    assert.match(c, /exactly one question/);
    assert.ok(!c.includes('Do NOT emit'), `segment ${seg}`);
  }
  const last = mythFirstClause('segmented', SEGMENT_MAX - 1, NORSE_CARD);
  assert.ok(last.includes(`Do NOT emit the ${MORE_TOKEN} token`));
  assert.ok(last.includes(mythFirstMythToken(NORSE_CARD)));
  assert.ok(!/exactly one question/.test(last));
});

ok('segmented clause: each portion shows only what it needs (no seeker in the myth, no retelling in the return)', () => {
  const c0 = mythFirstClause('segmented', 0, NORSE_CARD);
  assert.ok(c0.includes(NORSE_CARD.canonicalAnchor));
  assert.ok(!c0.includes(NORSE_CARD.shadow) && !c0.includes(NORSE_CARD.gift) && !c0.includes(NORSE_CARD.elderQuestion));
  assert.match(c0, /Do not turn to the seeker's situation in this portion/);
  const c1 = mythFirstClause('segmented', 1, NORSE_CARD);
  assert.ok(c1.includes(NORSE_CARD.gift) && c1.includes(NORSE_CARD.shadow));
  assert.ok(!c1.includes(NORSE_CARD.canonicalAnchor));
  const c2 = mythFirstClause('segmented', 2, NORSE_CARD);
  assert.ok(c2.includes(NORSE_CARD.elderQuestion));
  assert.ok(!c2.includes(NORSE_CARD.canonicalAnchor));
  assert.match(c2, /does not fit, do not argue for it/);
});

ok('segmented clause: a missing or out-of-range index is clamped by meaning (null is the first portion)', () => {
  assert.equal(mythFirstClause('segmented', null, NORSE_CARD), mythFirstClause('segmented', 0, NORSE_CARD));
  assert.equal(mythFirstClause('segmented', 99, NORSE_CARD), mythFirstClause('segmented', SEGMENT_MAX - 1, NORSE_CARD));
});

ok('whole clause: one unbroken telling, no portions, no question, no MORE token, no word target', () => {
  const c = mythFirstClause('whole', null, NORSE_CARD);
  assert.ok(!c.includes(MORE_TOKEN));
  assert.match(c, /one unbroken telling/);
  assert.match(c, /Do not portion the telling/);
  assert.match(c, /Do not end with a follow-up question/);
  assert.match(c, /sets no word target/);
  assert.ok(c.includes(NORSE_CARD.canonicalAnchor) && c.includes(NORSE_CARD.gift) && c.includes(NORSE_CARD.shadow));
  assert.ok(c.includes(mythFirstMythToken(NORSE_CARD)));
  assert.ok(!/exactly one question/.test(c));
  assert.equal(mythFirstClause('whole', 0, NORSE_CARD), c); // the index is ignored
  assert.equal(mythFirstClause('whole', 2, NORSE_CARD), c);
});

ok('length targets match segmentedDeliveryClause', () => {
  const existing = segmentedDeliveryClause(0);
  assert.ok(existing.includes(`${MYTH_FIRST_PORTION_WORDS} words`), 'portion range drifted');
  assert.ok(existing.includes(`about ${MYTH_FIRST_FINAL_PORTION_WORDS}`), 'final range drifted');
  assert.ok(mythFirstClause('segmented', 0, NORSE_CARD).includes(`${MYTH_FIRST_PORTION_WORDS} words`));
  assert.ok(mythFirstClause('segmented', SEGMENT_MAX - 1, NORSE_CARD).includes(`${MYTH_FIRST_FINAL_PORTION_WORDS} words`));
});

ok('every card in every lineage renders every clause cleanly', () => {
  let n = 0;
  for (const [lineage, cat] of Object.entries(LINEAGE_ARCHETYPES)) {
    for (const card of cat.archetypes) {
      const clauses = [
        mythFirstClause('segmented', 0, card),
        mythFirstClause('segmented', 1, card),
        mythFirstClause('segmented', 2, card),
        mythFirstClause('whole', null, card),
      ];
      for (const c of clauses) {
        const where = `${lineage}/${card.name}`;
        assert.ok(!c.includes('undefined') && !c.includes('[object') && !c.includes('NaN'), where);
        assert.ok(c.includes(card.name), where);
        // The catalog text is the lineage's own and is not ours to police here;
        // scan only the words this module adds around it.
        // Longest first: a short field (the name) can sit inside a long one (the anchor).
        const ours = [card.name, card.role, card.existentialField, card.gift, card.shadow, card.elderQuestion, card.canonicalAnchor]
          .sort((x, y) => y.length - x.length)
          .reduce((acc, v) => acc.split(v).join(''), c);
        assert.ok(!LABEL_WORDS.test(ours), `${where}: labeling words`);
        assert.ok(!FORBIDDEN_VOCAB.test(ours), `${where}: forbidden vocabulary`);
        assert.ok(c.includes('Never explain the token') || c.includes('Do NOT emit'), where);
        n++;
      }
    }
  }
  assert.ok(n > 4 * 40, `rendered ${n} clauses`);
});

ok('arc block names the order, forbids labels, and keeps to one myth', () => {
  const a = mythFirstArcBlock();
  assert.match(a, /in this order, and no other/);
  assert.match(a, /Do not label any movement/);
  assert.match(a, /one myth only/i);
  assert.ok(!LABEL_WORDS.test(a) && !FORBIDDEN_VOCAB.test(a));
});

console.log('mythFirst tests passed');
