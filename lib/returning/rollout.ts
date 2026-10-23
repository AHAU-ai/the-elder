// lib/returning/rollout.ts
//
// Testers-first rollout for the living features (config/returning-features.ts,
// docs/runbooks/light-the-living-features.md). The config holds the pure rule;
// this resolves "is this seeker a tester" for call sites that only hold a user
// id. A lookup failure reads as "not a tester", so the stage fails closed.
import {
  carryEnabled,
  carryStageAllows,
  figureContinuityEnabled,
  figureContinuityOpenToAll,
  figureContinuityStageAllows,
  trajectoryEnabled,
  trajectoryOpenToAll,
  trajectoryStageAllows,
} from '@/config/returning-features';

async function isTester(userId: number): Promise<boolean> {
  try {
    const { getTierRecord } = await import('@/lib/tierLedger');
    return (await getTierRecord(userId)).isTester === true;
  } catch {
    return false;
  }
}

// Each helper skips the lookup when the answer cannot depend on it, and takes
// the tester status when the caller already holds it (the divine route does).

export async function trajectoryLitFor(userId: number, knownTester?: boolean): Promise<boolean> {
  if (!trajectoryEnabled()) return false;
  if (trajectoryOpenToAll()) return true;
  return trajectoryStageAllows(knownTester ?? (await isTester(userId)));
}

export async function carryLitFor(userId: number, knownTester?: boolean): Promise<boolean> {
  if (!carryEnabled()) return false;
  if (trajectoryOpenToAll()) return true;
  return carryStageAllows(knownTester ?? (await isTester(userId)));
}

export async function figureContinuityLitFor(userId: number, knownTester?: boolean): Promise<boolean> {
  if (!figureContinuityEnabled()) return false;
  if (figureContinuityOpenToAll()) return true;
  return figureContinuityStageAllows(knownTester ?? (await isTester(userId)));
}
