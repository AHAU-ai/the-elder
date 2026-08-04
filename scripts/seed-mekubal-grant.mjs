import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

// Grant: Getzel Davis — Jewish Kabbalah / mekubal
await sql`
  INSERT INTO consent_grant (
    tradition, voice_key, holder_name, holder_role,
    scope, scope_detail, version,
    granted_at, granted_by, status, notes
  ) VALUES (
    'Jewish Kabbalah',
    'mekubal',
    'Getzel Davis',
    'Mekubal lineage accountability holder',
    'Use of Jewish Kabbalah mythological field in The Elder instrument, including Zohar and Sefer Yetzirah references, the Sefirot/Tree of Life framework, and Mekubal transmission vocabulary',
    '{"instrument": "the-elder", "voices": ["mekubal"], "activated": "2026-07-15", "excludes": ["practical Kabbalah / theurgic formulas", "divine Names for use", "halachic rulings"]}',
    '1.0',
    '2026-07-15T00:00:00Z',
    'Jesse Barber / Temporal Bridges Institute',
    'active',
    'Lineage review completed July 15 2026. Voice activated in production on that date.'
  )
`;

console.log('Seed complete: 1 consent grant inserted (mekubal).');
