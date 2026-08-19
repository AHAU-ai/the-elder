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
// Was "/api/chat" until 2026-08-19 -- that route has never existed in this
// app (confirmed against the live app/api/ tree); every call here 404'd
// unconditionally, readiness/timing notwithstanding. The real generation
// endpoint is /api/divine, with lineageKey + mode (not voice + mode) as
// its actual contract -- see app/api/divine/route.ts. "listening" maps to
// a single divine 'council' turn (an ordinary exchange). "reading" is NOT
// a single cold 'reading'-mode call -- see ask()'s own comment for why a
// naive single call silently returns a short clarifying question instead
// of the full arc, and how this replicates CouncilTabs.tsx's real two-turn
// shape instead.
const API = BASE + "/api/divine";

async function callDivine(messages, mode) {
  const r = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lineageKey: "maya", mode, messages }) // maya -> ojer_tzij, see lib/lineageToVoiceKey.ts
  });
  if (!r.ok) {
    throw new Error(`HTTP ${r.status} from ${API}`);
  }
  return r.json();
}

const OPENING_MESSAGE = "I have been carrying a grief I cannot name for three years. Something ended but I do not know what.";

async function ask(mode) {
  const opening = [{ role: "user", content: OPENING_MESSAGE }];

  if (mode === "listening") {
    // "Listening" IS the ordinary exchange -- a single 'council' turn,
    // matching how CouncilTabs.tsx's first message is always sent
    // (isReadingMode = readyToRead && !firstReading, false on turn one).
    return callDivine(opening, "council");
  }

  // "Reading" mode must replicate the real two-turn shape CouncilTabs.tsx
  // actually uses -- a single cold `mode:'reading'` call is NOT equivalent
  // to what a seeker experiences. Turn one is always 'council'; only once
  // that response carries readyToRead:true does the app resend with
  // mode:'reading' (see app/api/divine/route.ts's own comment: a response
  // that still carries the READY signal is "the model asking its one
  // allowed clarifying question, not delivering the Reading"). Sending
  // 'reading' cold, as this test did until 2026-08-19, gets exactly that
  // clarifying question back -- a real ~20-word response that looks like a
  // legitimate short answer, not an error, which is why this went
  // undetected: the old broken endpoint always SKIPped before this could
  // ever be observed.
  const first = await callDivine(opening, "council");
  if (!first.readyToRead) {
    // The model judged its first response sufficient to deliver the
    // reading directly -- rare but valid; do not force a second turn onto
    // an exchange the instrument itself already completed.
    return first;
  }
  const history = [
    ...opening,
    { role: "assistant", content: first.text ?? "" },
    { role: "user", content: OPENING_MESSAGE },
  ];
  return callDivine(history, "reading");
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

// failed = a real reading was obtained and it violated a signal-system
// rule (content drift). errored = no reading was obtained at all
// (connectivity, a non-2xx response, malformed JSON). These must never be
// conflated: a skip that quietly reported PASS is exactly CI-01 from
// docs/technical-strategic-and-ux-audit.md -- "the sophisticated layers
// are dormant and the crude layers are load-bearing" applies to this
// harness too. Absence of a violation is not proof of compliance if the
// probe never actually ran.
let failed = 0;
let errored = 0;

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
  console.log("  ERROR -- no reading obtained, cannot verify: " + e.message);
  errored++;
}

console.log("Test 2: reading mode should deliver a full, unlabeled arc...");
let declined = false;
try {
  const res = await ask("reading");
  if (res.ceilingCategory) {
    // A guardian rejection or other ceiling decline is neither the mythic
    // arc nor a signal-system format bug -- it's the instrument declining
    // to speak at all, for content/safety reasons this test isn't
    // equipped to judge. Scoring its short decline text against
    // MIN_READING_WORDS would be a category error (discovered live,
    // 2026-08-19: a guardian_rejected decline read as "too short: 22
    // words" here before this check existed). Reported distinctly, not
    // silently passed and not wrongly failed.
    console.log(`  DECLINED -- ceilingCategory: ${res.ceilingCategory}. Not scored against arc-length; this is the guardian/welfare gate doing its job, not a signal-format question. Text: "${(res.text || "").slice(0, 100)}"`);
    declined = true;
  } else {
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
  }
} catch (e) {
  console.log("  ERROR -- no reading obtained, cannot verify: " + e.message);
  errored++;
}

console.log("");
if (errored > 0) {
  console.log(`Signal system: ERROR -- ${errored} test(s) never reached the model. Not a content-drift verdict; the harness could not run.`);
} else if (declined && failed === 0) {
  console.log("Signal system: INCONCLUSIVE -- Test 2's reading was declined by the guardian/welfare gate before format could be checked. Re-run to get a real verdict; this is not a pass.");
} else {
  console.log("Signal system: " + (failed === 0 ? "PASS" : "FAIL " + failed + " tests"));
}
// A decline exits 0, deliberately -- this workflow step is NOT advisory-
// wrapped (unlike drift-detect/welfare-gate-probe/blue-team, which all
// have an `|| echo WARNING` PR variant), so a nonzero exit here hard-fails
// every PR. Whether the guardian was right to decline this specific probe
// is a content-safety question this format check isn't positioned to
// judge, and guardian outcomes aren't fully deterministic (the route
// itself retries once server-side) -- gating merges on that would repeat
// CI-06's finding (a probe suite scoped as a deploy gate, wired as a PR
// gate). It is printed loudly above specifically so it stays visible
// without blocking, not silently swallowed the way the old SKIP-as-PASS
// bug hid failures.
process.exit(errored > 0 || failed > 0 ? 1 : 0);
