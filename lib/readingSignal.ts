/**
 * readingSignal.ts
 *
 * Pure client-side helpers for the post-Reading signal (ReadingSignal.tsx).
 * Kept out of the component so the two things that silently broke the loop
 * before — a provenance shape mismatch and a server write that never fired —
 * are unit-testable.
 */

import type { AltarEntry } from "@/lib/altar-types";

export interface SignalProvenance {
  corpusVersion?:   string;
  modelVersion?:    string;
  contractVersion?: string;
}

/**
 * /api/divine returns `_provenance` from provenanceMetadata() in snake_case
 * (corpus_version, model_version, contract_version). The signal layer speaks
 * camelCase. Passing the raw object straight through made every tap fail
 * isValidProvenance, so nothing was ever persisted.
 */
export function provenanceFromMetadata(
  meta: Record<string, unknown> | null | undefined
): SignalProvenance | undefined {
  if (!meta) return undefined;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return {
    corpusVersion:   str(meta.corpus_version),
    modelVersion:    str(meta.model_version),
    contractVersion: str(meta.contract_version),
  };
}

/**
 * Defense-in-depth: /api/divine hard-fails before responding if its provenance
 * triple is incomplete, so this should never see an invalid triple. A signal
 * recorded against an unknown corpus/model/contract can't be attributed, so it
 * is not persisted at all.
 */
export function isValidProvenance(p?: SignalProvenance): boolean {
  if (!p) return false;
  return [p.corpusVersion, p.modelVersion, p.contractVersion].every(
    (v) => typeof v === "string" && v.length > 0 && v !== "unset"
  );
}

/**
 * Send a signal to the server ledger. Fire-and-forget by design: a logging
 * failure must never touch the ceremony, so every failure is swallowed and
 * nothing is awaited on the seeker's path. `keepalive` lets the request
 * survive the seeker closing the tab right after tapping.
 */
export function sendSignal(entry: AltarEntry): void {
  try {
    void fetch("/api/altar", {
      method:    "POST",
      headers:   { "Content-Type": "application/json" },
      body:      JSON.stringify(entry),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // silent — see above
  }
}
