#!/usr/bin/env node
// scripts/verify-hearth-read-only.mjs
//
// /hearth's entire premise is that a seeker who wants nothing FROM The
// Elder can arrive there and cost nothing, change nothing, and never
// touch generation. That promise needs to be provably true, not just
// claimed in a comment -- this is the static-analysis equivalent of the
// zero-write assertion, checking the actual source rather than trusting
// a runtime smoke test to happen to exercise every path.
//
// WHAT IT CHECKS:
//   1. app/api/hearth/route.ts exports GET and does NOT export POST,
//      PUT, PATCH, or DELETE -- so there is no write handler on this
//      route AT ALL, not just "the client doesn't call it".
//   2. app/components/Hearth.tsx never references /api/divine, and
//      never constructs a fetch() with a non-GET method.
//
// A runtime probe (hit /hearth, assert no POST was observed) would only
// prove "this particular click-through didn't trigger a write" -- it
// can't prove absence the way reading the source can.

import { readFileSync } from 'node:fs';

let failures = 0;
function fail(msg) {
  console.error(`  FAIL  ${msg}`);
  failures++;
}
function ok(msg) {
  console.log(`  ok    ${msg}`);
}

const routeSrc = readFileSync('app/api/hearth/route.ts', 'utf8');
const componentSrc = readFileSync('app/components/Hearth.tsx', 'utf8');

console.log('Checking app/api/hearth/route.ts...');
if (/export\s+async\s+function\s+GET/.test(routeSrc)) {
  ok('exports GET');
} else {
  fail('does not export GET -- the route would have nothing to serve');
}
for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
  const re = new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b`);
  if (re.test(routeSrc)) {
    fail(`exports ${method} -- /hearth's route must be read-only, no write handler of any kind`);
  } else {
    ok(`does not export ${method}`);
  }
}

console.log('Checking app/components/Hearth.tsx...');
if (componentSrc.includes('/api/divine')) {
  fail('references /api/divine -- the quiet path must never touch generation');
} else {
  ok('no reference to /api/divine');
}
// Matches fetch(...) calls that set a non-GET method -- GET is the only
// method that's also valid to omit entirely (fetch defaults to GET), so
// this only flags an explicit write method, not the absence of one.
const writeMethodRe = /method\s*:\s*['"](POST|PUT|PATCH|DELETE)['"]/g;
const writeMatches = [...componentSrc.matchAll(writeMethodRe)];
if (writeMatches.length > 0) {
  fail(`found ${writeMatches.length} write-method fetch call(s): ${writeMatches.map(m => m[1]).join(', ')}`);
} else {
  ok('no write-method fetch calls');
}

console.log('');
if (failures > 0) {
  console.error(`${failures} check(s) failed -- /hearth's read-only promise is not currently true.`);
  process.exit(1);
}
console.log('/hearth is provably read-only: no write handler, no /api/divine reference, no write-method fetch calls.');
