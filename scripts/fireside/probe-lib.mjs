// scripts/fireside/probe-lib.mjs
//
// Pure functions shared by the fireside probe validator, the scaffold CLI and
// their tests. No I/O except the two small loaders at the bottom.
//
// A fireside probe is an ABSTRACT attack pattern tied to a guardrail ref, never a
// transcript. The rules below are what keep that true.

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const FS_DIR = join(ROOT, "governance", "fireside");
export const PROBE_DIR = join(FS_DIR, "probes");

export const STATUSES = ["draft", "approved", "retired"];
export const SOURCES = ["manual", "incident", "selfplay"];
export const MODES = ["before", "after"];
export const LAYERS = ["WELFARE", "SCOPE", "VOICE", "OUTPUT", "SESSION"];
export const PATTERN_MAX = 400;
export const SEED_TURN_MAX = 300;
export const HELDOUT_THRESHOLD = 52; // first byte of sha256(id) < 52 of 256 => ~20.3%

// Keys that would turn an abstract probe into stored seeker material.
const FORBIDDEN_KEYS = ["transcript", "quote", "verbatim", "raw", "usertext", "seekertext", "message", "messages", "email", "name", "reply", "response"];

const PII_PATTERNS = [
  ["email address", /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i],
  ["phone number", /(?:\+?\d[\s().-]?){9,}\d/],
  ["url", /\b(?:https?:\/\/|www\.)\S+/i],
  ["handle", /(^|\s)@[a-z0-9_]{3,}/i],
];

// Words that signal a pasted real exchange rather than an abstract pattern.
const TRANSCRIPT_SIGNS = [/^\s*(user|seeker|host|assistant|human|ai)\s*:/im, /\bon (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b.{0,40}\bsaid\b/i];

/** Deterministic dev/held-out split. Stored on the probe and re-derived on validation. */
export function splitFor(id) {
  const first = createHash("sha256").update(String(id)).digest()[0];
  return first < HELDOUT_THRESHOLD ? "heldout" : "dev";
}

export function nextProbeId(existingIds) {
  let max = 0;
  for (const id of existingIds) {
    const m = /^FSP-(\d{4})$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `FSP-${String(max + 1).padStart(4, "0")}`;
}

const HUMAN_BLOCKLIST = /claude|\bai\b|\bbot\b|\[bot\]|agent|assistant|automation|github-actions|dependabot/i;
export function isHumanHandle(h) {
  return typeof h === "string" && /^[a-z0-9][a-z0-9-]{1,38}$/i.test(h) && !HUMAN_BLOCKLIST.test(h);
}

function scanForbiddenKeys(value, path, errors) {
  if (Array.isArray(value)) return value.forEach((v, i) => scanForbiddenKeys(v, `${path}[${i}]`, errors));
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.includes(k.toLowerCase())) errors.push(`${path}.${k}: key is not allowed in a probe (probes are abstract patterns, not stored material)`);
      scanForbiddenKeys(v, `${path}.${k}`, errors);
    }
  }
}

/**
 * ctx = { ruleIds:Set, criterionIds:Set, familyById:Map<string,{sensitive:boolean}>, incidentIds?:Set }
 * Returns an array of error strings (empty = valid).
 */
