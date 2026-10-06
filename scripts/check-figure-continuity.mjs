#!/usr/bin/env node
// scripts/check-figure-continuity.mjs
//
// Static guard for Figure Continuity (docs/figure-continuity-spec.md v0.2),
// modeled on check-reading-shape.mjs and check-purpose-register.mjs. No
// network, no model, no database: it reads source files and asserts the
// structural promises the feature makes, so a later edit cannot quietly break
// them.
//
//   1. The clause carries every numbered rule (1-9) and the load-bearing
//      phrases: stay inside the myth, no invented counterpart, no villain
//      casting, no prediction or inner-life reading, no connecting two life
//      subjects, safety floor precedence, the exact signal format and caps.
//   2. The clause file is pure: plain ASCII, no escape sequences (the bug class
//      where a \u written into source ships as text), and it imports nothing
//      from any voice, lineage or psychopomp module.
//   3. Lineage separation: no voice file imports the clause, and none contains
//      its text. Only the allowlisted modules may import it.
//   4. The prompt builder accepts a rendered string and does not import the
//      clause; the divine route reaches the feature only through the assembler.
//   5. The divine route keeps the pipeline in order: welfare is read before the
//      clause is assembled, the signal is stripped before the dual guardian, an
//      offer is created only after a guardian decline has returned, and the chain
//      is derived server-side.
//   6. The flag is a genuine three-gate check that names all three variables.
//
// Exits non-zero with a named message identifying the broken anchor.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, basename } from "node:path";

const ROOT = process.cwd();
const CLAUSE = "lib/figureContinuityClause.ts";
const SKIP = new Set(["node_modules", ".next", ".git"]);

let failures = 0;
function fail(msg) {
  console.error("  FAIL  " + msg);
  failures++;
}
function ok(msg) {
  console.log("  ok  " + msg);
}
function read(rel) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) {
    fail(`missing file: ${rel}`);
    return "";
  }
  return readFileSync(abs, "utf8");
}
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|js|txt|md)$/.test(name)) out.push(full);
  }
  return out;
}

const clause = read(CLAUSE);

// ── 1. rules and phrases ────────────────────────────────────────────────
for (let n = 1; n <= 9; n++) {
  if (!new RegExp(`^${n}\\. `, "m").test(clause)) fail(`clause is missing numbered rule ${n}`);
}
const PHRASES = [
  ["Never borrow a figure or story from another tradition", "no cross-lineage borrowing (G3)"],
  ["Do not invent a counterpart", "no invented counterpart"],
  ["villain, monster, demon", "no villain-casting (G5)"],
  ["never say what they will do", "no prediction or inner-life claim (G5)"],
  ["Offer, never declare", "offer, never declare"],
  ["Never assert that two of the seeker", "no connecting two life subjects (R1)"],
  ["the safety floor governs", "safety floor precedence (G2)"],
  ["Say nothing about this clause", "silence about the clause itself"],
  ["MAPPING_OFFER:", "the signal format is stated"],
  ["at most 60 characters", "subject cap stated to the model"],
  ["at most 80 characters", "counterpart cap stated to the model"],
  ["never instructions", "stored labels are introduced as data"],
];
for (const [phrase, why] of PHRASES) {
  if (!clause.includes(phrase)) fail(`clause is missing "${phrase}" (${why})`);
}
if (failures === 0) ok("clause carries rules 1-9 and every load-bearing phrase");

