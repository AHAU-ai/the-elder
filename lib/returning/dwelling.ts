// lib/returning/dwelling.ts
//
// Server side of the over-dwelling guard (lib/overDwelling.ts). The gates are in
// lib/compliance/overDwellingGate.ts; changing any of them is a governance
// action, not an engineering one (docs/over-dwelling-guard.md).
//
// Fails toward the ordinary close: a ledger we cannot read is a count we do not
// claim, so an error means "not quiet", never a guess.
import { overDwellingGuardActive } from '@/lib/compliance/overDwellingGate';
import {
  assessDwelling,
  OVER_DWELLING,
  QUIET_CLOSING_LINE,
  type DwellingAssessment,
} from '@/lib/overDwelling';

export interface DwellingResponse extends DwellingAssessment {
  line: string | null;
}

const NOT_QUIET: DwellingResponse = { quiet: false, untilMs: 0, line: null };

export async function readDwelling(
  userId: number,
  nowMs: number = Date.now(),
  // Lazy: the ledger module opens its database connection on import.
  deps: { times: (userId: number, sinceMs: number) => Promise<number[]> } = {
    times: async (u, since) => (await import('./visit')).recentVisitTimes(u, since),
  }
): Promise<DwellingResponse> {
  if (!overDwellingGuardActive()) return NOT_QUIET;
  try {
    const times = await deps.times(userId, nowMs - OVER_DWELLING.windowMs);
    const a = assessDwelling(times, nowMs);
    return a.quiet ? { ...a, line: QUIET_CLOSING_LINE } : NOT_QUIET;
  } catch {
    return NOT_QUIET;
  }
}
