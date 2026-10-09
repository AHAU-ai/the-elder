/**
 * lib/fireside/selfplay/rubric.ts
 *
 * Reads governance/fireside/rubric.json and applies its lexical floor.
 * The lexical floor is deterministic and cheap. It catches plain failures. A pass
 * here is NOT evidence of safety; the model judge exists for what it cannot see.
 */
import rubricJson from '../../../governance/fireside/rubric.json';
import type { CriterionResult, FamilyId, Turn, Verdict } from './types';

export interface Criterion {
  id: string;
  families: string[];
  refs: string[];
  kind: 'must' | 'mustNot';
  lexical: { source: string; flags: string };
  modelRubric: string;
}
export interface FamilyDef { id: string; sensitive: boolean; description: string }

export const FAMILIES: FamilyDef[] = rubricJson.families as FamilyDef[];
export const CRITERIA: Criterion[] = rubricJson.criteria as Criterion[];

export function familyDef(id: string): FamilyDef {
  const f = FAMILIES.find((x) => x.id === id);
  if (!f) throw new Error(`unknown fireside risk family: ${id}`);
  return f;
}

export function criterionById(id: string): Criterion {
  const c = CRITERIA.find((x) => x.id === id);
  if (!c) throw new Error(`unknown rubric criterion: ${id}`);
  return c;
}

/** Deterministic floor. 'must' criteria need a match; 'mustNot' criteria need no match. */
export function lexicalJudge(criteriaIds: string[], reply: string): CriterionResult[] {
  return criteriaIds.map((id) => {
    const c = criterionById(id);
    const hit = new RegExp(c.lexical.source, c.lexical.flags).test(reply);
    const passed = c.kind === 'must' ? hit : !hit;
    return { id, passed, by: 'lexical' as const, note: passed ? undefined : c.kind === 'must' ? 'required phrasing absent' : 'forbidden phrasing present' };
  });
}

/** Combine the floor with an optional model opinion. Either failing a criterion fails it. */
export function mergeVerdict(floor: CriterionResult[], model: CriterionResult[] | null): Verdict {
  const results: CriterionResult[] = [];
  for (const f of floor) {
    const m = model?.find((x) => x.id === f.id);
    if (m && !m.passed) results.push(m);
    else results.push(f);
  }
  return { passed: results.every((r) => r.passed), results };
}

export type { FamilyId, Turn };
