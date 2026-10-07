#!/usr/bin/env -S npx tsx
/**
 * figure-continuity-probe.ts -- runs the Figure Continuity model-facing probes
 * (tests/probes/figureContinuityProbes.ts) against a RUNNING server, with the
 * real model, and reports a pass RATE per probe.
 *
 * What it needs (the CI workflow .github/workflows/figure-continuity.yml sets all of it):
 *   - a running app (default http://localhost:3000) started with the three
 *     feature gates lit (FIGURE_CONTINUITY_ENABLED, MARKER_CONFIRMATION_READY,
 *     FIGURE_CONTINUITY_RELEASE_VERIFIED = true), ANTHROPIC_API_KEY,
 *     ELDER_CORPUS_VERSION, a high RATE_LIMIT_PER_DAY, and the SAME
 *     ELDER_SESSION_SECRET and DATABASE_URL as this script;
 *   - DATABASE_URL naming a DEV/TEST branch (migration 030 applied). The script
 *     creates and deletes throwaway seekers, so it REFUSES production
 *     (tests/support/devDatabaseGuard.ts; exit 2).
 *
 * Each probe seeds a fresh seeker with a chain and a confirmed figure, asks, judges
 * the response, and reads back what was stored. It runs `attempts` times and must
 * reach `minPass`. A response that never reached the model (HTTP 429/5xx, a
 * dropped connection, the route's "model unreachable" silence) is INFRASTRUCTURE,
 * retried and then reported as such; it is never scored as a verdict.
 *
 * Exit codes:  0 every probe met its pass rate
 *              1 at least one probe FAILED (a governance verdict)
 *              2 safety stop (refused a production database, or a bad setup); nothing was judged
 *              3 infrastructure failure only: no verdict failures, but some probes could not run
 *
 * Usage:
 *   npx tsx scripts/figure-continuity-probe.ts                run everything
 *   npx tsx scripts/figure-continuity-probe.ts --only P1,P3   run some
 *   npx tsx scripts/figure-continuity-probe.ts --attempts 5   override attempts (raises minPass proportionally)
 *   npx tsx scripts/figure-continuity-probe.ts --raw          the MODEL-ONLY probes: the real assembled prompt sent straight to the
 *                                                             model (no server, no guardian, no database; needs only ANTHROPIC_API_KEY)
 *   npx tsx scripts/figure-continuity-probe.ts --list         list probes, no network
 *   npx tsx scripts/figure-continuity-probe.ts --dry-run      validate and print the plan, no network, no database
 */
import { appendFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt } from '../lib/system-prompt-builder';
import { composeNarrativeBlock } from '../lib/narrativeForm';
import { lineageToVoiceKey } from '../lib/lineageToVoiceKey';
import { renderFigureContinuity } from '../lib/figureContinuityClause';
import { extractMappingOffer } from '../lib/returning/mappingSignal';
import { PRIMARY_MODEL } from '../lib/model.config';
import type { LineageKey } from '../lib/lineages';
import { signSession, SESSION_COOKIE } from '../lib/auth';
import { assertDevDatabase } from '../tests/support/devDatabaseGuard';
import {
  PROBES,
  LENGTH_TOLERANCE,
  lengthenedByFeature,
  DETERMINISTIC_COVERAGE,
  type Probe,
  type ProbeContext,
  type DivineResponse,
  type PairingRowLite,
} from '../tests/probes/figureContinuityProbes';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const valueOf = (name: string): string | null => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
};

const BASE_URL = process.env.ELDER_URL || 'http://localhost:3000';
const REPORT_PATH = valueOf('--report') || process.env.FIGURE_PROBE_REPORT || 'figure-continuity-probe-report.json';
const FLAKE_LOG = process.env.FLAKE_LOG || null;
const REQUEST_TIMEOUT_MS = 110_000; // /api/divine's own worst case is ~95s
const JUDGE_MODEL = 'claude-haiku-4-5-20251001';

const only = valueOf('--only')?.split(',').map(s => s.trim()).filter(Boolean) ?? null;
const attemptsOverride = valueOf('--attempts') ? Number(valueOf('--attempts')) : null;
const noFigure = flag('--no-figure');
const rawMode = flag('--raw');

