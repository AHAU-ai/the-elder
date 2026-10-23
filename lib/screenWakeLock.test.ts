import assert from 'node:assert/strict';
import { keepScreenAwake, type WakeLockHost, type WakeLockSentinelLike } from './screenWakeLock';

const tick = () => new Promise((r) => setTimeout(r, 0));

function makeHost(visible = true, supported = true) {
  const sentinels: Array<WakeLockSentinelLike & { released: boolean; fireRelease(): void }> = [];
  let visListener: (() => void) | null = null;
  const state = { visibilityState: visible ? 'visible' : 'hidden', requests: 0, failNext: false };
  const host: WakeLockHost = {
    navigator: supported ? {
      wakeLock: {
        async request() {
          state.requests++;
          if (state.failNext) { state.failNext = false; throw new Error('denied'); }
          let cb: (() => void) | null = null;
          const s = {
            released: false,
            async release() { s.released = true; },
            addEventListener(_t: 'release', l: () => void) { cb = l; },
            fireRelease() { s.released = true; cb?.(); },
          };
          sentinels.push(s);
          return s;
        },
      },
    } : {},
    document: {
      get visibilityState() { return state.visibilityState; },
      addEventListener(_t, l) { visListener = l; },
      removeEventListener(_t, l) { if (visListener === l) visListener = null; },
    } as WakeLockHost['document'],
  };
  return { host, state, sentinels, fireVisibility: () => visListener?.(), hasListener: () => visListener !== null };
}

async function main() {
  // Acquires once on start; a visibility event while held does not stack a second request.
  {
    const h = makeHost();
    const stop = keepScreenAwake(h.host);
    await tick();
    assert.equal(h.state.requests, 1);
    h.fireVisibility();
    await tick();
    assert.equal(h.state.requests, 1, 'no stacking while held');
    stop();
    assert.equal(h.sentinels[0].released, true, 'released on stop');
    assert.equal(h.hasListener(), false, 'listener removed on stop');
  }

  // A lock the browser releases while visible is taken back.
  {
    const h = makeHost();
    const stop = keepScreenAwake(h.host);
    await tick();
    h.sentinels[0].fireRelease();
    await tick();
    assert.equal(h.state.requests, 2, 're-requested after release');
    assert.equal(h.sentinels[1].released, false);
    stop();
  }

  // Released while hidden: not re-requested until the page is visible again.
  {
    const h = makeHost();
    const stop = keepScreenAwake(h.host);
    await tick();
    h.state.visibilityState = 'hidden';
    h.sentinels[0].fireRelease();
    await tick();
    assert.equal(h.state.requests, 1, 'nothing requested while hidden');
    h.state.visibilityState = 'visible';
    h.fireVisibility();
    await tick();
    assert.equal(h.state.requests, 2, 'back on screen: re-acquired');
    stop();
  }

  // A denied request fails silent and is retried at the next visibility change.
  {
    const h = makeHost();
    h.state.failNext = true;
    const stop = keepScreenAwake(h.host);
    await tick();
    assert.equal(h.sentinels.length, 0);
    h.fireVisibility();
    await tick();
    assert.equal(h.sentinels.length, 1, 'retried after a denial');
    stop();
  }

  // Unsupported devices and stopping before the request settles are harmless.
  {
    const h = makeHost(true, false);
    keepScreenAwake(h.host)();
    await tick();
    assert.equal(h.state.requests, 0);

    const g = makeHost();
    const stop = keepScreenAwake(g.host);
    stop(); // before the request resolves
    await tick();
    assert.equal(g.sentinels[0].released, true, 'a late lock is released at once');
  }

  console.log('screenWakeLock: ok');
}
main();
