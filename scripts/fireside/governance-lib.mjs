// scripts/fireside/governance-lib.mjs
//
// Pure logic for governance-as-data: validating the fireside rule records and
// comparing a proposed change against the base branch.
//
// The rule: tightening a guardrail needs one approval; LOOSENING one needs two
// distinct human approvals and a clean probe run on record. "Loosening" is
// decided by comparing the records, not by what the author calls it.

import { isHumanHandle } from "./probe-lib.mjs";

const EXPECTED_IDS = Array.from({ length: 17 }, (_, i) => `V${i + 1}`);
const TEST_KINDS = ["db", "unit", "integration", "chaos", "canary", "lint", "probe", "ui"];
const TEST_STATUS_RANK = { planned: 0, built: 1, enforced: 2 };
const CHANGES = ["initial", "tighten", "loosen", "clarify"];

/** Structural + coverage validation of rules.json. Returns { errors, warnings }. */
export function validateRules(doc, { probes = [] } = {}) {
  const errors = [];
  const warnings = [];
  if (!doc || !Array.isArray(doc.rules)) return { errors: ["rules.json must have a rules array"], warnings };

  const ids = doc.rules.map((r) => r.id);
  for (const want of EXPECTED_IDS) if (!ids.includes(want)) errors.push(`${want}: missing rule record (V1-V17 must all exist)`);
  for (const id of ids) {
    if (!EXPECTED_IDS.includes(id)) errors.push(`${id}: not a known invariant id`);
    if (ids.filter((x) => x === id).length > 1) errors.push(`${id}: duplicate record`);
  }

  for (const r of doc.rules) {
    const e = (m) => errors.push(`${r.id}: ${m}`);
    for (const k of ["title", "statement"]) if (typeof r[k] !== "string" || r[k].trim().length < 8) e(`${k} is required`);
    if (!r.owner || typeof r.owner.module !== "string" || !["planned", "built"].includes(r.owner.status)) e("owner needs { module, status: planned|built }");
    for (const layer of ["prevent", "detect", "contain"]) {
      if (!r.layers || typeof r.layers[layer] !== "string" || r.layers[layer].trim().length < 5) e(`layers.${layer} is required (every rule is held at prevent, detect and contain)`);
    }
    if (!Array.isArray(r.tests) || r.tests.length === 0) e("needs at least one test record");
    else {
      const tids = new Set();
      for (const t of r.tests) {
        if (!t.id || !t.id.startsWith(`${r.id}-`)) e(`test id "${t.id}" must start with "${r.id}-" (every test is tagged with its V number)`);
        if (tids.has(t.id)) e(`duplicate test id ${t.id}`);
        tids.add(t.id);
        if (!TEST_KINDS.includes(t.kind)) e(`test ${t.id}: kind must be one of ${TEST_KINDS.join(", ")}`);
        if (!(t.status in TEST_STATUS_RANK)) e(`test ${t.id}: status must be planned|built|enforced`);
      }
      if (r.owner && r.owner.status === "built" && !r.tests.some((t) => t.status !== "planned")) e("owner is built but no test is built or enforced");
    }
    if (!Number.isInteger(r.strictness) || r.strictness < 1) e("strictness must be an integer >= 1");
    if (!Number.isInteger(r.version) || r.version < 1) e("version must be an integer >= 1");
    if (!Array.isArray(r.incidents)) e("incidents must be an array");
    else for (const inc of r.incidents) if (!/^INC-\d{4}-\d{3}$/.test(inc)) e(`incident id "${inc}" is malformed`);

    // History must be contiguous, end at the current version, and carry real approvals.
    if (!Array.isArray(r.history) || r.history.length === 0) { e("history is required"); continue; }
    r.history.forEach((h, i) => {
      if (h.version !== i + 1) e(`history[${i}].version should be ${i + 1}`);
      if (!CHANGES.includes(h.change)) e(`history[${i}].change must be one of ${CHANGES.join(", ")}`);
      if (!Array.isArray(h.approvals)) return e(`history[${i}].approvals must be an array`);
      const distinct = new Set(h.approvals);
      if (distinct.size !== h.approvals.length) e(`history[${i}] lists the same approver twice`);
      for (const a of h.approvals) if (!isHumanHandle(a)) e(`history[${i}] approver "${a}" is not an acceptable human handle`);
      if (h.change === "loosen") {
        if (distinct.size < 2) e(`history[${i}] loosens the rule but has ${distinct.size} approval(s); two distinct humans are required`);
        const pr = h.probeRun;
        if (!pr || !pr.runId || pr.clean !== true || !/^\d{4}-\d{2}-\d{2}$/.test(pr.date || "")) e(`history[${i}] loosens the rule but has no clean probe run ({runId, clean:true, date})`);
      }
    });
    const last = r.history[r.history.length - 1];
    if (last.version !== r.version) e(`version ${r.version} does not match the last history entry (${last.version})`);
    if (r.ratified === true && (last.approvals || []).length < 1) e("ratified is true but the latest history entry has no approval");
    if (r.ratified !== true) warnings.push(`${r.id}: not yet ratified by a human`);

    // Tests and probes must point at each other honestly.
    for (const p of probes) {
      if (p.ref === r.id && p.status === "approved" && !r.tests.some((t) => t.kind === "probe")) {
        warnings.push(`${r.id}: has approved probes (${p.id}) but no test record of kind "probe"`);
        break;
      }
    }
  }
  return { errors, warnings };
}

function testRank(t) { return TEST_STATUS_RANK[t.status] ?? 0; }

/**
 * What kind of change is this, judged from the records alone?
 * Returns { kind: "none"|"tighten"|"loosen"|"clarify", reasons: string[] }.
 * Anything that removes protection counts as loosening, even if mixed with tightening.
 */
