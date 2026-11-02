// altar-types.ts — v3: adds the "sitting" response; backward compatible

import type { Mode } from "@/src/resilience/flags";

/**
 * What a seeker can say back after a Reading. Three honest answers, not two:
 *
 *   landed        — "I found myself here."
 *   sitting       — "I need to sit with this." Neither a hit nor a miss: the
 *                   seeker is still receiving it. Recorded so the closing is
 *                   real, but NEVER counted as a miss by the learning loop
 *                   (see lib/feedbackSteer.ts) — a Reading that is still
 *                   working on someone must not be "sharpened" away.
 *   did_not_land  — "Not mine." The Reading missed.
 *
 * SIGNAL_VALUES is the single source of truth: the /api/altar route validates
 * against it, so a new value cannot be accepted by the client and silently
 * dropped by the server.
 */
export const SIGNAL_VALUES = ["landed", "sitting", "did_not_land"] as const;
export type SignalValue = (typeof SIGNAL_VALUES)[number];

export interface AltarEntry {
  sessionId:  string;
  timestamp:  string;
  nahual:     string;
  trecena:    number;
  lineage:    string;
  signal:     SignalValue;
  corpusVersion?:   string;
  modelVersion?:    string;
  contractVersion?: string;
  // Was hardcoded to the single literal "adult_individual" -- silently made it
  // impossible for a client to ever send "classroom" mode, which is why the
  // route-level telemetry hard-block for classroom mode never actually fired.
  // Now uses the real Mode union from flags.ts (single source of truth).
  mode?: Mode;
}
