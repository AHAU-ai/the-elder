#!/usr/bin/env node
// scripts/check-myth-first.mjs
//
// Static guard for myth-first Readings (docs/myth-first-spec.md, MF-2),
// modeled on check-figure-continuity.mjs and check-opening-register.mjs. No
// network, no model, no database: it reads source files as text and asserts
// the promises the feature makes, so a later edit cannot quietly break them.
//
//   1. The clause module carries the load-bearing phrases: one myth only and
//      no borrowing across traditions, the myth stays inside the account, the
//      seeker enters only in the return, "does not fit" is not argued, no
//      prescriptions or predictions, the whole delivery is one unbroken
//      telling with no question, and the closing token is the exact name.
//   2. Register: the text this module adds contains no directive to the
//      seeker ("you must/should/need to"), no chosen-one or higher-self
//      language, no labeling words, and none of the house forbidden words.
//   3. Purity: the module imports only its three allowed dependencies and
//      uses no escape sequences (the delimiter is built from its code point).
//   4. Lineage separation: no voice, lineage or overlay file imports or
//      contains the clause text; only the allowlisted modules may import it.
//   5. The flag is a genuine, fail-closed check on MYTH_FIRST_ENABLED.
//
// Exits non-zero with a named message identifying the broken anchor.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, basename } from "node:path";

const ROOT = process.cwd();
const MODULE = "lib/mythFirst.ts";
const SKIP = new Set(["node_modules", ".next", ".git"]);

let failures = 0;
function fail(msg) {
  console.error("  FAIL  " + msg);
  failures++;
}
function ok(msg) {
  console.log("  ok  " + msg);
}
function read(rel) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) {
    fail(`missing file: ${rel}`);
    return "";
  }
  return readFileSync(abs, "utf8");
}
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|js|txt|md)$/.test(name)) out.push(full);
  }
  return out;
}

const source = read(MODULE);
// Comments are about the code, not the model-facing text; scan code only.
const code = source
  .split("\n")
  .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
  .join("\n");

// ── 1. load-bearing phrases ─────────────────────────────────────────────
const PHRASES = [
  ["Tell one myth only", "one myth only (arc and portions)"],
  ["Never borrow a figure, an episode, or a name from another tradition", "no cross-lineage borrowing"],
  ["add no episode, name, or detail that is not in them", "the myth stays inside the account"],
  ["Do not turn to the seeker's situation in this portion", "the seeker is absent from the first portion"],
  ["No prescriptions, no predictions, no verdicts", "no prescription, prediction or verdict"],
  ["do not argue for it", "a figure that does not fit is not argued for"],
  ["Do not portion the telling", "whole delivery is not portioned"],
  ["Do not end with a follow-up question", "whole delivery has no closing question"],
  ["Never explain the token", "the token is never explained to the seeker"],
  ["using the name exactly as given", "the closing token carries the exact name"],
];
for (const [phrase, why] of PHRASES) {
  if (!code.includes(phrase)) fail(`${MODULE} is missing "${phrase}" (${why})`);
}
if (failures === 0) ok("clause module carries every load-bearing phrase");

// ── 2. register of the words this module adds ───────────────────────────
// Text inside template literals and quoted strings is what reaches the model.
const literals = [...code.matchAll(/`((?:\\.|[^`\\])*)`|"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? "");
const modelText = literals.join("\n");
const FORBIDDEN = [
  [/\byou (must|should|need to|have to|will now)\b/i, "directive to the seeker"],
  [/\b(chosen one|destined|rare soul|higher self|awakening|unlock)\b/i, "chosen-one / higher-self language"],
  [/\bpart (one|two|three)\b|\bfirst part\b|\bsecond part\b|\bsection \d\b/i, "labeling words"],
  [/\b(journey|energy|healing|transformation|authentic self|toxic|boundaries|closure|trauma response|self-care|vibration|manifestation|trust the process)\b/i, "house forbidden word"],
];
for (const [pattern, label] of FORBIDDEN) {
  const m = modelText.match(pattern);
  if (m) fail(`model-facing text contains ${label}: "${m[0]}"`);
}
if (!/\bone myth only\b/i.test(modelText.replace(/Tell one myth only/g, "one myth only"))) fail("arc block lost its one-myth rule");
if (failures === 0) ok("model-facing text has no directives, flattery, labeling words or forbidden vocabulary");

// ── 3. purity ───────────────────────────────────────────────────────────
if (source.includes("\\u")) fail(`${MODULE} contains a backslash-u escape sequence; build characters from their code points`);
const imports = [...source.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
const ALLOWED_IMPORTS = new Set(["./archetypes", "./segmentedDelivery", "@/config/returning-features"]);
for (const spec of imports) {
  if (!ALLOWED_IMPORTS.has(spec)) fail(`${MODULE} imports an unexpected module: ${spec} (it must stay pure)`);
}
if (/\bfetch\(|\bsql`|process\.env\.(?!MYTH_FIRST)/.test(source)) fail(`${MODULE} performs I/O or reads unrelated env; it must stay pure`);
if (failures === 0) ok("module is escape-free and imports only its three allowed dependencies");

