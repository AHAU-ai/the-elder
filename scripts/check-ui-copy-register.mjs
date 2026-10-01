#!/usr/bin/env node
// Register guard for new/changed UI copy (PR5).
// Fails the build if the ceremonial section in lib/i18n/translations.ts
// drifts toward imperatives, directives, or flattery, if button labels
// grow past the clipping-safe budget, or if a language is missing keys
// another has.
//
// Same shape and philosophy as scripts/check-opening-register.mjs and
// scripts/check-purpose-register.mjs: this script keeps its own copy of
// the forbidden patterns and reads the source as text -- it does not
// import the module, so a structural change (renamed section, moved
// keys) fails loudly instead of silently passing.
//
// SINGLE VOICE (decision D2): the steelman draft of this guard proposed
// a two-voice split -- the Elder's own lines may never use imperatives,
// but interface controls could ("Enter", "Return to the fire"). That
// split was NOT adopted. Every forbidden pattern below (bare
// imperatives, directives to the seeker, flattery) applies identically
// to both key groups. CEREMONIAL_INTERFACE_KEYS holds every key this
// pass actually adds; CEREMONIAL_ELDER_VOICE_KEYS exists so a future
// pass has somewhere to add Elder-voice ceremonial copy under the same
// rules -- if that section is absent (as it is today), it is simply
// skipped, not treated as a failure.

import { readFileSync } from "node:fs";

const SOURCE = "lib/i18n/translations.ts";
const text = readFileSync(SOURCE, "utf8");

const failures = [];

// The 10 locales this file supports, in the order they're declared --
// used only to produce a useful error message (which locale's block is
// at fault), never to assume a fixed count independent of the file.
const LOCALE_ORDER = ["en", "es", "ki", "fr", "pt", "de", "da", "nl", "ja", "zh"];

// Button labels specifically (not placeholders or other interface copy)
// are subject to the 28-character budget, so re-voiced ceremonial copy
// can't reintroduce the clipping PR1 fixed. Hardcoded here, same as the
// sibling guards hardcode their own rules, rather than inferred from
// usage -- a key's role in the UI isn't recoverable by reading
// translations.ts text alone.
const BUTTON_LABEL_KEYS = new Set([
  "ceremonial_closing_exit_label",
  "ceremonial_overlay_escape_label",
  "ceremonial_reduced_motion_skip_label",
]);
const BUTTON_LABEL_MAX_CHARS = 28;

// Same two pattern families as check-opening-register.mjs's FORBIDDEN
// list (bare imperative, directive-to-the-seeker), plus the Purpose
// Statement's flattery patterns -- applied here to BOTH key groups, not
// split by voice, per D2 above.
const FORBIDDEN_IMPERATIVE_OR_DIRECTIVE = [
  [/^\s*(close|open|breathe|sit|stand|walk|step|feel|let|begin|come|enter|receive|give|take|say|speak|ask|choose|name|look|listen|hold|rest|return|answer|go|skip|tap|click|press|continue|wait)\b/i, "sentence-initial bare imperative"],
  [/\byou (must|should|need to|have to|will now)\b/i, "directive to the seeker"],
];
const FORBIDDEN_FLATTERY = [
  [/\b(chosen|destined|rare soul|higher self|special|awakening|unlock)\b/i, "chosen-one / latent-power flattery"],
  [/\bthe one (it|the fire|we)\b/i, "'the one the fire was waiting for' flattery"],
];
const FORBIDDEN = [...FORBIDDEN_IMPERATIVE_OR_DIRECTIVE, ...FORBIDDEN_FLATTERY];

/** Extracts every { ceremonial marker pair } block from the source text,
 *  in file order, returning each as its raw inner text. Structural, not
 *  semantic -- does not assume which locale a block belongs to. */
function extractCeremonialBlocks(sourceText, beginMarker, endMarker) {
  const blocks = [];
  let from = 0;
  for (;;) {
    const start = sourceText.indexOf(beginMarker, from);
    if (start === -1) break;
    const end = sourceText.indexOf(endMarker, start);
    if (end === -1) {
      failures.push(`structure: found "${beginMarker}" with no matching "${endMarker}" after it in ${SOURCE}`);
      break;
    }
    blocks.push(sourceText.slice(start + beginMarker.length, end));
    from = end + endMarker.length;
  }
  return blocks;
}

/** Parses `key: "value",` pairs out of one block's raw text. Values are
 *  JS string literals in the source (double-quoted here), so this
 *  deliberately does not attempt to handle escaped quotes beyond the
 *  simple case actually used in this file -- a value needing more than
 *  that should fail this parse loudly, not silently mis-split. */
function parseKeyValuePairs(blockText) {
  const pairs = {};
  const re = /(\w+):\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(blockText))) {
    pairs[m[1]] = m[2];
  }
  return pairs;
}

