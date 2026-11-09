'use client';

// One invitation at a time beneath a reading.
//
// The marker, depth-stage and carry offers each arrive on their own timer and
// used to land together, stacked. Each now asks for the slot while it has
// something to ask (`wants`); only the lowest priority number holds it, and
// the rest wait, unrendered, until it lets go (answered, declined, gone).
//
// A finished offer's own closing line is NOT gated: only an offer that is
// still asking waits its turn, so a thank-you never blocks the next offer.
// Outside a provider every offer behaves exactly as before.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Registry = Record<string, number>; // id -> priority, present only while it wants the slot

interface Ctx {
  registry: Registry;
  set: (id: string, priority: number | null) => void;
}

const SlotContext = createContext<Ctx | null>(null);

export function OfferSlotProvider({ children }: { children: React.ReactNode }) {
  const [registry, setRegistry] = useState<Registry>({});
  const set = useCallback((id: string, priority: number | null) => {
    setRegistry((prev) => {
      if (priority === null) {
        if (!(id in prev)) return prev;
        const { [id]: _drop, ...rest } = prev;
        return rest;
      }
      return prev[id] === priority ? prev : { ...prev, [id]: priority };
    });
  }, []);
  const value = useMemo(() => ({ registry, set }), [registry, set]);
  return <SlotContext.Provider value={value}>{children}</SlotContext.Provider>;
}

/** True when this offer may show: it holds the slot, or there is no provider. */
export function useOfferSlot(id: string, priority: number, wants: boolean): boolean {
  const ctx = useContext(SlotContext);
  const set = ctx?.set;
  useEffect(() => {
    if (!set) return;
    set(id, wants ? priority : null);
    return () => set(id, null);
  }, [set, id, priority, wants]);
  if (!ctx) return true;
  return holdsSlot(ctx.registry, id, priority, wants);
}

/** Pure rule: an asking offer holds the slot when it is registered and no
 *  other asking offer has a lower priority number. */
export function holdsSlot(registry: Record<string, number>, id: string, priority: number, wants: boolean): boolean {
  if (!wants) return false;
  if (!(id in registry)) return false; // not yet registered: wait one beat
  return Object.values(registry).every((p) => p >= priority);
}
