#!/usr/bin/env node
// scripts/check-reading-shape.mjs
// Run against sample readings to catch length/closing-shape regressions.
// Usage: node scripts/check-reading-shape.mjs <fixture1.txt> [fixture2.txt ...]

import { readFileSync } from 'fs';

const MIN_WORDS = 150;
const MAX_WORDS = 220;

const RESOLVED_PATTERNS = [
  /at peace/i,
  /found (your|the) answer/i,
  /path is (now )?clear/i,
  /can move forward with confidence/i,
  /all is resolved/i,
];

const FALSE_OPEN_PATTERNS = [
  /and so it continues\.{0,3}\s*$/i,
  /for another time\.?\s*$/i,
  /to be continued/i,
];

const OPEN_MARKER_PATTERN = /still|not yet|has not|have not|continues to|remains/i;

// Machine signal tokens are emitted "on its own line, after all visible
// content" per the Signal Token Rules (lib/system-prompt-builder.ts) and are
// stripped before a reading is ever displayed (app/api/divine/route.ts).
// Mirrors harness/narrativeAssertions.ts's stripMachineSignals() line
// patterns, extended with MYTH -- the token a readingMode fixture (this
// script's actual use case) will carry, which stripMachineSignals itself
// does not strip. A raw model-output fixture that still has its trailing
// token line must not have that line counted as prose or treated as the
// reading's actual closing line.
const SIGNAL_LINE_PATTERNS = [
  /^⧁CORPUS:[^⧁]+⧁$/,
  /^⧁?CEILING[:_A-Z0-9-]*⧁?$/,
  /^⧁⧁READY⧁⧁$/,
  /^⧁IMAGE_FIRST_VIOLATION⧁$/,
  /^⧁MYTH:[^⧁]+⧁$/,
];

function stripSignalTokens(text) {
  return text
    .split('\n')
    .filter(line => !SIGNAL_LINE_PATTERNS.some(p => p.test(line.trim())))
    .join('\n');
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// A delivered Reading is one continuous, unbroken paragraph by design (the
// system prompt's "single breath, first word to last" instruction --
// lib/system-prompt-builder.ts's ARC OF THE READING section) -- so a real
// fixture is expected to contain few or no internal line breaks. Splitting
// on '\n' alone (as this used to) would then hand the WHOLE reading to the
// closing-shape checks instead of just its ending. Collapse newlines and
// split on sentence boundaries instead, the same approach already used by
// harness/narrativeAssertions.ts's sentences(), so "last N" means the last N
// sentences (what READING_SHAPE_CLAUSE actually specifies), not lines.
function lastSentences(text, n) {
  return text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(-n);
}

function checkSample(rawText, label) {
  const text = stripSignalTokens(rawText);
  const errors = [];
  const wc = wordCount(text);

  if (wc < MIN_WORDS || wc > MAX_WORDS) {
    errors.push(`[${label}] word count ${wc} outside ${MIN_WORDS}-${MAX_WORDS} band`);
  }

  const closingSentences = lastSentences(text, 2);
  if (closingSentences.length === 0) {
    errors.push(`[${label}] no content found to check closing shape on`);
    return errors;
  }

  let matchedResolved = false;
  let matchedFalseOpen = false;
  let matchedOpenMarker = false;

  for (const line of closingSentences) {
    if (RESOLVED_PATTERNS.some(p => p.test(line))) matchedResolved = true;
    if (FALSE_OPEN_PATTERNS.some(p => p.test(line))) matchedFalseOpen = true;
    if (OPEN_MARKER_PATTERN.test(line)) matchedOpenMarker = true;
  }

  if (matchedResolved) {
    errors.push(`[${label}] closing reads as RESOLVED`);
  }
  if (matchedFalseOpen) {
    errors.push(`[${label}] closing reads as FALSE-OPEN / abrupt`);
  }
  if (!matchedOpenMarker) {
    errors.push(`[${label}] closing has no detected open-thread marker — verify manually`);
  }

  return errors;
}

function main() {
  const fixturePaths = process.argv.slice(2);
  if (fixturePaths.length === 0) {
    console.error('Usage: node check-reading-shape.mjs <fixture1.txt> [fixture2.txt ...]');
    process.exit(1);
  }

  let allErrors = [];
  for (const path of fixturePaths) {
    let text;
    try {
      text = readFileSync(path, 'utf-8');
    } catch (err) {
      console.error(`Could not read fixture "${path}": ${err.message}`);
      process.exit(1);
    }
    allErrors = allErrors.concat(checkSample(text, path));
  }

  if (allErrors.length > 0) {
    console.error('READING SHAPE CHECK FAILED:');
    allErrors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }

  console.log(`Reading shape check passed on ${fixturePaths.length} sample(s).`);
}

main();
