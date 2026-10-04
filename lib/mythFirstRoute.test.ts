import assert from 'node:assert/strict';
import { LINEAGE_ARCHETYPES } from './archetypes';
import {
  readMythFirstRequest,
  mythFirstStageAllows,
  priorAssistantTurns,
  selectorNeeded,
  figureRetrievalQuery,
  resolveMythFirst,
  mythFirstServerMoreToCome,
  mythFirstArchetypeName,
  mythFirstResponseFields,
  type ResolveInput,
} from './mythFirstRoute';
import { mythFirstEnabled, mythFirstOpenToAll } from '../config/returning-features';

function ok(name: string, fn: () => void) {
  fn();
  console.log(`  ok  ${name}`);
}

const NORSE = LINEAGE_ARCHETYPES.norse.archetypes;
const MAYA = LINEAGE_ARCHETYPES.maya.archetypes;
const WELL = { surfaceResources: false, allowPsychopompLayer: true };

function base(over: Partial<ResolveInput> = {}): ResolveInput {
  return {
    stageAllows: true,
    register: 'adult',
    request: { requested: true, clientFigure: null },
    selector: { figure: NORSE[0] },
    lineageKey: 'norse',
    voiceKey: 'volva',
    mode: 'reading',
    isDeepen: false,
    segmentIndex: 0,
    priorAssistantTurns: 0,
    welfare: WELL,
    hasLineageArchetype: false,
    hasChainGraft: false,
    ...over,
  };
}

ok('request parsing: only the exact string asks, and a long or non-string figure is dropped', () => {
  assert.deepEqual(readMythFirstRequest({}), { requested: false, clientFigure: null });
  assert.equal(readMythFirstRequest({ readingForm: 'myth_first' }).requested, true);
  assert.equal(readMythFirstRequest({ readingForm: 'MYTH_FIRST' }).requested, false);
  assert.equal(readMythFirstRequest({ readingForm: true }).requested, false);
  assert.equal(readMythFirstRequest({ figure: 42 }).clientFigure, null);
  assert.equal(readMythFirstRequest({ figure: 'x'.repeat(500) }).clientFigure, null);
  assert.equal(readMythFirstRequest({ figure: 'Odin' }).clientFigure, 'Odin');
});

ok('stage: flag off is always off; flag on is testers only until opened to all', () => {
  assert.equal(mythFirstStageAllows({ flagOn: false, openToAll: true, isTester: true }), false);
  assert.equal(mythFirstStageAllows({ flagOn: true, openToAll: false, isTester: false }), false);
  assert.equal(mythFirstStageAllows({ flagOn: true, openToAll: false, isTester: true }), true);
  assert.equal(mythFirstStageAllows({ flagOn: true, openToAll: true, isTester: false }), true);
});

ok('flags read the environment at call time and fail closed', () => {
  const a = process.env.MYTH_FIRST_ENABLED;
  const b = process.env.MYTH_FIRST_ALL_SEEKERS;
  try {
    delete process.env.MYTH_FIRST_ENABLED;
    delete process.env.MYTH_FIRST_ALL_SEEKERS;
    assert.equal(mythFirstEnabled(), false);
    assert.equal(mythFirstOpenToAll(), false);
    process.env.MYTH_FIRST_ENABLED = '1';
    process.env.MYTH_FIRST_ALL_SEEKERS = 'TRUE';
    assert.equal(mythFirstEnabled(), false);
    assert.equal(mythFirstOpenToAll(), false);
    process.env.MYTH_FIRST_ENABLED = 'true';
    process.env.MYTH_FIRST_ALL_SEEKERS = 'true';
    assert.equal(mythFirstEnabled(), true);
    assert.equal(mythFirstOpenToAll(), true);
  } finally {
    if (a === undefined) delete process.env.MYTH_FIRST_ENABLED; else process.env.MYTH_FIRST_ENABLED = a;
    if (b === undefined) delete process.env.MYTH_FIRST_ALL_SEEKERS; else process.env.MYTH_FIRST_ALL_SEEKERS = b;
  }
});

