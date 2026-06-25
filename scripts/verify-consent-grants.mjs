import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

const grants = await sql`
  SELECT id, tradition, voice_key, holder_name, version, status, granted_at, notes
  FROM consent_grant
  ORDER BY id
`;

console.log(JSON.stringify(grants, null, 2));
