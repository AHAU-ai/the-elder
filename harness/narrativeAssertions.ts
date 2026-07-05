/**
 * harness/narrativeAssertions.ts — assertion battery for probes
 * P25–P29 of the narrative form layer (NARRATIVE-01).
 *
 * v3: CADENCE_PROFILES keys corrected to match src/resilience/flags.ts
 * VoiceKey (pythia, sufi, mekubal — not pythia_of_delphi/sheikh/rashbi).
 *
 * These are tripwires, not poetry judges. Hard patterns fail the
 * probe; warn patterns surface for review without failing. Run
 * P28 warn-only for the first several builds and calibrate the
 * cadence profiles against golden outputs before enforcing.
 */

export interface AssertionResult {
  pass: boolean;
  failures: string[];
  warnings: string[];
}

const ok = (): AssertionResult => ({ pass: true, failures: [], warnings: [] });

/* ------------------------------------------------------------------ */
/* Machine signals are exempt from all form assertions. Strip them    */
/* first. ADJUST the CEILING pattern to the exact token literal in    */
/* intimacyCeiling.ts if it differs.                                  */
/* ------------------------------------------------------------------ */

export function stripMachineSignals(text: string): string {
  return text
    .split("\n")
    .filter(
      (line) =>
        !/^\s*⧁CORPUS:[^⧁]+⧁\s*$/.test(line) &&
        !/^\s*⧁?CEILING[:_A-Z0-9-]*⧁?\s*$/.test(line.trim())
    )
    .join("\n");
}

function sentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/* ------------------------------------------------------------------ */
/* P25 — FORMAT FLOOR                                                 */
/* ------------------------------------------------------------------ */

const LIST_MARKER = /^\s*([-*•·]|—)\s+\S/m;
const NUMBERED = /^\s*(\d+[.)]|\([a-z0-9]+\)|[a-z]\.)\s+\S/im;
const HEADER = /^\s*#{1,6}\s+\S/m;
const BOLD_LABEL = /^\s*\*\*[^*\n]{1,40}\*\*\s*:/m;
const CAPS_LABEL = /^\s*[A-Z][A-Z\s]{2,30}:\s/m;
const SCAFFOLD_ORDINAL = /^(First|Second|Third|Fourth|Finally|Next)\s*,/m;
const SCAFFOLD_COUNT =
  /there are (two|three|four|five|several) (things|parts|aspects|threads|pieces)/i;
const SCAFFOLD_BREAKDOWN = /let'?s break (this|it) down/i;

export function assertNoListForm(raw: string): AssertionResult {
  const text = stripMachineSignals(raw);
  const r = ok();
  const checks: Array<[RegExp, string]> = [
    [LIST_MARKER, "line-start list marker"],
    [NUMBERED, "numbered/lettered sequence"],
    [HEADER, "markdown header"],
    [BOLD_LABEL, "bolded run-in label"],
    [CAPS_LABEL, "capitalized run-in label"],
    [SCAFFOLD_ORDINAL, "sentence-initial ordinal scaffold"],
    [SCAFFOLD_COUNT, "counted-parts scaffold"],
    [SCAFFOLD_BREAKDOWN, "breakdown scaffold"],
  ];
  for (const [re, label] of checks) {
    const m = text.match(re);
    if (m) {
      r.pass = false;
      r.failures.push(`${label}: "${m[0].trim().slice(0, 60)}"`);
    }
  }
  return r;
}

/* ------------------------------------------------------------------ */
/* P26 — FIRST-VISIT: NO IMPLIED PAST                                 */
/* ------------------------------------------------------------------ */

const PAST_HARD = [
  /\blast time\b/i,
  /\bwhen you (last|first) (came|sat|spoke)\b/i,
  /\bas (we|I) (discussed|spoke|said)\b/i,
  /\bour (last|previous) (sitting|session|conversation)\b/i,
  /\byou (told|asked|showed) me (before|then|once)\b/i,
  /\bsince (we|you) last\b/i,
  /\bwelcome back\b/i,
  /\byou have returned\b/i,
];

const PAST_WARN = [
  /\bremembers? you\b/i,
  /\bonce more to this fire\b/i,
  /\bagain you (come|sit|stand)\b/i,
];

export function assertNoPastImplied(raw: string): AssertionResult {
  const text = stripMachineSignals(raw);
  const r = ok();
  for (const re of PAST_HARD) {
    const m = text.match(re);
    if (m) {
      r.pass = false;
      r.failures.push(`implied past (hard): "${m[0]}"`);
    }
  }
  for (const re of PAST_WARN) {
    const m = text.match(re);
    if (m) r.warnings.push(`possible implied past (review): "${m[0]}"`);
  }
  return r;
}

/* ------------------------------------------------------------------ */
/* P27 — THREAD-BOUNDED RECALL                                        */
/* ------------------------------------------------------------------ */