function selectProbes(): Probe[] {
  let chosen = only ? PROBES.filter(p => only.includes(p.id)) : PROBES;
  if (rawMode) chosen = chosen.filter(p => p.raw);
  // A CONTROL run: the same requests with the feature off (the seeker does not choose to continue as the
  // figure). Used to attribute guardian declines and length to the figure clause or to the voice itself.
  if (noFigure) chosen = chosen.map(p => ({ ...p, figureContinue: false, informational: true, title: 'CONTROL (feature off): ' + p.title }));
  if (only) {
    const unknown = only.filter(id => !PROBES.some(p => p.id === id));
    if (unknown.length) { console.error(`Unknown probe id(s): ${unknown.join(', ')}. Known: ${PROBES.map(p => p.id).join(', ')}`); process.exit(2); }
  }
  if (attemptsOverride !== null) {
    if (!Number.isInteger(attemptsOverride) || attemptsOverride < 1 || attemptsOverride > 20) { console.error('--attempts must be an integer from 1 to 20'); process.exit(2); }
    // keep the SAME strictness: a strict probe stays "all attempts must pass"
    return chosen.map(p => ({ ...p, minPass: p.minPass === p.attempts ? attemptsOverride : Math.max(1, Math.ceil((p.minPass / p.attempts) * attemptsOverride)), attempts: attemptsOverride }));
  }
  return chosen;
}

if (flag('--list')) {
  for (const p of PROBES) console.log(`${p.id.padEnd(4)} ${p.attempts}x need ${p.minPass}  [${p.guards.join(', ')}]  ${p.title}`);
  console.log('\nProven deterministically (not model-dependent):');
  for (const d of DETERMINISTIC_COVERAGE) console.log(`${d.id.padEnd(4)} ${d.what}  -> ${d.where}`);
  process.exit(0);
}

const probes = selectProbes();

if (flag('--dry-run')) {
  console.log(`Plan: ${probes.length} probe(s) against ${BASE_URL} (no request is made).`);
  for (const p of probes) console.log(`  ${p.id}: ${p.attempts} attempt(s), need ${p.minPass}; ${p.signedIn ? 'signed in' : 'signed out'}, ${p.register}, ${p.lineage}; ${p.rationale}`);
  process.exit(0);
}

// ── safety first: refuse production BEFORE touching anything ───────────
// Raw mode never touches the database or a server, so it needs neither the guard nor the session secret.
if (!rawMode) {
  assertDevDatabase();
  if (!process.env.ELDER_SESSION_SECRET) { console.error('ELDER_SESSION_SECRET is required (the same value the server was started with).'); process.exit(2); }
} else if (!process.env.ANTHROPIC_API_KEY) {
  console.error('--raw needs ANTHROPIC_API_KEY.');
  process.exit(2);
}
let sqlClient: NeonQueryFunction<false, false> | null = null;
const db = () => (sqlClient ??= neon(process.env.DATABASE_URL as string));

// ── seeding ────────────────────────────────────────────────────────────
const PRIOR_READING = 'The fire has carried you to the threshold of your own story. Something in the silence between you and another is still burning, and the one who went down has not yet come back up.';
const createdUsers: number[] = [];

