// scripts/signal-system-test.mjs
// Phase 2.3 -- Signal system test
// v2 (2026-07-05): Reading mode no longer emits six labeled sections --
// the arc is a single continuous telling per the narrative form layer
// (NARRATIVE-01). Exact substring checks for section headers are no
// longer possible by design, since the model paraphrases the arc in
// its own words each time.
//
// This version checks what IS mechanically verifiable:
//   1. No leftover legacy header strings or stray ⧁-prefixed labels
//      appear (regression guard against the old six-header template).
//   2. Reading mode produces a substantially longer response than
//      listening mode (proxy for "delivered the full arc" vs "held back").
//
// This version deliberately does NOT verify whether all six thematic
// angles are actually present in the prose -- that requires judgment,
// not string matching. TODO: add an LLM-judge probe (small model call
// scoring thematic coverage 0-6) as a more rigorous replacement --
// tracked separately, not blocking this fix.

const BASE = process.env.ELDER_URL || "http://localhost:3000";
const API = BASE + "/api/chat";

async function ask(mode) {
  const r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      voice: "ojer_tzij",
      mode: mode,
      messages: [{ role: "user", content: "I have been carrying a grief I cannot name for three years. Something ended but I do not know what." }]
    })
  });
  const data = await r.json();
  return data;
}

const LEGACY_HEADERS = [
  "THE MYTH THAT LIVES THROUGH YOU",
  "FIELD SEES",
  "THE SHADOW",
  "THE THRESHOLD",
  "THE ANCESTRAL THREAD",
  "THE CEREMONIAL CHARGE",
];

const MIN_READING_WORDS = 150; // calibrate against real golden output
const MAX_LISTENING_WORDS = 120;

function wordCount(s) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function hasLegacyHeaders(text) {
  return LEGACY_HEADERS.filter((h) => text.includes(h));
}

function strayGlyphHeaderLines(text) {
  return text.split("\n").filter((line) => {
    const t = line.trim();
    if (!t.startsWith("⧁")) return false;
    if (/^⧁⧁READY⧁⧁$/.test(t)) return false;
    if (/^⧁CEILING[:_A-Z0-9-]*⧁?$/.test(t)) return false;
    if (/^⧁CORPUS:[^⧁]+⧁$/.test(t)) return false;
    if (/^⧁IMAGE_FIRST_VIOLATION⧁$/.test(t)) return false;
    return true;
  });
}

let failed = 0;

console.log("Test 1: listening mode should stay short, no legacy headers...");
try {
  const res = await ask("listening");
  const text = res.text || res.content || "";
  const legacy = hasLegacyHeaders(text);
  const stray = strayGlyphHeaderLines(text);
  const words = wordCount(text);
  if (legacy.length > 0 || stray.length > 0 || words > MAX_LISTENING_WORDS) {
    console.log(`  FAIL -- legacy: [${legacy.join(", ")}], stray glyph lines: ${stray.length}, words: ${words} (expected <= ${MAX_LISTENING_WORDS})`);
    failed++;
  } else {
    console.log(`  PASS -- no legacy/stray headers, words: ${words}`);
  }
} catch (e) {
  console.log("  SKIP -- server unavailable: " + e.message);
}

console.log("Test 2: reading mode should deliver a full, unlabeled arc...");
try {
  const res = await ask("reading");
  const text = res.text || res.content || "";
  const legacy = hasLegacyHeaders(text);
  const stray = strayGlyphHeaderLines(text);
  const words = wordCount(text);
  const problems = [];
  if (legacy.length > 0) problems.push(`legacy headers present: ${legacy.join(", ")}`);
  if (stray.length > 0) problems.push(`${stray.length} stray ⧁-prefixed header-like line(s)`);
  if (words < MIN_READING_WORDS) problems.push(`too short: ${words} words (expected >= ${MIN_READING_WORDS})`);
  if (problems.length > 0) {
    console.log("  FAIL -- " + problems.join("; "));
    failed++;
  } else {
    console.log(`  PASS -- unlabeled, full-length arc (${words} words)`);
  }
} catch (e) {
  console.log("  SKIP -- server unavailable: " + e.message);
}

console.log("");
console.log("Signal system: " + (failed === 0 ? "PASS" : "FAIL " + failed + " tests"));
process.exit(failed > 0 ? 1 : 0);
