// lib/returning/visit.ts
import { randomUUID } from "crypto";
import { sql } from "./db";

export const DEEPEN_CONTEXT_WINDOW = 5;
export const DEEPEN_TOKEN_CEILING = 6000;

export type VisitMode = "explore" | "deepen";

export interface MythicMarkers {
  wound?: string; figure?: string; threshold?: string; exile?: string; pattern?: string;
}

export interface Visit {
  visitId: string;
  chainId: string;
  mode: VisitMode;
  mythTitle: string;
  archetype: string;
  depth: number;
  offering?: string;
  timestamp: string;
  elderResponse: string;
  markers: MythicMarkers;
  markersConfirmed?: MythicMarkers;
}

export interface ChainHead {
  chainId: string;
  mythTitle: string;
  archetype: string;
  depth: number;
  timestamp: string;
}

function mapVisit(r: any): Visit {
  return {
    visitId: r.id,
    chainId: r.chain_id,
    mode: r.visit_mode,
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

export async function mostRecentChain(userId: string): Promise<ChainHead | null> {
  const rows = await sql`
    SELECT chain_id, myth_title, archetype, depth, created_at
    FROM visit_record
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return {
    chainId: rows[0].chain_id,
    mythTitle: rows[0].myth_title,
    archetype: rows[0].archetype,
    depth: rows[0].depth,
    timestamp: String(rows[0].created_at),
  };
}

/**
 * Deepen context. Joins on chain_id (NOT myth_title) so two explore visits of the
 * same myth never interleave. Window + token ceiling with legible truncation note.
 * chainId is supplied by the caller, derived server-side from the user's own chain.
 */
export async function assembleDeepContext(
  userId: string,
  chainId: string
): Promise<{ chain: Visit[]; truncationNote: string | null; nextDepth: number; head: ChainHead }> {
  const rows = await sql`
    SELECT id, chain_id, visit_mode, myth_title, archetype, depth, offering,
           elder_response, markers, markers_confirmed, created_at
    FROM visit_record
    WHERE user_id = ${userId} AND chain_id = ${chainId}
    ORDER BY depth ASC, created_at ASC
  `;
  const full: Visit[] = rows.map(mapVisit);
  const last = full[full.length - 1];
  const head: ChainHead = {
    chainId,
    mythTitle: last.mythTitle,
    archetype: last.archetype,
    depth: last.depth,
    timestamp: last.timestamp,
  };
  const nextDepth = head.depth + 1;

  let included = full;
  let truncated = false;
  if (full.length > DEEPEN_CONTEXT_WINDOW) {
    included = full.slice(-DEEPEN_CONTEXT_WINDOW);
    truncated = true;
  }
  while (
    included.length > 1 &&
    included.reduce((n, v) => n + Math.ceil(v.elderResponse.length / 4), 0) > DEEPEN_TOKEN_CEILING
  ) {
    included = included.slice(1);
    truncated = true;
  }

  const truncationNote = truncated
    ? `The Elder has spoken to this person ${full.length} times within this myth. ` +
      `The ${included.length} most recent invocations follow. ` +
      `The earlier descents are held but not repeated here.`
    : null;

  return { chain: included, truncationNote, nextDepth, head };
}

export async function insertVisit(params: {
  userId: string;
  mode: VisitMode;
  chainId: string | null;
  mythTitle: string;
  archetype: string;
  depth: number;
  offering?: string;
  elderResponse: string;
  markers: MythicMarkers;
}): Promise<Visit> {
  const chainId = params.chainId ?? randomUUID();
  // Advisory lock serializes concurrent deepens on the same chain (Shalom Round 1).
  // neon() autocommits each tagged call; the UNIQUE(chain_id, depth) index is the
  // hard guarantee. The advisory lock is best-effort within this connection.
  await sql`SELECT pg_advisory_lock(hashtext(${chainId}))`;
  try {
    const rows = await sql`
      INSERT INTO visit_record
        (user_id, chain_id, visit_mode, myth_title, archetype, depth, offering,
         elder_response, markers)
      VALUES
        (${params.userId}, ${chainId}, ${params.mode}, ${params.mythTitle},
         ${params.archetype}, ${params.depth}, ${params.offering ?? null},
         ${params.elderResponse}, ${JSON.stringify(params.markers ?? {})})
      RETURNING id, chain_id, visit_mode, myth_title, archetype, depth, offering,
                elder_response, markers, markers_confirmed, created_at
    `;
    return mapVisit(rows[0]);
  } finally {
    await sql`SELECT pg_advisory_unlock(hashtext(${chainId}))`;
  }
}

export async function fullHistory(userId: string): Promise<Visit[]> {
  const rows = await sql`
    SELECT id, chain_id, visit_mode, myth_title, archetype, depth, offering,
           elder_response, markers, markers_confirmed, created_at
    FROM visit_record
    WHERE user_id = ${userId}
    ORDER BY created_at ASC
  `;
  return rows.map(mapVisit);
}

export async function getVisitById(visitId: string): Promise<Visit | null> {
  const rows = await sql`
    SELECT id, chain_id, visit_mode, myth_title, archetype, depth, offering,
           elder_response, markers, markers_confirmed, created_at
    FROM visit_record
    WHERE id = ${visitId}
  `;
  if (!rows[0]) return null;
  return mapVisit(rows[0]);
}