async function seedSeeker(p: Probe) {
  const [u] = await db()`INSERT INTO elder_user (email) VALUES (${`figure-probe-${p.id.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.invalid`}) RETURNING id`;
  const uid = Number(u.id);
  createdUsers.push(uid);
  await db()`UPDATE elder_user SET tier = 'kept', narrative_register = ${p.register} WHERE id = ${uid}`;
  const chainId = randomUUID();
  await db()`INSERT INTO visit_record (user_id, chain_id, visit_mode, lineage_key, myth_title, archetype, elder_response, markers_confirmed)
            VALUES (${uid}, ${chainId}, 'explore', ${p.lineage}, 'The Descent', 'The Descent', ${PRIOR_READING}, ${JSON.stringify({ figure: p.figure })}::jsonb)`;
  for (const s of p.seedConfirmed ?? []) {
    await db()`INSERT INTO figure_mapping (user_id, chain_id, lineage_key, myth_title, figure_label, subject_kind, subject_label, counterpart_label, counterpart_basis, status, confirmed_at)
              VALUES (${uid}, ${chainId}, ${p.lineage}, 'The Descent', ${p.figure}, 'person', ${s.subject}, ${s.counterpart}, 'model_report', 'confirmed', now())`;
  }
  return { uid, chainId };
}

// ── calling the app ────────────────────────────────────────────────────
interface Raw { status: number; json: DivineResponse | null; infra: string | null }

async function callDivine(p: Probe, uid: number | null): Promise<Raw> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    // /api/divine rate limits per IP; each probe request looks like its own visitor
    'x-forwarded-for': `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
  };
  if (p.signedIn && uid) headers.cookie = `${SESSION_COOKIE}=${signSession(uid)}`;
  const body = JSON.stringify({
    messages: p.messages,
    lineageKey: p.lineage,
    mode: 'reading',
    chainAction: 'deepen',
    figureContinue: p.figureContinue !== false,
    narrativeRegister: p.register,
  });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/api/divine`, { method: 'POST', headers, body, signal: ctl.signal });
    const raw = await res.text();
    let json: DivineResponse | null = null;
    try { json = JSON.parse(raw) as DivineResponse; } catch { /* HTML shell (route still compiling) or a proxy page */ }
    if (res.status === 429) return { status: res.status, json, infra: 'HTTP 429: the daily limiter is exhausted for this runner' };
    if (res.status >= 500) return { status: res.status, json, infra: `HTTP ${res.status}` };
    if (!json) return { status: res.status, json, infra: 'the response was not JSON (the route may still be compiling)' };
    const silenced = (json as { _infra?: { silenced?: boolean; failureClass?: string } })._infra;
    if (silenced?.silenced) return { status: res.status, json, infra: `the model was unreachable (${silenced.failureClass ?? 'model_error'})` };
    return { status: res.status, json, infra: null };
  } catch (err) {
    return { status: 0, json: null, infra: `the request failed: ${(err as Error).name === 'AbortError' ? `timed out after ${REQUEST_TIMEOUT_MS / 1000}s` : (err as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}

// ── the RAW path: the real prompt, straight to the model ───────────────
// Assembles the system prompt the route would for a deepen turn with the figure context (the same builder, the same
// clause renderer, the same narrative block), calls the model once, and applies the route's own token stripping and
// signal parsing. There is no server, welfare gate, dual guardian or database in the way, so EVERY attempt
// exercises the model (a route-level probe can pass on a guardian decline without the model being exercised).
const SEGMENT_MORE = String.fromCharCode(0x29c1, 0x29c1) + 'MORE' + String.fromCharCode(0x29c1, 0x29c1);
const READY = String.fromCharCode(0x29c1, 0x29c1) + 'READY' + String.fromCharCode(0x29c1, 0x29c1);
const D = String.fromCharCode(0x29c1);
let anthropic: Anthropic | null = null;

async function callRaw(p: Probe): Promise<Raw> {
  anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const voiceKey = lineageToVoiceKey(p.lineage);
  const figureBlock = p.figureContinue === false
    ? ''
    : renderFigureContinuity({
        figureLabel: p.figure,
        mythTitle: 'The Descent',
        mappings: (p.seedConfirmed ?? []).map(s => ({ subjectLabel: s.subject, counterpartLabel: s.counterpart, counterpartBasis: 'model_report' as const })),
      });
  const firstUser = p.messages.find(m => m.role === 'user')?.content ?? '';
  const prior = `\u2014 Descent 1 (The Descent) \u2014\n${PRIOR_READING}`;
  const base = buildSystemPrompt(p.lineage as LineageKey, false, true, 'English', prior, '', p.register, '', firstUser, null, figureBlock);
  const system = base + '\n\n' + composeNarrativeBlock(voiceKey, null);
  try {
    const res = await anthropic.messages.create({
      model: PRIMARY_MODEL,
      max_tokens: Number(process.env.MAX_TOKENS || 1200),
      system,
      messages: p.messages.map(m => ({ role: m.role, content: m.content })),
    });
    const block = res.content.find(b => b.type === 'text');
    if (!block || block.type !== 'text') return { status: 0, json: null, infra: 'the model returned no text' };
    // the route's own handling, in the route's own order: the signal first, then the existing tokens
    const extracted = extractMappingOffer(block.text);
    const text = extracted.text
      .replace(READY, '')
      .replace(SEGMENT_MORE, '')
      .replace(new RegExp(D + 'CEILING:[^' + D + ']+' + D, 'g'), '')
      .replace(new RegExp(D + 'MYTH:[^' + D + ']+' + D, 'g'), '')
      .trimStart();
    const offer = extracted.offer;
    return { status: 200, json: { text, ceilingCategory: null, ...(offer ? { mappingOffer: { id: 0, kind: offer.kind, subject: offer.subject, counterpart: offer.counterpart } } : {}) }, infra: null };
  } catch (err) {
    const status = (err as { status?: number }).status ?? 0;
    return { status, json: null, infra: `the model call failed: ${(err as Error).message.slice(0, 160)}` };
  }
}

/** An ADVISORY second opinion on whether a named counterpart exists in a tradition. 'unsure' whenever it cannot be had. */
async function judgeCounterpart(lineage: string, counterpart: string): Promise<'yes' | 'no' | 'unsure'> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return 'unsure';
  const tradition = lineage === 'maya' ? "the K'iche' Maya Popol Wuj" : 'Norse mythology';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: JUDGE_MODEL,
        max_tokens: 40,
        messages: [{ role: 'user', content:
          `In ${tradition}, is "${counterpart.slice(0, 120)}" a character, episode or force that actually appears in the traditional stories? ` +
          'Answer with exactly one word: yes, no, or unsure. Say unsure if you are not certain.' }],
      }),
    });
    if (!res.ok) return 'unsure';
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const word = (data.content?.find(b => b.type === 'text')?.text ?? '').trim().toLowerCase();
    return word.startsWith('yes') ? 'yes' : word.startsWith('no') ? 'no' : 'unsure';
  } catch {
    return 'unsure';
  }
}

// ── running ────────────────────────────────────────────────────────────
interface Attempt { ok: boolean; reasons: string[]; warnings: string[]; ms: number; infra: string | null; snippet?: string; words?: number; guardianDeclined?: boolean }
interface ProbeOutcome { id: string; title: string; verdict: 'PASS' | 'FAIL' | 'INFRA' | 'INFO'; passed: number; attempts: number; needed: number; strict: boolean; results: Attempt[]; rationale: string; declined: number; exercised: number }

async function runAttempt(p: Probe): Promise<Attempt> {
  const started = Date.now();
  // Infrastructure failures are retried; they are not an answer.
  let raw: Raw | null = null;
  let seeded: { uid: number; chainId: string } | null = null;
  for (let tries = 1; tries <= 3; tries++) {
    seeded = !rawMode && p.signedIn ? await seedSeeker(p) : null;
    raw = rawMode ? await callRaw(p) : await callDivine(p, seeded?.uid ?? null);
    if (!raw.infra) break;
    if (tries < 3) await new Promise(r => setTimeout(r, 4000 * tries));
  }
  const r = raw as Raw;
  if (r.infra) return { ok: false, reasons: [], warnings: [], ms: Date.now() - started, infra: r.infra };

  let rows: PairingRowLite[] = [];
  if (seeded) {
    rows = (await db()`SELECT status, subject_label, counterpart_label FROM figure_mapping WHERE user_id = ${seeded.uid} ORDER BY id`) as unknown as PairingRowLite[];
  }
  const ctx: ProbeContext = {
    status: r.status,
    response: r.json,
    rows,
    seededConfirmed: p.seedConfirmed?.length ?? 0,
    judgeCounterpart,
  };
  const verdict = await p.check(ctx);
  // On a failed attempt, keep enough of the response to diagnose it (the probe seekers are throwaway test data).
  const full = String(r.json?.text ?? '').replace(/\s+/g, ' ');
  const delim = String.fromCharCode(0x29c1);
  const at = full.indexOf(delim);
  // if a signal delimiter reached the seeker, show exactly where and what surrounds it: that is the diagnosis
  const around = at >= 0 ? ` || AROUND THE DELIMITER (char ${at}): ...${full.slice(Math.max(0, at - 90), at + 120)}...` : '';
  const snippet = verdict.ok ? undefined
    : `[status ${r.status}, ceiling=${String(r.json?.ceilingCategory ?? null)}, offer=${r.json?.mappingOffer ? 'yes' : 'no'}] ${flag('--full') ? full : full.slice(0, 220)}${around}`;
  return {
    ok: verdict.ok, reasons: verdict.reasons, warnings: verdict.warnings, ms: Date.now() - started, infra: null, snippet,
    words: String(r.json?.text ?? '').trim().split(/\s+/).filter(Boolean).length,
    guardianDeclined: r.json?.ceilingCategory === 'guardian_rejected',
  };
}

async function runProbe(p: Probe): Promise<ProbeOutcome> {
  const results: Attempt[] = [];
  for (let i = 0; i < p.attempts; i++) {
    const a = await runAttempt(p);
    results.push(a);
    const mark = (a.infra ? 'INFRA' : a.ok ? 'pass ' : 'FAIL ') + (a.guardianDeclined ? ' [guardian declined]' : '');
    console.log(`    ${p.id} attempt ${i + 1}/${p.attempts}: ${mark} (${(a.ms / 1000).toFixed(1)}s)${a.infra ? ` ${a.infra}` : ''}${a.reasons.length ? `  <- ${a.reasons.join('; ')}` : ''}${a.warnings.length ? `  (warn: ${a.warnings.join('; ')})` : ''}${a.snippet ? `\n        response: ${a.snippet}` : ''}`);
  }
  const judged = results.filter(r => !r.infra);
  const passed = judged.filter(r => r.ok).length;
  const infraCount = results.length - judged.length;
  const strict = p.minPass === p.attempts;
  let verdict: ProbeOutcome['verdict'];
  if (p.informational) verdict = judged.length === 0 ? 'INFRA' : 'INFO'; // a control or measurement: recorded, never a verdict
  else if (infraCount > 0 && passed + infraCount < p.minPass) verdict = 'INFRA'; // not enough judged attempts to reach a verdict either way
  else if (passed >= p.minPass) verdict = 'PASS';
  else verdict = judged.length === 0 ? 'INFRA' : 'FAIL';
  // A guardian decline is SAFE (it contains no villain-casting, prediction or name) so it passes a safety check,
  // but the clause was not exercised: the pass is the guardian's, not the model's. Count both.
  const declined = judged.filter(r => r.guardianDeclined).length;
  const exercised = judged.filter(r => r.ok && !r.guardianDeclined).length;
  return { id: p.id, title: p.title, verdict, passed, attempts: p.attempts, needed: p.minPass, strict, results, rationale: p.rationale, declined, exercised };
}

async function main() {
  console.log(rawMode
    ? `Figure Continuity RAW probes (the real prompt straight to ${PRIMARY_MODEL}; no route, guardian or database): ${probes.length} probe(s)\n`
    : `Figure Continuity probes against ${BASE_URL}: ${probes.length} probe(s)\n`);
  const outcomes: ProbeOutcome[] = [];
  try {
    for (const p of probes) {
      console.log(`${p.id}  ${p.title}  [${p.guards.join(', ')}]`);
      const o = await runProbe(p);
      outcomes.push(o);
      console.log(`  => ${o.verdict}: ${o.passed}/${o.attempts} passed (need ${o.needed}${o.strict ? ', every attempt' : ''}); guardian declined ${o.declined}/${o.attempts}${o.verdict === 'PASS' && o.exercised < o.needed ? ` -- WARNING: only ${o.exercised} passing attempt(s) actually exercised the model; the rest passed because the guardian declined` : ''}\n`);
      // a passing probe with a failed attempt is real signal: record it as a flake, the repo's best-of-N convention
      if (FLAKE_LOG && o.verdict === 'PASS') {
        for (const [i, a] of o.results.entries()) {
          if (!a.ok && !a.infra) appendFileSync(FLAKE_LOG, JSON.stringify({ script: 'figure-continuity-probe', id: o.id, detail: `attempt ${i + 1}: ${a.reasons.join('; ')}` }) + '\n');
        }
      }
    }
  } finally {
    for (const uid of createdUsers) {
      try { await db()`DELETE FROM elder_user WHERE id = ${uid}`; } catch { /* best effort; the users are throwaway */ }
    }
  }

  // P13 against its control: is an overrun the figure clause, or the voice's ordinary behavior?
  const mean = (o: ProbeOutcome | undefined) => {
    const w = (o?.results ?? []).filter(a => !a.infra && !a.guardianDeclined && typeof a.words === 'number').map(a => a.words as number);
    return w.length ? Math.round(w.reduce((x, y) => x + y, 0) / w.length) : null;
  };
  const declines = (o: ProbeOutcome | undefined) => (o?.results ?? []).filter(a => a.guardianDeclined).length;
  const p13 = outcomes.find(o => o.id === 'P13');
  const p13c = outcomes.find(o => o.id === 'P13c');
  if (p13 && p13c) {
    console.log(`\nP13 vs its control (the same request, feature off): mean words ${mean(p13) ?? 'n/a'} vs ${mean(p13c) ?? 'n/a'}; guardian declines ${declines(p13)}/${p13.attempts} vs ${declines(p13c)}/${p13c.attempts}.`);
    // The real P13 question: did the feature make readings LONGER than the same request without it?
    if (p13.verdict === 'PASS' && lengthenedByFeature(mean(p13), mean(p13c))) {
      p13.verdict = 'FAIL';
      console.log(`P13 FAILED against its control: readings with the feature averaged ${mean(p13)} words, more than ${Math.round((LENGTH_TOLERANCE - 1) * 100)}% over the ${mean(p13c)} without it. The feature lengthened the reading.`);
    }
  }

  const failed = outcomes.filter(o => o.verdict === 'FAIL');
  const infra = outcomes.filter(o => o.verdict === 'INFRA');
  const report = {
    baseUrl: BASE_URL,
    at: new Date().toISOString(),
    summary: { probes: outcomes.length, passed: outcomes.filter(o => o.verdict === 'PASS').length, failed: failed.length, infra: infra.length },
    probes: outcomes,
    deterministicCoverage: DETERMINISTIC_COVERAGE,
  };
  try { writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2)); } catch { /* the console output is the primary record */ }

  console.log('Summary');
  for (const o of outcomes) console.log(`  ${o.verdict.padEnd(5)} ${o.id.padEnd(4)} ${o.passed}/${o.attempts} (need ${o.needed}${o.strict ? ', strict' : ''}) declined ${o.declined}/${o.attempts}  ${o.title}`);
  const totalAttempts = outcomes.reduce((n, o) => n + o.results.filter(r => !r.infra).length, 0);
  const totalDeclined = outcomes.reduce((n, o) => n + o.declined, 0);
  if (totalAttempts > 0) console.log(`\nGuardian declined ${totalDeclined} of ${totalAttempts} judged responses (${Math.round((100 * totalDeclined) / totalAttempts)}%). Compare with --no-figure (the same requests, feature off).`);
  if (failed.length) {
    console.error(`\n${failed.length} probe(s) FAILED. This is a governance verdict: the model was reached and judged.`);
    process.exit(1);
  }
  if (infra.length) {
    console.error(`\n${infra.length} probe(s) could not run (INFRASTRUCTURE, not a verdict): ${infra.map(o => o.id).join(', ')}. Nothing was judged for them.`);
    process.exit(3);
  }
  console.log('\nAll probes met their pass rate.');
}

main().catch(err => {
  console.error('Probe runner crashed:', err);
  process.exit(2);
});