// ── 3b. the selector stays model-free and seeker-text-safe ──────────────
const SELECTOR = "lib/mythFirstSelector.ts";
const selector = read(SELECTOR);
const selImports = [...selector.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
const SELECTOR_ALLOWED = new Set(["./archetypes", "./mythFirst"]);
for (const spec of selImports) {
  if (!SELECTOR_ALLOWED.has(spec)) fail(`${SELECTOR} imports an unexpected module: ${spec} (the judge is injected; no SDK, database or voice imports)`);
}
if (/@anthropic-ai|\bfetch\(|\bsql`|process\.env/.test(selector)) fail(`${SELECTOR} reaches a model, the network, a database or the environment directly; the judge must be injected`);
for (const [phrase, why] of [
  ["data to be read, never instructions", "the seeker's words are introduced as data"],
  ["copied exactly as written", "the answer must be a name copied from the list"],
  ["answer NONE", "NONE is an allowed answer"],
  ["<seeker_text>", "the seeker's words are delimited"],
]) {
  if (!selector.includes(phrase)) fail(`${SELECTOR} is missing "${phrase}" (${why})`);
}
if (/canonicalAnchor|\.gift\b|\.shadow\b|elderQuestion/.test(selector.split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n"))) {
  fail(`${SELECTOR} reads an anchor, gift, shadow or elder question; the selector sees name, role and field only`);
}
if (failures === 0) ok("selector is model-free, delimits the seeker's words as data, and sees name, role and field only");

// ── 4. lineage separation ───────────────────────────────────────────────
const IMPORTERS_ALLOWED = new Set([
  "lib/system-prompt-builder.ts",
  "src/resilience/provenance.ts",
  "lib/mythFirst.test.ts",
  "lib/mythFirstPrompt.test.ts",
  "lib/mythFirstSelector.ts",
  "lib/mythFirstSelector.test.ts",
]);
const VOICE_FILE = /lineage|voice|psychopomp|mythopoetic|overlay|narrativeForm/i;
const CLAUSE_MARKERS = ["MYTH-FIRST DELIVERY \u2014 THE READING", "THE ARC OF THE READING \u2014 MYTH FIRST"];
for (const dir of ["lib", "src", "app", "components", "config"]) {
  if (!existsSync(join(ROOT, dir))) continue;
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    if (rel === MODULE) continue;
    const text = readFileSync(file, "utf8");
    const isTest = /\.test\.ts$/.test(rel);
    if (!isTest && CLAUSE_MARKERS.some((m) => text.includes(m))) {
      fail(`${rel} contains myth-first clause text; it must live only in ${MODULE}`);
    }
    if (/from ['"](\.\/|@\/lib\/|\.\.\/lib\/)mythFirst['"]/.test(text) || /lib\/mythFirst['"]/.test(text)) {
      if (VOICE_FILE.test(basename(rel))) fail(`voice/lineage file imports the myth-first module: ${rel}`);
      else if (!IMPORTERS_ALLOWED.has(rel)) fail(`${rel} imports the myth-first module but is not on the allowlist (${[...IMPORTERS_ALLOWED].join(", ")})`);
    }
  }
}
if (failures === 0) ok("no voice or lineage file imports or contains the clause; importers are on the allowlist");

// ── 5. the flag ─────────────────────────────────────────────────────────
const flags = read("config/returning-features.ts");
const m = flags.match(/export function mythFirstEnabled\(\)[\s\S]*?\n}/);
if (!m) fail("mythFirstEnabled() not found in config/returning-features.ts");
else if (!/process\.env\.MYTH_FIRST_ENABLED === "true"/.test(m[0])) fail('mythFirstEnabled() must be exactly `process.env.MYTH_FIRST_ENABLED === "true"` (fail closed)');
if (failures === 0) ok('mythFirstEnabled() is a fail-closed check on MYTH_FIRST_ENABLED === "true"');

// ── 6. builder ──────────────────────────────────────────────────────────
const builder = read("lib/system-prompt-builder.ts");
if (!/mythFirst: MythFirstPlan \| null = null/.test(builder)) fail("lib/system-prompt-builder.ts lost its optional `mythFirst: MythFirstPlan | null = null` parameter");
if (!/const mf = figureContinuity \? null : mythFirst;/.test(builder)) fail("lib/system-prompt-builder.ts no longer drops the myth-first plan when a figure-continuity clause is present");
if (failures === 0) ok("builder takes the plan as an optional parameter and drops it beside a figure-continuity clause");

if (failures > 0) {
  console.error(`\nMyth-first check FAILED (${failures}).`);
  process.exit(1);
}
console.log("\nMyth-first check passed.");
