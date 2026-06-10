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
    modelVersion: process.env.ELDER_MODEL_VERSION ?? "unset",
    contractVersion: process.env.ELDER_CONTRACT_VERSION ?? "unset",
  };
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
  const sourceName = p.passages[0].source;
  const sections = dedupe(p.passages.map((x) => x.section));
  const sectionList = humanList(sections);
  return (
    `⟡ The tradition-language of this reading was drawn from ${sectionList}, ` +
    `in the translation of ${shortSource(sourceName)}. ` +
    `The reflection offered upon them is the instrument's own.`
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
