#!/usr/bin/env node
// scripts/check-unwired-exports.mjs
//
// Guardrail against the exact class of bug found repeatedly in the
// 2026-08-17 session: lib/dualGuardian.ts (two-judge safety review),
// isChildTierEnabled()'s server-side enforcement, lib/observability.ts's
// four Sentry instruments, and lib/returning/trajectory.ts's readTrajectory
// were each fully built, in some cases explicitly documented with a
// "wire this in" usage note, and had ZERO real callers anywhere in the
// live app -- found only by manually tracing a flaky CI failure back to
// its root cause. tsc and `npm run build` cannot catch this: unwired code
// is syntactically perfect. This script is the automated version of the
// manual audit that found those four gaps, so the next one doesn't sit
// undiscovered for months.
//
// WHAT IT CHECKS: every top-level `export function` / `export async
// function` in lib/ and src/ must have at least one real call site
// somewhere in app/, lib/, src/, or scripts/ -- not counting the
// function's own definition line or comment-only mentions (a doc-comment
// usage EXAMPLE is not a real caller; this exact gap hid
// captureGuardianRejection from an earlier, cruder version of this
// check).
//
// WHAT IT IS NOT: a dead-code linter for the whole codebase (components,
// types, constants). Scoped narrowly to exported *functions* in lib/ and
// src/, which is where this session's real findings lived -- shared
// logic and safety/observability infrastructure, not UI.
//
// ALLOWLIST: a function that's genuinely, deliberately not wired yet
// (scaffolding for unreviewed future work, a CI harness waiting on
// human-authored fixtures, etc.) goes in ALLOWLIST below with a real
// reason -- not a blank exemption. An allowlisted entry that gets wired
// in later doesn't need to be removed; this script only checks for
// exports that are unwired AND unlisted, not the reverse.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["lib", "src"];
const SEARCH_DIRS = ["app", "lib", "src", "scripts"];
const SKIP = new Set(["node_modules", ".next", ".git"]);

// ─────────────────────────────────────────────────────────────────────────
// Allowlist -- every entry needs a real reason, not just a name.
// ─────────────────────────────────────────────────────────────────────────

