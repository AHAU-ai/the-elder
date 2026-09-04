#!/usr/bin/env node
// Register guard for the opening bridge line (lib/openingBridge.ts).
// Fails the build if OPENING_BRIDGE_COPY drifts from witnessing toward
// instructive/imperative copy or flattery, if it stops being anchored to
// the fire/breath, or if the module is imported into the prompt layer.
//
// Same shape and CI slot as scripts/check-purpose-register.mjs: this
// script keeps its own copy of the patterns and reads the source as
// text -- it does not import the module.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SOURCE = "lib/openingBridge.ts";
const text = readFileSync(SOURCE, "utf8");

const failures = [];

// Extract the copy string literal. A structural change (renamed export,
// moved to a template) must fail loudly, never degrade to a silent pass.
const m = text.match(/export const OPENING_BRIDGE_COPY\s*=\s*\n?\s*(['"`])([\s\S]*?)\1\s*;/);
if (!m) {
  failures.push(`structure: could not locate OPENING_BRIDGE_COPY string literal in ${SOURCE}`);
}
const copy = m ? m[2] : "";

const FORBIDDEN = [
  [/^\s*(close|open|breathe|sit|stand|walk|step|feel|let|begin|come|enter|receive|give|take|say|speak|ask|choose|name|look|listen|hold|rest)\b/i, "sentence-initial bare imperative"],
  [/\byou (must|should|need to|have to|will now)\b/i, "directive to the seeker"],
  [/\b(chosen|destined|rare soul|higher self|special|awakening|unlock)\b/i, "chosen-one / latent-power flattery"],
  [/\bthe one (it|the fire|we)\b/i, "'the one the fire was waiting for' flattery"],
];

// Must stay anchored to the ceremony's own objects.
const REQUIRED = [
  [/\b(breath|fire|flame|ember|hearth|smoke)\b/i, "anchored to the fire/breath, not generic affirmation"],
];

if (copy) {
  for (const [pattern, label] of FORBIDDEN) {
    if (pattern.test(copy)) failures.push(`forbidden: ${label} -- ${pattern}`);
  }
  for (const [pattern, label] of REQUIRED) {
    if (!pattern.test(copy)) failures.push(`missing: ${label}`);
  }
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
  if (/openingBridge/.test(body)) {
    failures.push(`boundary: ${file} imports the opening bridge (UI copy, not prompt input)`);
  }
}

if (failures.length) {
  console.error("Opening bridge register check FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("Opening bridge register check passed.");
