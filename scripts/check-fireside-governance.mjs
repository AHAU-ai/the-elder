#!/usr/bin/env node
// scripts/check-fireside-governance.mjs
//
// Governance-as-data gate for the fireside guardrails.
//
//   1. governance/fireside/rules.json is structurally valid and covers V1-V17,
//      each at prevent / detect / contain, each with V-tagged tests.
//   2. Rule <-> probe <-> incident links are reciprocal (no ghost citations).
//   3. Against the base branch: any change bumps the version and appends a
//      history entry; the declared change may not understate the diff; loosening
//      needs two distinct human approvals and a clean probe run; tightening one.
//
// Usage:
//   node scripts/check-fireside-governance.mjs                 # structure + coverage
//   node scripts/check-fireside-governance.mjs --base origin/main   # also diff vs base
//   node scripts/check-fireside-governance.mjs --base-file path.json
//
// Limits (be honest about them): approvals are handles recorded in the file. They
// become real only when the PR that adds them is itself reviewed by those people.
// Put governance/fireside/ under CODEOWNERS so that is enforced by GitHub.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, FS_DIR, loadJson, loadProbes } from "./fireside/probe-lib.mjs";
import { validateRules, checkAgainstBase } from "./fireside/governance-lib.mjs";

const args = process.argv.slice(2);
const argOf = (n) => { const i = args.indexOf(n); return i > -1 ? args[i + 1] : null; };

const rulesPath = join(FS_DIR, "rules.json");
const rules = loadJson(rulesPath);
const probes = loadProbes().map((x) => x.probe);

const errors = [];
const { errors: ve, warnings } = validateRules(rules, { probes });
errors.push(...ve);

// Reciprocal incident links are checked by the probe validator, which owns that data.

const baseRef = argOf("--base");
const baseFile = argOf("--base-file");
let notes = [];
if (baseFile || baseRef) {
  let baseDoc = null;
  try {
    const text = baseFile
      ? readFileSync(baseFile, "utf8")
      : execFileSync("git", ["show", `${baseRef}:governance/fireside/rules.json`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    baseDoc = JSON.parse(text);
  } catch (e) {
    const msg = String(e.stderr || e.message || e);
    if (/exists on disk, but not in|does not exist|path .* does not exist|bad object|invalid object/i.test(msg) && baseRef) {
      console.log(`note: ${baseRef} has no rules.json yet; treating every rule as new.`);
    } else {
      console.error(`✗ could not read base rules (${baseRef || baseFile}): ${msg.trim().split("\n")[0]}`);
      process.exit(1);
    }
  }
  if (baseDoc) {
    const r = checkAgainstBase(baseDoc, rules);
    errors.push(...r.errors);
    notes = r.notes;
  }
}

for (const n of notes) console.log(`  change: ${n}`);
const unratified = warnings.filter((w) => w.includes("not yet ratified")).length;
const otherWarnings = warnings.filter((w) => !w.includes("not yet ratified"));
for (const w of otherWarnings) console.warn(`  warning: ${w}`);
if (unratified) console.warn(`  warning: ${unratified} of ${rules.rules.length} rules are not yet ratified by a human`);

if (errors.length) {
  console.error(`\n✗ fireside governance: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✓ fireside governance: ${rules.rules.length} rules, structure and coverage OK${baseRef || baseFile ? ", base diff OK" : ""}`);