const ALLOWLIST = {
  // Model-migration regression harness (src/resilience/voiceRegression.ts).
  // Fully built, but needs real human-reviewed reference transcripts
  // ("golden cases") before it's useful -- fabricating them would be worse
  // than leaving it dormant, per Lineage Integrity of Voice (the same
  // principle that blocks inventing tradition content for an unauthorized
  // voice). Audited 2026-08-17; deliberately not wired.
  "src/resilience/voiceRegression.ts::evaluateCase": "needs human-authored golden-case fixtures before use; see file header",
  "src/resilience/voiceRegression.ts::migrationGate": "needs human-authored golden-case fixtures before use; see file header",

  // lib/mythopoetics/*.ts -- an 8-file curriculum/practice generator
  // (weekCall, weekFascinans, weekPassion, weekTremendum, nawalCurriculum,
  // puzKastaj, soulMakingSequence, tzijActivation, kabawil). Looks like
  // deliberately-scaffolded future work, not an oversight -- wiring a
  // whole curriculum system into live prompts is a product decision, not
  // a "connect the wire" fix. Audited 2026-08-17; deliberately not wired.
  "lib/mythopoetics/kabawil.ts::doubleSee": "scaffolding for a future curriculum feature, not yet a product decision",
  "lib/mythopoetics/nawalCurriculum.ts::generateLessonPlan": "scaffolding for a future curriculum feature, not yet a product decision",
  "lib/mythopoetics/puzKastaj.ts::modelResilience": "scaffolding for a future curriculum feature, not yet a product decision",
  "lib/mythopoetics/soulMakingSequence.ts::advanceSequence": "scaffolding for a future curriculum feature, not yet a product decision",
  "lib/mythopoetics/tzijActivation.ts::buildTzijExercise": "scaffolding for a future curriculum feature, not yet a product decision",
  "lib/mythopoetics/weekCall.ts::callPrompts": "scaffolding for a future curriculum feature, not yet a product decision",
  "lib/mythopoetics/weekFascinans.ts::fascinansPrompts": "scaffolding for a future curriculum feature, not yet a product decision",
  "lib/mythopoetics/weekPassion.ts::passionPrompts": "scaffolding for a future curriculum feature, not yet a product decision",
  "lib/mythopoetics/weekTremendum.ts::tremendumPrompts": "scaffolding for a future curriculum feature, not yet a product decision",

  // lib/observability.ts::captureProbeSlippage -- documented for
  // scripts/adversarial-probe.mjs ("wire in ... when a probe slips
  // through"), but that script never actually calls it. Genuine gap, but
  // wiring it is a CI-script change, not an app-route change like the
  // other three instruments in this file -- separate task from the
  // 2026-08-17 observability wiring (#54).
  "lib/observability.ts::captureProbeSlippage": "documented for scripts/adversarial-probe.mjs, never actually wired there -- separate task",

  // lib/compliance/signoffStatus.ts::getSignoff -- the richer accessor
  // (full record: reviewer, date, packet, notes). Its sibling isApproved()
  // IS wired (gates isChildTierEnabled()) -- this one is just an unused
  // detail view, not a missing enforcement boundary. Low stakes.
  "lib/compliance/signoffStatus.ts::getSignoff": "isApproved() (its sibling, same file) is the real enforcement boundary and is wired; this is just an unused detail accessor",

  // lib/altarRecord.ts::analyzeGuardianSignals -- probe-pattern analyzer
  // over the in-process rejection signal buffer. Meant for an admin route,
  // a cron job, or manual review per its own doc comment; no admin UI
  // exists yet to call it from.
  "lib/altarRecord.ts::analyzeGuardianSignals": "meant for an admin route/cron job that doesn't exist yet, per its own doc comment",

  // lib/model.config.ts::resolveModel -- multi-provider (anthropic/openai/
  // gemini) model resolution. The app currently calls PRIMARY_MODEL
  // directly everywhere instead of through this; looks like scaffolding
  // for future multi-provider support that hasn't been adopted yet.
  "lib/model.config.ts::resolveModel": "multi-provider scaffolding; app currently uses PRIMARY_MODEL directly, not yet adopted",

  // lib/traditions.ts::isKnownVoiceKey -- a type guard, unused convenience.
  "lib/traditions.ts::isKnownVoiceKey": "unused type-guard convenience, low stakes",

  // lib/openingBridge.ts::checkOpeningBridgeRegister -- the register guard
  // for the opening line. Its CI consumer is scripts/check-opening-register.mjs,
  // which (like check-purpose-register.mjs) keeps its own copy of the
  // patterns and reads the source as text rather than importing it -- and
  // .mjs is outside this checker's .ts/.tsx scan regardless. The export
  // exists for parity with the closing-bridge design and for direct/unit
  // use. Same situation as captureProbeSlippage above.
  "lib/openingBridge.ts::checkOpeningBridgeRegister": "consumed by scripts/check-opening-register.mjs (text-based, .mjs, outside this scan); export kept for parity + unit use",

  // lib/nahuales.ts -- day-sign lookup helpers, not yet surfaced in any UI.
  "lib/nahuales.ts::getNahualByNumber": "lookup helper not yet surfaced in any UI",
  "lib/nahuales.ts::getNahualByName": "lookup helper not yet surfaced in any UI",

  // src/corpus/normalize.ts::assertCanonical -- explicitly documented for
  // "the ingestion script" to call after normalization; that script either
  // doesn't exist yet or doesn't call this.
  "src/corpus/normalize.ts::assertCanonical": "documented for a corpus-ingestion script that doesn't call it yet",

  // lib/psychopompLayer.ts -- accessor/introspection helpers over the
  // per-voice psychopomp data. getPsychopompContext (the main entry point)
  // IS used. getPsychopompForbiddenMoves, detectSeekerPosture, and
  // formatPsychopompAnnotation were investigated 2026-08-19 and found to be
  // real gaps -- each had a doc comment naming an intended caller
  // (lib/system-prompt-builder.ts for the first; app/api/threshold/route.ts
  // for the other two, which turned out to be the WRONG site -- that route
  // generates the threshold question before the seeker has said anything,
  // so there is no opening message to detect a posture from there). All
  // three are now wired at the real site, lib/system-prompt-builder.ts,
  // fed by app/api/divine/route.ts's already-computed firstUserMsg --
  // removed from this allowlist. This also connects layer.promptAnnotation
  // and seekerPostureMap content (previously-authored per-voice material
  // that had never reached a live model call) for every already-authorized
  // voice; that scope decision was made explicitly, not incidentally.
  // getThresholdLetterVars is a redundant wrapper (the real call site,
  // lib/mythopoetics/thresholdLetter.ts, reads layer.thresholdLetterVars
  // directly) -- cosmetic, not a gap.
  "lib/psychopompLayer.ts::getThresholdLetterVars": "redundant wrapper; real call site reads layer.thresholdLetterVars directly -- cosmetic, not a gap",
  // TRIAGED 2026-08-21: its own doc comment names two possible live sites
  // ("debugging, lineage review documentation, or the Threshold Letter
  // system's review phase") -- searched app/ for any admin/review UI that
  // could be that call site; none exists. Genuinely a manual/REPL
  // debugging helper, not a missed wiring.
  "lib/psychopompLayer.ts::describePsychopompLayer": "confirmed debugging/documentation helper -- no admin or review UI exists in app/ for it to be called from",
};

