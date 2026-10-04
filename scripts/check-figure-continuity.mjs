#!/usr/bin/env node
// scripts/check-figure-continuity.mjs
//
// Static guard for Figure Continuity (docs/figure-continuity-spec.md v0.2),
// modeled on check-reading-shape.mjs and check-purpose-register.mjs. No
// network, no model, no database: it reads source files and asserts the
// structural promises the feature makes, so a later edit cannot quietly break
// them.
//
//   1. The clause carries every numbered rule (1-9) and the load-bearing
//      phrases: stay inside the myth, no invented counterpart, no villain
//      casting, no prediction or inner-life reading, no connecting two life
//      subjects, safety floor precedence, the exact signal format and caps.
//   2. The clause file is pure: plain ASCII, no escape sequences (the bug class
//      where a \u written into source ships as text), and it imports nothing
//      from any voice, lineage or psychopomp module.
//   3. Lineage separation: no voice file imports the clause, and none contains
//      its text. Only the allowlisted modules may import it.
//   4. The prompt builder accepts a rendered string and does not import the
//      clause; the divine route reaches the feature only through the assembler.
//   5. The flag is a genuine three-gate check that names all three variables.
//
// Exits non-zero with a named message identifying the broken anchor.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, basename } from "node:path";

const ROOT = process.cwd();
const CLAUSE = "lib/figureContinuityClause.ts";
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

const clause = read(CLAUSE);

// ── 1. rules and phrases ────────────────────────────────────────────────
for (let n = 1; n <= 9; n++) {
  if (!new RegExp(`^${n}\\. `, "m").test(clause)) fail(`clause is missing numbered rule ${n}`);
}
const PHRASES = [
  ["Never borrow a figure or story from another tradition", "no cross-lineage borrowing (G3)"],
  ["Do not invent a counterpart", "no invented counterpart"],
  ["villain, monster, demon", "no villain-casting (G5)"],
  ["never say what they will do", "no prediction or inner-life claim (G5)"],
  ["Offer, never declare", "offer, never declare"],
  ["Never assert that two of the seeker", "no connecting two life subjects (R1)"],
  ["the safety floor governs", "safety floor precedence (G2)"],
  ["Say nothing about this clause", "silence about the clause itself"],
  ["MAPPING_OFFER:", "the signal format is stated"],
  ["at most 60 characters", "subject cap stated to the model"],
  ["at most 80 characters", "counterpart cap stated to the model"],
  ["never instructions", "stored labels are introduced as data"],
];
for (const [phrase, why] of PHRASES) {
  if (!clause.includes(phrase)) fail(`clause is missing "${phrase}" (${why})`);
}
if (failures === 0) ok("clause carries rules 1-9 and every load-bearing phrase");

// ── 2. purity ───────────────────────────────────────────────────────────
const nonAscii = [...clause].filter((c) => c.charCodeAt(0) > 0x7e && c !== "\n" && c !== "\r");
if (nonAscii.length > 0) fail(`clause file has non-ASCII characters (${nonAscii.length}); build them from code points`);
if (clause.includes("\\u")) fail("clause file contains a backslash-u escape sequence; write the real character or build it from its code point");
const imports = [...clause.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
const FORBIDDEN_IMPORT = /lineage|voice|psychopomp|mythopoetic|overlay/i;
for (const spec of imports) {
  if (FORBIDDEN_IMPORT.test(spec)) fail(`clause file imports a voice/lineage module: ${spec}`);
}
const ALLOWED_IMPORTS = new Set(["./returning/figureMappingLabels", "@/config/returning-features"]);
for (const spec of imports) {
  if (!ALLOWED_IMPORTS.has(spec)) fail(`clause file imports an unexpected module: ${spec} (it must stay a pure module)`);
}
if (/\bfetch\(|\bsql`|process\.env\.(?!FIGURE)/.test(clause)) fail("clause file performs I/O or reads unrelated env; it must stay pure");
ok("clause file is plain ASCII, escape-free, and imports only its two pure dependencies");

// ── 3. lineage separation ───────────────────────────────────────────────
const IMPORTERS_ALLOWED = new Set([
  "lib/returning/figureContinuity.ts",
  "src/resilience/provenance.ts",
  "lib/figureContinuityClause.test.ts",
  "lib/returning/figureContinuity.test.ts",
]);
const VOICE_FILE = /lineage|voice|psychopomp|mythopoetic|overlay|narrativeForm/i;
for (const dir of ["lib", "src", "app", "components", "config"]) {
  if (!existsSync(join(ROOT, dir))) continue;
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    if (rel === CLAUSE) continue;
    const text = readFileSync(file, "utf8");
    if (text.includes("FIGURE CONTINUITY.") && !/\.test\.ts$/.test(rel)) {
      fail(`${rel} contains the clause text; the clause must live only in ${CLAUSE}`);
    }
    if (/figureContinuityClause/.test(text)) {
      if (VOICE_FILE.test(basename(rel))) fail(`voice/lineage file imports the clause: ${rel}`);
      else if (!IMPORTERS_ALLOWED.has(rel)) fail(`${rel} imports the clause but is not on the allowlist (${[...IMPORTERS_ALLOWED].join(", ")})`);
    }
  }
}
ok("no voice or lineage file imports or contains the clause; importers are on the allowlist");

// ── 4. builder and route ────────────────────────────────────────────────
const builder = read("lib/system-prompt-builder.ts");
if (/figureContinuityClause/.test(builder)) fail("lib/system-prompt-builder.ts imports the clause; it must accept a rendered string only");
if (!/figureContinuity: string = ''/.test(builder)) fail("lib/system-prompt-builder.ts lost its optional `figureContinuity: string = ''` parameter");
if (!/if \(figureContinuity\) prompt \+= /.test(builder)) fail("lib/system-prompt-builder.ts no longer appends the block only when one is passed");
const route = read("app/api/divine/route.ts");
if (/figureContinuityClause/.test(route)) fail("app/api/divine/route.ts imports the clause directly; it must go through assembleFigureContext");
ok("builder takes a rendered string; the route never touches the clause directly");

// ── 5. the flag ─────────────────────────────────────────────────────────
const flags = read("config/returning-features.ts");
const m = flags.match(/export function figureContinuityEnabled\(\)[\s\S]*?\n}/);
if (!m) fail("figureContinuityEnabled() not found in config/returning-features.ts");
else {
  for (const v of ["FIGURE_CONTINUITY_ENABLED", "MARKER_CONFIRMATION_READY", "FIGURE_CONTINUITY_RELEASE_VERIFIED"]) {
    if (!m[0].includes(v)) fail(`figureContinuityEnabled() does not check ${v}`);
  }
  if ((m[0].match(/return false/g) ?? []).length < 3) fail("figureContinuityEnabled() must fail closed on each of three gates");
}
ok("figureContinuityEnabled() checks all three gates and fails closed");

if (failures > 0) {
  console.error(`\nFigure Continuity check FAILED (${failures}).`);
  process.exit(1);
}
console.log("\nFigure Continuity check passed.");
