import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

// Grant 1: Dr. Vincent James Stanzione — K'iche' Maya / ojer_tzij
await sql`
  INSERT INTO consent_grant (
    tradition, voice_key, holder_name, holder_role,
    scope, scope_detail, version,
    granted_at, granted_by, status, notes
  ) VALUES (
    'K''iche'' Maya',
    'ojer_tzij',
    'Dr. Vincent James Stanzione',
    'Lineage accountability holder; translator of Nim Nuna Oj (Popol Wuj, Ximénez manuscript)',
    'Use of K''iche'' Maya mythological field in The Elder instrument, including Popol Wuj passages from Nim Nuna Oj, Chol Q''ij daysign system, and Ajq''ija'' transmission vocabulary',
    '{"corpus_slug": "popol-wuj-ojer-tzij-kiche-1554-1558", "instrument": "the-elder", "voices": ["ojer_tzij", "ajqij"], "excludes": ["living ceremony detail", "proprietary ritual content"]}',
    '1.0',
    '2026-01-01T00:00:00Z',
    'Jesse Barber / Temporal Bridges Institute',
    'active',
    'Initial grant. Stanzione is sign-off authority for all ojer_tzij and ajqij production changes per ELDER governance record.'
  )
`;

// Grant 2: Fama Aina Udoyi — Yorùbá Ifá / babalawo
await sql`
  INSERT INTO consent_grant (
    tradition, voice_key, holder_name, holder_role,
    scope, scope_detail, version,
    granted_at, granted_by, status, notes
  ) VALUES (
    'Yorùbá Ifá',
    'babalawo',
    'Fama Aina Udoyi',
    'Babalawo lineage accountability holder',
    'Use of Yorùbá Ifá mythological field in The Elder instrument, including Odù structure, Eshu-Elegba crossroads framework, and Ifá divination vocabulary',
    '{"instrument": "the-elder", "voices": ["babalawo"], "activated": "2026-06-16", "excludes": ["proprietary Odù texts", "initiated ceremony detail"]}',
    '1.0',
    '2026-06-16T00:00:00Z',
    'Jesse Barber / Temporal Bridges Institute',
    'active',
    'Lineage review completed June 16 2026. Voice activated in production on that date.'
  )
`;

console.log('Seed complete: 2 consent grants inserted.');
