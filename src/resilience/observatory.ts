/**
 * observatory.ts — anomaly-shape detectors
 *
 * lengthBucket() and jailbreakSignals() feed the Discovery Layer (v3 Layer A):
 * detecting what SURPRISED (out-of-distribution inputs, jailbreak-shaped
 * prompts) without ever persisting raw seeker text — shapes and signals only.
 *
 * The privacy invariant this file used to frame around a class-based
 * Observatory/sink design ("never runs in classroom mode") is now enforced
 * directly at the write site instead: app/api/divine/route.ts checks
 * telemetryAllowed(flags, mode) before it ever calls its logAnomaly() sink.
 * The Observatory class + sink abstraction that used to live here was never
 * actually constructed anywhere — removed rather than left as a second,
 * unenforced implementation of the same gate.
 */

/** Coarse length bucketing — keep the bucket, discard the text. */
export function lengthBucket(text: string): "short" | "medium" | "long" | "very_long" {
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
