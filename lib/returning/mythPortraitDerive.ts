// lib/returning/mythPortraitDerive.ts
//
// "Your myth, so far" (docs/myth-so-far.md): the through-line that lets a
// seeker see what they are building toward -- a Core Myth Statement only
// they can write -- and what they have already laid down for it.
//
// PURE. No database, no model, no clock. Everything here is arithmetic on
// facts the seeker produced by acting: a figure arrived, they went back to
// it, they kept a sentence in their own words, they wrote their statement.
// That purity is the integrity posture, same as depth-stage and the Core
// Myth eligibility rule: The Elder notices, it never decides or infers.
//
// Hard rules this module encodes structurally (not just in copy):
//   1. NOT SCORED. No percentage, level, streak, or "x of y". Stations are
//      lit or unlit; unlit is an invitation, never a deficit, and stations
//      may light in any order.
//   2. LINEAGES STAY APART. Figures are one entry per lineage, never merged
//      or summarized across lineages (the "melting pot" anti-pattern).
//   3. NO CONNECTIONS. `gathered` is the seeker's confirmed material as a
//      flat, unconnected list (same rows.map() discipline as
//      assembleConfirmedMaterial); nothing here relates two items.
//   4. NO INFERENCE FROM COUNTS. "Returned to" means only that the seeker
//      sat with that figure more than once -- a fact -- and is never
//      promoted to a claim about depth, integration, or growth. (The
//      archetype ledger auto-advances depth_stage by reading count with no
//      seeker confirmation; this module deliberately ignores it.)
//   5. ONE DOOR AT MOST. The portrait offers a single, optional next door,
//      the first station not yet touched -- never a list of tasks.

export type StationKey = 'arrival' | 'return' | 'naming' | 'telling';

/** Stations in road order. Order is presentation only: nothing gates on it. */
export const STATION_ORDER: readonly StationKey[] = ['arrival', 'return', 'naming', 'telling'];

export interface PortraitMythInput {
  lineageKey: string;
  archetypeName: string;
  readingCount: number;
}

export interface PortraitMaterialInput {
  kind: 'marker' | 'becoming';
  id: number;
  label: string;
}

export interface PortraitInput {
  /** The seeker's archetypes, newest-touched first (getUserMyths order). */
  myths: readonly PortraitMythInput[];
  /** The seeker's confirmed material, raw and unconnected. */
  material: readonly PortraitMaterialInput[];
  /** Core Myth Statement eligibility (getEligibility().status !== 'not_eligible'). */
  eligible: boolean;
  /** Whether a current (non-superseded) Core Myth Statement exists. */
  hasStatement: boolean;
  /** How many confirmed threads the Core Myth page asks for. */
  required: number;
}

export interface PortraitFigure {
  lineageKey: string;
  archetypeName: string;
  /** True only when the seeker has sat with this figure more than once. */
  returned: boolean;
}

export type NextDoor =
  | { kind: 'arrival' }
  | { kind: 'return'; figure: string }
  | { kind: 'naming' };

export interface MythPortrait {
  figures: PortraitFigure[];
  stations: Record<StationKey, boolean>;
  /** The seeker's own words laid down so far, flat and unconnected. */
  gathered: PortraitMaterialInput[];
  horizon: {
    /** How many confirmed threads the page at the end asks for. */
    required: number;
    /** The page is open to write (eligible) and not yet written. */
    open: boolean;
    written: boolean;
  };
  /** The first untouched station's invitation, or null when none applies. */
  nextDoor: NextDoor | null;
}

export function derivePortrait(input: PortraitInput): MythPortrait {
  const figures: PortraitFigure[] = input.myths.map((m) => ({
    lineageKey: m.lineageKey,
    archetypeName: m.archetypeName,
    returned: m.readingCount >= 2,
  }));

  const stations: Record<StationKey, boolean> = {
    arrival: figures.length > 0,
    return: figures.some((f) => f.returned),
    naming: input.material.length > 0,
    telling: input.hasStatement,
  };

  // A copy of each row, in the order received -- a 1:1 map, never a join.
  const gathered = input.material.map((m) => ({ kind: m.kind, id: m.id, label: m.label }));

  const open = input.eligible && !input.hasStatement;

  let nextDoor: NextDoor | null = null;
  if (!stations.arrival) {
    nextDoor = { kind: 'arrival' };
  } else if (!stations.return) {
    // The most recently touched figure: input order is newest-first.
    nextDoor = { kind: 'return', figure: figures[0].archetypeName };
  } else if (!stations.naming) {
    nextDoor = { kind: 'naming' };
  }
  // 'telling' has no door of its own: when the page is open, the Core Myth
  // invitation already sits on the same screen, and the Elder never
  // pressures it (docs: "no CTA pressure ... non-expiring").

  return {
    figures,
    stations,
    gathered,
    horizon: { required: input.required, open, written: input.hasStatement },
    nextDoor,
  };
}
