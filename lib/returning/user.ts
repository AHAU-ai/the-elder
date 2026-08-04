// lib/returning/user.ts
import { sql } from "./db";

export interface UserRecord {
  userId: string;
  name?: string;
  createdAt: string;
  lastVisitAt?: string;
  visitCount: number;
}

function mapUser(r: any): UserRecord {
  return {
    userId: r.id,
    name: r.name ?? undefined,
    createdAt: String(r.created_at),
    lastVisitAt: r.last_visit_at ? String(r.last_visit_at) : undefined,
    visitCount: r.visit_count,
  };
}

export async function createUser(name?: string): Promise<UserRecord> {
  const rows = await sql`
    INSERT INTO user_record (name) VALUES (${name ?? null})
    RETURNING id, name, created_at, last_visit_at, visit_count
  `;
  return mapUser(rows[0]);
}

export async function getUser(id: string): Promise<UserRecord | null> {
  const rows = await sql`
    SELECT id, name, created_at, last_visit_at, visit_count
    FROM user_record WHERE id = ${id}
  `;
  return rows[0] ? mapUser(rows[0]) : null;
}

/** Spec v2 [M-3]: dead/corrupt cookie => treat as first visit. Never 500. */
export async function getUserOrReissue(
  id: string | undefined,
  name?: string
): Promise<{ user: UserRecord; reissued: boolean }> {
  if (id) {
    const existing = await getUser(id);
    if (existing) return { user: existing, reissued: false };
  }
  const user = await createUser(name);
  return { user, reissued: true };
}

export async function updateName(id: string, name: string): Promise<void> {
  await sql`UPDATE user_record SET name = ${name} WHERE id = ${id}`;
}

export async function touchVisit(id: string): Promise<void> {
  await sql`UPDATE user_record SET last_visit_at = NOW() WHERE id = ${id}`;
}

export async function incrementVisitCount(id: string): Promise<void> {
  await sql`
    UPDATE user_record
    SET visit_count = visit_count + 1, last_visit_at = NOW()
    WHERE id = ${id}
  `;
}

export async function incrementWelfareBlock(id: string): Promise<void> {
  // content-free safety counter (Spec v2 R8); never stores offering text.
  await sql`UPDATE user_record SET welfare_block_count = welfare_block_count + 1 WHERE id = ${id}`;
}
