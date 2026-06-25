import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

// ── consent_grant ──────────────────────────────────────────────────────────
// One row per authorization grant per tradition/voice.
// §5.2: tradition, holder, scope, version, date, status.
// status: 'active' | 'withdrawn' | 'superseded'

await sql`
  CREATE TABLE IF NOT EXISTS consent_grant (
    id                bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    tradition         text NOT NULL,
    voice_key         text NOT NULL,
    holder_name       text NOT NULL,
    holder_role       text NOT NULL,
    scope             text NOT NULL,
    scope_detail      jsonb NOT NULL DEFAULT '{}',
    version           text NOT NULL,
    granted_at        timestamp with time zone NOT NULL,
    granted_by        text NOT NULL,
    status            text NOT NULL DEFAULT 'active',
    superseded_by     bigint REFERENCES consent_grant(id),
    notes             text,
    created_at        timestamp with time zone NOT NULL DEFAULT now()
  )
`;

await sql`CREATE INDEX IF NOT EXISTS consent_grant_voice_key_idx ON consent_grant(voice_key)`;
await sql`CREATE INDEX IF NOT EXISTS consent_grant_status_idx ON consent_grant(status)`;

// ── consent_withdrawal ─────────────────────────────────────────────────────
// One row per revocation event.
// §5.2: right of withdrawal; ledger is the propagation mechanism.
// A withdrawal marks the grant and all downstream content for removal.

await sql`
  CREATE TABLE IF NOT EXISTS consent_withdrawal (
    id                bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    grant_id          bigint NOT NULL REFERENCES consent_grant(id),
    withdrawn_by      text NOT NULL,
    withdrawn_at      timestamp with time zone NOT NULL,
    reason            text NOT NULL,
    scope_affected    jsonb NOT NULL DEFAULT '{}',
    propagation_log   jsonb NOT NULL DEFAULT '[]',
    created_at        timestamp with time zone NOT NULL DEFAULT now()
  )
`;

await sql`CREATE INDEX IF NOT EXISTS consent_withdrawal_grant_id_idx ON consent_withdrawal(grant_id)`;

console.log('Migration complete: consent_grant and consent_withdrawal tables created.');
