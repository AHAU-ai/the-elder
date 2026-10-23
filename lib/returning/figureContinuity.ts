// lib/returning/figureContinuity.ts
//
// The Figure Continuity context assembler (docs/figure-continuity-spec.md v0.2,
// guards G1-G3, G7, G8, G10). The ONLY place the feature's gates are evaluated:
// the divine route calls assembleFigureContext once and uses its result; it
// does not re-derive any gate itself. Returns null -- the feature is inert and
// the reading proceeds exactly as it would have -- unless every gate passes.
//
// Gates, all required, any failure (including a database error) is null:
//   flag        figureContinuityEnabled() (config/returning-features.ts)
//   identity    signed in (G1); userId comes from the route's signed session
//   choice      the seeker chose "continue as {figure}" this sitting
//   tier        not the free Seeker tier (Kept and Council; D3: no stateless taste)
//   register    adult only (G8; child and young_adult are off in v1)
//   welfare     the layer is allowed and no resources are surfaced (G2, D8): off at
//               distress as well as crisis. Welfare code is read, never modified.
//   mode        a Reading (the only mode that continues a chain)
//   home chain  the chain being continued holds a confirmed figure and is in the
//               requested lineage (G3): the figure is "at home" in one chain
// Mappings (G10) come only from that one chain, via a chain-scoped query, and
// only on deepen and thread turns (D6): `includeMappings` is false for a first
// reading, which receives the clause without the block.
//
// The dependencies are injectable so every gate is unit-testable without a
// database. The defaults load the ledger lazily, so importing this module never
// touches the database connection.

import {
  renderFigureContinuity,
  MAX_MAPPINGS_IN_PROMPT,
  type FigureMappingLine,
} from '@/lib/figureContinuityClause';
import { figureContinuityEnabled } from '@/config/returning-features';
import type { ChainFigureResult } from './figureMapping';

export interface FigureContextInput {
  /** The route's signed-session user id, or null when signed out. */
  userId: number | null;
  /** The seeker's arrival choice. Client-sent, so honored only through these gates. */
  figureContinue: boolean;
  /** deriveEffectiveTier() result: 'seeker' | 'kept' | 'council'. */
  effectiveTier: string;
  /** The resolved narrative register, or null if unresolved (treated as off). */
  register: string | null;
  welfare: { surfaceResources: boolean; allowPsychopompLayer: boolean };
  /** The request mode; only 'reading' continues a chain. */
  mode: string;
  /** The chain being continued, as the route derived it server-side (never from the client). */
  chainId: string | null;
  /** The lineage the request is for; the chain must be in it. */
  lineageKey: string;
  /** True on deepen and thread turns (D6); false for a first reading. */
  includeMappings: boolean;
}

export interface FigureContext {
  /** The rendered clause, ready for buildSystemPrompt's `figureContinuity` parameter. */
  block: string;
  chainId: string;
  lineageKey: string;
  figureLabel: string;
  mappingsIncluded: number;
  /** True when any included pairing is a model report, so the route can disclose it in provenance. */
  usesModelReport: boolean;
}

export interface FigureContextDeps {
  readChainFigure(userId: number, chainId: string): Promise<ChainFigureResult>;
  listConfirmed(userId: number, chainId: string, limit: number): Promise<Array<FigureMappingLine & { id: number }> | null>;
}

const defaultDeps: FigureContextDeps = {
  readChainFigure: async (userId, chainId) => (await import('./figureMapping')).readChainFigure(userId, chainId),
  listConfirmed: async (userId, chainId, limit) => (await import('./figureMapping')).listConfirmed(userId, chainId, limit),
};

/**
 * The gates that do not depend on the turn: the flag, a signed-in user, a paid
 * tier (D3: no stateless taste on the free Seeker tier), and the adult register
 * (G8). Shared by the per-turn assembler and the arrival capability below, so
 * the two can never disagree about who the feature is for.
 */
function standingGatesPass(input: { userId: number | null; effectiveTier: string; register: string | null }): boolean {
  if (!figureContinuityEnabled()) return false;
  if (!input.userId || !Number.isSafeInteger(input.userId) || input.userId <= 0) return false;
  if (input.effectiveTier !== 'kept' && input.effectiveTier !== 'council') return false;
  if (input.register !== 'adult') return false;
  return true;
}

