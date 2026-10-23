/**
 * overDwellingGate.ts
 *
 * Whether the over-dwelling guard (lib/overDwelling.ts) may run at all. Three
 * conditions, each a human act, all closed by default:
 *   1. the reviewer's clean "approved" for `overDwellingThreshold` in
 *      signoff-status.json ("approved_with_conditions" does not pass, see
 *      signoffStatus.ts);
 *   2. OVER_DWELLING_GUARD_ENABLED=true, set deliberately;
 *   3. the reviewer's disclosure wording exists, so it is never live undisclosed.
 * Kept free of any database import so server pages (About) can ask it.
 */
import { QUIET_DISCLOSURE } from '@/lib/overDwelling';
import { isApproved } from './signoffStatus';

export function overDwellingGuardActive(): boolean {
  if (!isApproved('overDwellingThreshold')) return false;
  if (process.env.OVER_DWELLING_GUARD_ENABLED !== 'true') return false;
  if (!QUIET_DISCLOSURE) return false;
  return true;
}
