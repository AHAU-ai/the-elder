import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

// Grant: Shalom Ormsby — Theravada Buddhist / bhikkhu
await sql`
  INSERT INTO consent_grant (
    tradition, voice_key, holder_name, holder_role,
    scope, scope_detail, version,
    granted_at, granted_by, status, notes
  ) VALUES (
    'Theravada Buddhist',
    'bhikkhu',
    'Shalom Ormsby',
    'Bhikkhu lineage accountability holder',
    'Use of the Theravada Buddhist mythological field in The Elder instrument, including the Pali Canon, the Dhammapada, the Four Noble Truths, and the Noble Eightfold Path',
    '{"instrument": "the-elder", "voices": ["bhikkhu"], "activated": "2026-07-31", "excludes": ["ordination or refuge transmission", "Mahayana/Vajrayana framing", "meditation instruction beyond pointing toward a teacher"]}',
    '1.0',
    '2026-07-31T00:00:00Z',
    'Jesse Barber / Temporal Bridges Institute',
    'active',
    'Lineage review completed July 31 2026. Voice activated in production on that date.'
  )
`;

console.log('Seed complete: 1 consent grant inserted (bhikkhu).');
