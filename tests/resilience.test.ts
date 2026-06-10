/**
 * resilience.test.ts — Invariant tests for the resilience architecture.
 * Pure-logic tests (no DB/model) so they run in CI on every commit.
 * Run: npx tsx tests/resilience.test.ts   (or wire to vitest/jest)
 */
import { normalizeKiche, assertCanonical } from "../src/corpus/normalize";
import { loadFlags, telemetryAllowed, isVoiceEnabled } from "../src/resilience/flags";
import { silence } from "../src/resilience/failTowardSilence";
import { renderProvenanceBlock } from "../src/resilience/provenance";
import { evaluateCase, GoldenCase } from "../src/resilience/voiceRegression";

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    console.error(`FAIL  ${name}`);
    failures++;
  }
}

// 1. Normalization gate collapses all three apostrophe forms to one.
{
  const ascii = normalizeKiche("K'iche'").text; // U+0027
  const smart = normalizeKiche("K\u2019iche\u2019").text; // U+2019
  const modifier = normalizeKiche("K\u02BCiche\u02BC").text; // U+02BC
  check("normalize: ascii apostrophe collapses", ascii === modifier);
  check("normalize: smart quote collapses", smart === modifier);
  check("normalize: all three forms now identical", ascii === smart && smart === modifier);
  check("normalize: change is reported", normalizeKiche("K'iche'").changed === true);
}

// 2. assertCanonical throws on non-canonical, passes on canonical.
{
  let threw = false;
  try {
    assertCanonical("Ojer Tzij'"); // ASCII apostrophe -> not canonical
  } catch {
    threw = true;
  }
  check("assertCanonical: rejects non-canonical", threw);
  let ok = true;
  try {
    assertCanonical(normalizeKiche("Ojer Tzij'").text);
  } catch {
    ok = false;
  }
  check("assertCanonical: accepts canonical", ok);
}

// 3. Classroom telemetry is structurally off, regardless of flags.
{
  const flags = loadFlags();
  check("telemetry: classroom always off", telemetryAllowed(flags, "classroom") === false);
  check("telemetry: adult on by default", telemetryAllowed(flags, "adult_individual") === true);
}

// 4. Deferred voices default off (consent invariant).
{
  const flags = loadFlags();
  check("flags: babalawo off by default", isVoiceEnabled(flags, "babalawo") === false);
  check("flags: elder_of_country off by default", isVoiceEnabled(flags, "elder_of_country") === false);
  check("flags: ojer_tzij on by default", isVoiceEnabled(flags, "ojer_tzij") === true);
}

// 5. Silence is logged and in-register (no error codes leaked to seeker).
{
  let logged = false;
  const s = silence("retrieval_empty", () => (logged = true));
  check("silence: is logged", logged && s.logged === true);
  check("silence: utterance has no error code", !/error|undefined|null|stack/i.test(s.utterance));
  check("silence: ok is false", s.ok === false);
}

// 6. Provenance fails toward silence when nothing grounded the reading.
{
  const block = renderProvenanceBlock({
    corpusVersion: "v1",
    modelVersion: "m1",
    contractVersion: "c1",
    voiceKey: "ojer_tzij",
    generatedAt: new Date().toISOString(),
    passages: [],
  });
  check("provenance: empty passages -> reflection-only disclaimer", /reflection only/i.test(block));
  const grounded = renderProvenanceBlock({
    corpusVersion: "v1",
    modelVersion: "m1",
    contractVersion: "c1",
    voiceKey: "ojer_tzij",
    generatedAt: new Date().toISOString(),
    passages: [{ passageId: "pw-iv-012", section: "Part IV — The Dawn", source: "Stanzione, Popol Wuj (Ximénez 1701–1703)" }],
  });
  check("provenance: grounded -> sourcing not sanction", /instrument's own/i.test(grounded));
}

// 7. Voice regression catches orthography + identity leakage.
{
  const c: GoldenCase = {
    id: "t1",
    voice: "ojer_tzij",
    seekerProfileFixture: "fixture-a",
    fixedRetrievalPassageIds: ["pw-iv-012"],
    reference: "⟡ The fire speaks. The old words hold the threshold. Receive this charge.",
    referenceCorpusVersion: "v1",
  };
  const bad = evaluateCase(c, "I am a real Ajq'ij. Consult your Tzolk'in day signs.");
  check("regression: catches identity overclaim", bad.leakageHits.length > 0);
  check("regression: bad case fails", bad.passed === false);
  const good = evaluateCase(c, "⟡ The fire speaks. The old words hold the threshold. Receive this charge.");
  check("regression: clean reference passes", good.passed === true);
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
} else {
  console.log("\nAll resilience invariants hold.");
}
