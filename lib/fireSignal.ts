// The one fire. FireAtmosphere (full-viewport SVG turbulence filter plus ~11
// blended layers) is expensive, and it used to be mounted twice at once: the
// persistent root-layout instance and one per phase inside Threshold. Both
// were filtered, composited and animated every frame. Now the layout mounts a
// single instance (FireHost) and any screen that wants to steer it publishes
// its wishes here through a FireDriver instead of rendering a second fire.
//
// Plain module store read with useSyncExternalStore -- no context, so
// Threshold's large tree is not re-rendered by it.

export interface FireSignal {
  soundEnabled: boolean;
  intensity: number;
  pulse: number;
}

export const DEFAULT_FIRE_SIGNAL: FireSignal = { soundEnabled: false, intensity: 0, pulse: 0 };

let current: FireSignal = DEFAULT_FIRE_SIGNAL;
let owner: symbol | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(l => l());
}

export function getFireSignal(): FireSignal {
  return current;
}

export function subscribeFireSignal(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Publish a signal as `who`. The latest publisher owns the fire. */
export function publishFireSignal(who: symbol, next: FireSignal): void {
  owner = who;
  if (
    current.soundEnabled === next.soundEnabled &&
    current.intensity === next.intensity &&
    current.pulse === next.pulse
  ) return;
  current = next;
  emit();
}

/**
 * Release `who`'s hold on the fire. Deferred one microtask and ignored if
 * another publisher has taken over in the meantime, so swapping one driver for
 * the next (a phase change) never flickers the fire back to its default.
 */
export function releaseFireSignal(who: symbol): void {
  queueMicrotask(() => {
    if (owner !== who) return;
    owner = null;
    if (current === DEFAULT_FIRE_SIGNAL) return;
    current = DEFAULT_FIRE_SIGNAL;
    emit();
  });
}
