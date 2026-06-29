// lib/returning/markers.ts
import type { MythicMarkers } from "@/lib/returning/visit";

/** Extract the <markers>{...}</markers> JSON the Elder emits; return display text stripped of it. */
export function extractMarkers(raw: string): { displayText: string; markers: MythicMarkers } {
  const m = raw.match(/<markers>([\s\S]*?)<\/markers>/);
  let markers: MythicMarkers = {};
  if (m) {
    try {
      const parsed = JSON.parse(m[1]);
      markers = Object.fromEntries(
        Object.entries(parsed).filter(([, v]) => v != null && v !== "")
      ) as MythicMarkers;
    } catch {
      markers = {};
    }
  }
  return { displayText: raw.replace(/<markers>[\s\S]*?<\/markers>/, "").trim(), markers };
}
