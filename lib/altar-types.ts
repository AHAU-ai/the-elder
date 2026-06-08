// altar-types.ts
// Shared types for the post-reading signal system.
// Imported by ReadingSignal.tsx and AltarRecord.tsx.
// Source of truth — define once, import everywhere.

export type SignalValue = "landed" | "did_not_land";

export interface AltarEntry {
  sessionId: string;  // ties signal to a specific ceremony session
  timestamp: string;  // ISO 8601
  nahual:    string;  // active nahual at time of reading e.g. "Kawoq"
  trecena:   number;  // trecena position 1-13
  lineage:   string;  // e.g. "ojer_tzij" | "norse" | "greek"
  signal:    SignalValue;
}
