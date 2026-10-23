#!/usr/bin/env node
// scripts/check-beat2-instrument.mjs
//
// Second, independent check on top of lib/beat2Instrument.ts's own
// throw-on-import invariants (lib/beat2VoiceStatus.ts's
// assertRegistryInvariants + lib/beat2Instrument.ts's
// assertBeat2Invariants). Those throw at runtime/build time already --
// this script exists to (a) catch the same class of problem in CI without
// needing to actually import/build the app, and (b) catch something the
// runtime check cannot: drift between the registry (code, source of truth)
// and docs/beat2-instrument-voice-review.md (its human-readable rendering).
//
// Usage: node scripts/check-beat2-instrument.mjs
// Exit 0 = pass, 1 = fail. Wired into gk-007.mjs as probeBeat2Instrument.

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');

const log = (msg, level = 'info') => {
  const prefix = { pass: '✅ ', fail: '❌ ', warn: '⚠️  ', info: 'ℹ️  ', detail: '  ' }[level] || '';
  console.log(prefix + msg);
};

const REGISTRY_PATH = resolve(REPO_ROOT, 'lib/beat2VoiceStatus.ts');
const INSTRUMENT_PATH = resolve(REPO_ROOT, 'lib/beat2Instrument.ts');
const DOC_PATH = resolve(REPO_ROOT, 'docs/beat2-instrument-voice-review.md');

function fail(msg) {
  log(msg, 'fail');
  process.exitCode = 1;
}

if (!existsSync(REGISTRY_PATH) || !existsSync(INSTRUMENT_PATH)) {
  fail('lib/beat2VoiceStatus.ts or lib/beat2Instrument.ts not found — Beat-2 governance check cannot run.');
  process.exit(1);
}

const registrySource = readFileSync(REGISTRY_PATH, 'utf-8');
const instrumentSource = readFileSync(INSTRUMENT_PATH, 'utf-8');

