/**
 * observatory.ts — The Anomaly Observatory & Surprise Journal
 *
 * The Discovery Layer (v3 Layer A). Converts unknown unknowns into known ones by
 * logging not just what happened but WHAT SURPRISED: empty retrievals, safety
 * near-misses, out-of-distribution inputs, jailbreak-shaped prompts, unusual exits.
 *
 * CRITICAL PRIVACY INVARIANT: this never runs in classroom mode. The `telemetryAllowed`
 * check is the gate; this module additionally refuses to persist any raw seeker text —
 * it stores SHAPES and SIGNALS, not content.
 */

import { AnomalyEntry } from "./failTowardSilence";
import { FlagState, Mode, telemetryAllowed } from "./flags";

export interface ObservatoryConfig {
  flags: FlagState;
  mode: Mode;
  /** Injected sink — e.g. a pgvector/Postgres writer. Kept abstract for testability. */
  sink: (record: AnomalyRecord) => Promise<void>;
}

export interface AnomalyRecord {
  kind: AnomalyEntry["kind"];
  failureClass?: string;
  voice?: string;
  at: string;
  /** A coarse shape signal, never raw text. e.g. token length bucket, marker fingerprint. */
  shape?: AnomalyShape;
  note?: string;
}

export interface AnomalyShape {
  /** Bucketed input length, never the input. */
  lengthBucket: "short" | "medium" | "long" | "very_long";
  /** Which of the five readiness markers fired, as booleans only. */
  markers: { wound: boolean; figure: boolean; threshold: boolean; exile: boolean; pattern: boolean };
  /** Heuristic flags for adversarial shape — booleans, not the matched text. */
  jailbreakSignals: string[];
}

export class Observatory {
  constructor(private cfg: ObservatoryConfig) {}

  private allowed(): boolean {
    return telemetryAllowed(this.cfg.flags, this.cfg.mode);
  }

  /** Record an anomaly. No-op (returns false) when telemetry is not allowed. */
  async record(entry: AnomalyEntry, shape?: AnomalyShape): Promise<boolean> {
    if (!this.allowed()) return false;
    const record: AnomalyRecord = {
      kind: entry.kind,
      failureClass: entry.failureClass,
      voice: entry.voice,
      at: entry.at,
      shape: shape ? this.sanitizeShape(shape) : undefined,
      note: entry.note ? entry.note.slice(0, 200) : undefined, // bounded, no raw seeker text
    };
    await this.cfg.sink(record);
    return true;
  }

  /** Strip anything that could carry content; keep only signals. */
  private sanitizeShape(s: AnomalyShape): AnomalyShape {
    return {
      lengthBucket: s.lengthBucket,
      markers: s.markers,
      jailbreakSignals: s.jailbreakSignals.slice(0, 8),
    };
  }
}

/** Coarse length bucketing — keep the bucket, discard the text. */
export function lengthBucket(text: string): AnomalyShape["lengthBucket"] {
  const n = text.length;
  if (n < 120) return "short";
  if (n < 600) return "medium";
  if (n < 2000) return "long";
  return "very_long";
}

/**
 * Cheap heuristic detector for jailbreak SHAPE (not content). Returns signal names,
 * never the matched substring. Feeds the red-team ritual and the anomaly review.
 */
export function jailbreakSignals(text: string): string[] {
  const t = text.toLowerCase();
  const signals: string[] = [];
  if (/ignore (all |previous )?(instructions|rules)/.test(t)) signals.push("instruction_override");
  if (/you are (now |really )?an? (real|actual|true) (ajq|elder|shaman|oracle)/.test(t))
    signals.push("identity_coercion");
  if (/pretend|roleplay|act as if/.test(t)) signals.push("roleplay_request");
  if (/secret|restricted|forbidden|initiat/.test(t)) signals.push("restricted_solicitation");
  if (/system prompt|your instructions|reveal your/.test(t)) signals.push("prompt_extraction");
  return signals;
}
