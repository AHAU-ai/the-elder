/**
 * figureMapping.redteam.test.ts -- adversarial regression suite for the
 * Figure Continuity ledger (lib/returning/figureMapping.ts). Each attack
 * asserts the behavior the spec's guards require; a FAIL line is a gap.
 *
 *   R1  lineage spoof         G3   the chain decides lineage, never the caller
 *   R2  foreign / ghost chain G1   an offer needs a chain the user owns
 *   R3  no confirmed figure   spec the offer's home chain must hold a confirmed figure
 *   R4  confirm after release G12  a released chain's offer must not become a mapping
 *   R5  invisible labels      G13   blank-looking labels are rejected
 *   R6  counterpart forgery   G3   a 'corpus' counterpart must be approved and in-lineage
 *   R7  offer flooding        G6   outstanding offers are bounded per user
 *   R8  large user ids        G9   confirm must not fail on ids above int4
 *   R9  malformed chain id    G9   typed 'invalid', not a driver error
 *   R10 log leakage           G6   labels never reach logs
 *   R11 offer races           G9   one live offer per chain, failures named
 *
 * Requires a live DATABASE_URL pointing at a DEV branch with migration 030.
 * Run: npm run test:figure-mapping-redteam
 */
import { randomUUID } from 'node:crypto';
import { sql } from '../lib/returning/db';
import {
  createOffer,
  confirmOffer,
  MAX_OUTSTANDING_OFFERS,
  type OfferInput,
} from '../lib/returning/figureMapping';

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    console.error(`  FAIL  ${name}`);
    failures++;
  }
}

const reasonOf = (r: object): string | undefined =>
  'reason' in r ? String((r as { reason: unknown }).reason) : undefined;
const isOk = (r: object) => (r as { ok?: boolean }).ok === true;

const offerOf = (subject: string, counterpart: string, extra: Partial<OfferInput> = {}): OfferInput => ({
  kind: 'person',
  subject,
  counterpart,
  basis: 'model_report',
  ...extra,
});

/** Adapter: the one place that knows createOffer's call shape. */
const offerOn = (userId: number, chainId: string, offer: OfferInput) =>
  createOffer(userId, chainId, offer);

async function newUser(tag: string, id?: number): Promise<number> {
  const email = `figure-map-rt-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.invalid`;
  const [row] = id
    ? await sql`INSERT INTO elder_user (id, email) VALUES (${id}, ${email}) RETURNING id`
    : await sql`INSERT INTO elder_user (email) VALUES (${email}) RETURNING id`;
  return Number(row.id);
}

/** A chain of one visit; figure is stored the way confirm-marker stores it. */
async function newChain(userId: number, lineageKey: string, figure: string | null): Promise<string> {
  const chainId = randomUUID();
  const confirmed = figure ? JSON.stringify({ figure }) : null;
  await sql`
    INSERT INTO visit_record (user_id, chain_id, visit_mode, lineage_key, myth_title, elder_response, markers_confirmed)
    VALUES (${userId}, ${chainId}, 'explore', ${lineageKey}, 'The Twins', 'test reading', ${confirmed}::jsonb)
  `;
  return chainId;
}

