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

// ── Portal narration (lib/portalCopy.ts) ────────────────────────────────
// The cold room's lines are the Elder's voice too -- same register, same
// mechanical check. Interface affordances (PORTAL_AFFORDANCE: "hold to
// open") are the interface speaking, like BreathGate's "BREATHE IN", and
// are deliberately NOT scanned. A structural change must fail loudly.
const PORTAL_SOURCE = "lib/portalCopy.ts";
const portalText = readFileSync(PORTAL_SOURCE, "utf8");

function stringLiterals(block) {
  return [...block.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map((x) => x[2]);
}

const roomBlock = portalText.match(/export const PORTAL_ROOM_LINES\s*=\s*\[([\s\S]*?)\]\s*as const\s*;/);
const crossBlock = portalText.match(/export const PORTAL_CROSSING_LINE\s*=\s*\n?\s*(['"`])([\s\S]*?)\1\s*;/);
const portalLines = [];
if (!roomBlock) failures.push(`structure: could not locate PORTAL_ROOM_LINES in ${PORTAL_SOURCE}`);
else {
  const lines = stringLiterals(roomBlock[1]);
  if (lines.length === 0) failures.push("structure: PORTAL_ROOM_LINES is empty");
  portalLines.push(...lines);
}
if (!crossBlock) failures.push(`structure: could not locate PORTAL_CROSSING_LINE in ${PORTAL_SOURCE}`);
else portalLines.push(crossBlock[2]);

// The returning-door line is the one place the interface could slide into
// performing recognition. It may state the room's state; it may not greet,
// remember, or miss anyone (synthetic-intimacy ceiling, Appendix B).
const returnBlock = portalText.match(/export const PORTAL_RETURN_LINE\s*=\s*\n?\s*(['"`])([\s\S]*?)\1\s*;/);
const RETURN_FORBIDDEN = /\b(welcome|back|again|miss(ed)?|waiting|waited|remember(ed|s)?|return(ed|s)?|home|kept|keep|longed?|glad)\b/i;
if (!returnBlock) failures.push(`structure: could not locate PORTAL_RETURN_LINE in ${PORTAL_SOURCE}`);
else {
  portalLines.push(returnBlock[2]);
  if (RETURN_FORBIDDEN.test(returnBlock[2])) failures.push(`portal forbidden: return line performs recognition or memory -- "${returnBlock[2]}"`);
  if (!/\b(fire|ember|flame|hearth|smoke)\b/i.test(returnBlock[2])) failures.push("portal missing: return line anchored to the fire");
}

for (const line of portalLines) {
  for (const [pattern, label] of FORBIDDEN) {
    if (pattern.test(line)) failures.push(`portal forbidden: ${label} -- ${pattern} in "${line}"`);
  }
}
// The crossing line is the first thing the other side offers: it must be
// anchored to the ceremony's own objects, not generic affirmation.
if (crossBlock) {
  for (const [pattern, label] of REQUIRED) {
    if (!pattern.test(crossBlock[2])) failures.push(`portal missing: crossing line ${label}`);
  }
}
// At least one room line names the seam of ember light (the anomaly itself).
if (portalLines.length && !portalLines.some((l) => /\b(ember|fire|flame|hearth|smoke)\b/i.test(l))) {
  failures.push("portal missing: no line is anchored to the fire/ember");
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
  if (/openingBridge|portalCopy/.test(body)) {
    failures.push(`boundary: ${file} imports opening/portal copy (UI copy, not prompt input)`);
  }
}

if (failures.length) {
  console.error("Opening bridge register check FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("Opening bridge + portal register check passed.");