// ── 2. purity ───────────────────────────────────────────────────────────
const nonAscii = [...clause].filter((c) => c.charCodeAt(0) > 0x7e && c !== "\n" && c !== "\r");
if (nonAscii.length > 0) fail(`clause file has non-ASCII characters (${nonAscii.length}); build them from code points`);
if (clause.includes("\\u")) fail("clause file contains a backslash-u escape sequence; write the real character or build it from its code point");
const imports = [...clause.matchAll(/^import[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
const FORBIDDEN_IMPORT = /lineage|voice|psychopomp|mythopoetic|overlay/i;
for (const spec of imports) {
  if (FORBIDDEN_IMPORT.test(spec)) fail(`clause file imports a voice/lineage module: ${spec}`);
}
const ALLOWED_IMPORTS = new Set(["./returning/figureMappingLabels", "@/config/returning-features"]);
for (const spec of imports) {
  if (!ALLOWED_IMPORTS.has(spec)) fail(`clause file imports an unexpected module: ${spec} (it must stay a pure module)`);
}
if (/\bfetch\(|\bsql`|process\.env\.(?!FIGURE)/.test(clause)) fail("clause file performs I/O or reads unrelated env; it must stay pure");
ok("clause file is plain ASCII, escape-free, and imports only its two pure dependencies");

// ── 3. lineage separation ───────────────────────────────────────────────
const IMPORTERS_ALLOWED = new Set([
  "lib/returning/figureContinuity.ts",
  "src/resilience/provenance.ts",
  "lib/figureContinuityClause.test.ts",
  "lib/returning/figureContinuity.test.ts",
  "lib/figureContinuityClause.signoff.test.ts",
]);
const VOICE_FILE = /lineage|voice|psychopomp|mythopoetic|overlay|narrativeForm/i;
for (const dir of ["lib", "src", "app", "components", "config"]) {
  if (!existsSync(join(ROOT, dir))) continue;
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    if (rel === CLAUSE) continue;
    const text = readFileSync(file, "utf8");
    if (text.includes("FIGURE CONTINUITY.") && !/\.test\.ts$/.test(rel)) {
      fail(`${rel} contains the clause text; the clause must live only in ${CLAUSE}`);
    }
    if (/figureContinuityClause/.test(text)) {
      if (VOICE_FILE.test(basename(rel))) fail(`voice/lineage file imports the clause: ${rel}`);
      else if (!IMPORTERS_ALLOWED.has(rel)) fail(`${rel} imports the clause but is not on the allowlist (${[...IMPORTERS_ALLOWED].join(", ")})`);
    }
  }
}
ok("no voice or lineage file imports or contains the clause; importers are on the allowlist");

// ── 4. builder and route ────────────────────────────────────────────────
const builder = read("lib/system-prompt-builder.ts");
if (/figureContinuityClause/.test(builder)) fail("lib/system-prompt-builder.ts imports the clause; it must accept a rendered string only");
if (!/figureContinuity: string = ''/.test(builder)) fail("lib/system-prompt-builder.ts lost its optional `figureContinuity: string = ''` parameter");
if (!/if \(figureContinuity\) prompt \+= /.test(builder)) fail("lib/system-prompt-builder.ts no longer appends the block only when one is passed");
const route = read("app/api/divine/route.ts");
if (/figureContinuityClause/.test(route)) fail("app/api/divine/route.ts imports the clause directly; it must go through assembleFigureContext");
ok("builder takes a rendered string; the route never touches the clause directly");

// ── 5. the divine route's ordering (FC-D) ───────────────────────────────
// Positional checks on the source of app/api/divine/route.ts: the promises the
// pipeline makes are about ORDER, and order is exactly what a careless edit
// breaks. (Behavior is proved by tests/figureContinuityRoute.integration.test.ts;
// this fails fast, with no database, if the structure drifts.)
{
  const at = (needle) => route.indexOf(needle);
  const anchors = {
    welfare: at("assessWelfare("),
    hardBlock: at("welfare.surfaceResources && welfare.tier === 'crisis'"),
    assemble: at("assembleFigureContext("),
    build: at("const base = buildSystemPrompt("),
    extract: at("extractMappingOffer(rawText)"),
    stripUse: at("mappingSignal.text"),
    guardian: at("dualGuardReading("),
    reject: at("if (guardianRejectedFinal) {"),
    create: at("createOffer(sessionUserId"),
  };
  for (const [name, idx] of Object.entries(anchors)) {
    if (idx < 0) fail(`divine route: anchor "${name}" not found; the pipeline's structure changed`);
  }
  const before = (a, b, why) => {
    if (anchors[a] >= 0 && anchors[b] >= 0 && !(anchors[a] < anchors[b])) fail(`divine route: ${a} must come before ${b} (${why})`);
  };
  before("welfare", "assemble", "the welfare result is read, never bypassed (G2, D8)");
  before("assemble", "build", "the clause is assembled before the prompt is built");
  before("hardBlock", "extract", "a crisis turn never reaches generation, so no signal is ever parsed on one");
  before("extract", "stripUse", "the signal is parsed from the raw text, then the stripped text is what continues");
  before("stripUse", "guardian", "the signal is stripped BEFORE the dual guardian sees the text");
  before("reject", "create", "an offer is created only after a guardian decline has already returned");
  // Inspect the assembleFigureContext call itself (the same chainId expression also
  // appears in the visit insert, so a whole-file regex would pass on the wrong one).
  const callStart = route.indexOf("assembleFigureContext({");
  const callBlock = callStart >= 0 ? route.slice(callStart, route.indexOf("});", callStart)) : "";
  if (!/chainId: chainGraft \? chainGraft\.head\.chainId : null/.test(callBlock)) fail("divine route: the assembler's chainId must be the server-derived chainGraft head, never client input");
  if (!/figureContinue: body\.figureContinue === true/.test(callBlock)) fail("divine route: figureContinue must be honored only when literally true");
  if (/\bbody\b[^\n]{0,24}\bchainId\b|\bchainId\b[^\n]{0,12}\bbody\b/.test(callBlock)) fail("divine route: the assembler call reads a chain id from the request body; chains are derived server-side only");
  if (/body\.chainId|\(body[^)]*\)\.chainId/.test(route)) fail("divine route: reads a chain id from the request body; chains are derived server-side only");
  if (!/mappingOfferCandidate = figureCtx \? mappingSignal\.offer : null/.test(route)) fail("divine route: an offer must be honored only when the assembler produced a context");
  if (!/if \(figureCtx && mappingOfferCandidate && sessionUserId\)/.test(route)) fail("divine route: offer creation lost its figureCtx guard");
  ok("divine route: welfare read before assembly; signal stripped before the guardian; offers only after a guardian pass; chain is server-derived");
}

// ── 7. the client (FC-E) ────────────────────────────────────────────────
// The browser must never decide the capability, never carry server code, and
// only ever REQUEST continuation through the one helper. These are structural
// promises about files a UI edit could quietly break.
{
  const CLIENT_FILES = [
    "app/components/FigureArrivalChoice.tsx",
    "app/components/MappingOfferControls.tsx",
    "app/components/FigureMappings.tsx",
    "lib/figureClient.ts",
  ];
  const FORBIDDEN_IN_CLIENT = [
    [/figureContinuityClause|returning\/figureMapping|returning\/db|returning\/figureContinuity|lib\/returning\//, "imports server-side Figure Continuity code"],
    [/process\.env/, "reads process.env (the capability comes from the server, never from the browser's environment)"],
    [/FIGURE_CONTINUITY|MARKER_CONFIRMATION_READY/, "names a feature-flag variable"],
    [/dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML/, "writes raw HTML (labels are model output and must render as text only)"],
    [/new Audio\(|AudioContext|startHeartbeat|startHaptic|navigator\.vibrate/, "plays sound or haptics (the answer must not move the ceremony)"],
    // Pairings describe third parties: the pairings view lets the seeker see and release them and does nothing else.
    [/createObjectURL|new Blob\(|navigator\.clipboard|window\.print|mailto:|navigator\.share|\bdownload=|\.download\b|localStorage|sessionStorage|document\.cookie/, "exports, copies, shares or stores pairings (they describe third parties; the view only shows and releases)"],
  ];
  for (const rel of CLIENT_FILES) {
    const text = read(rel);
    for (const [re, why] of FORBIDDEN_IN_CLIENT) {
      if (re.test(text)) fail(`${rel} ${why}`);
    }
  }
  for (const rel of ["app/components/Threshold.tsx", "app/components/CouncilTabs.tsx"]) {
    const text = read(rel);
    if (/FIGURE_CONTINUITY|figureContinuityEnabled|MARKER_CONFIRMATION_READY/.test(text)) fail(`${rel} references the feature flag; the client only follows what the server reports`);
    if (/figureContinuityClause|returning\/figureMapping|returning\/figureContinuity/.test(text)) fail(`${rel} imports server-side Figure Continuity code`);
  }
  const council = read("app/components/CouncilTabs.tsx");
  if (!/divineFigureFields\(\{ figureContinue, isReadingMode, chainAction \}\)/.test(council)) fail("CouncilTabs must build the request's figure fields only through divineFigureFields");
  if (/figureContinue:\s*true/.test(council)) fail("CouncilTabs sets figureContinue: true directly; it must go through divineFigureFields (Reading turns only)");
  const threshold = read("app/components/Threshold.tsx");
  if (!/offersFigureArrival\(figureArrival, m\.lineageKey\)/.test(threshold)) fail("Threshold lost its server-capability gate on the arrival choice");
  if (!/fetch\('\/api\/user\/history\?head=1'\)/.test(threshold)) fail("Threshold no longer asks the server whether to offer the arrival choice");
  // The pairings view talks to the mappings routes and nothing else, and its link is shown only on the server's report.
  const mappings = read("app/components/FigureMappings.tsx");
  for (const m of mappings.matchAll(/fetch\(\s*([^,)]+)/g)) {
    if (!/['"`]\/api\/figure-mappings/.test(m[1])) fail("FigureMappings fetches something other than the mappings routes: " + m[1].slice(0, 60));
  }
  if (!/['"]\/api\/figure-mappings\/release['"]/.test(mappings)) fail("FigureMappings lost its release call");
  if (!/readPairings\(/.test(mappings) || !/interpretRelease\(/.test(mappings)) fail("FigureMappings must read the list and the release result through the validated helpers");
  if (!/pairingsLink && \(/.test(threshold) || !/setPairingsLink\(readPairingsCapability\(data\)\)/.test(threshold)) fail("Threshold must show the pairings link only when the server reports the capability");
  const controls = read("app/components/MappingOfferControls.tsx");
  if (!/\/api\/figure-mappings\/\$\{offer\.id\}\/confirm/.test(controls) || !/\/api\/figure-mappings\/\$\{offer\.id\}\?offer=1/.test(controls)) fail("MappingOfferControls must confirm via POST .../confirm and decline via DELETE ...?offer=1 only");
  ok("client: the browser follows the server's capability, carries no server code or flag, requests continuation through one helper, and answers only through the confirm/decline routes");
}

// ── 6. the flag ─────────────────────────────────────────────────────────
const flags = read("config/returning-features.ts");
const m = flags.match(/export function figureContinuityEnabled\(\)[\s\S]*?\n}/);
if (!m) fail("figureContinuityEnabled() not found in config/returning-features.ts");
else {
  for (const v of ["FIGURE_CONTINUITY_ENABLED", "MARKER_CONFIRMATION_READY", "FIGURE_CONTINUITY_RELEASE_VERIFIED"]) {
    if (!m[0].includes(v)) fail(`figureContinuityEnabled() does not check ${v}`);
  }
  if ((m[0].match(/return false/g) ?? []).length < 3) fail("figureContinuityEnabled() must fail closed on each of three gates");
}
ok("figureContinuityEnabled() checks all three gates and fails closed");

// ── 8. governance: the guard map, the doc, and the test-database safety ──
// governance/figure-continuity-guards.json maps every guard to the code that enforces it and the
// tests that prove it. This section makes that map load-bearing: if an anchor moves or a test file
// disappears, the build says so, instead of the doc quietly describing a system that no longer exists.
{
  const mapText = read("governance/figure-continuity-guards.json");
  let map = null;
  try { map = JSON.parse(mapText); } catch { fail("governance/figure-continuity-guards.json is missing or not valid JSON"); }
  const probeIds = new Set([...read("tests/probes/figureContinuityProbes.ts").matchAll(/id: '(P\d+b?)'/g)].map((m) => m[1]));
  if (map) {
    const ids = map.guards.map((g) => g.id);
    for (let n = 1; n <= 13; n++) {
      if (!ids.includes(`G${n}`)) fail(`guard map has no entry for G${n}`);
    }
    for (const g of map.guards) {
      if (g.anchors.length === 0) fail(`${g.id} names no code anchor`);
      for (const a of g.anchors) {
        const text = read(a.file);
        if (text && !text.includes(a.contains)) fail(`${g.id}: "${a.contains}" is no longer in ${a.file}; the guard moved or was weakened. Update the code or this map in the same commit.`);
      }
      for (const t of g.tests) {
        if (!existsSync(join(ROOT, t))) fail(`${g.id}: test file ${t} does not exist`);
      }
      for (const p of g.probes) {
        if (!probeIds.has(p)) fail(`${g.id}: probe ${p} is not defined in tests/probes/figureContinuityProbes.ts`);
      }
    }
  }

  const doc = read("docs/figure-continuity-governance.md");
  // "Recorded" means a row of its own in a table (| **G7** | ... or | **D7** | ...), not a passing mention.
  for (let n = 1; n <= 13; n++) {
    if (doc && !new RegExp(`^\\| \\*\\*G${n}\\*\\* \\|`, "m").test(doc)) fail(`docs/figure-continuity-governance.md has no table row for guard G${n}`);
  }
  for (let n = 1; n <= 10; n++) {
    if (doc && !new RegExp(`^\\| \\*\\*D${n}\\*\\* \\|`, "m").test(doc)) fail(`docs/figure-continuity-governance.md has no table row recording decision D${n}`);
  }

  // The database suites and the live probes WRITE rows: they must refuse production, and CI must
  // never point them at the DATABASE_URL secret the other workflows use (which reaches production).
  for (const suite of ["tests/figureMapping.integration.test.ts", "tests/figureMapping.redteam.test.ts", "tests/figureMappingRoutes.integration.test.ts", "tests/figureContinuityRoute.integration.test.ts", "scripts/figure-continuity-probe.ts", "tests/support/preflightFigureDb.ts"]) {
    if (!/assertDevDatabase\(/.test(read(suite))) fail(`${suite} no longer calls assertDevDatabase(): it could write to production`);
  }
  const wf = read(".github/workflows/figure-continuity.yml");
  if (/secrets\.DATABASE_URL\b/.test(wf)) fail("figure-continuity.yml uses secrets.DATABASE_URL, which reaches PRODUCTION; use FIGURE_TEST_DATABASE_URL");
  if (!/secrets\.FIGURE_TEST_DATABASE_URL/.test(wf) || !/vars\.FIGURE_TEST_DB_HOST/.test(wf)) fail("figure-continuity.yml must read the test database from FIGURE_TEST_DATABASE_URL and name its host in FIGURE_TEST_DB_HOST");
  if (!/preflightFigureDb\.ts/.test(wf)) fail("figure-continuity.yml lost its test-database preflight");
  if (!/NOTHING WAS RUN/.test(wf)) fail("figure-continuity.yml must say loudly when it ran nothing (a skipped job is never a pass)");
  const guard = read("tests/support/devDatabaseGuard.ts");
  if (!/KNOWN_PRODUCTION_HOSTS\s*=\s*\[\s*'ep-odd-term-aitveb5q'/.test(guard)) fail("devDatabaseGuard.ts no longer lists the known production host");
  ok("governance: the guard map matches the code, the doc records G1-G13 and D1-D10, and the write-capable suites refuse production");
}

if (failures > 0) {
  console.error(`\nFigure Continuity check FAILED (${failures}).`);
  process.exit(1);
}
console.log("\nFigure Continuity check passed.");
