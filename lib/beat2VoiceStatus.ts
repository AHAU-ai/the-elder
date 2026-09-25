import type { VoiceKey } from '@/src/resilience/flags';
import { DEFAULT_FLAGS } from '@/src/resilience/flags';

// Single source of truth for Beat-2 probing-instrument governance, per
// voice. This is not documentation of a decision made elsewhere — it IS
// the decision. lib/beat2Instrument.ts imports this and refuses (throws at
// module load, not just at CI time) to let an instrument exist for, or an
// allowlist entry apply to, any voice not explicitly marked 'reviewed'
// here. docs/beat2-instrument-voice-review.md renders this registry in
// prose for humans; scripts/check-beat2-instrument.mjs verifies that
// rendering hasn't drifted from this file.
//
// Statuses:
//   'reviewed'        — instrument may ship live (BEAT2_REVIEWED_VOICES may
//                        include this voice). Requires reviewedBy + reviewedDate.
//   'drafted'         — questions authored in BEAT2_INSTRUMENTS, NOT yet
//                        reviewed. May not appear in BEAT2_REVIEWED_VOICES.
//   'queued'          — corpus judged clean enough to draft from; nobody
//                        has drafted yet. May not have a BEAT2_INSTRUMENTS entry.
//   'hold'            — corpus may be clean, but a real named accountability
//                        holder should be involved before ANY draft is
//                        authored, self-review alone is not enough. May not
//                        have a BEAT2_INSTRUMENTS entry.
//   'blocked'         — must not be drafted or reviewed until reason is
//                        resolved (thin/compromised corpus, retracted
//                        tradition-bearer, unrelated pre-existing gap,
//                        unapproved/STAGED-only corpus). May not have a
//                        BEAT2_INSTRUMENTS entry.
//   'not_applicable'  — no single tradition to derive from (default voice).
export type Beat2Status =
  | 'reviewed'
  | 'drafted'
  | 'queued'
  | 'hold'
  | 'blocked'
  | 'not_applicable';

export interface Beat2VoiceRecord {
  readonly status: Beat2Status;
  readonly reason: string;
  readonly corpusFile?: string;
  readonly corpusEntries?: number;
  readonly cautionFlags?: number;
  readonly reviewedBy?: string;
  readonly reviewedDate?: string; // YYYY-MM-DD
}