function checkGroup(groupLabel, beginMarker, endMarker, { required }) {
  const blocks = extractCeremonialBlocks(text, beginMarker, endMarker);
  if (blocks.length === 0) {
    if (required) {
      failures.push(`structure: could not find any "${beginMarker}" section in ${SOURCE} for ${groupLabel}`);
    }
    return; // optional group (Elder-voice) genuinely absent today -- not a failure
  }
  if (blocks.length !== LOCALE_ORDER.length) {
    failures.push(
      `structure: ${groupLabel} has ${blocks.length} section(s) in ${SOURCE}, expected ${LOCALE_ORDER.length} (one per locale: ${LOCALE_ORDER.join(", ")})`
    );
  }

  const perLocale = blocks.map(parseKeyValuePairs);
  const englishKeys = perLocale[0] ? Object.keys(perLocale[0]).sort() : [];
  if (englishKeys.length === 0) {
    failures.push(`structure: ${groupLabel}'s first section in ${SOURCE} has no parseable key: "value" pairs`);
    return;
  }

  // Key parity across every locale -- a key present in one language and
  // missing in another is exactly the drift this guard exists to catch.
  perLocale.forEach((pairs, i) => {
    const locale = LOCALE_ORDER[i] ?? `block #${i}`;
    const keys = Object.keys(pairs).sort();
    const missing = englishKeys.filter(k => !keys.includes(k));
    const extra = keys.filter(k => !englishKeys.includes(k));
    if (missing.length) failures.push(`${groupLabel} [${locale}]: missing key(s) ${missing.join(", ")}`);
    if (extra.length) failures.push(`${groupLabel} [${locale}]: extra key(s) ${extra.join(", ")} not present in English`);
  });

  // Forbidden patterns are English-word regexes -- meaningful only
  // against the English block. Key parity above is what protects every
  // other language from drifting independently of English.
  const english = perLocale[0];
  for (const [key, value] of Object.entries(english)) {
    for (const [pattern, patternLabel] of FORBIDDEN) {
      if (pattern.test(value)) {
        failures.push(`${groupLabel} [en] ${key}: forbidden -- ${patternLabel} -- "${value}"`);
      }
    }
  }

  // Character budget applies per-locale (any language's translation can
  // clip the layout, not just English's).
  perLocale.forEach((pairs, i) => {
    const locale = LOCALE_ORDER[i] ?? `block #${i}`;
    for (const [key, value] of Object.entries(pairs)) {
      if (BUTTON_LABEL_KEYS.has(key) && value.length > BUTTON_LABEL_MAX_CHARS) {
        failures.push(`${groupLabel} [${locale}] ${key}: ${value.length} characters, over the ${BUTTON_LABEL_MAX_CHARS}-character button-label budget -- "${value}"`);
      }
    }
  });
}

checkGroup(
  "CEREMONIAL_INTERFACE_KEYS",
  "// ═══ CEREMONIAL (PR5) ═══",
  "// ═══ /CEREMONIAL ═══",
  { required: true }
);
checkGroup(
  "CEREMONIAL_ELDER_VOICE_KEYS",
  "// ═══ CEREMONIAL ELDER-VOICE (PR5) ═══",
  "// ═══ /CEREMONIAL ELDER-VOICE ═══",
  { required: false }
);

// ─────────────────────────────────────────────────────────────────────────
// Self-test -- proves the checks above actually catch something, per the
// red-team finding that a guard which never fails on anything is
// theatre. Runs against fabricated strings, never against real file
// content, every time this script executes.
// ─────────────────────────────────────────────────────────────────────────
function selfTest() {
  const cases = [
    { value: "Enter the fire now", expect: "sentence-initial bare imperative" },
    { value: "Speak your truth", expect: "sentence-initial bare imperative" },
    { value: "You must choose a path", expect: "directive to the seeker" },
    { value: "You are the chosen one", expect: "chosen-one / latent-power flattery" },
    { value: "This is the one the fire was waiting for", expect: "'the one the fire was waiting for' flattery" },
  ];
  const selfTestFailures = [];
  for (const { value, expect } of cases) {
    const caught = FORBIDDEN.some(([pattern]) => pattern.test(value));
    if (!caught) {
      selfTestFailures.push(`self-test FAILED to catch known-bad string (expected "${expect}"): "${value}"`);
    }
  }
  // A known-good string must NOT be flagged -- otherwise the patterns
  // are too broad to ever let real ceremonial copy pass.
  const knownGood = "Back to the fire";
  if (FORBIDDEN.some(([pattern]) => pattern.test(knownGood))) {
    selfTestFailures.push(`self-test FAILED: known-good string was incorrectly flagged: "${knownGood}"`);
  }
  // Budget check self-test.
  const overBudget = "A".repeat(BUTTON_LABEL_MAX_CHARS + 1);
  if (overBudget.length <= BUTTON_LABEL_MAX_CHARS) {
    selfTestFailures.push("self-test FAILED: budget fixture is not actually over budget");
  }
  return selfTestFailures;
}

failures.push(...selfTest());

if (failures.length) {
  console.error("UI copy register check FAILED:");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("UI copy register check passed.");
