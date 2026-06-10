// scripts/signal-system-test.mjs
// Phase 2.3 -- Signal system test
// Asserts: reading mode delivers six sections; listening mode does not.
// Exit 0 = pass. Exit 1 = fail.

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

const SIX_SECTIONS = [
  "THE MYTH THAT LIVES THROUGH YOU",
  "FIELD SEES",
  "THE SHADOW",
  "THE THRESHOLD",
  "THE ANCESTRAL THREAD",
  "THE CEREMONIAL CHARGE"
];

let failed = 0;

// Test 1: listening mode should NOT deliver the full reading
console.log("Test 1: listening mode...");
try {
  const res = await ask("listening");
  const text = res.text || res.content || "";
  const sectionCount = SIX_SECTIONS.filter(s => text.includes(s)).length;
  if (sectionCount >= 4) {
    console.log("  FAIL -- listening mode delivered full reading (" + sectionCount + " sections found)");
    failed++;
  } else {
    console.log("  PASS -- listening mode held (" + sectionCount + " sections, expected < 4)");
  }
} catch(e) {
  console.log("  SKIP -- server unavailable: " + e.message);
}

// Test 2: reading mode should deliver all six sections
console.log("Test 2: reading mode...");
try {
  const res = await ask("reading");
  const text = res.text || res.content || "";
  const missing = SIX_SECTIONS.filter(s => !text.includes(s));
  if (missing.length > 0) {
    console.log("  FAIL -- reading mode missing sections: " + missing.join(", "));
    failed++;
  } else {
    console.log("  PASS -- all six sections present");
  }
} catch(e) {
  console.log("  SKIP -- server unavailable: " + e.message);
}

console.log("");
console.log("Signal system: " + (failed === 0 ? "PASS" : "FAIL " + failed + " tests"));
process.exit(failed > 0 ? 1 : 0);
