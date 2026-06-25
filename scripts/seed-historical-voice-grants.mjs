import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

const voices = [
  ['Greek Oracular', 'pythia'],
  ['Norse', 'volva'],
  ['Egyptian', 'hem_netjer'],
  ['Stoic', 'stoa'],
  ['Taoist', 'sage_of_the_way'],
  ['K\'iche\' Maya Ajq\'ij', 'ajqij'],
  ['Default/Keeper', 'keeper_of_the_fire'],
  ['Vedic', 'vedic'],
  ['Sufi', 'sufi'],
];

for (const [tradition, voiceKey] of voices) {
  await sql`INSERT INTO consent_grant (tradition, voice_key, holder_name, holder_role, scope, scope_detail, version, granted_at, granted_by, status, notes) VALUES (${tradition}, ${voiceKey}, 'Temporal Bridges Institute', 'Field governance authorization', ${'Use of ' + tradition + ' tradition in The Elder instrument'}, '{}'::jsonb, '1.0', '2026-01-01T00:00:00Z', 'Jesse Barber / Temporal Bridges Institute', 'active', 'Initial operational grant.')`;
  console.log('Inserted: ' + voiceKey);
}
console.log('Done.');
