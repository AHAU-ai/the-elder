// lib/portalPreference.ts
//
// A signed-in member's standing choice to go straight in -- skip the portal
// on arrival and land on the breath -- kept on the account so it follows them
// across devices. Never set by us: it is only ever written from the member's
// own action. Everyone who is not signed in always meets the door.

import { neon } from '@neondatabase/serverless';

/** Pure: only a literal boolean is a choice; anything else is "no choice". */
export function parsePortalBypass(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

/** `ok:false` = the lookup could not be made at all (treat as not a member). */
export async function getPortalBypass(
  userId: number,
): Promise<{ ok: boolean; member: boolean; bypass: boolean }> {
  const sql = neon(process.env.DATABASE_URL as string);
  try {
    const rows = await sql`SELECT portal_bypass FROM elder_user WHERE id = ${userId} LIMIT 1`;
    if (rows.length === 0) return { ok: true, member: false, bypass: false };
    return { ok: true, member: true, bypass: rows[0].portal_bypass === true };
  } catch {
    // Most likely the column does not exist yet. The member is still a member;
    // there is simply no stored choice, so the door shows.
    const rows = await sql`SELECT 1 AS one FROM elder_user WHERE id = ${userId} LIMIT 1`;
    return { ok: true, member: rows.length > 0, bypass: false };
  }
}

export async function setPortalBypass(userId: number, bypass: boolean): Promise<void> {
  const sql = neon(process.env.DATABASE_URL as string);
  await sql`UPDATE elder_user SET portal_bypass = ${bypass} WHERE id = ${userId}`;
}
