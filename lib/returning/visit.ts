// lib/returning/visit.ts
//
// Chain ledger, rekeyed to the single identity spine (elder_user BIGINT ids,
// migration 008) — the raw-UUID cookie identity retired with the invoke route.
// Stores the reading's FULL TEXT for signed-in seekers; every read here is
// scoped by user_id server-side, and everything written can be released
// (row, chain, or all) — see the DELETE handlers in /api/user/history and
// /api/journal.
//
// Fails closed like mythLedger.ts for writes attached to a reading response:
// callers wrap saves in try/catch so a ledger failure never breaks the
// reading. Releases are the opposite — user-initiated, so they fail LOUD
// (fail toward honesty): a failed release must never be reported as done.
import { randomUUID } from "crypto";
import { sql } from "./db";

// Full-text rows are heavier than myth_reading's distilled signatures, so the
// cap is enforced per whole chain: when a seeker exceeds it, their OLDEST
// chain is released to make room — never a hole mid-chain (the UNIQUE
// (chain_id, depth) contract stays meaningful).
export const MAX_VISITS_PER_USER = 400;

export type VisitMode = "explore" | "deepen";

export interface MythicMarkers {
  wound?: string; figure?: string; threshold?: string; exile?: string; pattern?: string;
}

export interface Visit {
  visitId: string;
  chainId: string;
  mode: VisitMode;
  lineageKey: string;
  mythTitle: string;
  archetype: string;
  depth: number;
  offering?: string;
  timestamp: string;
  elderResponse: string;
  markers: MythicMarkers;
  markersConfirmed?: MythicMarkers;
}

function mapVisit(r: any): Visit {
  return {
    visitId: r.id,
    chainId: r.chain_id,
    mode: r.visit_mode,
    lineageKey: r.lineage_key,
    mythTitle: r.myth_title,
    archetype: r.archetype,
    depth: r.depth,
    offering: r.offering ?? undefined,
    timestamp: String(r.created_at),
    elderResponse: r.elder_response,
    markers: r.markers ?? {},
    markersConfirmed: r.markers_confirmed ?? undefined,
  };
}

/** Oldest-chain eviction: keeps the seeker under the cap without mid-chain holes. */
async function evictOldestChainsIfNeeded(userId: number): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const count = await sql`SELECT count(*)::int AS n FROM visit_record WHERE user_id = ${userId}`;
    if (count[0].n < MAX_VISITS_PER_USER) return;
    await sql`
      DELETE FROM visit_record
      WHERE user_id = ${userId} AND chain_id = (
        SELECT chain_id FROM visit_record
        WHERE user_id = ${userId}
        GROUP BY chain_id
        ORDER BY MIN(created_at) ASC
        LIMIT 1
      )
    `;
  }
}

export async function insertVisit(params: {
  userId: number;
  mode: VisitMode;
  chainId: string | null;
  lineageKey: string;
  mythTitle: string;
  archetype: string;
  depth: number;
  offering?: string;
  elderResponse: string;
  markers: MythicMarkers;
}): Promise<Visit> {
  const chainId = params.chainId ?? randomUUID();
  await evictOldestChainsIfNeeded(params.userId);
  // Advisory lock serializes concurrent deepens on the same chain (Shalom Round 1).
  // neon() autocommits each tagged call; the UNIQUE(chain_id, depth) index is the
  // hard guarantee. The advisory lock is best-effort within this connection.
  await sql`SELECT pg_advisory_lock(hashtext(${chainId}))`;
  try {
    const rows = await sql`
      INSERT INTO visit_record
        (user_id, chain_id, visit_mode, lineage_key, myth_title, archetype, depth, offering,
         elder_response, markers)
      VALUES
        (${params.userId}, ${chainId}, ${params.mode}, ${params.lineageKey}, ${params.mythTitle},
         ${params.archetype}, ${params.depth}, ${params.offering ?? null},
         ${params.elderResponse}, ${JSON.stringify(params.markers ?? {})})
      RETURNING id, chain_id, visit_mode, lineage_key, myth_title, archetype, depth, offering,
                elder_response, markers, markers_confirmed, created_at
    `;
    return mapVisit(rows[0]);
  } finally {
    await sql`SELECT pg_advisory_unlock(hashtext(${chainId}))`;
  }
}

export async function fullHistory(userId: number): Promise<Visit[]> {
  const rows = await sql`
    SELECT id, chain_id, visit_mode, lineage_key, myth_title, archetype, depth, offering,
           elder_response, markers, markers_confirmed, created_at
    FROM visit_record
    WHERE user_id = ${userId}
    ORDER BY created_at ASC
  `;
  return rows.map(mapVisit);
}

/** User-scoped single-visit read. (Replaces the old unscoped getVisitById.) */
export async function getVisitForUser(userId: number, visitId: string): Promise<Visit | null> {
  const rows = await sql`
    SELECT id, chain_id, visit_mode, lineage_key, myth_title, archetype, depth, offering,
           elder_response, markers, markers_confirmed, created_at
    FROM visit_record
    WHERE id = ${visitId} AND user_id = ${userId}
  `;
  if (!rows[0]) return null;
  return mapVisit(rows[0]);
}

// ── Release (all user-scoped; loud on failure) ──────────────────────────────

/** Release one reading. Returns true only if a row belonging to this user was removed. */
export async function releaseVisit(userId: number, visitId: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM visit_record
    WHERE id = ${visitId} AND user_id = ${userId}
    RETURNING id
  `;
  return rows.length > 0;
}

/** Release a whole chain. Returns the number of readings released. */
export async function releaseChain(userId: number, chainId: string): Promise<number> {
  const rows = await sql`
    DELETE FROM visit_record
    WHERE chain_id = ${chainId} AND user_id = ${userId}
    RETURNING id
  `;
  return rows.length;
}

/** Release every reading the fire holds for this seeker. */
export async function releaseAllVisits(userId: number): Promise<number> {
  const rows = await sql`
    DELETE FROM visit_record
    WHERE user_id = ${userId}
    RETURNING id
  `;
  return rows.length;
}
