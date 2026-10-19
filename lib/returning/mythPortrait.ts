// lib/returning/mythPortrait.ts
//
// Server-side assembly for "Your myth, so far". Reads only what the seeker
// already owns (archetype ledger, confirmed material, Core Myth Statement)
// and hands it to the pure derivation. Session-scoped by the caller; every
// query here takes the userId the route took from the signed cookie.
//
// FAILS TOWARD HONESTY: if any source cannot be read, the whole portrait is
// null. A partial read would render unlit stations the seeker has in fact
// reached ("a figure will come" over a figure that already has), which is a
// false statement about their own life. No portrait is better than a wrong one.
import { getUserMyths } from '@/lib/mythLedger';
import {
  getEligibility,
  assembleConfirmedMaterial,
  getCurrentStatement,
  REQUIRED_INTEGRATED_MARKERS,
} from './coreMythStatement';
import { derivePortrait, type MythPortrait } from './mythPortraitDerive';

export async function buildMythPortrait(userId: number): Promise<MythPortrait | null> {
  try {
    const [myths, material, eligibility, current] = await Promise.all([
      getUserMyths(userId),
      assembleConfirmedMaterial(userId),
      getEligibility(userId),
      getCurrentStatement(userId),
    ]);
    return derivePortrait({
      myths,
      material,
      eligible: eligibility.status !== 'not_eligible',
      hasStatement: current !== null,
      required: REQUIRED_INTEGRATED_MARKERS,
    });
  } catch (err) {
    console.error('[myth-portrait] could not assemble portrait:', err);
    return null;
  }
}
