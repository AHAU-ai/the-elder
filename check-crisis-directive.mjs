#!/usr/bin/env node
// check-crisis-directive.mjs
// Build-time guard: fails with a non-zero exit code if CRISIS_DIRECTIVE in
// app/api/divine/route.ts still contains the placeholder token.
// Add to package.json scripts and/or pre-commit hook so the placeholder
// can never reach production.
//
// Usage:
//   node scripts/check-crisis-directive.mjs
//
// Exit codes:
//   0 — directive is authored (no placeholder found)
//   1 — placeholder still present (___AUTHOR_THIS___)
//   2 — CRISIS_DIRECTIVE declaration not found at all (structural error)

import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROUTE = resolve('app/api/divine/route.ts');
const PLACEHOLDER = '___AUTHOR_THIS___';

let text;
try {
  text = readFileSync(ROUTE, 'utf8');
} catch {
  console.error('✗ Could not read app/api/divine/route.ts — run from repo root.');
  process.exit(2);
}

if (!text.includes('CRISIS_DIRECTIVE')) {
  console.error('✗ CRISIS_DIRECTIVE declaration not found in route.ts — structural error.');
  process.exit(2);
}

if (text.includes(PLACEHOLDER)) {
  console.error('');
  console.error('✗ CRISIS_DIRECTIVE is still the placeholder (___AUTHOR_THIS___).');
  console.error('  Author the crisis directive text and have it reviewed by welfare-design');
  console.error('  accountability before shipping to production.');
  console.error('');
  process.exit(1);
}

console.log('✓ CRISIS_DIRECTIVE is authored — no placeholder found.');
process.exit(0);
