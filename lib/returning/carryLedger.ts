// lib/returning/carryLedger.ts
// The only reader/writer of seeker_carry (migrations/027). Every query is
// user-scoped. scripts/check-carry-register.mjs asserts that nothing else
// touches the table, so the seeker's line cannot flow into a prompt.
import { sql } from './db';
import type { CarryRow, CarryPracticeKey } from './carry';

const MAX_ROWS = 400;

/** Insert a carry for one of the user's own readings. false = already carried for that reading, or not theirs. */
export async function recordCarry(
  userId: number,
  visitId: string,
  practiceKey: CarryPracticeKey | null,
  line: string | null
): Promise<boolean> {
  const rows = await sql`
    INSERT INTO seeker_carry (user_id, visit_id, practice_key, line)
    SELECT ${userId}, v.id, ${practiceKey}, ${line}
    FROM visit_record v
    WHERE v.id = ${visitId} AND v.user_id = ${userId}
    ON CONFLICT (visit_id) DO NOTHING
    RETURNING id
  `;
  return rows.length === 1;
}

export async function carryRows(userId: number): Promise<CarryRow[]> {
  const rows = await sql`
    SELECT id, created_at, practice_key, line
    FROM seeker_carry
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${MAX_ROWS}
  `;
  return rows.map((r: any) => ({
    id: String(r.id),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    practiceKey: r.practice_key,
    line: r.line,
  }));
}

/** Release one carry. Returns rows removed (0 = not found / not theirs). */
export async function releaseCarry(userId: number, carryId: string): Promise<number> {
  const rows = await sql`
    DELETE FROM seeker_carry WHERE id = ${carryId} AND user_id = ${userId} RETURNING id
  `;
  return rows.length;
}