export function validateProbe(p, ctx) {
  const e = [];
  const where = p && p.id ? p.id : "(no id)";
  const err = (m) => e.push(`${where}: ${m}`);
  if (!p || typeof p !== "object") return [`${where}: probe is not an object`];

  const allowed = new Set(["id", "ref", "family", "source", "incidentId", "status", "approvedBy", "split", "abstractOnly", "pattern", "seed", "mode", "expect", "created", "notes"]);
  for (const k of Object.keys(p)) if (!allowed.has(k)) err(`unknown field "${k}"`);
  scanForbiddenKeys(p, where, e);

  if (!/^FSP-\d{4}$/.test(p.id || "")) err("id must look like FSP-0001");
  const refOk = ctx.ruleIds.has(p.ref) || /^WA[1-8]$/.test(p.ref || "") || LAYERS.includes(p.ref);
  if (!refOk) err(`ref "${p.ref}" is not a known V rule, WA1-WA8 amendment, or guardrail layer`);

  const fam = ctx.familyById.get(p.family);
  if (!fam) err(`family "${p.family}" is not in rubric.json`);
  if (!SOURCES.includes(p.source)) err(`source must be one of ${SOURCES.join(", ")}`);
  if (!STATUSES.includes(p.status)) err(`status must be one of ${STATUSES.join(", ")}`);
  if (!MODES.includes(p.mode)) err(`mode must be one of ${MODES.join(", ")}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.created || "")) err("created must be YYYY-MM-DD");

  // Split must be the derived one, so nobody can steer a probe into or out of the held-out set.
  if (p.id && p.split !== splitFor(p.id)) err(`split "${p.split}" does not match the derived split "${splitFor(p.id)}"`);

  // Source / incident coupling.
  if (p.source === "incident") {
    if (!/^INC-\d{4}-\d{3}$/.test(p.incidentId || "")) err("incident probes need incidentId like INC-2026-001");
  } else if (p.incidentId != null) {
    err("incidentId is only allowed when source is incident");
  }

  // Pattern: abstract, bounded, no personal material.
  if (typeof p.pattern !== "string" || p.pattern.trim().length < 20) err("pattern must be a sentence of at least 20 characters describing the attack shape");
  else {
    if (p.pattern.length > PATTERN_MAX) err(`pattern is ${p.pattern.length} chars; the limit is ${PATTERN_MAX}`);
    for (const [label, re] of PII_PATTERNS) if (re.test(p.pattern)) err(`pattern contains what looks like a ${label}`);
    for (const re of TRANSCRIPT_SIGNS) if (re.test(p.pattern)) err("pattern reads like a pasted exchange; describe the shape of the attack instead");
    if (/["“”]/.test(p.pattern) && p.source === "incident") err("incident-derived patterns may not contain quotation marks (no quoted seeker text)");
  }

  // Sensitive families: abstract only, no seed turns at all.
  const mustBeAbstract = !!(fam && fam.sensitive);
  if (mustBeAbstract && p.abstractOnly !== true) err(`family "${p.family}" is sensitive, so abstractOnly must be true`);
  if (p.abstractOnly === true && p.seed != null) err("abstractOnly probes must not carry a seed");
  if (p.abstractOnly !== true) {
    if (!p.seed || p.seed.synthetic !== true) err("seed.synthetic must be true");
    else if (!Array.isArray(p.seed.turns) || p.seed.turns.length < 1 || p.seed.turns.length > 6) err("seed.turns must hold 1 to 6 synthetic turns");
    else {
      p.seed.turns.forEach((t, i) => {
        if (typeof t !== "string" || !t.trim()) return err(`seed.turns[${i}] must be a non-empty string`);
        if (t.length > SEED_TURN_MAX) err(`seed.turns[${i}] exceeds ${SEED_TURN_MAX} chars`);
        for (const [label, re] of PII_PATTERNS) if (re.test(t)) err(`seed.turns[${i}] contains what looks like a ${label}`);
      });
    }
  }

  // Expectations point at real criteria that apply to this family.
  const crit = p.expect && p.expect.criteria;
  if (!Array.isArray(crit) || crit.length === 0) err("expect.criteria must list at least one rubric criterion");
  else for (const c of crit) {
    if (!ctx.criterionIds.has(c)) err(`expect.criteria names unknown criterion "${c}"`);
    else if (ctx.criterionFamilies && !ctx.criterionFamilies.get(c).includes(p.family)) err(`criterion "${c}" does not apply to family "${p.family}"`);
  }

  // Approval is a human act, recorded.
  if (p.status === "approved") {
    if (!Array.isArray(p.approvedBy) || p.approvedBy.length < 1) err("approved probes need at least one human in approvedBy");
    else for (const h of p.approvedBy) if (!isHumanHandle(h)) err(`approvedBy "${h}" is not an acceptable human handle`);
    if (p.ref && ctx.ruleIds.has(p.ref) === false && !/^WA[1-8]$/.test(p.ref) && !LAYERS.includes(p.ref)) err("approved probe has no valid ref");
  } else if (Array.isArray(p.approvedBy) && p.approvedBy.length) {
    err("only approved probes may list approvedBy");
  }
  if (p.source === "incident" && ctx.incidentIds && !ctx.incidentIds.has(p.incidentId)) {
    err(`incidentId ${p.incidentId} has no matching entry in governance/fireside/incidents.json`);
  }
  return e;
}

/** Cross-file checks on the whole probe set. */
export function validateProbeSet(probes, ctx, opts = {}) {
  const e = [];
  const seen = new Set();
  for (const p of probes) {
    if (seen.has(p.id)) e.push(`${p.id}: duplicate id`);
    seen.add(p.id);
  }
  const active = probes.filter((p) => p.status !== "retired");
  const approved = probes.filter((p) => p.status === "approved");
  const held = approved.filter((p) => p.split === "heldout").length;
  const minForRatio = opts.minForRatio ?? 10;
  if (approved.length >= minForRatio) {
    const ratio = held / approved.length;
    if (ratio < 0.1 || ratio > 0.35) e.push(`held-out share of approved probes is ${(ratio * 100).toFixed(0)}%, outside 10-35%; add probes (the split is derived, so it cannot be edited)`);
  }
  // Every rule->incident link must be reciprocal with a probe, so a V number never cites a ghost.
  if (ctx.ruleIncidents) {
    for (const [rid, incs] of ctx.ruleIncidents) {
      for (const inc of incs) {
        if (!active.some((p) => p.incidentId === inc && p.ref === rid)) e.push(`${rid} cites ${inc} but no active probe with ref ${rid} carries that incidentId`);
      }
    }
    for (const p of active) {
      if (p.incidentId && /^V\d+$/.test(p.ref)) {
        const list = ctx.ruleIncidents.get(p.ref) || [];
        if (!list.includes(p.incidentId)) e.push(`${p.id}: incident ${p.incidentId} is not listed on rule ${p.ref}`);
      }
    }
  }
  return e;
}

export function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function loadProbes(dir = PROBE_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^FSP-\d{4}\.json$/.test(f))
    .sort()
    .map((f) => ({ file: f, probe: loadJson(join(dir, f)) }));
}

export function buildContext({ rules, rubric, incidents }) {
  const ruleIds = new Set(rules.rules.map((r) => r.id));
  const familyById = new Map(rubric.families.map((f) => [f.id, f]));
  const criterionIds = new Set(rubric.criteria.map((c) => c.id));
  const criterionFamilies = new Map(rubric.criteria.map((c) => [c.id, c.families]));
  const ruleIncidents = new Map(rules.rules.map((r) => [r.id, r.incidents || []]));
  const incidentIds = new Set((incidents && incidents.incidents ? incidents.incidents : []).map((i) => i.id));
  return { ruleIds, familyById, criterionIds, criterionFamilies, ruleIncidents, incidentIds };
}
