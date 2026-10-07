// Judge-call behavior under infrastructure trouble (dualGuardReading with an
// injected fake client). Run: tsx lib/dualGuardian.judge.test.ts
import assert from 'node:assert/strict';
import { dualGuardReading } from './dualGuardian';

const PASS = { content: [{ type: 'text', text: '{"passed": true, "violations": []}' }] };
const ctx = { voiceKey: 'kiche', reading: 'The seed went under and the corn kept its count.', seekerInput: 'grief' };

type Step = 'pass' | 'hang' | { status?: number };
function fakeClient(script: () => Step) {
  const state = { calls: 0 };
  const client = {
    messages: {
      create: (_p: unknown, o?: { signal?: AbortSignal }) => {
        state.calls++;
        const s = script();
        if (s === 'pass') return Promise.resolve(PASS);
        if (s === 'hang') {
          return new Promise((_res, rej) => o?.signal?.addEventListener('abort', () => rej(new Error('Request was aborted.'))));
        }
        return Promise.reject(Object.assign(new Error('api error'), { status: s.status }));
      },
    },
  };
  return { client: client as never, state };
}
async function t(name: string, fn: () => Promise<void>) { await fn(); console.log(`  ok  ${name}`); }

async function main() {
  await t('both judges pass -> cleared', async () => {
    const { client, state } = fakeClient(() => 'pass');
    const v = await dualGuardReading(ctx, { client, timeoutMs: 500 });
    assert.equal(v.passed, true);
    assert.equal(state.calls, 2);
  });

  await t('a transient 529 on each judge is retried once and clears', async () => {
    let n = 0;
    const { client, state } = fakeClient(() => { n++; return n <= 2 ? { status: 529 } : 'pass'; });
    const v = await dualGuardReading(ctx, { client, timeoutMs: 2000 });
    assert.equal(v.passed, true);
    assert.equal(state.calls, 4); // 2 judges x (fail + retry)
  });

  await t('a persistent 529 fails closed as infrastructure after one retry per judge', async () => {
    const { client, state } = fakeClient(() => ({ status: 529 }));
    const v = await dualGuardReading(ctx, { client, timeoutMs: 2000 });
    assert.equal(v.passed, false);
    assert.equal((v as { failureMode: string }).failureMode, 'infrastructure');
    assert.equal(state.calls, 4);
  });

  await t('a timeout fails closed and is NOT retried', async () => {
    const { client, state } = fakeClient(() => 'hang');
    const t0 = Date.now();
    const v = await dualGuardReading(ctx, { client, timeoutMs: 80 });
    assert.equal(v.passed, false);
    assert.equal((v as { failureMode: string }).failureMode, 'infrastructure');
    assert.equal(state.calls, 2); // one call per judge, no retry
    assert.ok(Date.now() - t0 < 1000);
  });

  await t('a non-transient 401 fails closed without a retry', async () => {
    const { client, state } = fakeClient(() => ({ status: 401 }));
    const v = await dualGuardReading(ctx, { client, timeoutMs: 2000 });
    assert.equal(v.passed, false);
    assert.equal(state.calls, 2);
  });

  console.log('All dualGuardian judge tests passed.');
}
main().catch((e) => { console.error(e); process.exit(1); });
