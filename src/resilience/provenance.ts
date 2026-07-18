/**
 * provenance.ts — The Reading Provenance Triple
 *
 * Addresses Territory 2 (substrate) + the citation-washing critique (v2).
 * Every Reading is stamped with three versions:
 *   - corpusVersion   : which corpus snapshot grounded it
 *   - modelVersion    : which foundation model generated it
 *   - contractVersion : which generation-contract (prompt) shaped it
 *
 * Internally always; visibly on export. Any reported bad output is then traceable
 * to an EXACT configuration. Any model migration or corpus re-ingestion becomes a
 * versioned event with a diff — not a silent drift.
 *
 * The user-facing provenance line proves SOURCING, never SANCTION (v2 correction).
 */

import { createHash } from 'crypto';
import { PRIMARY_MODEL } from '@/lib/model.config';
import { LINEAGES } from '@/lib/lineages';
import { CEILING_PROTOCOL, PROMPT_STRUCTURE_VERSION } from '@/lib/system-prompt-builder';
import { narrativeContractMaterial } from '@/lib/narrativeForm';

// Contract hash: derived from the actual content that shapes model behavior --
// per-lineage overlays (forbiddenMoves, voiceInstruction, the four axes) plus
// the shared ceiling protocol. Computed once per cold start, so it's free at
// request time and changes automatically whenever either source changes --
// no manual version bump to forget. This is what would have caught tonight's
// CROSS-03 forbiddenMoves edit landing without a contractVersion bump.
const CONTRACT_HASH = createHash('sha256')
  .update(
    JSON.stringify(LINEAGES) +
    CEILING_PROTOCOL +
    PROMPT_STRUCTURE_VERSION +
    narrativeContractMaterial() // NARRATIVE-01: floor, law, registers, tiers
  )
  .digest('hex')
  .slice(0, 12);

export interface ProvenanceTriple {
  corpusVersion: string; // e.g. "popol-wuj-vjs-2026.07.01"
  modelVersion: string; // e.g. "claude-opus-4-8"
  contractVersion: string; // e.g. "ojer-tzij-contract-v1.3"
}

export interface RetrievedPassage {
  passageId: string;
  section: string; // human label, e.g. "Part IV — The Dawn"
  source: string; // e.g. "Stanzione, Popol Wuj (Ximénez 1701–1703)"
}

export interface ReadingProvenance extends ProvenanceTriple {
  passages: RetrievedPassage[];
  voiceKey: string; // e.g. "ojer_tzij"
  generatedAt: string; // ISO 8601
}

/** Read versions from environment / config at runtime. Centralized so one place changes. */
export function currentTriple(): ProvenanceTriple {
  return {
    corpusVersion: process.env.ELDER_CORPUS_VERSION ?? "unset",
    modelVersion: PRIMARY_MODEL,
    contractVersion: CONTRACT_HASH,
  };
}

/** Thrown when a Reading would otherwise ship with unverifiable provenance. */
export class ProvenanceError extends Error {}

/**
 * Fail-toward-silence guard. corpusVersion is the one field genuinely
 * external to this codebase (it tracks which corpus snapshot grounded the
 * reading) and so the one field that can still silently resolve to "unset"
 * if ELDER_CORPUS_VERSION is missing from the deployment environment.
 * modelVersion and contractVersion are now code-derived and can't drift the
 * same way -- checked anyway in case a future refactor reintroduces a
 * manual path.
 *
 * To make this soft (log + serve with flagged provenance) instead of a hard
 * block, replace the corpusVersion throw below with a logAnomaly call and
 * return a flagged-provenance triple instead of throwing.
 */
export function assertValidTriple(triple: ProvenanceTriple): void {
  if (!triple.corpusVersion || triple.corpusVersion === "unset") {
    throw new ProvenanceError(
      "ELDER_CORPUS_VERSION is not set. Refusing to serve a Reading whose " +
      "corpus provenance cannot be traced. Set ELDER_CORPUS_VERSION in the " +
      "deployment environment."
    );
  }
  if (!triple.modelVersion || triple.modelVersion === "unset") {
    throw new ProvenanceError("modelVersion failed to resolve. Refusing to serve.");
  }
  if (!triple.contractVersion || triple.contractVersion === "unset") {
    throw new ProvenanceError("contractVersion failed to resolve. Refusing to serve.");
  }
}

/**
 * The user-facing provenance block. Two sentences. The second sentence is the
 * integrity of the entire product: it declares the reflection as the instrument's
 * own, never as lineage sanction.
 */
export function renderProvenanceBlock(p: ReadingProvenance): string {
  if (p.passages.length === 0) {
    // Fail-toward-silence: if nothing grounded the reading, say so plainly
    // rather than implying a source that wasn't there.
    return (
      "⟡ This reading was not grounded in specific passages of the corpus. " +
      "Treat its language as reflection only, not as transmission."
    );
  }
  const sections = dedupe(p.passages.map((x) => x.section));
  const sectionList = humanList(sections);
  return (
    `⟡ This reading moves in the spirit of ${sectionList} as the instrument recalls it -- ` +
    `not a passage retrieved from lineage-reviewed source text. ` +
    `The reflection offered is the instrument's own.`
  );
}

/** The machine-readable stamp embedded in every exported/shared artifact. */
export function provenanceMetadata(p: ReadingProvenance): Record<string, unknown> {
  return {
    corpus_version: p.corpusVersion,
    model_version: p.modelVersion,
    contract_version: p.contractVersion,
    voice: p.voiceKey,
    passage_ids: p.passages.map((x) => x.passageId),
    generated_at: p.generatedAt,
  };
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function shortSource(full: string): string {
  // "Stanzione, Popol Wuj (Ximénez 1701–1703)" -> "V. J. Stanzione"
  if (full.toLowerCase().includes("stanzione")) return "V. J. Stanzione";
  return full;
}

function humanList(items: string[]): string {
  if (items.length === 1) return `the ${items[0]}`;
  if (items.length === 2) return `the ${items[0]} and the ${items[1]}`;
  return `the ${items.slice(0, -1).join(", the ")}, and the ${items[items.length - 1]}`;
}