// Every voiceKey lineageToVoiceKey.ts can produce MUST have a record here —
// see the completeness assertion at the bottom of this file, which throws
// at import time if one is missing (fail-closed, not fail-open).
export const BEAT2_VOICE_REGISTRY: Readonly<Record<string, Beat2VoiceRecord>> = {
  ojer_tzij: {
    status: 'drafted',
    reason:
      'Four questions derived from the ten-theses material (reciprocity, ' +
      'container-for-the-wound, failure-as-teacher, ritual participation). ' +
      'Pending real review with Vincent Stanzione, the only voice with ' +
      'confirmed, verified tradition-bearer authorization.',
  },
  stoa: {
    status: 'drafted',
    reason:
      'Four questions derived directly from corpus/stoic-passages.json ' +
      '(dichotomy of control, the inner citadel, memento mori, anger as ' +
      'self-inflicted). Pending self-review sign-off.',
    corpusFile: 'corpus/stoic-passages.json',
    corpusEntries: 22,
    cautionFlags: 0,
  },
  sage_of_the_way: {
    status: 'drafted',
    reason:
      'Four questions derived directly from corpus/taoist-passages.json ' +
      '(wu-wei, water over stone, small beginnings, identity of contraries). ' +
      'Pending self-review sign-off.',
    corpusFile: 'corpus/taoist-passages.json',
    corpusEntries: 15,
    cautionFlags: 1,
  },
  hem_netjer: {
    status: 'drafted',
    reason:
      'Four questions derived directly from corpus/egyptian-passages.json ' +
      '(the negative confession, the weighing of the heart, the secret ' +
      'name, the field of reeds as continuation not escape). Pending ' +
      'self-review sign-off.',
    corpusFile: 'corpus/egyptian-passages.json',
    corpusEntries: 15,
    cautionFlags: 0,
  },
  pythia: {
    status: 'drafted',
    reason:
      'RESOLVED 2026-09-24: this voice had NO registry record at all until ' +
      'now -- a real gap in this registry itself (missed since the first ' +
      'draft; caught only once BEAT2_VOICE_REGISTRY was checked against ' +
      'src/resilience/flags.ts\'s full 14-voice DEFAULT_FLAGS.voices list, ' +
      'which this file now does automatically at import time -- see the ' +
      'completeness assertion below). No dedicated corpus/greek-*.json ' +
      'file existed either; the only prior material was 5 DB-seeded rows ' +
      'in scripts/seed-corpus.json sharing the identical defect found in ' +
      'volva\'s seed rows (no _provenance, reads as modern applied-' +
      'mythopoetics commentary rather than translated primary text -- see ' +
      'scripts/fix-seed-pythia-provenance.mjs, not yet run). Resolved the ' +
      'same way as babalawo: fetched real public-domain primary sources ' +
      'and built corpus/greek-passages.json from them -- Herodotus\'s ' +
      'Croesus episode (Macaulay/Rawlinson-tradition translations, PD), ' +
      'Sophocles\' Oedipus the King (Jebb, 1904/1917, PD), and the Homeric ' +
      'Hymn to Apollo (Evelyn-White, 1914 Loeb, PD). Four questions ' +
      'derived, phrased in the Pythia\'s established register (lib/' +
      'lineages.ts: "she names, she does not interpret... never be ' +
      'Socratic") rather than the softer therapeutic phrasing used for ' +
      'other voices. Pending self-review sign-off.',
    corpusFile: 'corpus/greek-passages.json',
    corpusEntries: 12,
    cautionFlags: 0,
  },
  sufi: {
    status: 'drafted',
    reason:
      'Four questions derived directly from corpus/sufi-passages.json + ' +
      'sufi-hafiz-ibnarabi-passages.json (love as the astrolabe pointing ' +
      'beyond itself, pain of heart as evidence, the false bazaar, ' +
      'pilgrimage as self toward self). Pending self-review sign-off.',
    corpusFile: 'corpus/sufi-passages.json + corpus/sufi-hafiz-ibnarabi-passages.json',
    corpusEntries: 17,
    cautionFlags: 0,
  },
  vedic: {
    status: 'drafted',
    reason:
      'Four questions derived from the primary-source Rigveda/Upanishad ' +
      'entries specifically (Griffith, Bloomfield, Hume translations), not ' +
      'the 6 flagged Wilkins entries -- those are self-labeled "narrative-' +
      'style compilation, interpretive rather than a direct primary-text ' +
      'translation," a mild sourcing caution, not a content or ethics ' +
      'problem. Questions: self-knowledge by the self (Muller\u2019s Atman ' +
      'preface), the fullness within mirroring the space without (Chandogya ' +
      '3.12.7-9), Brahma in every direction (Mundaka 2.2.11), inherited ' +
      'treasure from the fathers (Rigveda VII.18). Pending self-review ' +
      'sign-off.',
    corpusFile: 'corpus/vedic-passages.json',
    corpusEntries: 27,
    cautionFlags: 6,
  },
  mekubal: {
    status: 'hold',
    reason:
      'Investigated further 2026-09-24: the corpus (corpus/mekubal-' +
      'passages.json) is raw Aramaic Zohar text with no English ' +
      'translation in the data at all -- each entry is individually ' +
      'reviewed_by "Getzel Davis" at the ingestion level, but deriving new ' +
      'Beat-2 questions from it would require translating/interpreting ' +
      'Zoharic Kabbalah directly, a materially different and higher-stakes ' +
      'task than self-reviewing an existing English translation (as done ' +
      'for stoa/sage_of_the_way/hem_netjer/sufi/vedic/volva). This is not ' +
      'attempted. Do not draft until Jesse decides how to involve Getzel ' +
      'Davis specifically for this -- e.g. asking him to supply or ' +
      'react to candidate questions himself, rather than self-review of ' +
      'someone else\'s translation.',
    corpusFile: 'corpus/mekubal-passages.json',
    corpusEntries: 10,
    cautionFlags: 0,
  },
  bhikkhu: {
    status: 'blocked',
    reason:
      "Investigated further 2026-09-24: lib/voiceKeyToTraditionSlug.ts's " +
      "own comment confirms this is not an oversight -- bhikkhu's " +
      'TRADITION_MAP entry (canon anchors, forbidden list) was ' +
      'deliberately never authored because it requires a real Theravada ' +
      'lineage holder\'s input, per this project\'s own Lineage Integrity ' +
      'of Voice principle. Same category of gap as babalawo/dreamtime ' +
      '(tradition boundary needs a real tradition-bearer, not to be ' +
      'invented here), surfacing through a different mechanism (guardian ' +
      'review skip rather than corpus content). Confirmed correctly ' +
      'blocked, not just overlooked.',
    corpusFile: 'corpus/buddhist-passages.json',
    corpusEntries: 18,
    cautionFlags: 3,
  },
  babalawo: {
    status: 'drafted',
    reason:
      'RESOLVED 2026-09-24: the original corpus (8 entries, half colonial-' +
      'outsider-sourced) was too thin to derive from. Fetched and added 4 ' +
      'new entries from Samuel Johnson\'s "The History of the Yorubas" ' +
      '(1921, public domain) Chapter I -- a genuine insider oral-historical ' +
      'source (Johnson was a Yoruba Anglican priest drawing directly on ' +
      'the hereditary bardic families retained by the King at Oyo as ' +
      'national historians, per his own stated methodology), not colonial ' +
      'ethnography. A prior session had already flagged this exact chapter ' +
      'as unextracted; this session extracted it. Four questions derived: ' +
      'Oranyan\'s land inheritance (hidden value in what looks like the ' +
      'least of the family\'s wealth), the cock scattering earth on the ' +
      'water (small acts from near-nothing), the Olowu and the crown he ' +
      'wouldn\'t let go of (claiming, not just inheriting), Oduduwa\'s exile ' +
      'and founding at Ile-Ife (displacement becoming origin). Named ' +
      'tradition-bearer (Fama Aina Udoyi) remains a retracted fabrication ' +
      'and is not relied on here at all -- this resolution rests entirely ' +
      'on Johnson\'s own public-domain, insider-authored text. Pending ' +
      'self-review sign-off, same as every other drafted voice.',
    corpusFile: 'corpus/babalawo-passages.json',
    corpusEntries: 12,
    cautionFlags: 4,
  },
  elder_of_country: {
    status: 'blocked',
    reason:
      'All 9 corpus entries caution-flagged (corpus itself unapproved, ' +
      'STAGED-only). Aboriginal Australian tradition carries real-world ' +
      'sacred/secret-content restrictions; named tradition-bearer (Barbara ' +
      'Randall) was also retracted. Stronger than a review gap: recommend ' +
      'not self-review-deriving this one at all without real, consenting ' +
      'community involvement.',
    corpusFile: 'corpus/dreamtime-passages-STAGED.json',
    corpusEntries: 9,
    cautionFlags: 9,
  },
  volva: {
    status: 'drafted',
    reason:
      'Jesse approved the norse corpus pipeline-wide (2026-09-24) after ' +
      'investigation confirmed corpus/norse-*-STAGED.json content itself ' +
      'is clean (614 entries, individually "approved", 0 caution flags, ' +
      'real translators/public domain). Four questions derived directly ' +
      'from that corpus (Hávamál 138-140 self-sacrifice on the tree, ' +
      'Hávamál 77-78 fame outlasting the self, Völuspá 19-20 the Norns/' +
      'well of Urd, Völuspá 59 the earth rising green after Ragnarök). ' +
      'Pending self-review sign-off. NOTE: this status covers Beat-2 only. ' +
      'A SEPARATE, still-open issue was found in the same investigation: ' +
      'the DB-seeded corpus_passage rows for volva (scripts/seed-corpus.json, ' +
      'used by the unrelated retrieval/citation pipeline in ' +
      'lib/corpusRetrieval.ts) have no _provenance block, and 2 of 5 read ' +
      'as modern commentary mislabeled as Poetic Edda -- the same defect a ' +
      '2026-09-20 audit already found and rejected for stoa/sufi/mekubal. ' +
      'That audit never actually reached volva (or vedic/babalawo/' +
      'elder_of_country/pythia/keeper_of_the_fire -- none of those six were ' +
      'checked either). Currently dormant either way: that retrieval ' +
      'pipeline is wired to mekubal only, so nothing live is affected, but ' +
      'it should be fixed before norse retrieval is ever turned on.',
    corpusFile: 'corpus/norse-*-STAGED.json (5 files)',
    corpusEntries: 614,
    cautionFlags: 0,
  },
  chukchi_shaman: {
    status: 'blocked',
    reason:
      "Explicitly scaffolding-only per lib/lineages.ts's own comment; no " +
      'tradition-bearer has reviewed or authorized this entry at all.',
  },
  keeper_of_the_fire: {
    status: 'not_applicable',
    reason: 'Default voice, not a specific tradition — out of scope for a per-tradition instrument.',
  },
};

