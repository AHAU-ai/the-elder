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

  // lib/nahuales.ts -- day-sign lookup helpers, not yet surfaced in any UI.
  "lib/nahuales.ts::getNahualByNumber": "lookup helper not yet surfaced in any UI",
  "lib/nahuales.ts::getNahualByName": "lookup helper not yet surfaced in any UI",

  // src/corpus/normalize.ts::assertCanonical -- explicitly documented for
  // "the ingestion script" to call after normalization; that script either
  // doesn't exist yet or doesn't call this.
  "src/corpus/normalize.ts::assertCanonical": "documented for a corpus-ingestion script that doesn't call it yet",

  // lib/psychopompLayer.ts -- accessor/introspection helpers over the
  // per-voice psychopomp data. getPsychopompContext (the main entry point)
  // IS used. getPsychopompForbiddenMoves was investigated 2026-08-19 and
  // found to be a real gap -- its own doc comment named
  // lib/system-prompt-builder.ts as the intended caller, and that merge
  // had genuinely never happened. Now wired (see the merge site in
  // system-prompt-builder.ts and the CONTRACT_HASH follow-on fix in
  // src/resilience/provenance.ts) -- removed from this allowlist.
  // getThresholdLetterVars is a redundant wrapper (the real call site,
  // lib/mythopoetics/thresholdLetter.ts, reads layer.thresholdLetterVars
  // directly) -- cosmetic, not a gap. The remaining three siblings are
  // not individually investigated in depth -- flagged here so CI doesn't
  // break, but detectSeekerPosture/formatPsychopompAnnotation are a real
  // gap too (own doc comment names app/api/threshold/route.ts as intended
  // caller, confirmed zero references there) -- separate task, not
  // addressed by this pass.
  "lib/psychopompLayer.ts::detectSeekerPosture": "NEEDS TRIAGE -- real gap, doc comment names app/api/threshold/route.ts as intended caller, confirmed unwired there; separate task from the psychopompForbidden merge",
  "lib/psychopompLayer.ts::formatPsychopompAnnotation": "NEEDS TRIAGE -- see detectSeekerPosture entry above",
  "lib/psychopompLayer.ts::getThresholdLetterVars": "redundant wrapper; real call site reads layer.thresholdLetterVars directly -- cosmetic, not a gap",
  "lib/psychopompLayer.ts::describePsychopompLayer": "NEEDS TRIAGE -- not individually investigated; no caller found, likely a manual/REPL debugging tool for lineage review rather than automated wiring",

  // src/resilience/provenance.ts::provenanceMetadata -- ITS OWN doc
  // comment says it's "the machine-readable stamp embedded in every
  // exported/shared artifact," which implies it should be live somewhere
  // (ShareableCard's PNG export? the share API?). No evidence found that
  // it actually is. NOT confidently classified as intentional -- flagged
  // here only so CI doesn't break today; this is the most likely
  // candidate in this list to be a real gap like the other four found
  // 2026-08-17, and deserves a real look before being trusted as fine.
  "src/resilience/provenance.ts::provenanceMetadata": "NEEDS TRIAGE -- likely a real gap (own doc comment implies it should be live in exported artifacts); not confirmed either way",
};

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
const searchFiles = SEARCH_DIRS.flatMap((d) => walk(join(ROOT, d), [], /\.(ts|tsx)$/));

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
