#!/usr/bin/env node
// R2/R3: Seeker-Carry Contract guard (specs/adr/ADR-0015.md).
// Same shape as check-reflection-register.mjs: extract the guarded literals,
// check them against forbidden/required patterns, and fail loudly on
// structural drift.
//
// Contract:
//   1. The menu is looking-only (every practice begins "notice") and static.
//   2. No tracking or outcome language; never the Elder's voice; no change
//      claims; no instruction to the seeker.
//   3. The seeker's line reaches no model except the welfare classifier:
//      only lib/returning/carryLedger.ts touches seeker_carry, only the carry
//      route imports the ledger, and neither imports a prompt builder.
//   4. The governance gate (carryEnabled) and session scope stay in the route,
//      the line is welfare-gated, and the copy module stays client-safe.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, sep } from "node:path";

const MODULE = "lib/returning/carry.ts";
const LEDGER = "lib/returning/carryLedger.ts";
const ROUTE = "app/api/user/carry/route.ts";
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:'"`])\/\/.*$/gm, "$1");
const text = readFileSync(MODULE, "utf8");
const moduleCode = stripComments(text);
const route = stripComments(readFileSync(ROUTE, "utf8"));
const ledger = stripComments(readFileSync(LEDGER, "utf8"));
const failures = [];

// ── copy literals ───────────────────────────────────────────────────────────
const cm = text.match(/export const CARRY_COPY = \{([\s\S]*?)\} as const;/);
const pm = text.match(/export const CARRY_PRACTICES = \[([\s\S]*?)\] as const;/);
if (!cm || !pm) { console.error("structure: could not locate CARRY_COPY / CARRY_PRACTICES in " + MODULE); process.exit(1); }
const strings = (b) => [...b.matchAll(/:\s*'((?:[^'\\]|\\.)*)'/g)].map((x) => x[1]);
const copyStrings = strings(cm[1]);
const practiceTexts = [...pm[1].matchAll(/text:\s*'((?:[^'\\]|\\.)*)'/g)].map((x) => x[1]);
if (copyStrings.length < 12) failures.push(`structure: expected >= 12 copy strings, found ${copyStrings.length}`);
if (practiceTexts.length < 3) failures.push(`structure: expected >= 3 practices, found ${practiceTexts.length}`);
const copy = [...copyStrings, ...practiceTexts].join("\n");

const FORBIDDEN = [
  [/\bI (remember|recall|see|notice|sense|know|hear|feel)\b/i, "voice-attributed memory or perception"],
  [/\bthe (pattern|fire|elder|oracle) (shows|says|sees|remembers|knows)\b/i, "instrument-attributed observation"],
  [/\b(streak|complete[d]?|completion|goal|habit|achiev\w*|remind\w*|how did|did you|check[- ]in|daily|every day|today|score|track\w*|progress\w*)\b/i, "tracking or outcome language"],
  [/\b(changed|change|grown|grew|growth|shift(ed)?|evolv\w*|journey|breakthrough|healed|healing|better|worse|moved on)\b/i, "claim that something changed"],
  [/\byou (are|were|have become|seem|must|should|need|have to)\b/i, "interpretation or instruction addressed to the seeker"],
  [/\b(fix|work on|let go|overcome|resolve|practice makes)\b/i, "therapeutic task language"],
  [/\b(once|twice|\d+\s+times|again and again)\b/i, "spoken count"],
];
for (const [re, label] of FORBIDDEN) if (re.test(copy)) failures.push(`forbidden: ${label}`);
for (const t of practiceTexts) if (!/^notice\b/.test(t)) failures.push(`practice must be looking-only (begin "notice"): "${t}"`);
for (const [re, label] of [
  [/if you like/i, "offer must say it is optional"],
  [/in your own words/i, "line prompt must say whose words"],
  [/release/i, "release must be offered"],
]) if (!re.test(copy)) failures.push(`missing: ${label}`);
for (const ph of copy.match(/\{[^}]*\}/g) ?? []) if (ph !== "{when}" && ph !== "{practice}") failures.push(`forbidden placeholder: ${ph}`);

// ── route: gate, scope, welfare, release ────────────────────────────────────
if (!/if\s*\(\s*!carryEnabled\(\)/.test(route)) failures.push(`gate: ${ROUTE} POST no longer refuses when !carryEnabled()`);
if (!/=\s*carryEnabled\(\)/.test(route)) failures.push(`gate: ${ROUTE} GET no longer reads carryEnabled()`);
if ((route.match(/getSessionUserId\(/g) ?? []).length < 3) failures.push(`scope: ${ROUTE} must scope GET, POST and DELETE by session`);
if (!/assessWelfare\(\s*input\.line/.test(route)) failures.push(`welfare: ${ROUTE} no longer welfare-gates the seeker's line`);
if (!/export async function DELETE/.test(route)) failures.push(`release: ${ROUTE} no longer exports DELETE`);
const del = route.slice(route.indexOf("export async function DELETE"));
if (/carryEnabled\(\)/.test(del)) failures.push(`release: DELETE must not depend on the gate (a seeker can always release)`);

// ── client-safety of the pure module ────────────────────────────────────────
if (/^\s*import\b|\brequire\(/m.test(moduleCode)) {
  failures.push(`client-safety: ${MODULE} must be import-free (it is shared with the client)`);
}

// ── the line never reaches a model ──────────────────────────────────────────
const PROMPT_IMPORT = /from ['"][^'"]*(system-prompt-builder|trajectoryContext|markerTrajectory|markerExtractor|dualGuardian)['"]/;
for (const [name, code] of [[ROUTE, route], [LEDGER, ledger], [MODULE, moduleCode]]) {
  if (PROMPT_IMPORT.test(code)) failures.push(`isolation: ${name} imports a prompt/trajectory module`);
}
if (/messages\.create\(/.test(route) && (route.match(/messages\.create\(/g) ?? []).length > 1) failures.push(`isolation: ${ROUTE} makes a model call other than the welfare judge`);

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (["node_modules", ".next", ".git"].includes(n)) continue;
    const p = join(dir, n);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    // Normalized to forward slashes so comparisons below match the posix-style
    // constants above regardless of platform (join() uses '\' on Windows).
    else if (/\.(ts|tsx|mjs|js)$/.test(n)) out.push(p.split(sep).join("/"));
  }
  return out;
}
const SELF = "scripts/check-carry-register.mjs";
for (const f of ["app", "lib", "src", "scripts"].flatMap((d) => { try { return walk(d); } catch { return []; } })) {
  if (f === SELF) continue;
  const src = readFileSync(f, "utf8");
  if (/seeker_carry/.test(src) && f !== LEDGER) failures.push(`isolation: ${f} touches seeker_carry (only ${LEDGER} may)`);
  if (/carryLedger/.test(src) && ![ROUTE, LEDGER].includes(f)) failures.push(`isolation: ${f} imports the carry ledger (only ${ROUTE} may)`);
}

if (failures.length) {
  console.error("Seeker-Carry Contract check FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("Seeker-Carry Contract check passed.");
