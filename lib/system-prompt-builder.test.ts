/**
 * system-prompt-builder.test.ts — Invariant tests for the psychopompForbidden
 * merge (lib/system-prompt-builder.ts). This layer was documented as
 * additive to o.forbiddenMoves since lib/psychopompLayer.ts was written, but
 * had zero callers until 2026-08-19 (found via
 * scripts/check-unwired-exports.mjs's "NEEDS TRIAGE" list) -- these tests
 * lock in that the merge actually reaches the built prompt, degrades
 * cleanly for voices with no psychopomp layer, and doesn't leak one
 * lineage's forbidden moves into another's prompt.
 *
 * Run: npx tsx lib/system-prompt-builder.test.ts
 */
import { buildSystemPrompt } from './system-prompt-builder';
import { psychopompLayer } from './psychopompLayer';
import { lineageToVoiceKey } from './lineageToVoiceKey';
import { LINEAGES, type LineageKey } from './lineages';

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    console.error(`FAIL  ${name}`);
    failures++;
  }
}

// The exact transform system-prompt-builder.ts applies to each raw clause.
function expectedClause(raw: string): string {
  return `Never ${raw.charAt(0).toLowerCase()}${raw.slice(1)}.`;
}

// 1. A lineage whose voice HAS a psychopomp layer: every one of its
// psychopompForbidden clauses appears in the built prompt, correctly
// transformed (lowercase-first, "Never " prefix, period suffix -- the
// source clauses are capitalized gerund fragments with no trailing
// punctuation, so a naive concatenation would read as broken English).
{
  const layer = psychopompLayer['ojer_tzij'];
  const prompt = buildSystemPrompt('maya');
  const allPresent = layer.psychopompForbidden.every(raw => prompt.includes(expectedClause(raw)));
  check('maya (ojer_tzij, has psychopomp layer): every clause merged in, correctly transformed', allPresent);
}

// 2. A lineage whose voice has NO psychopomp layer (bhikkhu): the merge
// must degrade to nothing added, not throw and not fall back to some
// other voice's content.
{
  const voiceKey = lineageToVoiceKey('buddhist');
  check('buddhist maps to a voiceKey with no psychopomp layer (fixture assumption)', psychopompLayer[voiceKey as keyof typeof psychopompLayer] === undefined);
  const prompt = buildSystemPrompt('buddhist');
  // None of the *other* voices' forbidden clauses should appear here.
  const leaked = Object.entries(psychopompLayer).some(([vk, layer]) =>
    vk !== voiceKey && layer.psychopompForbidden.some(raw => prompt.includes(expectedClause(raw)))
  );
  check('buddhist (no psychopomp layer): no cross-lineage forbidden-move leakage', !leaked);
}

// 3. Cross-lineage isolation, the general case: for every LineageKey that
// does have a psychopomp layer, its clauses appear in ITS OWN prompt and
// not in a different lineage's prompt (spot-checks maya vs. a Norse-voiced
// lineage, since both have real distinct psychopomp content).
{
  const mayaPrompt = buildSystemPrompt('maya');
  const norseLineageKey = (Object.keys(LINEAGES) as LineageKey[]).find(
    k => lineageToVoiceKey(k) === 'volva'
  );
  if (norseLineageKey) {
    const norsePrompt = buildSystemPrompt(norseLineageKey);
    const volvaLayer = psychopompLayer['volva'];
    const volvaClauseLeaksIntoMaya = volvaLayer.psychopompForbidden.some(raw => mayaPrompt.includes(expectedClause(raw)));
    const mayaClauseLeaksIntoNorse = psychopompLayer['ojer_tzij'].psychopompForbidden.some(raw => norsePrompt.includes(expectedClause(raw)));
    check('volva clauses do not leak into the maya (ojer_tzij) prompt', !volvaClauseLeaksIntoMaya);
    check('ojer_tzij clauses do not leak into the norse (volva) prompt', !mayaClauseLeaksIntoNorse);
  } else {
    check('norse lineage key found for cross-check (fixture assumption)', false);
  }
}

// 4. The merged block sits inside "WHAT YOU MUST NEVER DO", after the
// lineage's own o.forbiddenMoves -- additive, not a replacement, and not
// injected somewhere disconnected from the rest of the forbidden-moves
// section.
{
  const prompt = buildSystemPrompt('maya');
  const sectionIdx = prompt.indexOf('WHAT YOU MUST NEVER DO');
  const ownForbiddenIdx = prompt.indexOf(LINEAGES.maya.overlay.forbiddenMoves);
  const firstPsychopompClauseIdx = prompt.indexOf(expectedClause(psychopompLayer['ojer_tzij'].psychopompForbidden[0]));
  check('section header precedes the lineage\'s own forbiddenMoves', sectionIdx !== -1 && sectionIdx < ownForbiddenIdx);
  check('psychopomp clause comes after (additive to) the lineage\'s own forbiddenMoves', ownForbiddenIdx < firstPsychopompClauseIdx);
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
} else {
  console.log('\nAll system-prompt-builder tests passed.');
}
