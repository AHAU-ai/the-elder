// altar-types.ts — v2: adds optional provenance fields, backward compatible

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
  mode?: "adult_individual";
}
