/**
 * reflection.test.ts — Invariant tests for the R1 return-visit reflection.
 * Pure-logic tests (no DB/model) so they run in CI.
 * Run: npx tsx lib/returning/reflection.test.ts
 */
import {
  pickReflection,
  buildReflectionResponse,
  fillCopy,
  REFLECTION_COPY,
  MIN_GAP_DAYS,
  type ConfirmedRow,
} from "./reflection";

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    console.error(`FAIL  ${name}`);
    failures++;
  }
}

const DAY = 86_400_000;
const T0 = Date.parse("2026-03-10T12:00:00.000Z");
const at = (days: number) => new Date(T0 + days * DAY).toISOString();
const cell = (value: string, days: number, mode: string = "reshaped") => ({ value, mode, confirmedAt: at(days) });
const row = (days: number, confirmed: unknown): ConfirmedRow => ({ createdAt: at(days), confirmed });

// 1. Nothing to show.
check("no rows: null", pickReflection([]) === null);
check("one row: null", pickReflection([row(0, { wound: cell("the silence I keep", 0) })]) === null);
check("not an array: null (never throws)", pickReflection(undefined as unknown as ConfirmedRow[]) === null);

// 2. Two different words, far enough apart: the reflection.
{
  const r = pickReflection([
    row(0, { wound: cell("the silence I keep", 0) }),
    row(60, { wound: cell("the silence that protected me", 60) }),
  ]);
  check("two different confirmed values, 60 days apart: shown", r !== null);
  check("earlier is the first words, verbatim", r?.earlier.value === "the silence I keep");
  check("latest is the most recent words, verbatim", r?.latest.value === "the silence that protected me");
  check("marker type carried", r?.markerType === "wound");
  check("timestamps are the seeker's confirmation times", r?.earlier.at === at(0) && r?.latest.at === at(60));
}

// 3. Honest-silence rules.
check(
  `gap under ${MIN_GAP_DAYS} days (one sitting): null`,
  pickReflection([
    row(0, { wound: cell("the silence I keep", 0) }),
    row(MIN_GAP_DAYS - 1, { wound: cell("a door I hold shut", MIN_GAP_DAYS - 1) }),
  ]) === null
);
check(
  "exactly the minimum gap: shown",
  pickReflection([
    row(0, { wound: cell("the silence I keep", 0) }),
    row(MIN_GAP_DAYS, { wound: cell("a door I hold shut", MIN_GAP_DAYS) }),
  ]) !== null
);
check(
  "same words, different case/spacing/trailing punctuation: null",
  pickReflection([
    row(0, { wound: cell("The silence I keep.", 0) }),
    row(90, { wound: cell("the  silence   I keep", 90) }),
  ]) === null
);
check(
  "A, then B, then A again: most recent is the first words again, so null (never claims B is 'latest')",
  pickReflection([
    row(0, { wound: cell("the silence I keep", 0) }),
    row(40, { wound: cell("a door I hold shut", 40) }),
    row(90, { wound: cell("the silence I keep", 90) }),
  ]) === null
);

// 4. Only the seeker's ratified words; never other types mixed together.
check(
  "different marker types never pair: wound then figure is not a reflection",
  pickReflection([
    row(0, { wound: cell("the silence I keep", 0) }),
    row(90, { figure: cell("the gatekeeper", 90) }),
  ]) === null
);
check(
  "a mode other than confirmed/reshaped is ignored",
  pickReflection([
    row(0, { wound: cell("the silence I keep", 0, "confirmed") }),
    row(90, { wound: cell("something proposed", 90, "proposed") }),
  ]) === null
);
check(
  "declined-shaped cell (no value) is ignored",
  pickReflection([
    row(0, { wound: cell("the silence I keep", 0) }),
    row(90, { wound: { mode: "declined", confirmedAt: at(90) } }),
  ]) === null
);
check(
  "confirmed (not only reshaped) words count",
  pickReflection([
    row(0, { threshold: cell("the week before", 0, "confirmed") }),
    row(45, { threshold: cell("the week after", 45, "confirmed") }),
  ])?.markerType === "threshold"
);

// 5. Several types: longest honest span wins; ties fall to canonical order.
{
  const r = pickReflection([
    row(0, { wound: cell("w1", 0), pattern: cell("p1", 0) }),
    row(30, { wound: cell("w2", 30) }),
    row(120, { pattern: cell("p2", 120) }),
  ]);
  check("longest span wins (pattern 120d over wound 30d)", r?.markerType === "pattern");
}
{
  const r = pickReflection([
    row(0, { pattern: cell("p1", 0), wound: cell("w1", 0) }),
    row(60, { pattern: cell("p2", 60), wound: cell("w2", 60) }),
  ]);
  check("tie on span falls to canonical order (wound before pattern)", r?.markerType === "wound");
}

// 6. Input hygiene.
{
  const r = pickReflection([
    row(0, { wound: cell("line one\nline two\t\u0000end", 0) }),
    row(90, { wound: cell("x".repeat(500), 90) }),
  ]);
  check("control characters and newlines are flattened", r?.earlier.value === "line one line two end");
  check("values are capped at 120 characters", (r?.latest.value.length ?? 0) <= 120);
}
check(
  "malformed jsonb does not throw and yields null",
  pickReflection([
    row(0, null),
    row(90, "not an object"),
    row(120, { wound: null }),
    row(150, { wound: "string" }),
  ]) === null
);
check(
  "missing confirmedAt falls back to the row's created_at",
  pickReflection([
    row(0, { wound: { value: "first words", mode: "reshaped" } }),
    row(80, { wound: { value: "later words", mode: "reshaped" } }),
  ])?.latest.at === at(80)
);

// 7. The governance gate is honoured by the response builder.
{
  const rows = [
    row(0, { wound: cell("the silence I keep", 0) }),
    row(60, { wound: cell("the silence that protected me", 60) }),
  ];
  check("gate off: reflection is null even with honest data", buildReflectionResponse(rows, false).reflection === null);
  check("gate on: reflection present", buildReflectionResponse(rows, true).reflection !== null);
  check("gate on but no data: null", buildReflectionResponse([], true).reflection === null);
}

// 8. The copy: static, seeker-attributed, no interpretation.
{
  const all = Object.values(REFLECTION_COPY).join("\n");
  check("copy never speaks in the Elder's voice (no 'I remember/see/notice')", !/\bI (remember|see|notice|sense)\b/i.test(all));
  check("copy claims no change or progress", !/\b(changed|grown|grew|progress|shift|journey|breakthrough|healed|better)\b/i.test(all));
  check("copy speaks no count", !/\b(once|twice|\d+\s+times|first time|again and again)\b/i.test(all));
  check("copy names whose words these are", /your own words/i.test(REFLECTION_COPY.heading));
  check(
    "fillCopy fills both placeholders",
    fillCopy(REFLECTION_COPY.lineEarlier, { type: "wound", when: "March 2026" }) === "Your wound, as you named it in March 2026:"
  );
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
} else {
  console.log("\nAll reflection tests passed.");
}
