/**
 * carry.test.ts — Invariant tests for R2/R3 (the seeker's carry).
 * Pure-logic tests (no DB/model) so they run in CI.
 * Run: npx tsx lib/returning/carry.test.ts
 */
import {
  CARRY_PRACTICES,
  CARRY_COPY,
  MAX_LINE_CHARS,
  MIN_SHOW_HOURS,
  sanitizeLine,
  validateCarryInput,
  pickCarryForReturn,
  buildCarryResponse,
  fillCarry,
  practiceText,
  type CarryRow,
} from "./carry";

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) console.log(`  ok  ${name}`);
  else { console.error(`FAIL  ${name}`); failures++; }
}

const H = 3_600_000;
const NOW = Date.parse("2026-10-20T12:00:00.000Z");
const ago = (hours: number) => new Date(NOW - hours * H).toISOString();
const row = (hours: number, practiceKey: unknown, line: unknown, id: string | number = 1): CarryRow => ({ id, createdAt: ago(hours), practiceKey, line });

// 1. The menu is looking-only, fixed, and distinct.
check("four practices", CARRY_PRACTICES.length === 4);
check("every practice begins 'notice' (looking only)", CARRY_PRACTICES.every((p) => /^notice\b/.test(p.text)));
check("practice keys are distinct", new Set(CARRY_PRACTICES.map((p) => p.key)).size === CARRY_PRACTICES.length);
check("practice texts are distinct", new Set(CARRY_PRACTICES.map((p) => p.text)).size === CARRY_PRACTICES.length);

// 2. sanitizeLine
check("non-string: null", sanitizeLine(42) === null && sanitizeLine(undefined) === null && sanitizeLine({}) === null);
check("whitespace only: null", sanitizeLine("  \n\t ") === null);
check("control characters and newlines flattened", sanitizeLine("a\nb\t\u0000c") === "a b c");
check(`capped at ${MAX_LINE_CHARS}`, (sanitizeLine("x".repeat(500))?.length ?? 0) === MAX_LINE_CHARS);
check("plain words pass through unchanged", sanitizeLine("look for the door I leave ajar") === "look for the door I leave ajar");

// 3. validateCarryInput
check("neither practice nor line: rejected", !validateCarryInput({}).ok);
check("not an object: rejected", !validateCarryInput(null).ok && !validateCarryInput("x").ok);
check("unknown practice key: rejected, never silently dropped", !validateCarryInput({ practice: "fix" }).ok);
check("unknown key rejected even with a good line", !validateCarryInput({ practice: "fix", line: "hello" }).ok);
check("non-string line: rejected", !validateCarryInput({ practice: "appear", line: 7 }).ok);
check("practice only: ok", (() => { const v = validateCarryInput({ practice: "near" }); return v.ok && v.practiceKey === "near" && v.line === null; })());
check("line only: ok", (() => { const v = validateCarryInput({ line: "  my words " }); return v.ok && v.practiceKey === null && v.line === "my words"; })());
check("both: ok", (() => { const v = validateCarryInput({ practice: "absent", line: "x" }); return v.ok && v.practiceKey === "absent" && v.line === "x"; })());
check("blank line and no practice: rejected", !validateCarryInput({ line: "   " }).ok);
check("null practice with line: ok", validateCarryInput({ practice: null, line: "x" }).ok);

// 4. pickCarryForReturn
check("no rows: null", pickCarryForReturn([], NOW) === null);
check("not an array: null (never throws)", pickCarryForReturn(undefined as unknown as CarryRow[], NOW) === null);
check(`younger than ${MIN_SHOW_HOURS}h (same sitting): null`, pickCarryForReturn([row(MIN_SHOW_HOURS - 1, "appear", "x")], NOW) === null);
check(`exactly ${MIN_SHOW_HOURS}h: shown`, pickCarryForReturn([row(MIN_SHOW_HOURS, "appear", null)], NOW) !== null);
{
  const v = pickCarryForReturn([row(100, "appear", "older", 1), row(30, "near", "newer", 2), row(2, "absent", "too fresh", 3)], NOW);
  check("most recent eligible wins (skips the too-fresh one)", v?.id === "2" && v?.line === "newer" && v?.practiceKey === "near");
}
check("line verbatim", pickCarryForReturn([row(50, null, "the door I leave ajar")], NOW)?.line === "the door I leave ajar");
check("unknown stored practice key is dropped; line kept", (() => { const v = pickCarryForReturn([row(50, "bogus", "kept")], NOW); return v?.practiceKey === null && v?.line === "kept"; })());
check("row with nothing usable is skipped", pickCarryForReturn([row(50, "bogus", "  ")], NOW) === null);
check("bad createdAt is skipped, never throws", pickCarryForReturn([{ id: 1, createdAt: "nonsense", practiceKey: "appear", line: null }], NOW) === null);
check("timestamp is the stored creation time", pickCarryForReturn([row(50, "appear", null)], NOW)?.at === ago(50));

// 5. Governance gate
{
  const rows = [row(50, "appear", "x")];
  check("gate off: disabled and null even with data", (() => { const r = buildCarryResponse(rows, false, NOW); return r.enabled === false && r.carry === null; })());
  check("gate on: enabled and present", (() => { const r = buildCarryResponse(rows, true, NOW); return r.enabled === true && r.carry !== null; })());
  check("gate on, no data: enabled, null", (() => { const r = buildCarryResponse([], true, NOW); return r.enabled === true && r.carry === null; })());
}

// 6. Copy contract
{
  const all = [...Object.values(CARRY_COPY), ...CARRY_PRACTICES.map((p) => p.text)].join("\n");
  check("never the Elder's voice", !/\bI (remember|see|notice|sense|know|hear)\b/i.test(all));
  check("no tracking or outcome language", !/\b(streak|complete[d]?|goal|habit|achiev\w*|remind\w*|how did|did you|progress|daily|every day|today)\b/i.test(all));
  check("no change claims", !/\b(changed|grown|grew|healed|healing|better|breakthrough|journey)\b/i.test(all));
  check("no instruction to the seeker", !/\byou (should|must|need|have to)\b/i.test(all));
  check("offer says it is optional", /if you like/i.test(CARRY_COPY.offerLead));
  check("release is always offered on return", CARRY_COPY.release.length > 0 && /release/i.test(CARRY_COPY.returnFootnote));
  check("fillCarry fills both placeholders", fillCarry(CARRY_COPY.returnPractice, { when: "March 2026", practice: practiceText("appear") }) === "In March 2026 you set out to notice where it shows up.");
}

if (failures > 0) { console.error(`\n${failures} test(s) failed.`); process.exit(1); }
console.log("\nAll carry tests passed.");