ok('prior assistant turns counts assistant messages only', () => {
  assert.equal(priorAssistantTurns([]), 0);
  assert.equal(
    priorAssistantTurns([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: 'b' },
      { role: 'user', content: 'c' },
    ]),
    1,
  );
});

const need = (over = {}) => ({
  stageAllows: true,
  requested: true,
  lineageKey: 'norse',
  voiceKey: 'volva',
  mode: 'reading',
  isDeepen: false,
  segmentIndex: 0 as number | null,
  clientCard: null,
  ...over,
});

ok('selector is spent only at the start of a myth-first Reading', () => {
  assert.equal(selectorNeeded(need()), true);
  assert.equal(selectorNeeded(need({ stageAllows: false })), false);
  assert.equal(selectorNeeded(need({ requested: false })), false);
  assert.equal(selectorNeeded(need({ isDeepen: true })), false);
  assert.equal(selectorNeeded(need({ mode: 'forge' })), false);
  assert.equal(selectorNeeded(need({ segmentIndex: null })), false); // segmentable voice, not segmented
});

ok('selector on a later segment only when the client lost the figure', () => {
  assert.equal(selectorNeeded(need({ segmentIndex: 1, clientCard: null })), true);
  assert.equal(selectorNeeded(need({ segmentIndex: 2, clientCard: null })), true);
  assert.equal(selectorNeeded(need({ segmentIndex: 1, clientCard: NORSE[0] })), false);
});

ok('selector for a whole-delivery voice runs on its single request, never on a segment', () => {
  assert.equal(selectorNeeded(need({ lineageKey: 'maya', voiceKey: 'ojer_tzij', segmentIndex: null })), true);
  assert.equal(selectorNeeded(need({ lineageKey: 'maya', voiceKey: 'ojer_tzij', segmentIndex: 0 })), false);
  // kill switch: voice removed from the whole-delivery set
  assert.equal(
    selectorNeeded(need({ lineageKey: 'maya', voiceKey: 'ojer_tzij', segmentIndex: null, wholeVoices: new Set<string>() })),
    false,
  );
});

ok('retrieval query is the figure, not the seeker', () => {
  const q = figureRetrievalQuery(NORSE[0]);
  assert.ok(q.includes(NORSE[0].name));
  assert.ok(q.includes(NORSE[0].role));
});

ok('segment 0: the selector figure is used and the client figure is ignored', () => {
  const r = resolveMythFirst(base({ request: { requested: true, clientFigure: NORSE[1].name } }));
  assert.ok(r.plan);
  assert.equal(r.plan.card.name, NORSE[0].name);
  assert.equal(r.plan.delivery, 'segmented');
});

ok('segment 1 and 2: the client figure is used when it is in the catalog', () => {
  for (const seg of [1, 2]) {
    const r = resolveMythFirst(
      base({ segmentIndex: seg, priorAssistantTurns: seg, selector: null, request: { requested: true, clientFigure: NORSE[1].name } }),
    );
    assert.ok(r.plan);
    assert.equal(r.plan.card.name, NORSE[1].name);
  }
});

ok('a figure from another lineage is never accepted (client or selector path)', () => {
  const r = resolveMythFirst(
    base({ segmentIndex: 1, selector: null, request: { requested: true, clientFigure: MAYA[0].name } }),
  );
  assert.equal(r.plan, null);
  assert.ok(r.notes.includes('figure_off_catalog'));
  assert.ok(r.notes.includes('myth_first_fallback:figure_invalid'));
});

ok('a missing client figure on segment 1 falls back to the re-run selector', () => {
  const r = resolveMythFirst(base({ segmentIndex: 1, request: { requested: true, clientFigure: null } }));
  assert.ok(r.plan);
  assert.equal(r.plan.card.name, NORSE[0].name);
});

