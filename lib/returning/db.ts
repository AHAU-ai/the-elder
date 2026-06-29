// lib/returning/db.ts
// Matches the repo's established pattern (lib/consentLedger.ts, app/api/altar/route.ts):
// neon() from @neondatabase/serverless with tagged-template queries.
import { neon } from "@neondatabase/serverless";

export const sql = neon(process.env.DATABASE_URL!);
