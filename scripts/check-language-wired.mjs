// scripts/check-language-wired.mjs
//
// The language toggle is only real if the choice reaches the model. Before
// this guard, no client ever sent `languageName`, so the server's LANGUAGE
// DIRECTIVE never fired. This fails the build if a client fetch to a
// seeker-facing generation route stops sending it, or a route stops reading it.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const CLIENT_ROUTES = ['/api/divine', '/api/threshold', '/api/elder/marker-offer', '/api/journal'];
const SERVER_FILES = {
  'app/api/divine/route.ts': 'languageNameFromInput',
  'app/api/threshold/route.ts': 'languageNameFromInput',
  'app/api/elder/marker-offer/route.ts': 'languageNameFromInput',
  'app/api/journal/route.ts': 'languageNameFromInput',
};

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (f === 'node_modules' || f === '.next' || f === 'api') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(f)) out.push(p);
  }
  return out;
}

const problems = [];
for (const file of walk(join(ROOT, 'app'))) {
  const src = readFileSync(file, 'utf8');
  for (const route of CLIENT_ROUTES) {
    let i = -1;
    while ((i = src.indexOf(`fetch(`, i + 1)) !== -1) {
      const window = src.slice(i, i + 700);
      if (!new RegExp(`['"\`]${route}(['"\`?])`).test(window.slice(0, 120))) continue;
      if (!window.includes('languageName')) {
        problems.push(`${file.replace(ROOT, '')}: fetch(${route}) does not send languageName`);
      }
    }
  }
}
for (const [f, needle] of Object.entries(SERVER_FILES)) {
  if (!readFileSync(join(ROOT, f), 'utf8').includes(needle)) problems.push(`${f}: no longer reads languageName`);
}

if (problems.length) {
  console.error('check-language-wired FAILED:\n' + problems.map((p) => '  - ' + p).join('\n'));
  process.exit(1);
}
console.log('check-language-wired: ok');