const rowsFor = async (userId: number) =>
  sql`SELECT lineage_key, status, subject_label, counterpart_passage_id, counterpart_basis FROM figure_mapping WHERE user_id = ${userId}`;

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required for this test.');
    process.exit(1);
  }
  const users: number[] = [];
  try {
    const A = await newUser('a'); users.push(A);
    const B = await newUser('b'); users.push(B);

    // R1 -- the chain's own lineage is what gets stored
    const c1 = await newChain(A, 'ojer_tzij', 'The Hero Twin');
    const r1 = await offerOn(A, c1, offerOf('my sister', 'the Maize Maiden'));
    check('R1 baseline: legitimate offer on an owned chain with a confirmed figure succeeds', isOk(r1));
    const r1rows = await rowsFor(A);
    check('R1 stored lineage_key is the chain\'s own (ojer_tzij)', r1rows.length === 1 && r1rows[0].lineage_key === 'ojer_tzij');
    await sql`DELETE FROM figure_mapping WHERE user_id = ${A}`;

    // R2 -- ghost chain and someone else's chain
    const ghost = await offerOn(A, randomUUID(), offerOf('nobody', 'no one'));
    check('R2 offer on a chain with no visits is refused', !isOk(ghost));
    const bChain = await newChain(B, 'ojer_tzij', 'The Hero Twin');
    const foreign = await offerOn(A, bChain, offerOf('their sister', 'the Maize Maiden'));
    check('R2 offer on ANOTHER user\'s chain is refused', !isOk(foreign));
    check('R2 nothing was written for either', (await rowsFor(A)).length === 0 && (await rowsFor(B)).length === 0);

    // R3 -- chain with no confirmed figure
    const noFig = await newChain(A, 'ojer_tzij', null);
    const r3 = await offerOn(A, noFig, offerOf('my mother', 'the Grandmother'));
    check('R3 offer on a chain with no confirmed figure is refused', !isOk(r3));

    // R4 -- confirm after the chain was released
    const c4 = await newChain(A, 'ojer_tzij', 'The Hero Twin');
    const r4 = await offerOn(A, c4, offerOf('my aunt', 'the Weaver'));
    if (!isOk(r4)) throw new Error('R4 setup offer failed');
    await sql`DELETE FROM visit_record WHERE user_id = ${A} AND chain_id = ${c4}`; // seeker released the reading, mapping cleanup not (yet) run
    const r4c = await confirmOffer(A, (r4 as { id: number }).id);
    check('R4 confirming an offer whose chain was released is a noop', isOk(r4c) && (r4c as { outcome?: string }).outcome === 'noop');
    check('R4 no confirmed mapping survives for a released chain', (await rowsFor(A)).filter(r => r.status === 'confirmed').length === 0);
    await sql`DELETE FROM figure_mapping WHERE user_id = ${A}`;

    // R5 -- blank-looking labels (code points built, not typed)
    const cp = (n: number) => String.fromCodePoint(n);
    const c5 = await newChain(A, 'ojer_tzij', 'The Hero Twin');
    const blanks: Array<[string, string]> = [
      ['hangul filler', cp(0x3164)],
      ['braille blank', cp(0x2800)],
      ['halfwidth hangul filler', cp(0xffa0)],
      ['combining grapheme joiner', cp(0x034f)],
      ['punctuation only', '...'],
      ['emoji only', cp(0x1f525)],
    ];
    for (const [name, text] of blanks) {
      const r = await offerOn(A, c5, offerOf(text, 'the Owl'));
      check(`R5 subject made only of ${name} is refused`, !isOk(r));
      const r2 = await offerOn(A, c5, offerOf('my friend', text));
      check(`R5 counterpart made only of ${name} is refused`, !isOk(r2));
    }
    check('R5 nothing blank-looking was stored', (await rowsFor(A)).length === 0);
    const unicodeOk = await offerOn(A, c5, offerOf('mi hermana', 'la Doncella del Maíz'));
    check('R5 ordinary non-English labels still pass', isOk(unicodeOk));
    await sql`DELETE FROM figure_mapping WHERE user_id = ${A}`;

    // R6 -- counterpart forgery: a 'corpus' passage must be approved and in the chain's lineage
    // Dev has no ojer_tzij corpus, so R6 homes its chain in a lineage that has
    // both approved and unapproved passages (mekubal) and borrows from another.
    const HOME = 'mekubal';
    const approvedOther = await sql`
      SELECT passage_id, lineage_key FROM corpus_passage
      WHERE review_status = 'approved' AND lineage_key IS NOT NULL AND lineage_key <> ${HOME} LIMIT 1`;
    const unapprovedSame = await sql`
      SELECT passage_id FROM corpus_passage
      WHERE review_status <> 'approved' AND lineage_key = ${HOME} LIMIT 1`;
    const approvedSame = await sql`
      SELECT passage_id FROM corpus_passage
      WHERE review_status = 'approved' AND lineage_key = ${HOME} LIMIT 1`;
    const c6 = await newChain(A, HOME, 'The Hero Twin');
    if (approvedOther[0]) {
      const r = await offerOn(A, c6, offerOf('my boss', 'the Lord', { basis: 'corpus', counterpartPassageId: approvedOther[0].passage_id }));
      check('R6 corpus counterpart from ANOTHER lineage is refused (no melting pot)', !isOk(r));
    } else console.log('  skip  R6 cross-lineage passage (no approved passage of another lineage on this DB)');
    if (unapprovedSame[0]) {
      const r = await offerOn(A, c6, offerOf('my boss', 'the Lord', { basis: 'corpus', counterpartPassageId: unapprovedSame[0].passage_id }));
      check('R6 corpus counterpart from an UNAPPROVED passage is refused', !isOk(r));
    } else console.log('  skip  R6 unapproved passage (none of the home lineage on this DB)');
    const noPassage = await offerOn(A, c6, offerOf('my boss', 'the Lord', { basis: 'corpus' }));
    check('R6 basis corpus with no passage id is refused', !isOk(noPassage));
    const fake = await offerOn(A, c6, offerOf('my boss', 'the Lord', { basis: 'corpus', counterpartPassageId: 'no-such-passage-' + randomUUID() }));
    check('R6 basis corpus with a nonexistent passage is refused as invalid, not a db error', !isOk(fake) && reasonOf(fake) === 'invalid');
    if (approvedSame[0]) {
      const good = await offerOn(A, c6, offerOf('my teacher', 'the Wise Owl', { basis: 'corpus', counterpartPassageId: approvedSame[0].passage_id }));
      check('R6 a genuine approved in-lineage passage is accepted', isOk(good));
      const stored = (await rowsFor(A)).find(r => r.subject_label === 'my teacher');
      check('R6 ...and stored as basis corpus with its passage id', stored?.counterpart_basis === 'corpus' && stored?.counterpart_passage_id === approvedSame[0].passage_id);
    }
    const mr = await offerOn(A, c6, offerOf('my cousin', 'the Parrot', { counterpartPassageId: approvedSame[0]?.passage_id ?? 'x' }));
    const mrRow = (await rowsFor(A)).find(r => r.subject_label === 'my cousin');
    check('R6 a model_report offer never stores a passage id', isOk(mr) && mrRow?.counterpart_passage_id === null);
    await sql`DELETE FROM figure_mapping WHERE user_id = ${A}`;

    // R7 -- offer flooding across chains
    const floodUser = await newUser('flood'); users.push(floodUser);
    let accepted = 0;
    for (let i = 0; i < MAX_OUTSTANDING_OFFERS + 8; i++) {
      const chain = await newChain(floodUser, 'ojer_tzij', 'The Hero Twin');
      if (isOk(await offerOn(floodUser, chain, offerOf(`subject ${i}`, `counterpart ${i}`)))) accepted++;
    }
    const liveOffers = (await rowsFor(floodUser)).filter(r => r.status === 'offered').length;
    check(`R7 outstanding offers are capped at ${MAX_OUTSTANDING_OFFERS} per user`, liveOffers <= MAX_OUTSTANDING_OFFERS && accepted <= MAX_OUTSTANDING_OFFERS);

    // R8 -- ids above int4
    const BIG = 3_000_000_000 + Math.floor(Math.random() * 1000);
    const bigUser = await newUser('big', BIG); users.push(bigUser);
    const bigChain = await newChain(bigUser, 'ojer_tzij', 'The Hero Twin');
    const bigOffer = await offerOn(bigUser, bigChain, offerOf('my sister', 'the Maize Maiden'));
    const bigConfirm = bigOffer && isOk(bigOffer) ? await confirmOffer(bigUser, (bigOffer as { id: number }).id) : null;
    check('R8 a user id above 2^31 can confirm an offer', !!bigConfirm && isOk(bigConfirm) && (bigConfirm as { outcome?: string }).outcome === 'confirmed');

    // R9 -- malformed chain ids and user ids
    for (const bad of ['not-a-uuid', '', "'; DROP TABLE figure_mapping;--", '00000000-0000-0000-0000-00000000000z']) {
      const r = await offerOn(A, bad, offerOf('x1', 'y1'));
      check(`R9 chain id ${JSON.stringify(bad).slice(0, 24)} is 'invalid', not a driver error`, !isOk(r) && reasonOf(r) === 'invalid');
    }
    for (const badUser of [Number.NaN, 0, -3, 1.5]) {
      const r = await offerOn(badUser, randomUUID(), offerOf('x1', 'y1'));
      check(`R9 user id ${badUser} is 'invalid'`, !isOk(r) && reasonOf(r) === 'invalid');
    }
    const table = await sql`SELECT to_regclass('public.figure_mapping')::text AS t`;
    check('R9 the table survived the injection attempt', table[0].t === 'figure_mapping');

    // R10 -- logs never contain label text
    const logged: string[] = [];
    const origError = console.error;
    console.error = (...args: unknown[]) => { logged.push(args.map(String).join(' ')); };
    try {
      const SECRET_SUBJECT = 'zq-secret-subject-' + Date.now();
      const SECRET_COUNTERPART = 'zq-secret-counterpart-' + Date.now();
      await offerOn(2_000_000_000 + Math.floor(Math.random() * 1000), randomUUID(), offerOf(SECRET_SUBJECT, SECRET_COUNTERPART)); // FK-violating user
      const leakChain = await newChain(A, 'ojer_tzij', 'The Hero Twin');
      await offerOn(A, leakChain, offerOf(SECRET_SUBJECT, SECRET_COUNTERPART));
      await offerOn(A, leakChain, offerOf(SECRET_SUBJECT, SECRET_COUNTERPART));
      check('R10 no log line contains a stored label', !logged.some(l => l.includes(SECRET_SUBJECT) || l.includes(SECRET_COUNTERPART)));
    } finally {
      console.error = origError;
    }
    await sql`DELETE FROM figure_mapping WHERE user_id = ${A}`;

    // R11 -- concurrent offers on one chain: serialized by the per-user lock,
    // at most one stays live, and any failure is named (never a driver error)
    const raceUser = await newUser('race'); users.push(raceUser);
    for (let round = 0; round < 4; round++) {
      const rc = await newChain(raceUser, 'ojer_tzij', 'The Hero Twin');
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) => offerOn(raceUser, rc, offerOf(`racer ${round}-${i}`, `door ${round}-${i}`)))
      );
      const live = (await sql`SELECT count(*)::int n FROM figure_mapping WHERE user_id = ${raceUser} AND chain_id = ${rc} AND status = 'offered'`)[0].n;
      check(`R11 round ${round}: exactly one live offer remains`, live === 1);
      check(`R11 round ${round}: every result is ok or a named reason`, results.every(r => isOk(r) || ['conflict', 'limit'].includes(reasonOf(r) ?? '')));
    }
  } finally {
    for (const id of users) {
      try { await sql`DELETE FROM elder_user WHERE id = ${id}`; } catch { /* best-effort cleanup */ }
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} red-team check(s) FAILED (gaps).`);
    process.exit(1);
  }
  console.log('\nfigureMapping red-team: all attacks contained');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
