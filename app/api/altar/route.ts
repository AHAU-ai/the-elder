import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { loadFlags, telemetryAllowed } from "@/src/resilience/flags";
import type { AltarEntry } from "@/lib/altar-types";

const VALID_SIGNALS = new Set(["landed", "did_not_land"]);
const VALID_LINEAGES = new Set([
  "ojer_tzij", "pythia", "volva", "hem_netjer", "stoa",
  "sage_of_the_way", "keeper_of_the_fire", "babalawo",
  "sufi", "elder_of_country", "ajqij", "vedic", "mekubal",
]);

function isValidEntry(b: unknown): b is AltarEntry {
  if (!b || typeof b !== "object") return false;
  const e = b as Record<string, unknown>;
  return (
    typeof e.sessionId === "string" && e.sessionId.length > 0 && e.sessionId.length <= 64 &&
    typeof e.timestamp === "string" &&
    typeof e.nahual === "string" && e.nahual.length <= 32 &&
    typeof e.trecena === "number" && e.trecena >= 1 && e.trecena <= 13 &&
    typeof e.lineage === "string" && VALID_LINEAGES.has(e.lineage) &&
    typeof e.signal === "string" && VALID_SIGNALS.has(e.signal as string)
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });

  if (!isValidEntry(body)) {
    return NextResponse.json({ ok: true });
  }

  const flags = loadFlags();
  if (!telemetryAllowed(flags, "adult_individual")) {
    return NextResponse.json({ ok: true });
  }

  const entry = body as AltarEntry;

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
