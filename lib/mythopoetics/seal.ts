// lib/mythopoetics/seal.ts
//
// D10 (design action items, 2026-08-19, non-representational): a
// deterministic mark derived from a reading's confirmed markers, rendered
// entirely client-side, with no model call. Companion to the D11 card
// work -- a small constellation seal, not a competing feature.
//
// DECISION (mirrors the DECISION note in cardConfig.ts for the card's
// landscape imagery): no figurative or model-generated imagery, ever. A
// diffusion model asked for a "seal of this reading" would either produce
// generic decoration or, worse, ceremonial-looking fabrication -- the
// same integrity problem the card's templated landscape system already
// exists to avoid. This generator produces an ABSTRACT geometric
// constellation (points + connecting lines on a circle) from a pure hash
// of the reading's own confirmed inputs. It draws no figure, animal,
// symbol, or cultural motif -- only points and lines, so it can never be
// mistaken for a specific tradition's iconography by any seeker or any
// tradition-bearer reviewing it later.
//
// "Deterministic" here means: the same marker + quote always produce the
// same seal. Re-opening the same card, or generating the seal twice for
// the same reading, never produces a different mark -- the seal is a
// property of the reading, not a random decoration.

import type { MarkerType } from './cardConfig';

export interface SealPoint {
  x: number;
  y: number;
}

export interface SealGeometry {
  points: SealPoint[];
  /** Index pairs into `points`, the connecting lines of the constellation. */
  edges: [number, number][];
}

// Small deterministic string hash (djb2 variant). Not cryptographic --
// doesn't need to be, this only ever seeds a visual layout, never
// anything security-relevant.
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

// Deterministic pseudo-random sequence from a seed, mulberry32.
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Point count and connection density vary slightly by marker archetype --
// the same "mood only" constraint the card's incense-smoke drift and
// landscape variants already follow (see ShareableCard.tsx's smokeAnim
// comment): a felt difference in shape, never a claim of cultural
// specificity. wound/exile read as sparser, more broken constellations;
// threshold/pattern/figure read as fuller ones.
const MARKER_POINT_COUNT: Record<MarkerType, number> = {
  wound: 5,
  exile: 5,
  threshold: 7,
  pattern: 8,
  figure: 6,
};

const MARKER_EDGE_DENSITY: Record<MarkerType, number> = {
  wound: 0.35,
  exile: 0.3,
  threshold: 0.55,
  pattern: 0.65,
  figure: 0.5,
};

/**
 * Generate a deterministic constellation seal from a reading's confirmed
 * marker and quote line. Pure function -- same inputs, same geometry,
 * always. No network call, no model, no randomness beyond the seeded PRNG.
 */
export function generateSeal(marker: MarkerType, line: string): SealGeometry {
  const seed = hashString(`${marker}::${line}`);
  const rand = mulberry32(seed);
  const n = MARKER_POINT_COUNT[marker];
  const density = MARKER_EDGE_DENSITY[marker];

  // Points scattered on/near a circle (radius jitter), not a regular
  // polygon -- a constellation, not a geometric logo.
  const points: SealPoint[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n + (rand() - 0.5) * 0.5;
    const radius = 0.62 + (rand() - 0.5) * 0.3;
    // BUG FOUND 2026-08-21: raw Math.cos/sin output has ~17 significant
    // digits, passed straight into JSX cx/cy on SeekerSeal.tsx's <circle>.
    // React's SSR number-to-attribute serialization and the client's own
    // recomputation of this same "deterministic" value can disagree in
    // the last couple of digits (verified live: a real card produced
    // cy="18.08253221208023" server-side vs cy={18.082532212080228}
    // client-side) -- a hydration mismatch on every single card render,
    // not a rendering difference a person would ever see. Rounding to a
    // fixed, short precision makes both sides serialize identically.
    points.push({
      x: Math.round((50 + radius * 44 * Math.cos(angle)) * 1000) / 1000,
      y: Math.round((50 + radius * 44 * Math.sin(angle)) * 1000) / 1000,
    });
  }

  // Candidate edges are every point pair; keep roughly `density` of them,
  // chosen deterministically by the same seeded sequence so the result
  // never redraws differently between renders.
  const candidates: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      candidates.push([i, j]);
    }
  }
  const edges = candidates.filter(() => rand() < density);

  // Guarantee the constellation is at least connected in a ring, even if
  // the density filter above happened to drop every edge touching some
  // point -- an isolated point would read as a rendering bug, not a
  // deliberate choice.
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const already = edges.some(
      ([a, b]) => (a === i && b === next) || (a === next && b === i)
    );
    if (!already) edges.push([i, next]);
  }

  return { points, edges };
}
