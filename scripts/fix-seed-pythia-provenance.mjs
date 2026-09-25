// scripts/fix-seed-pythia-provenance.mjs
//
// ONE-TIME CORRECTION, same pattern as scripts/fix-seed-corpus-review-status.mjs
// and scripts/fix-seed-volva-provenance.mjs. The 2026-09-20 audit that
// rejected stoa/sufi/mekubal seed rows never reached pythia -- found this
// session (2026-09-24) while resolving pythia's Beat-2 instrument.
//
// The five pythia rows in scripts/seed-corpus.json (pyt-001..005) carry
// review_status='approved' but NO _provenance block. All five read as
// modern applied-mythopoetics commentary wearing a citation, not translated
// primary text:
//   - pyt-001 ("Delphic Tradition — The Two Maxims") opens with the two
//     real, attested Delphic inscriptions (gnothi seauton, meden agan) but
//     wraps them in unsourced modern framing ("These were not decorations.
//     They were the entire teaching...").
//   - pyt-002 ("Sophocles — Oedipus Rex") is not a translation of anything
//     Sophocles wrote -- it is modern commentary ("This is the Greek
//     teaching about fate and choice...") citing the play as its source.
//   - pyt-003 ("Aeschylus — The Oresteia") likewise: modern commentary on
//     inherited trauma, not a rendering of any actual Oresteia passage.
//   - pyt-004 ("Eleusinian Mysteries — The Descent of Persephone") and
//     pyt-005 ("Delphic Oracle — The Pronouncement Structure") are the same
//     pattern again -- interpretive prose citing a real tradition by name
//     without translating or quoting anything from it.
// This is the identical category of problem that got sto-001/002/004/005,
// suf-004, mek-001..005 rejected, and vol-001..005 flagged in
// fix-seed-volva-provenance.mjs.
//
// This script rejects all five, the same way the existing audit rejected
// the sto-*/suf-004/mek-* rows. It does NOT touch the real fix: this
// session already built corpus/greek-passages.json from genuine public-
// domain sources (Herodotus, Sophocles/Jebb, the Homeric Hymn to Apollo/
// Evelyn-White) for the Beat-2 instrument itself. Ingesting that file into
// the DB-backed retrieval pipeline (lib/corpusRetrieval.ts, currently wired
// to mekubal only) would use the same single-door tool as always:
//
//   python3 scripts-resilience/ingest.py corpus/greek-passages.json
//
// (requires VOYAGE_API_KEY and DATABASE_URL in .env.local, same as
// ingest:mekubal already does).
//
// This script has NOT been run against any database. Jesse: review the
// specific pyt-002/003/004/005 judgment calls below before running -- if
// you disagree they're fabricated commentary rather than acceptable
// paraphrase, don't run this as-is.
//
// Usage:
//   node scripts/fix-seed-pythia-provenance.mjs

import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

const REJECTIONS = {
  'pyt-001': {
    reason:
      "No _provenance block. The two maxims quoted (gnothi seauton, meden agan) are genuinely attested Delphic inscriptions, but the surrounding framing ('These were not decorations. They were the entire teaching...') is unsourced modern commentary, not a translation of any period source. review_status changed from 'approved' (self-approved with no provenance) to 'rejected' so the build gate blocks it. corpus/greek-passages.json (built 2026-09-24) has real, properly-sourced material for this voice -- use that pattern instead.",
  },
  'pyt-002': {
    reason:
      "Cited as 'Sophocles — Oedipus Rex' but contains no translated or quoted text from the play at all -- it is modern interpretive commentary about the play's themes ('This is the Greek teaching about fate and choice: the oracle does not compel...'), the same category of problem that got sto-002/004 and mek-001..004 rejected (unsourced modern gloss blended in as if it were the primary text). review_status changed to 'rejected'.",
  },
  'pyt-003': {
    reason:
      "Cited as 'Aeschylus — The Oresteia' with the same defect as pyt-002: no translated or quoted text, only modern commentary on inherited trauma framed as if it were the source. review_status changed to 'rejected'.",
  },
  'pyt-004': {
    reason:
      "Cited as 'Eleusinian Mysteries — The Descent of Persephone' with the same defect: interpretive prose about the Mysteries' meaning, not a rendering of the Homeric Hymn to Demeter or any other primary source. review_status changed to 'rejected'.",
  },
  'pyt-005': {
    reason:
      "Cited as 'Delphic Oracle — The Pronouncement Structure' with the same defect: a description of how the Pythia supposedly worked, written in modern analytical prose, not sourced from Plutarch, Herodotus, or any attested account. review_status changed to 'rejected'.",
  },
};

async function main() {
  const ids = Object.keys(REJECTIONS);
  console.log('Checking current state of the five pythia passages...\n');

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
    // _flag isn't a real column on corpus_passage (see the identical note
    // in fix-seed-volva-provenance.mjs) -- reason exists as an audit trail
    // in this script's own source, same purpose the JSON _flag objects
    // serve on the sto-*/suf-004/mek-* rows.
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
      '`python3 scripts-resilience/ingest.py corpus/greek-passages.json` to ' +
      'load the real, properly-sourced material this session built.'
  );
}

main().catch(err => {
  console.error('Correction script failed:', err);
  process.exit(1);
});
