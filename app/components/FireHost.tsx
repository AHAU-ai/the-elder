'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import FireAtmosphere from './FireAtmosphere';
import {
  DEFAULT_FIRE_SIGNAL, getFireSignal, publishFireSignal, releaseFireSignal, subscribeFireSignal,
  type FireSignal,
} from '../../lib/fireSignal';

/**
 * The single, persistent FireAtmosphere. Mounted once in the root layout.
 * Screens steer it with <FireDriver /> rather than rendering their own fire --
 * two concurrently mounted fires meant two full-viewport SVG filters, two
 * sets of blended layers and two spark fields.
 */
export function FireHost() {
  const sig = useSyncExternalStore(subscribeFireSignal, getFireSignal, () => DEFAULT_FIRE_SIGNAL);
  return (
    <FireAtmosphere
      arrivalNudge
      soundEnabled={sig.soundEnabled}
      intensity={sig.intensity}
      pulse={sig.pulse}
    />
  );
}

/** Renders nothing; tells the one fire how to burn while this is mounted. */
export function FireDriver({ soundEnabled = false, intensity = 0, pulse = 0 }: Partial<FireSignal>) {
  const who = useRef<symbol | null>(null);
  if (who.current === null) who.current = Symbol('fire-driver');

  useEffect(() => {
    publishFireSignal(who.current!, { soundEnabled, intensity, pulse });
  }, [soundEnabled, intensity, pulse]);

  useEffect(() => {
    const me = who.current!;
    return () => releaseFireSignal(me);
  }, []);

  return null;
}