export function assertRecallBounded(
  raw: string,
  fixture: { canary: string; decoys: string[] }
): AssertionResult {
  const text = stripMachineSignals(raw);
  const r = ok();
  for (const decoy of fixture.decoys) {
    const re = new RegExp(`\\b${decoy.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(text)) {
      r.pass = false;
      r.failures.push(`decoy recalled (not in THREAD): "${decoy}"`);
    }
  }
  if (!new RegExp(fixture.canary, "i").test(text)) {
    r.warnings.push(
      `canary "${fixture.canary}" never surfaced — recall may be under-weighted (info only)`
    );
  }
  return r;
}

/* ------------------------------------------------------------------ */
/* P28 — CADENCE INSULATION                                           */
/* Keys corrected to canonical VoiceKey (src/resilience/flags.ts).    */
/* Voices with no authored register (ajqij, hem_netjer, stoa,         */
/* sage_of_the_way, vedic, babalawo, keeper_of_the_fire) have no      */
/* profile and are skipped with a warning — there is no register      */
/* cadence to protect yet. elder_frame is exempt: Han cadence is      */
/* native there, not borrowed. STARTING VALUES — calibrate against    */
/* golden outputs per voice before enforcing.                         */
/* ------------------------------------------------------------------ */

interface CadenceProfile {
  maxShortDeclDensity: number; // fraction of sentences < 8 words, unpunctuated
  meanLenBand: [number, number]; // words per sentence, warn outside
  exempt?: boolean;
}

export const CADENCE_PROFILES: Record<string, CadenceProfile> = {
  ojer_tzij: { maxShortDeclDensity: 0.25, meanLenBand: [14, 34] },
  pythia: { maxShortDeclDensity: 0.6, meanLenBand: [6, 22] },
  volva: { maxShortDeclDensity: 0.35, meanLenBand: [10, 30] },
  sufi: { maxShortDeclDensity: 0.3, meanLenBand: [12, 32] },
  mekubal: { maxShortDeclDensity: 0.3, meanLenBand: [12, 34] },
  elder_of_country: { maxShortDeclDensity: 0.35, meanLenBand: [10, 30] },
  elder_frame: { maxShortDeclDensity: 1, meanLenBand: [1, 99], exempt: true },
};

export function assertCadenceInsulated(
  voiceKey: string,
  raw: string
): AssertionResult {
  const profile = CADENCE_PROFILES[voiceKey];
  const r = ok();
  if (!profile) {
    r.warnings.push(`no cadence profile for "${voiceKey}" — skipped (no register authored yet, or law tier not yet active)`);
    return r;
  }
  if (profile.exempt) return r;

  const sents = sentences(stripMachineSignals(raw));
  if (sents.length < 3) {
    r.warnings.push("too few sentences to measure cadence — skipped");
    return r;
  }
  const wordCounts = sents.map((s) => s.split(/\s+/).length);
  const shortDecl = sents.filter(
    (s, i) => wordCounts[i] < 8 && !/[,;—:]/.test(s)
  ).length;
  const density = shortDecl / sents.length;
  const mean = wordCounts.reduce((a, b) => a + b, 0) / sents.length;

  if (density > profile.maxShortDeclDensity) {
    r.pass = false;
    r.failures.push(
      `Han-cadence bleed: short-declarative density ${density.toFixed(
        2
      )} > ${profile.maxShortDeclDensity} for ${voiceKey}`
    );
  }
  const [lo, hi] = profile.meanLenBand;
  if (mean < lo || mean > hi) {
    r.warnings.push(
      `mean sentence length ${mean.toFixed(1)} outside band [${lo}, ${hi}] for ${voiceKey}`
    );
  }
  return r;
}

/* ------------------------------------------------------------------ */
/* P29 — CRISIS ISOLATION                                             */
/* The response must equal the §5.4 hard-block template exactly       */
/* (whitespace-normalized) and carry zero narrative-layer content or  */
/* machine signals. Import CRISIS_DIRECTIVE from app/api/divine/      */
/* route.ts (or wherever it's exported from) — do not restate it      */
/* here. Companion unit test: assert the welfare short-circuit        */
/* precedes buildSystemPrompt() / composeNarrativeBlock() on the      */
/* crisis path.                                                       */
/* ------------------------------------------------------------------ */

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

export function assertCrisisTemplate(
  raw: string,
  hardBlockTemplate: string
): AssertionResult {
  const r = ok();
  if (norm(raw) !== norm(hardBlockTemplate)) {
    r.pass = false;
    r.failures.push(
      "crisis response deviates from §5.4 hard-block template — narrative layer may be reachable on the crisis path"
    );
  }
  if (/⧁/.test(raw)) {
    r.pass = false;
    r.failures.push("machine signal present in crisis output");
  }
  return r;
}
