/**
 * consentLedger.ts
 *
 * §5.2 — The Consent and Provenance Ledger
 *
 * Checks whether a voice has an active consent grant before serving a Reading.
 * If the grant is missing or withdrawn, the voice is blocked — fail toward silence.
 *
 * GOVERNANCE: This module is the propagation mechanism for withdrawals.
 * A revoked grant here disables the voice at the route level, before generation.
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export interface ConsentGrant {
  id: string;
  tradition: string;
  voiceKey: string;
  holderName: string;
  version: string;
  status: 'active' | 'withdrawn' | 'superseded';
  grantedAt: string;
}

export type ConsentCheckResult =
  | { allowed: true; grant: ConsentGrant }
  | { allowed: false; reason: 'no_grant' | 'withdrawn' | 'superseded' };

/**
 * Check whether a voice has an active consent grant.
 * Called before generation in route.ts.
 * Fails closed: any DB error = not allowed.
 */
export async function checkConsent(voiceKey: string): Promise<ConsentCheckResult> {
  try {
    const rows = await sql`
      SELECT id, tradition, voice_key, holder_name, version, status, granted_at
      FROM consent_grant
      WHERE voice_key = ${voiceKey}
      ORDER BY id DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      return { allowed: false, reason: 'no_grant' };
    }

    const row = rows[0];
    const grant: ConsentGrant = {
      id: row.id,
      tradition: row.tradition,
      voiceKey: row.voice_key,
      holderName: row.holder_name,
      version: row.version,
      status: row.status,
      grantedAt: row.granted_at,
    };

    if (grant.status !== 'active') {
      return { allowed: false, reason: grant.status as 'withdrawn' | 'superseded' };
    }

    return { allowed: true, grant };
  } catch (err) {
    // Fail closed — DB error blocks the voice, never bypasses it
    console.error('[consentLedger] DB error, failing closed:', err);
    return { allowed: false, reason: 'no_grant' };
  }
}
