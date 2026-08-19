#!/usr/bin/env node
// B5: Pattern-View Copy Contract guard for the Mythic Journal's
// pattern-surfacing view (lib/mythPatterns.ts). Mirrors
// check-purpose-register.mjs's shape: extract the guarded string
// literal, check it against forbidden/required patterns, fail loudly
// on structural drift rather than silently passing.
//
// Contract (see lib/mythPatterns.ts header for the full rationale):
//   1. Patterns belong to the seeker's returning, never to a voice.
//   2. No counts are spoken.
//   3. No two threads are asserted as connected/linked/tied together.

import { readFileSync } from "node:fs";

const SOURCE = "lib/mythPatterns.ts";
const text = readFileSync(SOURCE, "utf8");

const failures = [];

// Extract the guarded system-prompt literal specifically, not the whole
// file — shared vocabulary elsewhere in the module must not mask a
// targeted edit to the prompt itself.
const m = text.match(/export const MYTH_PATTERN_SYSTEM = `([\s\S]*?)`;/);
if (!m) {
  console.error("structure: could not locate MYTH_PATTERN_SYSTEM in " + SOURCE);
  process.exit(1);
}
const block = m[1];

const FORBIDDEN = [
  // Rule 1: never voice-attributed.
  [/\bI see\b/i, "voice-attributed perception ('I see')"],
  [/\bI notice\b/i, "voice-attributed perception ('I notice')"],
  [/the pattern shows/i, "pattern-as-instrument-observation framing"],

  // Rule 2: no counts.
  [/\bthe (first|second|third|fourth|fifth)\s+time\b/i, "ordinal count of occurrences"],
  [/\btwice\b/i, "spoken count ('twice')"],
  [/\bagain and again\b/i, "tally-like repetition phrasing"],
  [/\b\d+\s+times\b/i, "numeric count of occurrences"],

  // Rule 3: no asserted connection between threads.
  [/threads?\s+(are|is)\s+(connected|linked|tied together|related)/i, "asserted connection between threads"],
  [/\bconnects? (them|these|the two)\b/i, "asserted connection between threads"],
];

// Required: the contract's own three rules must be stated in the prompt,
// so a future edit that strips the rules (rather than violating them) is
// also caught.
const REQUIRED = [
  [/never say/i, "prompt must explicitly forbid voice-attributed phrasing"],
  [/never speak a count/i, "prompt must explicitly forbid spoken counts"],
  [/never assert that two threads are connected/i, "prompt must explicitly forbid asserting a connection between threads"],
];

// The forbidden check must not fire on the rules themselves (which
// necessarily name the phrases they forbid, e.g. 'Never say "I see..."').
// Strip lines that are stating the rules before scanning for violations.
const nonRuleLines = block
  .split("\n")
  .filter((line) => !/^\s*\d\.\s/.test(line) && !/\bnever\b/i.test(line))
  .join("\n");

for (const [pattern, label] of FORBIDDEN) {
  if (pattern.test(nonRuleLines)) failures.push(`forbidden: ${label}`);
}
for (const [pattern, label] of REQUIRED) {
  if (!pattern.test(block)) failures.push(`missing: ${label}`);
}

if (failures.length) {
  console.error("Pattern-View Copy Contract check FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("Pattern-View Copy Contract check passed.");