export interface FigureArrivalInput {
  userId: number | null;
  effectiveTier: string;
  register: string | null;
  /** The seeker's most recent chain, as the server derived it (the same one a deepen would continue). */
  head: { chainId: string; lineageKey: string } | null;
}

export interface FigureArrival {
  /** The figure as the seeker confirmed it, for "Continue as {figure}". */
  figureLabel: string;
  /** The lineage of the chain, so the client offers the choice only on the matching myth. */
  lineageKey: string;
}

/**
 * Whether to offer "continue as {figure}" at arrival (spec 3.1). Reported by
 * the server so the client never decides it from an env var or a guess: the
 * standing gates pass, and the chain a deepen would continue holds a confirmed
 * figure. Turn-dependent gates (welfare, mode) are checked per turn by
 * assembleFigureContext; a seeker who then turns out to be in distress simply
 * gets an ordinary reading. Null means "do not offer", for any reason,
 * including a database error. Returns only what the client needs: no chain id.
 */
export async function assessFigureArrival(
  input: FigureArrivalInput,
  deps: Pick<FigureContextDeps, 'readChainFigure'> = defaultDeps
): Promise<FigureArrival | null> {
  if (!standingGatesPass(input)) return null;
  if (!input.head || !input.head.chainId) return null;
  try {
    const chain = await deps.readChainFigure(input.userId as number, input.head.chainId);
    if (!chain.ok) return null;
    const home = chain as Extract<ChainFigureResult, { ok: true }>;
    if (home.lineageKey !== input.head.lineageKey) return null;
    return { figureLabel: home.figureLabel, lineageKey: home.lineageKey };
  } catch {
    return null;
  }
}

export interface PairingsAccessInput {
  userId: number | null;
  effectiveTier: string;
}

/**
 * Whether to show the seeker's own pairings view and its link (spec 3.6). Reported by the server so
 * the browser never decides it. Shown when the feature is lit and the seeker is on a paid tier, OR
 * they still hold any pairing (a seeker who has since left the paid tier keeps access to, and the
 * right to release, what was written under it). Not gated on register: removing your own data is
 * never withheld. Null "holds any" (a read failure) is treated as "do not show".
 */
export async function assessPairingsAccess(
  input: PairingsAccessInput,
  deps: { hasAnyMapping(userId: number): Promise<boolean | null> } = {
    hasAnyMapping: async (userId) => (await import('./figureMapping')).hasAnyMapping(userId),
  }
): Promise<boolean> {
  if (!figureContinuityEnabled()) return false;
  if (!input.userId || !Number.isSafeInteger(input.userId) || input.userId <= 0) return false;
  if (input.effectiveTier === 'kept' || input.effectiveTier === 'council') return true;
  try {
    return (await deps.hasAnyMapping(input.userId)) === true;
  } catch {
    return false;
  }
}

export async function assembleFigureContext(
  input: FigureContextInput,
  deps: FigureContextDeps = defaultDeps
): Promise<FigureContext | null> {
  if (!standingGatesPass(input)) return null;
  if (input.figureContinue !== true) return null;
  if (input.welfare.surfaceResources || !input.welfare.allowPsychopompLayer) return null;
  if (input.mode !== 'reading') return null;
  if (!input.chainId) return null;

  try {
    const chain = await deps.readChainFigure(input.userId, input.chainId);
    if (!chain.ok) return null;
    const home = chain as Extract<ChainFigureResult, { ok: true }>;
    // Lineage lock (G3): the chain's own lineage must be the one being asked for.
    if (home.lineageKey !== input.lineageKey) return null;

    let mappings: FigureMappingLine[] = [];
    if (input.includeMappings) {
      const rows = await deps.listConfirmed(input.userId, input.chainId, MAX_MAPPINGS_IN_PROMPT);
      // null is "could not read": fail toward inert rather than speak without the seeker's own findings.
      if (rows === null) return null;
      mappings = rows.slice(0, MAX_MAPPINGS_IN_PROMPT);
    }

    return {
      block: renderFigureContinuity({ figureLabel: home.figureLabel, mythTitle: home.mythTitle, mappings }),
      chainId: input.chainId,
      lineageKey: home.lineageKey,
      figureLabel: home.figureLabel,
      mappingsIncluded: mappings.length,
      usesModelReport: mappings.some(m => m.counterpartBasis === 'model_report'),
    };
  } catch {
    return null;
  }
}
