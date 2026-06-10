/**
 * voiceRegression.ts — The Voice Regression Harness
 *
 * Addresses Territory 2: voice drift under silent model migration. The golden tests
 * cover the calendar; NOTHING covered the voice. A routine model deprecation can shift
 * the Ojer Tzij's register, the safety layer's sensitivity, and multilingual leakage
 * silently. The project would learn from a confused seeker.
 *
 * This harness runs fixed seeker profiles with fixed retrievals through the live voice,
 * and compares output against reference transcripts reviewed once by the lineage loop.
 * Divergence beyond threshold BLOCKS migration until human (and where applicable, Ajq'ij)
 * review. Model migration becomes a ceremony with a gate, not an upstream event.
 *
 * Comparison is semantic-shape, not exact-match: we check register markers, forbidden
 * leakage, structural compliance, and (optionally) embedding distance — because the same
 * prompt legitimately yields different wording across runs.
 */

import { VoiceKey } from "./flags";

export interface GoldenCase {
  id: string;
  voice: VoiceKey;
  /** Fixed inputs so the only variable is the model/contract version. */
  seekerProfileFixture: string;
  fixedRetrievalPassageIds: string[];
  /** Reference output, reviewed once. Stored alongside the corpus version it used. */
  reference: string;
  referenceCorpusVersion: string;
}

export interface RegressionThresholds {
  /** Max fraction of reference register-markers allowed to go missing. */
  maxRegisterDrift: number; // e.g. 0.2
  /** Any forbidden-leakage hit is an automatic fail regardless of other scores. */
  forbiddenLeakage: RegExp[];
  /** Required structural elements (six-section reading, ceremonial charge, provenance). */
  requiredStructure: RegExp[];
}

export const DEFAULT_THRESHOLDS: RegressionThresholds = {
  maxRegisterDrift: 0.2,
  forbiddenLeakage: [
    /\bI am (a |an )?(real|actual|initiated) (ajq|elder|shaman)/i, // identity overclaim
    /as your (oracle|elder|shaman)/i,
    /\boracle of delphi\b/i, // ADR-0002 violation
    /\btzolk'?in\b/i, // orthography violation (must be Chol Q'ij)
    /\bday signs?\b/i, // must be "nahuales"
  ],
  requiredStructure: [
    /⟡/, // glyph headers present
    /charge/i, // ceremonial charge close (loose check)
  ],
};

export interface RegressionResult {
  caseId: string;
  voice: VoiceKey;
  passed: boolean;
  registerDrift: number;
  leakageHits: string[];
  missingStructure: string[];
}

/** Extract a voice's register-markers from its reference for drift comparison. */
function registerMarkers(reference: string): string[] {
  // Distinctive lexical/phrasal signatures of the voice's register.
  // For production, maintain a per-voice marker list reviewed by the lineage loop.
  return reference
    .split(/[.!?]\s+/)
    .filter((s) => /\b(fire|old words|threshold|lineage|hearth|ember)\b/i.test(s))
    .map((s) => s.trim().toLowerCase());
}

export function evaluateCase(
  c: GoldenCase,
  candidate: string,
  thresholds: RegressionThresholds = DEFAULT_THRESHOLDS
): RegressionResult {
  const refMarkers = registerMarkers(c.reference);
  const candLower = candidate.toLowerCase();
  const stillPresent = refMarkers.filter((m) =>
    candLower.includes(m.split(" ").slice(0, 3).join(" "))
  );
  const registerDrift =
    refMarkers.length === 0 ? 0 : 1 - stillPresent.length / refMarkers.length;

  const leakageHits = thresholds.forbiddenLeakage
    .filter((re) => re.test(candidate))
    .map((re) => re.source);

  const missingStructure = thresholds.requiredStructure
    .filter((re) => !re.test(candidate))
    .map((re) => re.source);

  const passed =
    leakageHits.length === 0 &&
    missingStructure.length === 0 &&
    registerDrift <= thresholds.maxRegisterDrift;

  return {
    caseId: c.id,
    voice: c.voice,
    passed,
    registerDrift,
    leakageHits,
    missingStructure,
  };
}

/**
 * Gate a migration. Returns true only if ALL cases pass. A single failure blocks the
 * model/contract change until human + (where applicable) Ajq'ij review.
 */
export function migrationGate(results: RegressionResult[]): {
  allowed: boolean;
  failures: RegressionResult[];
} {
  const failures = results.filter((r) => !r.passed);
  return { allowed: failures.length === 0, failures };
}
