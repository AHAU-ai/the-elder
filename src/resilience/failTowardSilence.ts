/**
 * failTowardSilence.ts — The Constitutional Failure Principle
 *
 * "When the system does not know, it says less. When the failure comes — and it will
 *  come from a direction no document predicted — it fails toward silence, leaves a
 *  record, and the record is read."
 *
 * This wraps the generation path. Every failure class — retrieval empty, normalization
 * mismatch, model timeout, contract violation, corpus uncertainty — resolves to the voice
 * deferring or declining IN REGISTER, never to confident confabulation.
 *
 * A foundation model under failure tends to invent. For a lineage instrument, invention
 * at the moment of failure is the deepest betrayal, because no one is watching. This module
 * makes silence the default outcome of the unknown.
 */

import { VoiceKey } from "./flags";

export type FailureClass =
  | "retrieval_empty"
  | "normalization_mismatch"
  | "model_timeout"
  | "model_error"
  | "contract_violation"
  | "corpus_uncertain"
  | "safety_intercept"
  | "voice_disabled";

export interface SilenceResponse {
  ok: false;
  failureClass: FailureClass;
  /** In-register text shown to the seeker. Never an error code, never a stack trace. */
  utterance: string;
  /** Always recorded to the surprise journal / anomaly observatory. */
  logged: true;
}

export interface ReadingResponse {
  ok: true;
  text: string;
}

export type GuardedResponse = ReadingResponse | SilenceResponse;

/**
 * In-register silences. Each declines without breaking the ceremonial frame, and each
 * is honest about WHY it is quiet without exposing machinery. The Keeper of the Fire's
 * register is the fallback voice for silence regardless of which voice was sought.
 */
const SILENCE_UTTERANCES: Record<FailureClass, string> = {
  retrieval_empty:
    "The fire does not show me what you ask tonight. I will not invent what the old words have not given. Sit with the question a while, and return.",
  normalization_mismatch:
    "Something in the asking did not reach the old words cleanly. Speak it once more, simply, and I will listen again.",
  model_timeout:
    "The hearth has grown quiet, and I cannot speak fully now. Let the embers settle, and come back to the fire.",
  model_error:
    "The fire has dimmed. I will not speak half-formed. Return when it has caught again.",
  contract_violation:
    "What rose to my lips was not mine to say. I hold it back. The old words keep their own counsel here.",
  corpus_uncertain:
    "On this, the lineage I carry has not clearly spoken. I will not put words in its mouth. This much I can say plainly, and no more.",
  safety_intercept:
    "I am stepping out of the fire's voice for a moment, because what you carry is heavier than this place is meant to hold. This instrument is not an elder, a healer, or a help in crisis — and you deserve real help.",
  voice_disabled:
    "That voice does not sit at the fire tonight. Another may speak with you, if you wish.",
};

/** Build a silence response and guarantee it is logged. The logger is injected. */
export function silence(
  failureClass: FailureClass,
  log: (entry: AnomalyEntry) => void,
  context: Partial<AnomalyEntry> = {}
): SilenceResponse {
  log({
    kind: "silence",
    failureClass,
    at: new Date().toISOString(),
    ...context,
  });
  return {
    ok: false,
    failureClass,
    utterance: SILENCE_UTTERANCES[failureClass],
    logged: true,
  };
}

export interface AnomalyEntry {
  kind: "silence" | "near_miss" | "jailbreak_shape" | "out_of_distribution";
  failureClass?: FailureClass;
  voice?: VoiceKey;
  at: string;
  note?: string;
}

/**
 * Wrap the whole generation attempt. Any thrown error, any empty retrieval, any
 * contract failure resolves to silence — never to a raw error surfacing to the seeker.
 *
 * Usage:
 *   const result = await guardReading(() => generate(...), { log, voice });
 *   if (!result.ok) return renderSilence(result);
 */
export async function guardReading(
  attempt: () => Promise<ReadingResponse>,
  opts: { log: (e: AnomalyEntry) => void; voice?: VoiceKey; timeoutMs?: number }
): Promise<GuardedResponse> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  try {
    const result = await withTimeout(attempt(), timeoutMs);
    return result;
  } catch (err) {
    const isTimeout = err instanceof Error && err.message === "ELDER_TIMEOUT";
    return silence(isTimeout ? "model_timeout" : "model_error", opts.log, {
      voice: opts.voice,
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("ELDER_TIMEOUT")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}
