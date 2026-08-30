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

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function lastNonEmptyLines(text, n) {
  return text
    .trim()
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .slice(-n);
}

function checkSample(text, label) {
  const errors = [];
  const wc = wordCount(text);

  if (wc < MIN_WORDS || wc > MAX_WORDS) {
    errors.push(`[${label}] word count ${wc} outside ${MIN_WORDS}-${MAX_WORDS} band`);
  }

  const closingLines = lastNonEmptyLines(text, 2);
  if (closingLines.length === 0) {
    errors.push(`[${label}] no content found to check closing shape on`);
    return errors;
  }

  let matchedResolved = false;
  let matchedFalseOpen = false;
  let matchedOpenMarker = false;

  for (const line of closingLines) {
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
