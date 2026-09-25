// scripts/fix-seed-volva-provenance.mjs
//
// ONE-TIME CORRECTION, same pattern as scripts/fix-seed-corpus-review-status.mjs
// and the 2026-09-20 audit that rejected stoa/sufi/mekubal seed rows for the
// identical defect. That audit never reached volva — found this session
// (2026-09-24) while investigating whether the norse corpus could be
// approved pipeline-wide for Beat-2 purposes.
//
// The five volva rows in scripts/seed-corpus.json (vol-001..005) carry
// review_status='approved' but NO _provenance block. Two of the five
// (vol-004 "Ragnarok as Necessary Dissolution", vol-005 "The Shadow of the
// Wyrd") read as modern applied-psychology commentary, not any actual
// Poetic Edda passage -- the same category of problem that got sto-001/
// 002/004/005 and mek-001..005 rejected. vol-001/002/003 read as closer
// paraphrase of genuine Voluspa/Havamal content, but per the SAME standard
// already applied to sto-003 (rejected solely for lacking a _provenance
// block despite reading as the most authentic of the five stoa rows), lack
// of provenance is disqualifying on its own, regardless of how genuine the
// paraphrase sounds.
//
// This script rejects all five, the same way the existing 2026-09-20 audit
// rejected the sto-*/suf-004/mek-* rows -- it does NOT touch the actual fix
// (real ingestion). corpus/norse-poetic-edda-passages-STAGED.json and the
// other 4 norse corpus files ARE properly provenanced (real translators,
// public domain, source_url) and were confirmed clean by direct inspection
// this session -- the real fix is running the existing single-door tool
// against them:
//
//   python3 scripts-resilience/ingest.py corpus/norse-poetic-edda-passages-STAGED.json
//   python3 scripts-resilience/ingest.py corpus/norse-edda-passages-STAGED.json
//   python3 scripts-resilience/ingest.py corpus/norse-edda-skaldskaparmal-STAGED.json
//   python3 scripts-resilience/ingest.py corpus/norse-colum-passages-STAGED.json
//   python3 scripts-resilience/ingest.py corpus/norse-passages-STAGED.json
//
// (requires VOYAGE_API_KEY and DATABASE_URL in .env.local, same as
// ingest:mekubal already does). Run THIS script first or after, order
// doesn't matter -- they touch disjoint passage_ids.
//
// This script has NOT been run against any database. Jesse: review the
// specific vol-004/005 bodies below before running -- if you disagree
// they're fabricated commentary rather than acceptable paraphrase, don't
// run this as-is.
//
// Usage:
//   node scripts/fix-seed-volva-provenance.mjs

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

const REJECTIONS = {
  'vol-001': {
    reason:
      "Found in a follow-up to the 2026-09-20 corpus audit (that audit never reached volva): no _provenance block (no translator, year, or source_url). Body paraphrases genuine Voluspa content (Ymir, the primordial void) reasonably closely, but per the same standard applied to sto-003 (rejected on lack-of-provenance alone despite reading as the most authentic of the five stoa rows), a plausible paraphrase without a verifiable source is not sufficient. review_status changed from 'approved' (self-approved with no provenance) to 'rejected' so the build gate blocks it. corpus/norse-poetic-edda-passages-STAGED.json already has this exact material properly sourced (Bellows, 1923) -- use that instead.",
  },
  'vol-002': {
    reason:
      "No _provenance block. Body closely paraphrases the genuine Havamal 139-140 self-sacrifice stanzas ('hung on the wind-swept tree... myself to myself'), but same gap as vol-001: no verifiable source. review_status changed to 'rejected'. corpus/norse-poetic-edda-passages-STAGED.json has the real Bellows translation of these exact stanzas.",
  },
  'vol-003': {
    reason:
      "No _provenance block. Body paraphrases genuine Voluspa Norns material (Urd/Verdandi/Skuld, the well watering Yggdrasil), same gap as vol-001/002. review_status changed to 'rejected'. corpus/norse-poetic-edda-passages-STAGED.json has this material properly sourced.",
  },
  'vol-004': {
    reason:
      "Found in a follow-up to the 2026-09-20 corpus audit: no _provenance block, AND the section title 'Ragnarok as Necessary Dissolution' and body ('The seeress does not speak of Ragnarok with dread... What collapses is the world that could no longer hold') are modern applied-psychology commentary in this project's own interpretive voice, not a translation or close paraphrase of any actual Voluspa passage -- the identical category of problem that got sto-002/004 and mek-001..004 rejected (unsourced modern gloss blended in as if it were the primary text). review_status changed to 'rejected'. If this interpretive framing is wanted, it belongs in Beat-2/reading-generation prompting where it can be labeled as such, not as a corpus passage citable via CORPUS: markers.",
  },
  'vol-005': {
    reason:
      "Same defect as vol-004: no _provenance, and 'The Shadow of the Wyrd' / 'a father's silence, a mother's grief, a people's wound that never healed' is modern therapeutic-applied-mythopoetics commentary, not Poetic Edda content, sourced or otherwise. review_status changed to 'rejected'.",
  },
};

async function main() {
  const ids = Object.keys(REJECTIONS);
  console.log('Checking current state of the five volva passages...\n');

  const before = await sql`
    SELECT passage_id, review_status, reviewed_by, (embedding IS NOT NULL) AS has_embedding
    FROM corpus_passage
    WHERE passage_id = ANY(${ids});
  `;

  if (before.length === 0) {
    console.log('No matching rows found -- these passages were never seeded into this database. Nothing to correct.');
    return;
  }
  console.table(before);

  for (const [passageId, { reason }] of Object.entries(REJECTIONS)) {
    await sql`
      UPDATE corpus_passage
      SET review_status = 'rejected',
          embedding = NULL,
          updated_at = now()
      WHERE passage_id = ${passageId};
    `;
    // _flag isn't a real column on corpus_passage in the schema this repo
    // ships (scripts-resilience/schema.sql) -- the _flag objects seen on
    // sto-*/suf-004/mek-* rows in scripts/seed-corpus.json live only in
    // that JSON file, not the database, so there is nothing to write here
    // beyond review_status/embedding. Leaving `reason` unused at the SQL
    // layer is intentional; it exists so this script's own source is a
    // readable audit trail, same purpose the JSON _flag objects serve.
    void reason;
  }

  const after = await sql`
    SELECT passage_id, review_status, reviewed_by, (embedding IS NOT NULL) AS has_embedding
    FROM corpus_passage
    WHERE passage_id = ANY(${ids})
    ORDER BY passage_id;
  `;
  console.log('\nAfter correction:');
  console.table(after);

  const stillRetrievable = await sql`
    SELECT passage_id FROM retrievable_passage WHERE passage_id = ANY(${ids});
  `;
  console.log(
    stillRetrievable.length === 0
      ? '\nConfirmed: none of the five passages are in retrievable_passage anymore.'
      : `\nWARNING: ${stillRetrievable.length} passage(s) still showing in retrievable_passage: ${stillRetrievable.map(r => r.passage_id).join(', ')}`
  );
  console.log(
    '\nReminder: this only retires the contaminated placeholder rows. Run ' +
      'the ingest.py commands in this file\'s header comment to load the ' +
      'real, properly-sourced norse corpus.'
  );
}

main().catch(err => {
  console.error('Correction script failed:', err);
  process.exit(1);
});
