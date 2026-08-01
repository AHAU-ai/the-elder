import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { loadFlags, telemetryAllowed } from "@/src/resilience/flags";
import type { AltarEntry } from "@/lib/altar-types";
import { getSessionUserId } from "@/lib/auth";

const VALID_SIGNALS = new Set(["landed", "did_not_land"]);
// Callers (ReadingSignal.tsx, in both Threshold.tsx and CouncilTabs.tsx) only
// ever have the LineageKey on hand, not the voice key — this used to be a
// set of voice keys, which meant every lineage whose voice key differs from
// its lineage key (most of them) had its signal silently dropped by
// isValidEntry before it ever reached the DB.
const VALID_LINEAGES = new Set([
  "default", "maya", "norse", "taoist", "greek", "egyptian",
  "dreamtime", "vedic", "yoruba", "sufi", "stoic", "mekubal", "buddhist",
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
  const userId = getSessionUserId(req);

  if (process.env.DATABASE_URL) {
    try {
      const sql = neon(process.env.DATABASE_URL);
      await sql`INSERT INTO altar_record
        (session_id, timestamp, nahual, trecena, lineage, signal,
         corpus_version, model_version, contract_version, mode, user_id)
        VALUES (${entry.sessionId}, ${entry.timestamp}, ${entry.nahual},
        ${entry.trecena}, ${entry.lineage}, ${entry.signal},
        ${entry.corpusVersion ?? null}, ${entry.modelVersion ?? null},
        ${entry.contractVersion ?? null}, ${entry.mode ?? null}, ${userId})`;
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