ok('selector failure gives story-first and records why', () => {
  const r = resolveMythFirst(base({ selector: { figure: null, note: 'selector_timeout' } }));
  assert.equal(r.plan, null);
  assert.deepEqual(r.notes, ['selector_timeout', 'myth_first_fallback:figure_invalid']);
});

ok('every ineligibility is story-first: stage, not requested, welfare, distress, returning, deepen', () => {
  assert.equal(resolveMythFirst(base({ stageAllows: false })).plan, null);
  assert.equal(resolveMythFirst(base({ request: { requested: false, clientFigure: null } })).plan, null);
  assert.equal(resolveMythFirst(base({ welfare: { surfaceResources: true, allowPsychopompLayer: false } })).plan, null);
  assert.equal(resolveMythFirst(base({ welfare: { surfaceResources: false, allowPsychopompLayer: false } })).plan, null); // distress
  assert.equal(resolveMythFirst(base({ hasLineageArchetype: true })).plan, null);
  assert.equal(resolveMythFirst(base({ hasChainGraft: true })).plan, null);
  assert.equal(resolveMythFirst(base({ isDeepen: true })).plan, null);
});

ok('no fallback note when the request did not ask or the stage is closed', () => {
  assert.deepEqual(resolveMythFirst(base({ stageAllows: false })).notes, []);
  assert.deepEqual(resolveMythFirst(base({ request: { requested: false, clientFigure: null } })).notes, []);
});

ok('whole delivery: excluded voice in the set tells it once; out of the set is story-first', () => {
  const whole = base({
    lineageKey: 'maya',
    voiceKey: 'ojer_tzij',
    segmentIndex: null,
    selector: { figure: MAYA[0] },
  });
  const r = resolveMythFirst(whole);
  assert.ok(r.plan);
  assert.equal(r.plan.delivery, 'whole');
  assert.equal(mythFirstServerMoreToCome(r.plan, null), false);
  assert.equal(mythFirstArchetypeName(r.plan, false), MAYA[0].name);
  const off = resolveMythFirst({ ...whole, wholeVoices: new Set<string>() });
  assert.equal(off.plan, null);
});

ok('whole delivery is bounded to a first Reading', () => {
  const r = resolveMythFirst(
    base({ lineageKey: 'maya', voiceKey: 'ojer_tzij', segmentIndex: null, selector: { figure: MAYA[0] }, priorAssistantTurns: 3 }),
  );
  assert.equal(r.plan, null);
});

ok('moreToCome is server-authoritative for segmented delivery', () => {
  const plan = resolveMythFirst(base()).plan!;
  assert.equal(mythFirstServerMoreToCome(plan, 0), true);
  assert.equal(mythFirstServerMoreToCome(plan, 1), true);
  assert.equal(mythFirstServerMoreToCome(plan, 2), false);
  assert.equal(mythFirstArchetypeName(plan, true), null);
  assert.equal(mythFirstArchetypeName(plan, false), NORSE[0].name);
});

ok('response fields: nothing unless asked; story_first when asked and not told; full when told', () => {
  const plan = resolveMythFirst(base()).plan!;
  assert.equal(mythFirstResponseFields(null, false), null);
  assert.deepEqual(mythFirstResponseFields(null, true), { form: 'story_first' });
  assert.deepEqual(mythFirstResponseFields(plan, true), {
    form: 'myth_first',
    delivery: 'segmented',
    figure: NORSE[0].name,
  });
});

ok('register: adult and young_adult are myth-first; child and an unset register follow D17', () => {
  assert.ok(resolveMythFirst(base({ register: 'adult' })).plan);
  assert.ok(resolveMythFirst(base({ register: 'young_adult' })).plan);
  assert.ok(resolveMythFirst(base({ register: null })).plan);
  const child = resolveMythFirst(base({ register: 'child' }));
  assert.equal(child.plan, null);
  assert.deepEqual(child.notes, ['myth_first_fallback:child_register']);
  assert.deepEqual(resolveMythFirst(base({ register: 'child', stageAllows: false })).notes, []);
});
