#!/usr/bin/env node
// R1: Return-Visit Reflection Copy Contract guard (specs/adr/ADR-0014.md).
// Mirrors check-pattern-view-register.mjs: extract the guarded literal, check it
// against forbidden/required patterns, and fail loudly on structural drift.
//
// Contract:
//   1. The copy speaks as the seeker's own record, never in the Elder's voice.
//   2. No counts, and no claim that anything changed, grew or progressed.
//   3. No claim that two threads are connected.
//   4. The governance gate (trajectoryEnabled) stays in the route, and the
//      copy module stays client-safe (no server imports).

import { readFileSync } from "node:fs";

const MODULE = "lib/returning/reflection.ts";
const ROUTE = "app/api/user/reflection/route.ts";
const text = readFileSync(MODULE, "utf8");
// Structural checks run on CODE only: a gate that is merely mentioned in a
// comment must not satisfy them.
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:'"`])\/\/.*$/gm, "$1");
const route = stripComments(readFileSync(ROUTE, "utf8"));
const moduleCode = stripComments(text);
const failures = [];

const m = text.match(/export const REFLECTION_COPY = \{([\s\S]*?)\} as const;/);
if (!m) {
  console.error("structure: could not locate REFLECTION_COPY in " + MODULE);
  process.exit(1);
}
const block = m[1];
const strings = [...block.matchAll(/:\s*'((?:[^'\\]|\\.)*)'/g)].map((x) => x[1]);
if (strings.length < 5) failures.push(`structure: expected 5 copy strings, found ${strings.length}`);
const copy = strings.join("\n");

const FORBIDDEN = [
  [/\bI (remember|recall|see|notice|sense|know|feel)\b/i, "voice-attributed memory or perception"],
  [/\bthe (pattern|fire|elder|oracle) (shows|says|sees|remembers|knows)\b/i, "instrument-attributed observation"],
  [/\b(changed|change|grown|grew|growth|progress|shift(ed)?|evolv\w*|journey|breakthrough|healed|healing|better|worse|moved on|come so far)\b/i, "claim that something changed or progressed"],
  [/\b(once|twice|\d+\s+times|first time|second time|again and again|so many)\b/i, "spoken count"],
  [/\b(connect(s|ed)?|linked?|tied together|related|same thread)\b/i, "asserted connection between threads"],
  [/\byou (are|were|have become|seem|must|should|need)\b/i, "interpretation or instruction addressed to the seeker"],
];
for (const [re, label] of FORBIDDEN) if (re.test(copy)) failures.push(`forbidden: ${label}`);

const REQUIRED = [
  [/your own words/i, "heading must say whose words these are"],
  [/nothing here is a reading/i, "footnote must say this is not a reading"],
  [/as you named it/i, "earlier line must attribute the words to the seeker"],
];
for (const [re, label] of REQUIRED) if (!re.test(copy)) failures.push(`missing: ${label}`);

// Placeholders: only {type} and {when}.
for (const ph of copy.match(/\{[^}]*\}/g) ?? []) {
  if (ph !== "{type}" && ph !== "{when}") failures.push(`forbidden placeholder: ${ph}`);
}

// Governance gate must stay in the route; the copy module must stay client-safe.
if (!/=\s*trajectoryEnabled\(\)|\(\s*trajectoryEnabled\(\)|if\s*\(\s*!?trajectoryEnabled\(\)/.test(route)) failures.push(`gate: ${ROUTE} no longer calls trajectoryEnabled()`);
if (!/getSessionUserId\(/.test(route)) failures.push(`scope: ${ROUTE} no longer scopes by session`);
if (/^\s*import\b|\brequire\(/m.test(moduleCode)) {
  failures.push(`client-safety: ${MODULE} must be import-free (it is shared with the client)`);
}

if (failures.length) {
  console.error("Reflection Copy Contract check FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("Reflection Copy Contract check passed.");
