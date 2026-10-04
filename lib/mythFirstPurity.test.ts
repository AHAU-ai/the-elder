// Static lineage-purity check for myth-first (docs/myth-first-spec.md, MF-6).
// No model, no network: it builds the prompt the model would receive for the
// first movement of every lineage and every card, and asserts that the card's
// anchor is present and no other lineage's figure is named. Live probes for
// the same properties against a real model live in scripts/drift-detect.mjs.

import assert from 'node:assert/strict';
import { buildSystemPrompt } from './system-prompt-builder';
import { LINEAGE_ARCHETYPES } from './archetypes';
import { LINEAGES, type LineageKey } from './lineages';
import { lineageToVoiceKey } from './lineageToVoiceKey';
import { mythFirstDelivery, type MythFirstPlan } from './mythFirst';

function ok(name: string, fn: () => void) {
  fn();
  console.log(`  ok  ${name}`);
}

function firstMovement(lineage: LineageKey, plan: MythFirstPlan): string {
  return buildSystemPrompt(
    lineage,
    false,
    true,
    'English',
    '',
    '',
    null,
    '',
    'I keep returning to the same argument with my brother.',
    plan.delivery === 'segmented' ? 0 : null,
    '',
    plan
  );
}

const KEYS = (Object.keys(LINEAGES) as LineageKey[]).filter(
  (k) => (LINEAGE_ARCHETYPES[k]?.archetypes.length ?? 0) > 0
);

// A figure name owned by exactly one lineage can prove leakage. Names shared
// by several lineages (if any) are excluded from the leak scan.
const OWNERS = new Map<string, Set<string>>();
for (const k of KEYS) {
  for (const c of LINEAGE_ARCHETYPES[k].archetypes) {
    const set = OWNERS.get(c.name) ?? new Set<string>();
    set.add(k);
    OWNERS.set(c.name, set);
  }
}

// Figures the default (Keeper) lineage's text carries across traditions
// (decision D4). They may appear in the default lineage only.
const DEFAULT_ANCHORS = ['Chiron', 'Inanna'];

ok('every lineage has a delivery for myth-first', () => {
  for (const k of KEYS) {
    assert.ok(mythFirstDelivery(lineageToVoiceKey(k)), `${k} has a delivery`);
  }
});

ok('for every card, the first movement names that card and no other lineage\'s figure', () => {
  let checked = 0;
  for (const k of KEYS) {
    const voice = lineageToVoiceKey(k);
    const delivery = mythFirstDelivery(voice)!;
    for (const card of LINEAGE_ARCHETYPES[k].archetypes) {
      const prompt = firstMovement(k, { delivery, card });
      assert.ok(prompt.includes(card.name), `${k} / ${card.name}: card name is in the prompt`);
      for (const [name, owners] of OWNERS) {
        if (owners.size !== 1 || owners.has(k)) continue;
        assert.ok(!prompt.includes(name), `${k} / ${card.name}: prompt names ${name}, which belongs to ${[...owners][0]}`);
      }
      checked++;
    }
  }
  assert.ok(checked >= 40, `checked ${checked} cards`);
});

ok('the default lineage\'s cross-tradition anchors appear only in the default lineage', () => {
  for (const k of KEYS) {
    if (k === 'default') continue;
    const delivery = mythFirstDelivery(lineageToVoiceKey(k))!;
    for (const card of LINEAGE_ARCHETYPES[k].archetypes) {
      const prompt = firstMovement(k, { delivery, card });
      for (const anchor of DEFAULT_ANCHORS) {
        assert.ok(!prompt.includes(anchor), `${k} / ${card.name}: prompt carries default anchor ${anchor}`);
      }
    }
  }
});

ok('the seeker\'s story is not in the first-movement figure block: the figure block is the card only', () => {
  const k: LineageKey = 'norse';
  const card = LINEAGE_ARCHETYPES[k].archetypes[0];
  const prompt = firstMovement(k, { delivery: mythFirstDelivery(lineageToVoiceKey(k))!, card });
  // The opening is available to the model as context, but the figure block
  // itself is built from the catalog entry alone.
  const start = prompt.indexOf(card.name);
  assert.ok(start >= 0);
  const block = prompt.slice(Math.max(0, start - 200), start + 600);
  assert.ok(!block.includes('my brother'), 'the seeker\'s words are not inside the figure block');
});
