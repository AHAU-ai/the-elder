/**
 * lib/fireside/ember/profile.ts
 *
 * The ember profile: a small bundle of BUCKETED numbers describing the shape of a
 * sitting. It is the only input to the ember sigil. It is built from counts and
 * durations, with no model and no text.
 *
 * Hard rule (V3, and the sigil's own acceptance test): the profile must never carry
 * a welfare level, a step-out flag, an emotional label, or any seeker words. The
 * guard below enforces this two ways: an exact allowlist of keys, and a scan for
 * forbidden names that fails even if someone extends the allowlist carelessly.
 *
 * Residual, stated plainly: the drawing is a function of these bands, so a person
 * who knew the mapping could infer rough duration or silence from a sigil. The bands
 * are coarse on purpose, and none of them is a welfare signal.
 */

export type Band = 0 | 1 | 2 | 3;

export const EMBER_MOTIFS = ['spiral', 'rays', 'lattice', 'petals', 'arcs', 'knot'] as const;
export type EmberMotif = (typeof EMBER_MOTIFS)[number];

export interface EmberProfile {
  v: 1;
  durationBand: Band;
  segmentBand: Band;
  /** Three UI-defined reaction slots, by position. No slot has an emotional meaning here. */
  reactionBands: [Band, Band, Band];
  silenceBand: Band;
  depthStage: Band;
  motif: EmberMotif;
}

/** What a sitting records about itself. Counts and durations only. */
export interface RawSittingShape {
  durationSec: number;
  segmentCount: number;
  reactionCounts: [number, number, number];
  longestSilenceSec: number;
  /** Reading depth stage 0..3, as the sitting already tracks it. */
  depthStage: number;
  motifId: string;
}

export const PROFILE_KEYS = ['v', 'durationBand', 'segmentBand', 'reactionBands', 'silenceBand', 'depthStage', 'motif'] as const;

/** Names that must never appear anywhere in a profile, at any depth. */
export const FORBIDDEN_KEY_PATTERN = /welfare|tier|level|step.?out|stepout|flag|emotion|mood|feel|sentiment|distress|crisis|risk|score|severity|text|transcript|message|reply|voice|name|label|email|diagnos/i;

function band(n: number, cuts: [number, number, number]): Band {
  if (!Number.isFinite(n) || n < 0) throw new RangeError(`ember input must be a non-negative number, got ${n}`);
  return n < cuts[0] ? 0 : n < cuts[1] ? 1 : n < cuts[2] ? 2 : 3;
}

export const bandDuration = (sec: number): Band => band(sec, [180, 600, 1500]);
export const bandSegments = (n: number): Band => band(n, [4, 9, 17]);
export const bandReaction = (n: number): Band => band(n, [1, 3, 6]);
export const bandSilence = (sec: number): Band => band(sec, [10, 40, 120]);

function scanKeys(value: unknown, path: string): void {
  if (Array.isArray(value)) { value.forEach((v, i) => scanKeys(v, `${path}[${i}]`)); return; }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEY_PATTERN.test(k)) throw new Error(`ember profile may not carry "${path}.${k}" (welfare, emotion and seeker text never enter the sigil)`);
      scanKeys(v, `${path}.${k}`);
    }
  }
}

const isBand = (x: unknown): x is Band => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 3;

/** Throws unless `p` is exactly an EmberProfile. Use at every boundary. */
export function assertEmberProfile(p: unknown): asserts p is EmberProfile {
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw new Error('ember profile must be an object');
  scanKeys(p, 'profile');
  const keys = Object.keys(p as object).sort();
  const want = [...PROFILE_KEYS].sort();
  if (keys.length !== want.length || keys.some((k, i) => k !== want[i])) throw new Error(`ember profile keys must be exactly: ${PROFILE_KEYS.join(', ')}`);
  const q = p as Record<string, unknown>;
  if (q.v !== 1) throw new Error('ember profile v must be 1');
  for (const k of ['durationBand', 'segmentBand', 'silenceBand', 'depthStage']) if (!isBand(q[k])) throw new Error(`${k} must be an integer 0..3`);
  if (!Array.isArray(q.reactionBands) || q.reactionBands.length !== 3 || !q.reactionBands.every(isBand)) throw new Error('reactionBands must be three integers 0..3');
  if (!EMBER_MOTIFS.includes(q.motif as EmberMotif)) throw new Error(`motif must be one of ${EMBER_MOTIFS.join(', ')}`);
}

/**
 * Build a profile from a sitting's own counts. Reads ONLY the named numeric fields,
 * so extra properties on `raw` (a welfare level, a flag, anything) are never copied.
 */
export function buildEmberProfile(raw: RawSittingShape): EmberProfile {
  if (!EMBER_MOTIFS.includes(raw.motifId as EmberMotif)) throw new RangeError(`unknown motif "${raw.motifId}"`);
  const depth = Math.min(3, Math.max(0, Math.floor(raw.depthStage)));
  const profile: EmberProfile = {
    v: 1,
    durationBand: bandDuration(raw.durationSec),
    segmentBand: bandSegments(raw.segmentCount),
    reactionBands: [bandReaction(raw.reactionCounts[0]), bandReaction(raw.reactionCounts[1]), bandReaction(raw.reactionCounts[2])],
    silenceBand: bandSilence(raw.longestSilenceSec),
    depthStage: depth as Band,
    motif: raw.motifId as EmberMotif,
  };
  assertEmberProfile(profile);
  return profile;
}

/** What gets stored with an ember: the profile and the seed that makes the drawing repeatable. */
export interface EmberSigilRecord {
  profile: EmberProfile;
  /** Unsigned 32-bit integer, drawn once at the Recorded stage so the same sigil redraws identically. */
  seed: number;
}

export function assertSigilRecord(r: unknown): asserts r is EmberSigilRecord {
  if (!r || typeof r !== 'object') throw new Error('sigil record must be an object');
  const q = r as Record<string, unknown>;
  const keys = Object.keys(q).sort().join(',');
  if (keys !== 'profile,seed') throw new Error('sigil record keys must be exactly: profile, seed');
  assertEmberProfile(q.profile);
  if (!Number.isInteger(q.seed) || (q.seed as number) < 0 || (q.seed as number) > 0xffffffff) throw new Error('seed must be an unsigned 32-bit integer');
}
