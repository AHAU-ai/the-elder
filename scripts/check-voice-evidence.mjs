#!/usr/bin/env node
// scripts/check-voice-evidence.mjs
//
// Governance gate: a voice may only be recorded as "bearer-confirmed" if a
// signoff/attestation artifact exists in the repo to back it. Nothing here
// decides whether a voice is authorized -- that is a human, lineage-holder
// act. This check only stops the repo from CLAIMING more than it can show.
//
// Registry: governance/voice-evidence.json, keyed by voiceKey from
// src/resilience/flags.ts (DEFAULT_FLAGS.voices). Statuses:
//   bearer-confirmed  a named bearer's signoff/attestation file exists under
//                     governance/signoffs/ or attestations/ (required, listed
//                     in `evidence`, must exist on disk)
//   db-grant-only     a consent_grant row is claimed, but no artifact in the
//                     repo backs it. Allowed; reported as a warning.
//   unconfirmed       no bearer evidence anywhere. Allowed; reported as a
//                     warning while the voice is live.
//   off               voice flag is false. Fails if the flag is actually true.
//
// FAILS (exit 1) when:
//   - a voice in flags.ts has no registry entry, or a registry entry has no voice
//   - status is not one of the four above
//   - bearer-confirmed with no evidence, or evidence outside the allowed dirs
//   - any listed evidence path does not exist
//   - status "off" but the flag is true
//
// Usage: node scripts/check-voice-evidence.mjs [--flags <path>] [--registry <path>]

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argOf = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? resolve(process.argv[i + 1]) : fallback;
};
const FLAGS_PATH = argOf("--flags", resolve(ROOT, "src/resilience/flags.ts"));
const REGISTRY_PATH = argOf("--registry", resolve(ROOT, "governance/voice-evidence.json"));

const STATUSES = ["bearer-confirmed", "db-grant-only", "unconfirmed", "off"];
const EVIDENCE_DIRS = ["governance/signoffs/", "attestations/"];

const errors = [];
const warnings = [];

function readOrExit(path, label) {
  try {
    return readFileSync(path, "utf8");
  } catch (e) {
    console.error(`✗ could not read ${label} (${path}): ${e.message}`);
    process.exit(1);
  }
}

// ── voices from DEFAULT_FLAGS ───────────────────────────────────────────
const flagsSrc = readOrExit(FLAGS_PATH, "flags.ts");
const block = flagsSrc.match(/DEFAULT_FLAGS[^=]*=\s*\{\s*voices:\s*\{([\s\S]*?)\n\s*\},/);
if (!block) {
  console.error("✗ could not locate DEFAULT_FLAGS.voices in flags.ts");
  process.exit(1);
}
const flagVoices = {};
for (const line of block[1].split("\n")) {
  const m = line.match(/^\s*([a-z_]+)\s*:\s*(true|false)\b/);
  if (m) flagVoices[m[1]] = m[2] === "true";
}
if (Object.keys(flagVoices).length === 0) {
  console.error("✗ parsed zero voices from flags.ts; refusing to pass vacuously");
  process.exit(1);
}

// ── registry ────────────────────────────────────────────────────────────
let registry;
try {
  registry = JSON.parse(readOrExit(REGISTRY_PATH, "voice-evidence.json"));
} catch (e) {
  console.error(`✗ voice-evidence.json is not valid JSON: ${e.message}`);
  process.exit(1);
}
const voices = registry.voices ?? {};

for (const key of Object.keys(flagVoices)) {
  if (!(key in voices)) errors.push(`${key}: in flags.ts but missing from voice-evidence.json`);
}
for (const key of Object.keys(voices)) {
  if (!(key in flagVoices)) errors.push(`${key}: in voice-evidence.json but not a voice in flags.ts`);
}

for (const [key, entry] of Object.entries(voices)) {
  const status = entry?.status;
  const evidence = Array.isArray(entry?.evidence) ? entry.evidence : [];
  if (!STATUSES.includes(status)) {
    errors.push(`${key}: status "${status}" is not one of ${STATUSES.join(", ")}`);
    continue;
  }
  if (status === "bearer-confirmed" && evidence.length === 0) {
    errors.push(`${key}: bearer-confirmed but lists no signoff/attestation file`);
  }
  for (const p of evidence) {
    const normalized = p.replace(/\\/g, "/");
    if (!EVIDENCE_DIRS.some((d) => normalized.startsWith(d))) {
      errors.push(`${key}: evidence "${p}" is not under ${EVIDENCE_DIRS.join(" or ")}`);
    } else if (!existsSync(resolve(ROOT, normalized))) {
      errors.push(`${key}: evidence file "${p}" does not exist`);
    }
  }
  if (status === "off" && flagVoices[key] === true) {
    errors.push(`${key}: registry says "off" but the flag is true in flags.ts`);
  }
  if (flagVoices[key] === true && (status === "db-grant-only" || status === "unconfirmed")) {
    warnings.push(`${key}: LIVE with status "${status}" -- no bearer signoff in the repo`);
  }
}

// ── report ──────────────────────────────────────────────────────────────
const live = Object.entries(flagVoices).filter(([, on]) => on).length;
console.log(`Voice evidence check: ${Object.keys(flagVoices).length} voices in flags.ts, ${live} live`);
for (const w of warnings) console.log(`  ⚠ ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error(`\nFAILED: ${errors.length} problem(s) in ${relative(ROOT, REGISTRY_PATH)}.`);
  process.exit(1);
}
console.log(`PASSED (${warnings.length} live voice(s) without bearer evidence in the repo -- see warnings).`);
