/**
 * corpusRetrieval.integration.test.ts — real retrieveForVoice() against the
 * live DB and Voyage API. Deliberately NOT in resilience.test.ts: that suite
 * is pure-logic by design so it runs in CI on every commit without secrets.
 * This one needs DATABASE_URL + VOYAGE_API_KEY and hits real network/DB, so
 * it's a separate, explicitly-run check.
 *
 * Why this exists: retrieveForVoice() fails soft to [] on ANY error --
 * missing key, DB error, wrong column, network failure -- indistinguishable
 * from "no relevant passage found." That design is correct for a live
 * reading (never block a seeker over infra), but it means a real bug can
 * hide behind an empty array indefinitely, which is exactly what happened
 * 2026-08-18: retrievable_passage's frozen SELECT * view didn't expose the
 * filter column at all, and every call silently returned [] until someone
 * queried the DB by hand. This test exists so that specific failure mode
 * gets caught by a run, not by luck.
 *
 * Run: npx tsx tests/corpusRetrieval.integration.test.ts
 */
import { retrieveForVoice } from "../lib/corpusRetrieval";

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    console.error(`FAIL  ${name}`);
    failures++;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("SKIPPED: DATABASE_URL not set -- this test needs a real DB connection.");
    process.exit(1);
  }
  if (!process.env.VOYAGE_API_KEY) {
    console.error("SKIPPED: VOYAGE_API_KEY not set -- this test needs to embed a real query.");
    process.exit(1);
  }

  // A query that should land near the corpus's actual content (Zohar,
  // Bereshit 1:1-2:10 -- primordial light / concealment / creation), not a
  // vague or unrelated prompt -- a real bug (wrong column, empty view) and
  // a real "no match" should not be able to hide behind an ambiguous query.
  const seekerText =
    "What does the tradition say about the primordial light hidden within the concealment before creation?";

  const mekubalResults = await retrieveForVoice("mekubal", seekerText, 3);

  check("mekubal retrieval returns at least one passage", mekubalResults.length > 0);
  check(
    "every result has a non-empty body (real corpus text, not a stub)",
    mekubalResults.every((r) => typeof r.body === "string" && r.body.length > 20)
  );
  check(
    "every result cites a real passageId/section/source",
    mekubalResults.every((r) => r.passageId && r.section && r.source)
  );
  check(
    "results are plausibly Zohar/Bereshit content, not contamination from another voice",
    mekubalResults.every((r) => /zohar/i.test(r.source))
  );

  if (mekubalResults.length > 0) {
    console.log("\n  sample match:");
    console.log(`    passageId: ${mekubalResults[0].passageId}`);
    console.log(`    section:   ${mekubalResults[0].section}`);
    console.log(`    source:    ${mekubalResults[0].source}`);
    console.log(`    body:      ${mekubalResults[0].body.slice(0, 80)}...`);
  }

  // A voice with no approved corpus content must still fail SOFT (empty
  // array), never throw -- this is the other half of the contract: absence
  // of content is not an error.
  let threwForUnknownVoice = false;
  try {
    const noneResult = await retrieveForVoice("ojer_tzij", seekerText, 3);
    check(
      "voice with no approved corpus rows returns [] without throwing",
      Array.isArray(noneResult) && noneResult.length === 0
    );
  } catch {
    threwForUnknownVoice = true;
  }
  check("retrieveForVoice never throws, even for a voice with no corpus", !threwForUnknownVoice);

  if (failures > 0) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  } else {
    console.log("\nAll corpus retrieval integration checks hold.");
  }
}

main().catch((err) => {
  console.error("FAIL  unexpected exception during integration test:", err);
  process.exit(1);
});
