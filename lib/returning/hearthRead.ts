// lib/returning/hearthRead.ts
//
// Server side of Axis 4 (docs/axis-4-hearth-movement.md): classify the
// seeker's recent movement and reduce it to one warm-only number. The movement
// enum exists only inside this function call; it is not returned, stored or
// logged (RT-2). Every failure is neutral (0), never a guess.
import { hearthMovementStageAllows, hearthRespondsToMovementEnabled } from '@/config/returning-features';
import { warmthFor } from '@/lib/hearthMovement';
import { readTrajectory } from './trajectory';

export interface HearthReadDeps {
  isTester(userId: number): Promise<boolean>;
  effectiveTierIsKeptPlus(userId: number): Promise<boolean>;
  recentVisits(userId: number): ReturnType<typeof import('./visit').recentVisitsForMovement>;
}

const defaultDeps: HearthReadDeps = {
  isTester: async (u) => (await (await import('@/lib/tierLedger')).getTierRecord(u)).isTester === true,
  effectiveTierIsKeptPlus: async (u) => {
    const t = await import('@/lib/tierLedger');
    const tier = t.deriveEffectiveTier(await t.getTierRecord(u));
    return tier === 'kept' || tier === 'council';
  },
  recentVisits: async (u) => (await import('./visit')).recentVisitsForMovement(u, 5),
};

export async function readHearthWarmth(userId: number, deps: HearthReadDeps = defaultDeps): Promise<number> {
  try {
    // Dark unless the flip, trajectory's gates, and this seeker's stage all hold.
    if (!hearthRespondsToMovementEnabled()) return 0; // cheap exit: dark for everyone, no database read
    if (!hearthMovementStageAllows(await deps.isTester(userId))) return 0;
    if (!(await deps.effectiveTierIsKeptPlus(userId))) return 0;
    const visits = await deps.recentVisits(userId);
    // No welfare message exists at arrival; grief maps to warm anyway (DESCENDING), so the
    // RT-1 override changes nothing here.
    return warmthFor(readTrajectory(visits, { griefSignal: false }).movement);
  } catch {
    return 0;
  }
}
