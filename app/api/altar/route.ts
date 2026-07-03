import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { loadFlags, telemetryAllowed } from "@/src/resilience/flags";
import type { Mode } from "@/src/resilience/flags";
import type { AltarEntry } from "@/lib/altar-types";

const VALID_SIGNALS = new Set(["landed", "did_not_land"]);
const VALID_LINEAGES = new Set([
  "ojer_tzij", "pythia", "volva", "hem_netjer", "stoa",
  "sage_of_the_way", "keeper_of_the_fire", "babalawo",
  "sufi", "elder_of_country", "ajqij", "vedic", "mekubal",
]);
const VALID_MODES = new Set<Mode>(["adult_individual", "classroom"]);

function isValidEntry(b: unknown): b is AltarEntry {
  if (!b || typeof b !== "object") return false;
  const e = b as Record<string, unknown>;
  return (
    typeof e.sessionId === "string" && e.sessionId.length > 0 && e.sessionId.length <= 64 &&
    typeof e.timestamp === "string" &&
    typeof e.nahual === "string" && e.nahual.length <= 32 &&
    typeof e.trecena === "number" && e.trecena >= 1 && e.trecena <= 13 &&
    typeof e.lineage === "string" && VALID_LINEAGES.has(e.lineage) &&
    typeof e.signal === "string" && VALID_SIGNALS.has(e.signal as string) &&
    // mode is optional (older/legacy entries never sent it), but if present
    // it must be a real Mode value -- no longer silently accepting anything.
    (e.mode === undefined || (typeof e.mode === "string" && VALID_MODES.has(e.mode as Mode)))
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });

  if (!isValidEntry(body)) {
    return NextResponse.json({ ok: true });
  }

  const flags = loadFlags();
  const entry = body as AltarEntry;

  // Was hardcoded to "adult_individual" regardless of what the client sent --
  // meaning telemetryAllowed's "classroom" hard-block (see flags.ts, marked
  // "hard, structural, non-overridable") could never actually fire. Default
  // to adult_individual only for legacy entries that never sent a mode at
  // all; any entry that DOES send a mode is now honored for real.
  const mode: Mode = entry.mode ?? "adult_individual";
  if (!telemetryAllowed(flags, mode)) {
    return NextResponse.json({ ok: true });
  }

  if (process.env.DATABASE_URL) {
    try {
      const sql = neon(process.env.DATABASE_URL);
      await sql`INSERT INTO altar_record
        (session_id, timestamp, nahual, trecena, lineage, signal,
         corpus_version, model_version, contract_version, mode)
        VALUES (${entry.sessionId}, ${entry.timestamp}, ${entry.nahual},
        ${entry.trecena}, ${entry.lineage}, ${entry.signal},
        ${entry.corpusVersion ?? null}, ${entry.modelVersion ?? null},
        ${entry.contractVersion ?? null}, ${entry.mode ?? null})`;
    } catch {
      // altar record must never break the generation path
    }
  } else {
    console.log("[ALTAR]", JSON.stringify({
      sessionId: entry.sessionId, nahual: entry.nahual,
      trecena: entry.trecena, lineage: entry.lineage,
      signal: entry.signal, at: entry.timestamp,
    }));
  }

  return NextResponse.json({ ok: true });
}
