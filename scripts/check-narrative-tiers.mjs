#!/usr/bin/env node
// scripts/check-narrative-tiers.mjs
//
// Governance consistency gate for the narrative form layer
// (NARRATIVE-01). Fails CI if:
//   - governance/checklist.yaml (narrative_form.voices) and
//     governance/narrative-tiers.json disagree on any voice or tier
//   - any law-tier row lacks status "signed"
//   - either file is missing a voice the other declares
//
// Requires: npm i -D js-yaml
// Wire into CI alongside the drift harness as a required check.

import { readFileSync } from "node:fs";
import { load as yamlLoad } from "js-yaml";

const YAML_PATH = "governance/checklist.yaml";
const JSON_PATH = "governance/narrative-tiers.json";

const errors = [];

let doc, tiers;
try {
  doc = yamlLoad(readFileSync(YAML_PATH, "utf8"));
} catch (e) {
  console.error(`✗ could not read/parse ${YAML_PATH}: ${e.message}`);
  process.exit(1);
}
try {
  tiers = JSON.parse(readFileSync(JSON_PATH, "utf8"));
} catch (e) {
  console.error(`✗ could not read/parse ${JSON_PATH}: ${e.message}`);
  process.exit(1);
}

const rows = doc?.narrative_form?.voices;
if (!rows || typeof rows !== "object") {
  errors.push(`${YAML_PATH}: narrative_form.voices section missing`);
} else {
  for (const key of Object.keys(tiers)) {
    if (!(key in rows)) {
      errors.push(`"${key}" is in ${JSON_PATH} but has no checklist row`);
    }
  }
  for (const [key, row] of Object.entries(rows)) {
    if (!(key in tiers)) {
      errors.push(`"${key}" has a checklist row but is missing from ${JSON_PATH}`);
      continue;
    }
    if (!["floor", "law"].includes(row.tier)) {
      errors.push(`"${key}": invalid tier "${row.tier}" in checklist`);
    }
    if (row.tier !== tiers[key]) {
      errors.push(
        `tier mismatch for "${key}": checklist=${row.tier} json=${tiers[key]}`
      );
    }
    if (row.tier === "law" && row.status !== "signed") {
      errors.push(
        `"${key}" is law-tier but status is "${row.status}" — law requires signed`
      );
    }
  }
}

if (errors.length > 0) {
  console.error("NARRATIVE GOVERNANCE CHECK FAILED:");
  for (const e of errors) console.error("  ✗ " + e);
  process.exit(1);
}

console.log(
  "narrative governance ✓ checklist.yaml ↔ narrative-tiers.json consistent; all law-tier rows signed."
);