// TRIAGED 2026-08-21: src/resilience/provenance.ts::provenanceMetadata was
// flagged NEEDS TRIAGE here as "likely a real gap." It no longer is one --
// app/api/divine/route.ts now calls it directly at every response site
// (5 call sites, including the fix documented in that file's own comment
// about a prior hand-duplicated/camelCase provenance bug), and
// ShareableCard.tsx / lib/pngProvenance.ts / lib/shareLedger.ts all
// reference its shape downstream. Per this script's own policy (see header
// comment above), a since-wired allowlist entry doesn't need to be kept --
// removed rather than left stale.

// ─────────────────────────────────────────────────────────────────────────

// pattern defaults to .ts only -- deliberately excludes .tsx. React
// components exported from .tsx files are used as JSX tags (<Foo />), not
// function calls with parens, so the call-pattern usage check below can't
// see them -- confirmed by a false positive on LanguageProvider during
// development. Component reachability is a different, JSX-shaped problem
// (handled separately, e.g. the /about page-linking fix) from what this
// script targets: exported functions -- the shape every 2026-08-17 finding
// actually was.
function walk(dir, acc = [], pattern = /\.ts$/) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(full, acc, pattern);
    else if (pattern.test(full)) acc.push(full);
  }
  return acc;
}

function findExportedFunctions(file) {
  const text = readFileSync(file, "utf8");
  const names = [];
  const re = /^export (?:async )?function ([a-zA-Z0-9_]+)/gm;
  let m;
  while ((m = re.exec(text)) !== null) names.push(m[1]);
  return names;
}

function countRealUsages(fnName, allFiles) {
  let count = 0;
  const callPattern = new RegExp(`\\b${fnName}\\(`);
  for (const file of allFiles) {
    const text = readFileSync(file, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
      if (callPattern.test(line)) count++;
    }
  }
  return count;
}

const scanFiles = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d), [], /\.ts$/));
// Usage sites CAN be in .tsx (a component calling a lib function) even
// though scan targets stay .ts-only -- so search with the wider pattern.
// middleware.ts added explicitly (2026-08-30): a real, required Next.js
// convention file that MUST live at the repo root, not inside any of
// SEARCH_DIRS -- found calling lib/referral.ts's captureReferral() and
// getting a false "unwired" verdict for exactly that reason. A single
// file, not a directory, so it's appended rather than walked.
const searchFiles = [
  ...SEARCH_DIRS.flatMap((d) => walk(join(ROOT, d), [], /\.(ts|tsx)$/)),
  join(ROOT, "middleware.ts"),
];

const unwired = [];

for (const file of scanFiles) {
  const relFile = relative(ROOT, file).replace(/\\/g, "/");
  for (const fnName of findExportedFunctions(file)) {
    const usages = countRealUsages(fnName, searchFiles);
    // The definition line itself matches the call pattern's word boundary
    // in some declaration styles, so <=1 (not ===0) is "no real caller."
    if (usages <= 1) {
      const key = `${relFile}::${fnName}`;
      if (!(key in ALLOWLIST)) {
        unwired.push(key);
      }
    }
  }
}

if (unwired.length > 0) {
  console.error("Unwired exports check FAILED:");
  console.error("");
  console.error("The following exported functions in lib/ or src/ have no real");
  console.error("caller anywhere in app/, lib/, src/, or scripts/:");
  console.error("");
  for (const key of unwired) console.error("  - " + key);
  console.error("");
  console.error("Either wire the function in, or -- if it's deliberately dormant");
  console.error("(scaffolding, waiting on a review, etc.) -- add it to ALLOWLIST in");
  console.error("scripts/check-unwired-exports.mjs with a real reason, not a blank");
  console.error("exemption. See the 2026-08-17 session's findings (dualGuardian,");
  console.error("isChildTierEnabled, observability.ts, readTrajectory) for what this");
  console.error("check exists to catch.");
  process.exit(1);
}

console.log(`Unwired exports check passed (${Object.keys(ALLOWLIST).length} allowlisted, all with stated reasons).`);
