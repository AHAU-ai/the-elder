/**
 * figureMapping.integration.test.ts -- ledger tests for Figure Continuity
 * (migration 030, lib/returning/figureMapping.ts). Covers the spec's ledger
 * cases: T1 cap, T2 expiry, T3 release, P6 cross-user confirm, P7 replay,
 * plus the races the build plan's steelman names (concurrent confirms,
 * concurrent offers, cap under concurrency) and the D9 release rule.
 *
 * Requires a live DATABASE_URL pointing at a DEV branch with migration 030
 * applied -- an integration test, not a hermetic one (same category as
 * tests/coreMythStatement.integration.test.ts).
 * Run: npx tsx -r dotenv/config tests/figureMapping.integration.test.ts dotenv_config_path=.env.local
 *
 * Creates and deletes its own throwaway elder_user rows (cascade removes
 * their mappings); never touches real seeker data.
 */
import { randomUUID } from 'node:crypto';
import { sql } from '../lib/returning/db';
import { assertDevDatabase } from './support/devDatabaseGuard';
import {
  createOffer,
  confirmOffer,
  declineOffer,
  listConfirmed,
  removeMapping,
  releaseMappingsForChain,
  releaseAllMappings,
  releaseMappingsIfChainEmpty,
  purgeExpiredOffers,
  MAX_CONFIRMED_MAPPINGS,
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

/** A chain of one visit with a confirmed figure, the way confirm-marker leaves it. */
async function newChain(userId: number, lineageKey = 'ojer_tzij'): Promise<string> {
  const chainId = randomUUID();
  await sql`
    INSERT INTO visit_record (user_id, chain_id, visit_mode, lineage_key, myth_title, elder_response, markers_confirmed)
    VALUES (${userId}, ${chainId}, 'explore', ${lineageKey}, 'The Twins', 'test reading', ${JSON.stringify({ figure: 'The Hero Twin' })}::jsonb)
  `;
  return chainId;
}
// tsconfig is not strict, so `.ok` does not narrow the result unions; read the reason through a helper.
const reasonOf = (r: object): string | undefined => ('reason' in r ? String((r as { reason: unknown }).reason) : undefined);
const offerOf = (subject: string, counterpart: string): OfferInput => ({
  kind: 'person',
  subject,
  counterpart,
  basis: 'model_report',
});

async function newUser(tag: string): Promise<number> {
  const [row] = await sql`
    INSERT INTO elder_user (email) VALUES (${`figure-map-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.invalid`})
    RETURNING id
  `;
  return Number(row.id);
}

const countRows = async (userId: number, status?: string) => {
  const rows = status
    ? await sql`SELECT count(*)::int AS n FROM figure_mapping WHERE user_id = ${userId} AND status = ${status}`
    : await sql`SELECT count(*)::int AS n FROM figure_mapping WHERE user_id = ${userId}`;
  return rows[0].n as number;
};

async function offerAndConfirm(userId: number, chainId: string, subject: string, counterpart: string) {
  const o = await createOffer(userId, chainId, offerOf(subject, counterpart));
  if (!o.ok) throw new Error('setup offer failed: ' + reasonOf(o));
  const c = await confirmOffer(userId, o.id);
  if (!c.ok || c.outcome !== 'confirmed') throw new Error('setup confirm failed');
  return o.id;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL required for this integration test.');
    process.exit(1);
  }
  assertDevDatabase(); // these suites create and delete rows: never production (exit 2 = safety stop, not a verdict)

  const users: number[] = [];
  try {
    const A = await newUser('a'); users.push(A);
    const B = await newUser('b'); users.push(B);
    const chain1 = await newChain(A);
    const chain2 = await newChain(A);

    // ── basic loop: offer -> confirm -> list ───────────────────────────
    const o1 = await createOffer(A, chain1, offerOf('my sister', 'the Maize Maiden'));
    check('createOffer returns an id', o1.ok && o1.id > 0);
    if (!o1.ok) throw new Error('cannot continue without an offer');
    check('an offer is not listed as confirmed', (await listConfirmed(A, chain1, 10))?.length === 0);
    const c1 = await confirmOffer(A, o1.id);
    check('confirm: confirmed', c1.ok && c1.outcome === 'confirmed');
    const listed = await listConfirmed(A, chain1, 10);
    check('confirmed mapping is listed with its labels', listed?.length === 1 && listed[0].subjectLabel === 'my sister' && listed[0].counterpartLabel === 'the Maize Maiden');

    // ── P7: replayed confirm is idempotent ─────────────────────────────
    const replay = await confirmOffer(A, o1.id);
    check('P7 replay: neutral noop', replay.ok && replay.outcome === 'noop');
    check('P7 replay: exactly one confirmed row', (await countRows(A, 'confirmed')) === 1);

    // ── P6: another user cannot confirm, decline or remove my rows ─────
    const o2 = await createOffer(A, chain2, offerOf('the move', 'the Descent'));
    if (!o2.ok) throw new Error('offer 2 failed');
    const forged = await confirmOffer(B, o2.id);
    check('P6 forged confirm: noop', forged.ok && forged.outcome === 'noop');
    const forgedDecline = await declineOffer(B, o2.id);
    check('P6 forged decline: deletes nothing', forgedDecline.ok && forgedDecline.count === 0);
    const forgedRemove = await removeMapping(B, o1.id);
    check('P6 forged remove: deletes nothing', forgedRemove.ok && forgedRemove.count === 0);
    check('P6: A still holds the offer and the mapping', (await countRows(A)) === 2);
    check('P6: B holds nothing', (await countRows(B)) === 0);
    check('P6: B cannot list A\'s chain', (await listConfirmed(B, chain1, 10))?.length === 0);

    // ── unknown / junk ids are neutral ─────────────────────────────────
    for (const bad of [0, -1, 1.5, Number.NaN, 9e15, 99999999999]) {
      const r = await confirmOffer(A, bad);
      check(`junk id ${bad}: noop`, r.ok && r.outcome === 'noop');
    }

    // ── decline deletes the offer and leaves no tombstone ──────────────
    const dec = await declineOffer(A, o2.id);
    check('decline: removed one row', dec.ok && dec.count === 1);
    check('decline: no tombstone, row is gone', (await countRows(A, 'offered')) === 0);
    const decConfirmed = await declineOffer(A, o1.id);
    check('decline never deletes a confirmed mapping', decConfirmed.ok && decConfirmed.count === 0 && (await countRows(A, 'confirmed')) === 1);

    // ── one outstanding offer per user and chain ───────────────────────
    const a1 = await createOffer(A, chain2, offerOf('my boss', 'the Lord of Xibalba'));
    const a2 = await createOffer(A, chain2, offerOf('my brother', 'the Elder Twin'));
    check('a newer offer replaces the older unconfirmed one', a1.ok && a2.ok && (await countRows(A, 'offered')) === 1);
    const remaining = await sql`SELECT subject_label FROM figure_mapping WHERE user_id = ${A} AND status = 'offered'`;
    check('the surviving offer is the newest', remaining[0]?.subject_label === 'my brother');
    // an offer on a different chain does not displace it
    const otherChain = await createOffer(A, chain1, offerOf('my friend', 'the Messenger Owl'));
    check('an offer on another chain coexists', otherChain.ok && (await countRows(A, 'offered')) === 2);
    await sql`DELETE FROM figure_mapping WHERE user_id = ${A} AND status = 'offered'`;

    // ── duplicate of an already-confirmed pairing ──────────────────────
    const dupe = await createOffer(A, chain1, offerOf('MY SISTER', 'the maize maiden'));
    check('offering an already-confirmed pairing (case-insensitive) is a duplicate', reasonOf(dupe) === 'duplicate');
    check('...and leaves the confirmed row alone', (await countRows(A, 'confirmed')) === 1);

    // ── input validation fails closed, writes nothing ──────────────────
    const NUL = String.fromCodePoint(0);
    const bads: Array<[string, OfferInput]> = [
      ['empty subject', offerOf('   ', 'x')],
      ['over-long subject', offerOf('s'.repeat(61), 'x')],
      ['over-long counterpart', offerOf('s', 'c'.repeat(81))],
      ['control-only subject', offerOf(NUL, 'x')],
      ['bad kind', { ...offerOf('s', 'c'), kind: 'dragon' as unknown as 'person' }],
      ['bad basis', { ...offerOf('s', 'c'), basis: 'vibes' as unknown as 'corpus' }],
    ];
    for (const [name, offer] of bads) {
      const r = await createOffer(A, chain1, offer);
      check(`invalid (${name}): rejected`, reasonOf(r) === 'invalid');
    }
    check('invalid offers wrote nothing', (await countRows(A, 'offered')) === 0);
    const cleaned = await createOffer(A, chain2, offerOf('  my   mother' + NUL + ' ', 'the Grandmother'));
    check('labels are sanitized on write', cleaned.ok);
    const stored = await sql`SELECT subject_label FROM figure_mapping WHERE user_id = ${A} AND status = 'offered'`;
    check('stored label is cleaned', stored[0]?.subject_label === 'my mother');
    await sql`DELETE FROM figure_mapping WHERE user_id = ${A} AND status = 'offered'`;

    // ── T2: an offer older than 24h cannot be confirmed ────────────────
    const stale = await createOffer(A, chain2, offerOf('the old house', 'the Ballcourt'));
    if (!stale.ok) throw new Error('stale offer failed');
    await sql`UPDATE figure_mapping SET created_at = now() - interval '25 hours' WHERE id = ${stale.id}`;
    const staleConfirm = await confirmOffer(A, stale.id);
    check('T2 expired offer: confirm is a noop', staleConfirm.ok && staleConfirm.outcome === 'noop');
    check('T2: nothing was confirmed', (await countRows(A, 'confirmed')) === 1);
    await purgeExpiredOffers(A);
    check('T2: expired offer is purged lazily', (await countRows(A, 'offered')) === 0);

    // ── concurrent confirms of the SAME offer: exactly one winner ──────
    const race = await createOffer(A, chain2, offerOf('my cousin', 'the Parrot'));
    if (!race.ok) throw new Error('race offer failed');
    const racers = await Promise.all([confirmOffer(A, race.id), confirmOffer(A, race.id), confirmOffer(A, race.id)]);
    const winners = racers.filter(r => r.ok && r.outcome === 'confirmed').length;
    check('concurrent confirms: exactly one wins', winners === 1);
    check('concurrent confirms: exactly one new confirmed row', (await countRows(A, 'confirmed')) === 2);

    // ── concurrent offers on the same chain: at most one stays live ────
    const offerRaceUser = await newUser('offerrace'); users.push(offerRaceUser);
    const rc = await newChain(offerRaceUser);
    const offerRace = await Promise.all(
      ['one', 'two', 'three', 'four'].map(n => createOffer(offerRaceUser, rc, offerOf(`subject ${n}`, `counterpart ${n}`)))
    );
    check('concurrent offers: never more than one live offer for the chain', (await countRows(offerRaceUser, 'offered')) <= 1);
    check('concurrent offers: at least one succeeded', offerRace.some(r => r.ok));
    check('concurrent offers: losers are named, not thrown', offerRace.every(r => r.ok || reasonOf(r) === 'conflict'));

    // ── T1: cap. Nothing is evicted; a named outcome is returned ───────
    const capUser = await newUser('cap'); users.push(capUser);
    const capChain = await newChain(capUser);
    await sql`
      INSERT INTO figure_mapping
        (user_id, chain_id, lineage_key, myth_title, figure_label, subject_kind, subject_label, counterpart_label, counterpart_basis, status, confirmed_at)
      SELECT ${capUser}, ${capChain}, 'ojer_tzij', 'The Twins', 'The Hero Twin', 'person',
             'subject ' || g, 'counterpart ' || g, 'model_report', 'confirmed', now() - (g || ' minutes')::interval
      FROM generate_series(1, ${MAX_CONFIRMED_MAPPINGS - 1}) AS g
    `;
    check('cap setup: one below the cap', (await countRows(capUser, 'confirmed')) === MAX_CONFIRMED_MAPPINGS - 1);
    const lastOne = await offerAndConfirm(capUser, capChain, 'the thirtieth', 'the Last Door');
    check('T1: the 30th confirm succeeds', lastOne > 0 && (await countRows(capUser, 'confirmed')) === MAX_CONFIRMED_MAPPINGS);
    const over = await createOffer(capUser, capChain, offerOf('the thirty-first', 'the Extra Door'));
    if (!over.ok) throw new Error('over-cap offer failed');
    const capped = await confirmOffer(capUser, over.id);
    check('T1: the 31st confirm is capReached', capped.ok && capped.outcome === 'capReached');
    check('T1: nothing evicted', (await countRows(capUser, 'confirmed')) === MAX_CONFIRMED_MAPPINGS);
    check('T1: the offer stays pending, not silently confirmed or deleted', (await countRows(capUser, 'offered')) === 1);
    await removeMapping(capUser, lastOne);
    const afterRoom = await confirmOffer(capUser, over.id);
    check('T1: after the seeker removes one, the same offer confirms', afterRoom.ok && afterRoom.outcome === 'confirmed');

    // ── cap under concurrency: two offers, one slot ────────────────────
    const slotUser = await newUser('slot'); users.push(slotUser);
    await sql`
      INSERT INTO figure_mapping
        (user_id, chain_id, lineage_key, myth_title, figure_label, subject_kind, subject_label, counterpart_label, counterpart_basis, status, confirmed_at)
      SELECT ${slotUser}, ${randomUUID()}, 'ojer_tzij', 'The Twins', 'The Hero Twin', 'person',
             'subject ' || g, 'counterpart ' || g, 'model_report', 'confirmed', now()
      FROM generate_series(1, ${MAX_CONFIRMED_MAPPINGS - 1}) AS g
    `;
    const s1 = await createOffer(slotUser, await newChain(slotUser), offerOf('first claimant', 'a door'));
    const s2 = await createOffer(slotUser, await newChain(slotUser), offerOf('second claimant', 'another door'));
    if (!s1.ok || !s2.ok) throw new Error('slot offers failed');
    const slotRace = await Promise.all([confirmOffer(slotUser, s1.id), confirmOffer(slotUser, s2.id)]);
    check('cap race: exactly one of two concurrent confirms wins', slotRace.filter(r => r.ok && r.outcome === 'confirmed').length === 1);
    check('cap race: the other is capReached', slotRace.filter(r => r.ok && r.outcome === 'capReached').length === 1);
    check('cap race: never exceeds the cap', (await countRows(slotUser, 'confirmed')) === MAX_CONFIRMED_MAPPINGS);

    // ── T3: release paths ──────────────────────────────────────────────
    const relUser = await newUser('rel'); users.push(relUser);
    const rcA = await newChain(relUser);
    const rcB = await newChain(relUser);
    await offerAndConfirm(relUser, rcA, 'my sister', 'the Maize Maiden');
    await offerAndConfirm(relUser, rcA, 'my brother', 'the Elder Twin');
    await offerAndConfirm(relUser, rcB, 'the move', 'the Descent');
    await createOffer(relUser, rcA, offerOf('a pending one', 'the Owl'));
    const rm = await removeMapping(relUser, (await listConfirmed(relUser, rcA, 10))![0].id);
    check('T3 per-mapping remove deletes exactly one', rm.ok && rm.count === 1 && (await countRows(relUser, 'confirmed')) === 2);
    const relChain = await releaseMappingsForChain(relUser, rcA);
    check('T3 chain release deletes that chain\'s mappings AND its pending offer', relChain.ok && relChain.count === 2 && (await countRows(relUser)) === 1);
    check('T3 chain release leaves the other chain alone', (await listConfirmed(relUser, rcB, 10))?.length === 1);
    const relAll = await releaseAllMappings(relUser);
    check('T3 release-all deletes everything this user holds', relAll.ok && relAll.count === 1 && (await countRows(relUser)) === 0);
    check('T3 release-all did not touch another user', (await countRows(A)) > 0);

    // ── D9: a chain left with no visits loses its mappings ─────────────
    const d9User = await newUser('d9'); users.push(d9User);
    const d9Chain = await newChain(d9User);
    await offerAndConfirm(d9User, d9Chain, 'my aunt', 'the Weaver');
    const stillHasVisit = await releaseMappingsIfChainEmpty(d9User, d9Chain);
    check('D9: chain with a visit keeps its mappings', stillHasVisit.ok && stillHasVisit.count === 0 && (await countRows(d9User)) === 1);
    await sql`DELETE FROM visit_record WHERE user_id = ${d9User} AND chain_id = ${d9Chain}`;
    const orphaned = await releaseMappingsIfChainEmpty(d9User, d9Chain);
    check('D9: chain with no visits left loses its mappings', orphaned.ok && orphaned.count === 1 && (await countRows(d9User)) === 0);

    // ── cascade: deleting the account removes mappings ─────────────────
    const gone = await newUser('gone');
    await offerAndConfirm(gone, await newChain(gone), 'my teacher', 'the Wise Owl');
    await sql`DELETE FROM elder_user WHERE id = ${gone}`;
    const orphanRows = await sql`SELECT count(*)::int AS n FROM figure_mapping WHERE user_id = ${gone}`;
    check('account deletion cascades to mappings', orphanRows[0].n === 0);

    // ── a user with no chains cannot attach an offer to anything ───────
    const ghost = await createOffer(2147483000, randomUUID(), offerOf('nobody', 'no one'));
    check('an offer for a user and chain that do not exist is no_chain', reasonOf(ghost) === 'no_chain');
  } finally {
    for (const id of users) {
      try { await sql`DELETE FROM elder_user WHERE id = ${id}`; } catch { /* best-effort cleanup */ }
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log('\nfigureMapping integration: all passed');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
