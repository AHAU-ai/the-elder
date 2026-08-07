#!/usr/bin/env node
// Register guard for the Purpose Statement.
// Fails the build if the canonical copy drifts toward inflation,
// or if the Purpose Statement is imported into the prompt layer.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SOURCE = "lib/purposeStatement.ts";
const text = readFileSync(SOURCE, "utf8");

const FORBIDDEN = [
  [/higher\s+self/i, "higher-self register"],
  [/latent\s+power/i, "latent-powers register"],
  [/chosen\s+one/i, "chosen-one flattery"],
  [/rare\s+soul/i, "rare-soul flattery"],
  [/\bdestined\b/i, "destiny guarantee"],
  [/\bunlock\b/i, "unlock register"],
  [/personaliz/i, "product register"],
  [/quench\w*\s+(one's\s+|your\s+)?hope/i, "quench/hope inversion"],
];

const REQUIRED = [
  [/dim/i, "the torch must stay dim"],
  [/faint/i, "the torch must stay faint"],
  [/rekindle/i, "hope is rekindled, not quenched"],
];

const failures = [];

for (const [pattern, label] of FORBIDDEN) {
  if (pattern.test(text)) failures.push(`forbidden: ${label} (${pattern})`);
}
for (const [pattern, label] of REQUIRED) {
  if (!pattern.test(text)) failures.push(`missing: ${label} (${pattern})`);
}

// Boundary check: nothing in the prompt layer may import this module.
function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|mjs|js)$/.test(full)) acc.push(full);
  }
  return acc;
}

const PROMPT_LAYER = /system-prompt-builder|voices?\//i;
for (const file of walk("lib").concat(walk("app"))) {
  if (!PROMPT_LAYER.test(file)) continue;
  const body = readFileSync(file, "utf8");
  if (/purposeStatement/.test(body)) {
    failures.push(`boundary: ${file} imports the Purpose Statement (copy, not prompt)`);
  }
}

if (failures.length) {
  console.error("Purpose Statement register check FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("Purpose Statement register check passed.");
