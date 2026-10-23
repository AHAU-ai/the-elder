// lib/screenWakeLock.ts
//
// Keeps the screen awake for a long sitting (the Fire Meditation), where the
// device supports it. Best-effort and silent: unsupported, denied or failing
// requests never surface.
//
// The browser can release a lock on its own (tab hidden, low battery, system
// policy). A lock that is released is re-requested the next time the page is
// visible, and again straight away if the release happened while it was
// visible. Re-requests are never stacked: at most one is in flight.
//
// Written against minimal structural types so it can be tested without a DOM.

export interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener?(type: 'release', listener: () => void): void;
}

export interface WakeLockHost {
  navigator: { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } };
  document: {
    visibilityState: string;
    addEventListener(type: 'visibilitychange', listener: () => void): void;
    removeEventListener(type: 'visibilitychange', listener: () => void): void;
  };
}

/** Starts holding the lock; returns a function that stops and releases it. */
export function keepScreenAwake(host: WakeLockHost): () => void {
  let stopped = false;
  let inFlight = false;
  let lock: WakeLockSentinelLike | null = null;

  const acquire = async (): Promise<void> => {
    const wl = host.navigator.wakeLock;
    if (stopped || inFlight || lock || !wl || host.document.visibilityState !== 'visible') return;
    inFlight = true;
    try {
      const l = await wl.request('screen');
      if (stopped) { l.release().catch(() => {}); return; }
      lock = l;
      l.addEventListener?.('release', () => {
        if (lock === l) lock = null;
        // Released while still on screen: take it back. (If hidden, the
        // visibilitychange handler does it when the page returns.)
        void acquire();
      });
    } catch { /* denied or unsupported -- the sitting is unaffected */ }
    finally { inFlight = false; }
  };

  const onVisible = (): void => { void acquire(); };
  void acquire();
  host.document.addEventListener('visibilitychange', onVisible);

  return () => {
    stopped = true;
    host.document.removeEventListener('visibilitychange', onVisible);
    const l = lock;
    lock = null;
    l?.release().catch(() => {});
  };
}
