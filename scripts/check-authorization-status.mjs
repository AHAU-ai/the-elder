#!/usr/bin/env node
// F15 guard: every voice in lib/traditions.ts must carry an explicit
// authorizationStatus, and the deprecated "institute-placeholder" value
// must never be (re)introduced. Voices without a named tradition-bearer
// belong in "pending", not silently treated as authorized.
//
// This does not block deployment of "pending" voices — governanceStatus
// already governs that — it only guards against pretending a pending
// voice is bearer-confirmed, and against un-migrating one of the seven
// voices flipped to "pending" on 2026-08-19 back to the deprecated
// placeholder value.

import { readFileSync } from "node:fs";

const SOURCE = "lib/traditions.ts";
const text = readFileSync(SOURCE, "utf8");

const failures = [];

// Every entry in TRADITION_MAP must have an authorizationStatus line.
const voiceBlocks = [...text.matchAll(/voiceKey:\s*"([a-z]+)"/g)].map((m) => m[1]);
if (voiceBlocks.length === 0) {
  failures.push("structure: could not find any voiceKey entries in " + SOURCE);
}

for (const key of voiceBlocks) {
  // Find the block for this voiceKey up to the next voiceKey or end of map.
  const start = text.indexOf(`voiceKey: "${key}"`);
  const rest = text.slice(start);
  const nextIdx = rest.indexOf("voiceKey:", 1);
  const block = nextIdx === -1 ? rest : rest.slice(0, nextIdx);
  if (!/authorizationStatus:\s*"(bearer-confirmed|institute-placeholder|pending)"/.test(block)) {
    failures.push(`${key}: missing or invalid authorizationStatus`);
  }
}

// The deprecated placeholder value must not appear anywhere as a live
// assignment — only "pending" and "bearer-confirmed" are allowed states
// going forward. (It remains a valid TYPE value so old data/tests can
// still reference it, but no TRADITION_MAP row may use it.)
const placeholderAssignments = [
  ...text.matchAll(/authorizationStatus:\s*"institute-placeholder"/g),
];
if (placeholderAssignments.length > 0) {
  failures.push(
    `${placeholderAssignments.length} voice(s) still assigned the deprecated ` +
    `"institute-placeholder" authorizationStatus. Migrate to "pending" ` +
    `(honest resting state) or "bearer-confirmed" (named review complete).`
  );
}

if (failures.length) {
  console.error("Authorization status check FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("Authorization status check passed.");