/** Read-only lookup; undefined means no registry record exists at all. */
export function beat2VoiceStatus(voiceKey: string): Beat2VoiceRecord | undefined {
  return BEAT2_VOICE_REGISTRY[voiceKey];
}

// ─── Fail-closed invariants, enforced at import time ───────────────────────
// These throw on module load (not just in a CI script) so a violation
// breaks `next dev`/`next build`/any test importing this module directly —
// not only a probe someone has to remember to run.

function assertRegistryInvariants(): void {
  const problems: string[] = [];
  for (const [voiceKey, record] of Object.entries(BEAT2_VOICE_REGISTRY)) {
    if (record.status === 'reviewed' && (!record.reviewedBy || !record.reviewedDate)) {
      problems.push(
        `${voiceKey}: status 'reviewed' requires both reviewedBy and reviewedDate to be set.`
      );
    }
  }

  // Completeness check, added 2026-09-24 after 'pythia' was found to have
  // had NO registry record at all since this file's very first draft --
  // a real gap that went unnoticed through every subsequent pass because
  // nothing ever checked the registry against the actual full voice set.
  // src/resilience/flags.ts's DEFAULT_FLAGS.voices is that full set (every
  // VoiceKey the app actually knows about, including bhikkhu/chukchi_shaman,
  // which lib/traditions.ts's older TRADITION_MAP predates and excludes --
  // see lib/voiceKeyToTraditionSlug.ts's own comment on that gap). A voice
  // present there but absent here would silently be ungoverned by Beat-2
  // entirely -- neither drafted, held, blocked, nor N/A -- rather than
  // safely defaulting to "no instrument" the way an explicit 'blocked'
  // record does. Fail loudly instead.
  for (const voiceKey of Object.keys(DEFAULT_FLAGS.voices) as VoiceKey[]) {
    if (!(voiceKey in BEAT2_VOICE_REGISTRY)) {
      problems.push(
        `${voiceKey}: present in src/resilience/flags.ts's DEFAULT_FLAGS.voices ` +
          `but has NO record in BEAT2_VOICE_REGISTRY at all.`
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(
      'lib/beat2VoiceStatus.ts: registry invariant violation(s):\n' +
        problems.map(p => '  - ' + p).join('\n')
    );
  }
}

assertRegistryInvariants();