// ── Parse BEAT2_VOICE_REGISTRY: voiceKey -> { status, reason } ─────────────
// Static regex parse, same style as gk-007.mjs's probeVoiceFlagAlignment --
// deliberately not importing the .ts module (this script runs under plain
// node, not tsx, so CI doesn't need a TS runtime for a static check).
const registryBlockMatch = registrySource.match(
  /export const BEAT2_VOICE_REGISTRY[^{]*\{([\s\S]*?)\n\};/
);
if (!registryBlockMatch) {
  fail('Could not locate BEAT2_VOICE_REGISTRY block in lib/beat2VoiceStatus.ts — structure may have changed.');
  process.exit(1);
}
const registryBlock = registryBlockMatch[1];

// Split into per-voice top-level entries by matching `key: {` ... matching `},`
// at the same nesting depth. Simple brace-depth scan rather than a single
// regex, since reason strings themselves contain punctuation.
function parseRegistryEntries(block) {
  const entries = {};
  const keyRe = /(\w+):\s*\{/g;
  let m;
  while ((m = keyRe.exec(block)) !== null) {
    const voiceKey = m[1];
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    while (depth > 0 && i < block.length) {
      if (block[i] === '{') depth++;
      else if (block[i] === '}') depth--;
      i++;
    }
    const body = block.slice(start, i - 1);
    const statusMatch = body.match(/status:\s*'([^']+)'/);
    entries[voiceKey] = {
      status: statusMatch ? statusMatch[1] : null,
      hasReviewedBy: /reviewedBy:/.test(body),
      hasReviewedDate: /reviewedDate:/.test(body),
    };
  }
  return entries;
}

const registryEntries = parseRegistryEntries(registryBlock);
const registryVoices = Object.keys(registryEntries);
log(`Parsed ${registryVoices.length} voices from BEAT2_VOICE_REGISTRY.`, 'info');

// ── Parse BEAT2_INSTRUMENTS: which voiceKeys have authored questions ───────
const instrumentsBlockMatch = instrumentSource.match(
  /const BEAT2_INSTRUMENTS[^{]*\{([\s\S]*?)\n\};/
);
if (!instrumentsBlockMatch) {
  fail('Could not locate BEAT2_INSTRUMENTS block in lib/beat2Instrument.ts — structure may have changed.');
  process.exit(1);
}
// Top-level keys of BEAT2_INSTRUMENTS are voiceKey: [ ... ], not voiceKey: { ... } --
// match `word: [` at line-start indentation instead of the registry's `word: {`.
const instrumentVoices = [...instrumentsBlockMatch[1].matchAll(/^\s{2}(\w+):\s*\[/gm)].map(m => m[1]);
log(`Parsed ${instrumentVoices.length} voices with authored instruments from BEAT2_INSTRUMENTS: ${instrumentVoices.join(', ')}`, 'info');

// ── Parse BEAT2_REVIEWED_VOICES: which voiceKeys are actually live ─────────
const allowlistBlockMatch = instrumentSource.match(
  /export const BEAT2_REVIEWED_VOICES[^{]*\{[^}]*\}\s*=\s*new Set<string>\(\[([\s\S]*?)\]\);/
);
const allowlistVoices = allowlistBlockMatch
  ? [...allowlistBlockMatch[1].matchAll(/^\s*"(\w+)",?\s*$/gm)].map(m => m[1])
  : [];
log(`Parsed ${allowlistVoices.length} live (non-commented) entries in BEAT2_REVIEWED_VOICES: ${allowlistVoices.join(', ') || '(none)'}`, 'info');

// ── Check 1: every instrument-bearing voice has a registry record, and it's not blocked/hold/not_applicable ──
log('\n[Beat2-P1] Instruments never exceed registry authorization', 'info');
let p1pass = true;
for (const voiceKey of instrumentVoices) {
  const record = registryEntries[voiceKey];
  if (!record) {
    fail(`  ${voiceKey}: has an instrument but NO registry record at all.`);
    p1pass = false;
    continue;
  }
  if (['blocked', 'hold', 'not_applicable'].includes(record.status)) {
    fail(`  ${voiceKey}: has an instrument but registry status is '${record.status}'.`);
    p1pass = false;
  } else if (VERBOSE) {
    log(`  ${voiceKey}: instrument present, registry status '${record.status}' — OK`, 'detail');
  }
}
log(`Instruments vs registry: ${p1pass ? 'PASS' : 'FAIL'}`, p1pass ? 'pass' : 'fail');

// ── Check 2: allowlist entries must have registry status 'reviewed' with a real record ──
log('\n[Beat2-P2] Allowlist never exceeds "reviewed" status', 'info');
let p2pass = true;
for (const voiceKey of allowlistVoices) {
  const record = registryEntries[voiceKey];
  if (!record || record.status !== 'reviewed') {
    fail(`  ${voiceKey}: in BEAT2_REVIEWED_VOICES but registry status is '${record?.status ?? '(none)'}', not 'reviewed'.`);
    p2pass = false;
    continue;
  }
  if (!record.hasReviewedBy || !record.hasReviewedDate) {
    fail(`  ${voiceKey}: status 'reviewed' but missing reviewedBy/reviewedDate.`);
    p2pass = false;
  } else if (VERBOSE) {
    log(`  ${voiceKey}: reviewed, with reviewedBy/reviewedDate present — OK`, 'detail');
  }
}
log(`Allowlist vs registry: ${p2pass ? 'PASS' : 'FAIL'}`, p2pass ? 'pass' : 'fail');

// ── Check 3: doc table hasn't drifted from the registry ────────────────────
log('\n[Beat2-P3] docs/beat2-instrument-voice-review.md matches the registry', 'info');
let p3pass = true;
if (!existsSync(DOC_PATH)) {
  fail('  docs/beat2-instrument-voice-review.md not found.');
  p3pass = false;
} else {
  const docSource = readFileSync(DOC_PATH, 'utf-8');
  // Doc table rows look like: | voiceKey | ... | STATUS_WORD | ... |
  // Status word in the doc is upper-cased prose (DRAFTED, BLOCKED, etc.) --
  // map to registry's lower-case status values for comparison.
  const docStatusWords = {
    reviewed: 'REVIEWED',
    drafted: 'DRAFTED',
    queued: 'QUEUED',
    hold: 'HOLD',
    blocked: 'BLOCKED',
    not_applicable: 'N/A',
  };
  const rowRe = /^\|\s*(\w+)\s*\|[^|]*\|[^|]*\|\s*(REVIEWED|DRAFTED|QUEUED|HOLD|BLOCKED|N\/A)\b/gm;
  const docRows = {};
  let rm;
  while ((rm = rowRe.exec(docSource)) !== null) {
    docRows[rm[1]] = rm[2];
  }
  if (Object.keys(docRows).length === 0) {
    fail('  Could not parse any status rows out of the doc table — format may have drifted from what this checker expects.');
    p3pass = false;
  }
  for (const voiceKey of registryVoices) {
    const expectedWord = docStatusWords[registryEntries[voiceKey].status];
    const actualWord = docRows[voiceKey];
    if (actualWord === undefined) {
      fail(`  ${voiceKey}: in registry but has no matching row in the doc table.`);
      p3pass = false;
    } else if (actualWord !== expectedWord) {
      fail(`  ${voiceKey}: registry says '${registryEntries[voiceKey].status}' (expects doc word '${expectedWord}') but doc row says '${actualWord}'.`);
      p3pass = false;
    } else if (VERBOSE) {
      log(`  ${voiceKey}: doc says '${actualWord}', registry agrees — OK`, 'detail');
    }
  }
  for (const voiceKey of Object.keys(docRows)) {
    if (!registryEntries[voiceKey]) {
      fail(`  ${voiceKey}: has a doc row but no registry record.`);
      p3pass = false;
    }
  }
}
log(`Doc vs registry: ${p3pass ? 'PASS' : 'FAIL'}`, p3pass ? 'pass' : 'fail');

// ── Check 4: registry has a record for every voice the app actually knows about ──
// Added 2026-09-24 after 'pythia' was found to be missing from the
// registry AND the doc simultaneously -- Check 3 above only verifies the
// doc and registry agree with EACH OTHER, which is exactly how both could
// be silently wrong together, as they were. This check verifies both
// against a third, independent, authoritative source: the full voice list
// in src/resilience/flags.ts's DEFAULT_FLAGS.voices block.
log('\n[Beat2-P4] Registry covers every voice the app actually knows about', 'info');
let p4pass = true;
const FLAGS_PATH = resolve(REPO_ROOT, 'src/resilience/flags.ts');
if (!existsSync(FLAGS_PATH)) {
  fail('  src/resilience/flags.ts not found -- cannot verify completeness.');
  p4pass = false;
} else {
  const flagsSource = readFileSync(FLAGS_PATH, 'utf-8');
  const voicesBlockMatch = flagsSource.match(/voices:\s*\{([\s\S]*?)\n\s*\},/);
  if (!voicesBlockMatch) {
    fail('  Could not locate DEFAULT_FLAGS.voices block in src/resilience/flags.ts.');
    p4pass = false;
  } else {
    const allAppVoices = [...voicesBlockMatch[1].matchAll(/^\s*(\w+):\s*(?:true|false),/gm)].map(m => m[1]);
    log(`Parsed ${allAppVoices.length} voices from src/resilience/flags.ts: ${allAppVoices.join(', ')}`, 'info');
    for (const voiceKey of allAppVoices) {
      if (!registryEntries[voiceKey]) {
        fail(`  ${voiceKey}: known to the app (src/resilience/flags.ts) but has NO record in BEAT2_VOICE_REGISTRY.`);
        p4pass = false;
      }
    }
  }
}
log(`Registry completeness: ${p4pass ? 'PASS' : 'FAIL'}`, p4pass ? 'pass' : 'fail');

const allPass = p1pass && p2pass && p3pass && p4pass;
console.log('');
log(`Beat-2 instrument governance: ${allPass ? 'PASS' : 'FAIL'}`, allPass ? 'pass' : 'fail');
process.exit(allPass ? 0 : 1);
