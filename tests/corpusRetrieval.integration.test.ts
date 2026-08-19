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
import { neon } from "@neondatabase/serverless";

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
  // Contamination check: verify each result's passageId is actually rows
  // WHERE lineage_key = 'mekubal' in the DB, independent of retrieveForVoice()'s
  // own filter -- this catches a real WHERE-clause/view bug the same way the
  // 2026-08-18 incident did, without assuming what mekubal's content looks
  // like. The corpus legitimately grew beyond pure Zohar text this session
  // (Kabbalah Unveiled, Sepher Yetzirah, Rappoport's Myth and Legend of
  // Ancient Israel are all genuine mekubal-voice sources), so a "does the
  // source string say zohar" check was a false positive waiting to happen --
  // it would have passed just as easily if retrieval leaked rows from a
  // voice whose source string happened to contain "zohar" coincidentally.
  const sql = neon(process.env.DATABASE_URL!);
  const passageIds = mekubalResults.map((r) => r.passageId);
  const ownerRows = passageIds.length
    ? await sql`SELECT passage_id, lineage_key FROM corpus_passage WHERE passage_id = ANY(${passageIds})`
    : [];
  const ownerByPassageId = new Map(ownerRows.map((row: any) => [row.passage_id, row.lineage_key]));
  check(
    "every result's passageId actually belongs to lineage_key='mekubal' in the DB (no cross-voice contamination)",
    mekubalResults.every((r) => ownerByPassageId.get(r.passageId) === "mekubal")
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
