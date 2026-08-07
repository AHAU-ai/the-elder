/**
 * markerDeficit.test.ts — Invariant tests for returning-arc marker
 * personalization. Pure-logic tests (no DB/model) so they run in CI.
 * Run: npx tsx lib/returning/markerDeficit.test.ts   (or wire to vitest/jest)
 */
import { computeMarkerPriority, MIN_MARKERED_LETTERS_FOR_PERSONALIZATION, type KeptLetterMarker } from "./markerDeficit";
import type { MarkerField } from "./markers";

const CANONICAL_ORDER: MarkerField[] = ["wound", "threshold", "pattern", "exile", "figure"];

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    console.error(`FAIL  ${name}`);
    failures++;
  }
}

function arraysEqual(a: MarkerField[], b: MarkerField[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// 1. No letters -> canonical order, unchanged.
{
  const result = computeMarkerPriority([]);
  check("empty history: returns canonical order", arraysEqual(result, CANONICAL_ORDER));
}

// 2. Below threshold, even if wildly skewed -> canonical order still wins.
{
  check(
    "threshold constant matches design (5)",
    MIN_MARKERED_LETTERS_FOR_PERSONALIZATION === 5
  );
  const letters: KeptLetterMarker[] = [
    { marker: "wound" },
    { marker: "wound" },
    { marker: "wound" },
    { marker: "wound" },
  ];
  const result = computeMarkerPriority(letters);
  check("4 markered letters (below threshold): returns canonical order despite skew", arraysEqual(result, CANONICAL_ORDER));
}

// 3. Exactly 5, all-null markers -> falls back (proves IS-NOT-NULL filtering, not raw length).
{
  const letters: KeptLetterMarker[] = Array(5).fill({ marker: null });
  const result = computeMarkerPriority(letters);
  check("5 letters, all null markers: falls back to canonical order", arraysEqual(result, CANONICAL_ORDER));
}

// 4. 5 markered letters, skewed -> ascending-count order, exact tie-break locked in.
{
  const letters: KeptLetterMarker[] = [
    { marker: "wound" },
    { marker: "wound" },
    { marker: "wound" },
    { marker: "threshold" },
    { marker: "pattern" },
  ];
  // counts: wound=3, threshold=1, pattern=1, exile=0, figure=0
  // ascending: exile(0), figure(0) [tie, canonical order], threshold(1), pattern(1) [tie], wound(3)
  const expected: MarkerField[] = ["exile", "figure", "threshold", "pattern", "wound"];
  const result = computeMarkerPriority(letters);
  check("5 letters skewed toward wound: deficit order matches expected tie-break", arraysEqual(result, expected));
}

// 5. Mixed null and non-null markers -> nulls excluded from count AND threshold check.
{
  const letters: KeptLetterMarker[] = [
    { marker: "wound" },
    { marker: null },
    { marker: null },
    { marker: null },
    { marker: null },
    { marker: null },
  ];
  // Only 1 non-null marker present, despite 6 total rows -> below threshold.
  const result = computeMarkerPriority(letters);
  check("mixed null/non-null: nulls excluded from threshold check", arraysEqual(result, CANONICAL_ORDER));
}

// 6. Lineage-blindness as documentation-by-test: the input type carries no
// lineage field at all, so two fixture sets differing only in an unrelated
// field produce identical output.
{
  type FakeLineageLetter = KeptLetterMarker & { sourceLineage: string };
  const setA: FakeLineageLetter[] = [
    { marker: "wound", sourceLineage: "maya" },
    { marker: "wound", sourceLineage: "maya" },
    { marker: "wound", sourceLineage: "maya" },
    { marker: "threshold", sourceLineage: "maya" },
    { marker: "pattern", sourceLineage: "maya" },
  ];
  const setB: FakeLineageLetter[] = setA.map((l) => ({ ...l, sourceLineage: "norse" }));
  const resultA = computeMarkerPriority(setA);
  const resultB = computeMarkerPriority(setB);
  check("lineage-blind: identical marker multiset yields identical output regardless of lineage field", arraysEqual(resultA, resultB));
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
} else {
  console.log("\nAll markerDeficit tests passed.");
}