export function classifyChange(oldRule, newRule) {
  const loosen = [];
  const tighten = [];
  const other = [];
  if (!oldRule) return { kind: "tighten", reasons: ["new rule"] };
  if (!newRule) return { kind: "loosen", reasons: ["rule removed"] };

  if (newRule.strictness < oldRule.strictness) loosen.push(`strictness ${oldRule.strictness} -> ${newRule.strictness}`);
  if (newRule.strictness > oldRule.strictness) tighten.push(`strictness ${oldRule.strictness} -> ${newRule.strictness}`);

  for (const layer of ["prevent", "detect", "contain"]) {
    const a = (oldRule.layers || {})[layer] || "";
    const b = (newRule.layers || {})[layer] || "";
    if (a !== b) other.push(`layers.${layer} text changed`);
  }
  const oldTests = new Map((oldRule.tests || []).map((t) => [t.id, t]));
  const newTests = new Map((newRule.tests || []).map((t) => [t.id, t]));
  for (const [id, t] of oldTests) {
    const n = newTests.get(id);
    if (!n) loosen.push(`test ${id} removed`);
    else if (testRank(n) < testRank(t)) loosen.push(`test ${id} downgraded ${t.status} -> ${n.status}`);
    else if (testRank(n) > testRank(t)) tighten.push(`test ${id} upgraded ${t.status} -> ${n.status}`);
    if (n && n.kind !== t.kind) other.push(`test ${id} kind changed`);
  }
  for (const id of newTests.keys()) if (!oldTests.has(id)) tighten.push(`test ${id} added`);
  if (oldRule.statement !== newRule.statement) other.push("statement text changed");
  if (oldRule.title !== newRule.title) other.push("title changed");
  if (JSON.stringify(oldRule.owner) !== JSON.stringify(newRule.owner)) other.push("owner changed");

  if (loosen.length) return { kind: "loosen", reasons: loosen.concat(tighten, other) };
  if (tighten.length) return { kind: "tighten", reasons: tighten.concat(other) };
  if (other.length) return { kind: "clarify", reasons: other };
  return { kind: "none", reasons: [] };
}

/**
 * Compare proposed rules to the base branch's rules. Returns { errors, notes }.
 * - Any change needs a version bump and a new history entry declaring it.
 * - The declared change must not understate what the diff shows.
 * - loosen: two distinct approvals + clean probe run (also checked in validateRules).
 * - tighten/clarify: at least one approval, unless the rule is still unratified draft text.
 */
export function checkAgainstBase(baseDoc, nextDoc) {
  const errors = [];
  const notes = [];
  const baseById = new Map((baseDoc?.rules || []).map((r) => [r.id, r]));
  const nextById = new Map((nextDoc?.rules || []).map((r) => [r.id, r]));

  for (const [id, oldRule] of baseById) {
    if (!nextById.has(id)) errors.push(`${id}: rule removed. Removing an invariant is a loosening and is not permitted through this check; retire it with a recorded history entry instead`);
  }
  for (const [id, newRule] of nextById) {
    const oldRule = baseById.get(id);
    if (!oldRule) {
      notes.push(`${id}: new rule`);
      continue;
    }
    const { kind, reasons } = classifyChange(oldRule, newRule);
    if (kind === "none") {
      if (JSON.stringify(oldRule) !== JSON.stringify(newRule) && newRule.version === oldRule.version) {
        // incidents, ratified flag or history-only edits: only allow additions of incidents.
        const stripped = (r) => JSON.stringify({ ...r, incidents: undefined, ratified: undefined, history: undefined });
        if (stripped(oldRule) !== stripped(newRule)) errors.push(`${id}: changed without a version bump`);
        const lost = (oldRule.incidents || []).filter((i) => !(newRule.incidents || []).includes(i));
        if (lost.length) errors.push(`${id}: incidents removed (${lost.join(", ")}); incident links are permanent`);
        if (JSON.stringify(oldRule.history) !== JSON.stringify(newRule.history)) errors.push(`${id}: history edited without a version bump; history is append-only`);
      }
      continue;
    }
    if (newRule.version !== oldRule.version + 1) {
      errors.push(`${id}: ${kind} change (${reasons.join("; ")}) needs version ${oldRule.version + 1}, found ${newRule.version}`);
      continue;
    }
    const oldHist = oldRule.history || [];
    const newHist = newRule.history || [];
    if (JSON.stringify(newHist.slice(0, oldHist.length)) !== JSON.stringify(oldHist)) errors.push(`${id}: earlier history entries were altered; history is append-only`);
    const entry = newHist[newHist.length - 1];
    if (!entry || entry.version !== newRule.version) { errors.push(`${id}: no history entry for version ${newRule.version}`); continue; }

    const rank = { clarify: 0, tighten: 1, loosen: 2 };
    if (rank[entry.change] === undefined) errors.push(`${id}: history entry change "${entry.change}" is not valid for an edit`);
    else if (rank[entry.change] < rank[kind]) errors.push(`${id}: declared "${entry.change}" but the records show a ${kind} (${reasons.join("; ")})`);

    const approvals = new Set(entry.approvals || []);
    if (kind === "loosen") {
      if (approvals.size < 2) errors.push(`${id}: loosening (${reasons.join("; ")}) needs 2 distinct human approvals, found ${approvals.size}`);
      if (!entry.probeRun || entry.probeRun.clean !== true) errors.push(`${id}: loosening needs a clean probe run recorded in the history entry`);
    } else if (approvals.size < 1) {
      errors.push(`${id}: ${kind} needs at least 1 human approval recorded in the history entry`);
    }
    notes.push(`${id}: ${kind} (${reasons.join("; ")})`);
  }
  return { errors, notes };
}
