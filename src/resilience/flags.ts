/**
 * flags.ts — Blast-Radius Isolation
 *
 * Addresses Territory 1/2/4 + makes the v2 kill criteria EXECUTABLE rather than aspirational.
 *
 * Every voice, every mode, and the safety layer sit behind independent flags. Any voice
 * can be retired in minutes without a deployment. Classroom mode and adult mode share no
 * telemetry path by construction. The safety layer can tighten globally with one switch.
 *
 * Flags are read from config/env so they can flip without a code change. In production,
 * back this with an edge config store (e.g. Vercel Edge Config) so a flip propagates in seconds.
 */

export type VoiceKey =
  | "ojer_tzij"
  | "ajqij"
  | "pythia"
  | "hem_netjer"
  | "volva"
  | "stoa"
  | "sage_of_the_way"
  | "sufi"
  | "elder_of_country"
  | "babalawo" // deferred
  | "mekubal"  // scaffolding — pending lineage review — flag exists but defaults OFF and must not be enabled w/o lineage consult
  | "vedic"    // authorized — Rishi voice, lineage-reviewed, defaults ON
  | "keeper_of_the_fire";

export type Mode = "adult_individual" | "classroom";

export interface FlagState {
  voices: Record<VoiceKey, boolean>;
  modes: Record<Mode, boolean>;
  /** When true, the safety layer applies its most conservative thresholds everywhere. */
  safetyLockdown: boolean;
  /** When true, ALL telemetry (altar record, anomaly observatory) is hard-off. */
  telemetryDisabled: boolean;
  /** Per-mode telemetry override; classroom is ALWAYS forced off regardless. */
  telemetryByMode: Record<Mode, boolean>;
}

/**
 * Safe defaults encode policy, not convenience:
 *  - Only the textual-core voices that are grounded-or-ready default ON.
 *  - Babalawo and Elder of Country default OFF pending consent (v2/v3).
 *  - Classroom telemetry is forced OFF here AND re-forced at the read site.
 */
export const DEFAULT_FLAGS: FlagState = {
  voices: {
    ojer_tzij: true,
    pythia: true,
    hem_netjer: true,
    volva: true,
    stoa: true,
    sage_of_the_way: true,
    keeper_of_the_fire: true,
    ajqij: false, // enabled once corpus-grounded + lineage-reviewed
    sufi: false, // public-domain Masnavi only; living-order content deferred
    elder_of_country: false, // ICIP consult pending (v3 Territory 4)
    babalawo: true,  // authorized — Fama Aina Udoyi, June 16 2026
    mekubal:  false, // scaffolding — pending lineage review
    vedic:    true,  // authorized — lineage-reviewed
  },
  modes: {
    adult_individual: true,
    classroom: false, // enabled only after DOE reachability test + data-privacy agreement
  },
  safetyLockdown: false,
  telemetryDisabled: false,
  telemetryByMode: {
    adult_individual: true, // on, with Threshold consent
    classroom: false, // structurally off
  },
};

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

/** Load effective flags, allowing env overrides per voice/mode without code changes. */
export function loadFlags(): FlagState {
  const f: FlagState = JSON.parse(JSON.stringify(DEFAULT_FLAGS));
  (Object.keys(f.voices) as VoiceKey[]).forEach((v) => {
    f.voices[v] = envBool(`ELDER_VOICE_${v.toUpperCase()}`, f.voices[v]);
  });
  f.modes.adult_individual = envBool("ELDER_MODE_ADULT", f.modes.adult_individual);
  f.modes.classroom = envBool("ELDER_MODE_CLASSROOM", f.modes.classroom);
  f.safetyLockdown = envBool("ELDER_SAFETY_LOCKDOWN", f.safetyLockdown);
  f.telemetryDisabled = envBool("ELDER_TELEMETRY_DISABLED", f.telemetryDisabled);
  return f;
}

export function isVoiceEnabled(flags: FlagState, voice: VoiceKey): boolean {
  return flags.voices[voice] === true;
}

/**
 * The single source of truth for "may we log this session?".
 * Classroom mode is forced off here regardless of any other setting — defense in depth
 * against a config drift that would otherwise log a minor's session.
 */
export function telemetryAllowed(flags: FlagState, mode: Mode): boolean {
  if (mode === "classroom") return false; // hard, structural, non-overridable
  if (flags.telemetryDisabled) return false;
  return flags.telemetryByMode[mode] === true;
}
