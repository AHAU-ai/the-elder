// altar-types.ts — v2: adds optional provenance fields, backward compatible

import type { Mode } from "@/src/resilience/flags";

export type SignalValue = "landed" | "did_not_land";

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
