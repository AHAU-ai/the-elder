/**
 * lib/chol-qij.ts
 * Chol Q'ij sacred calendar engine.
 * Anchor: April 22, 2020 = 5 Kawoq (lineage-verified, per Dr. Stanzione)
 * Imox-first nahual ordering.
 * Orthography: Chol Q'ij, nahuales — never Tzolkin, day signs.
 */

import { NAHUALES, Nahual } from './nahuales';

// Anchor: April 22, 2020 = 5 Kawoq
// Kawoq is nahual index 18 (0-based), number 5
const ANCHOR_DATE  = new Date(Date.UTC(2020, 3, 22)); // April 22 2020
const ANCHOR_IDX   = 18; // Kawoq
const ANCHOR_NUM   = 5;

export interface DaySign {
  number: number;
  nahual: Nahual;
}

export interface CruzMaya {
  center:   DaySign; // birth nahual
  origin:   DaySign; // center − 8
  destiny:  DaySign; // center + 8
  paternal: DaySign; // center − 6
  maternal: DaySign; // center + 6
}

export type VenusPhase = 'Morning Star' | 'Evening Star' | 'unknown';

export interface NatalProfile {
  cruz:        CruzMaya;
  venus:       VenusPhase;
  birthDaySign: DaySign;
}

function deltaDays(date: Date): number {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((utc - ANCHOR_DATE.getTime()) / 86400000);
}

function getDaySign(delta: number): DaySign {
  const nahualIdx = ((ANCHOR_IDX + delta) % 20 + 20) % 20;
  const number    = ((ANCHOR_NUM - 1 + delta) % 13 + 13) % 13 + 1;
  return { number, nahual: NAHUALES[nahualIdx] };
}

export function computeCruzMaya(birthDate: Date): CruzMaya {
  const d = deltaDays(birthDate);
  const center   = getDaySign(d);
  const origin   = getDaySign(d - 8);
  const destiny  = getDaySign(d + 8);
  const paternal = getDaySign(d - 6);
  const maternal = getDaySign(d + 6);
  return { center, origin, destiny, paternal, maternal };
}

/**
 * Venus phase at birth.
 * Venus synodic cycle ≈ 583.92 days.
 * Anchor: Venus was Morning Star on April 22, 2020.
 * Morning Star: days 0–263 of synodic cycle
 * Evening Star: days 264–583 of synodic cycle
 * (inferior/superior conjunction transitions simplified)
 */
const VENUS_SYNODIC = 583.92;
const VENUS_MORNING_DAYS = 263;

export function computeVenusPhase(birthDate: Date): VenusPhase {
  const d = deltaDays(birthDate);
  const phase = ((d % VENUS_SYNODIC) + VENUS_SYNODIC) % VENUS_SYNODIC;
  return phase < VENUS_MORNING_DAYS ? 'Morning Star' : 'Evening Star';
}

export function computeNatalProfile(birthDate: Date): NatalProfile {
  const cruz  = computeCruzMaya(birthDate);
  const venus = computeVenusPhase(birthDate);
  return { cruz, venus, birthDaySign: cruz.center };
}

/**
 * Formats the Cruz Maya as a compact system-prompt injection block.
 * Written to be consumed by buildSystemPrompt.
 */
export function formatCruzForPrompt(profile: NatalProfile): string {
  const { cruz, venus } = profile;
  const fmt = (label: string, ds: DaySign) =>
    `${label}: ${ds.number} ${ds.nahual.name} — ${ds.nahual.existentialField}`;

  return `━━━ NATAL FIELD — CRUZ MAYA ━━━
This seeker was born under the following configuration. Let it inform how you read — not what you say about it directly.

${fmt('CENTER (Birth Nahual)', cruz.center)}
Shadow: ${cruz.center.nahual.shadow}
Gift: ${cruz.center.nahual.gift}
Popol Wuj anchor: ${cruz.center.nahual.popol}

${fmt('ORIGIN (−8)', cruz.origin)}
${fmt('DESTINY (+8)', cruz.destiny)}
${fmt('PATERNAL (−6)', cruz.paternal)}
${fmt('MATERNAL (+6)', cruz.maternal)}

VENUS AT BIRTH: ${venus}
${venus === 'Morning Star'
  ? 'Pioneer archetype — leads into the unknown, initiates, breaks ground.'
  : 'Warrior archetype — consolidates, deepens, completes what was begun.'}

Do not enumerate these positions to the seeker. Use them as the invisible substrate — the field through which you read what they bring you. The Cruz Maya is your diagnostic lens, not your script.`.trim();
}
