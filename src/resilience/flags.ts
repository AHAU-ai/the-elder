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
  | "ojer_tzij" // publicly titled "Ajq'ij" in lib/lineages.ts — see note below
  | "pythia"
  | "hem_netjer"
  | "volva"
  | "stoa"
  | "sage_of_the_way"
  | "sufi" // NOT authorized by a named tradition-bearer — consent_grant row is a
  // Temporal Bridges Institute placeholder (2026-01-01), same as the honestly-
  // unauthorized voices below. "El Atigh Abba" does not appear in any signoff
  // doc or DB record; kept live on operator decision (2026-08-30), not on
  // the strength of this claim. See governance/signoffs/ for the real process.
  | "elder_of_country"
  | "babalawo" // authorized — Fama Aina Udoyi, June 16 2026
  | "mekubal"  // authorized — Getzel Davis, July 15 2026
  | "vedic"    // NOT authorized by a named tradition-bearer — consent_grant row is
  // the same Temporal Bridges Institute placeholder (2026-01-01). No named
  // reviewer found in history or governance/signoffs/; kept live on operator
  // decision (2026-08-30), not on the strength of this claim.
  | "keeper_of_the_fire"
  | "bhikkhu" // authorized — Theravada voice, Shalom Ormsby, July 31 2026
  | "chukchi_shaman"; // SCAFFOLDING (2026-08-18) — no consent grant, no named tradition-bearer,
  // no corpus content. Flag exists so the type system and UI plumbing can be built ahead of
  // authorization, same pattern as elder_of_country/babalawo before their grants landed. Must
  // not be flipped on and must not receive ingested corpus content until a Chukchi cultural
  // authority or specialist in Siberian Indigenous studies reviews and sanctions it, per
  // GOVERNANCE.md's Elder Review as Deployment Condition. See lib/lineages.ts 'chukchi' entry.

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
 *  - Elder of Country defaults OFF pending consent (v3, Territory 4). Babalawo
 *    defaulted OFF for the same reason until its consent grant landed
 *    2026-06-16 (see the authorized comment on babalawo below) — kept here
 *    as the pattern to expect from any other voice still pending, not as a
 *    claim about babalawo's current state.
 *  - Classroom telemetry is forced OFF here AND re-forced at the read site.
 */
export const DEFAULT_FLAGS: FlagState = {
  voices: {
    ojer_tzij: true, // authorized — Vincent Stanzione. "ajqij" was a duplicate VoiceKey for
    // this same voice (publicly titled "Ajq'ij" in lib/lineages.ts) that was never wired
    // into any lineageKey route — see audit finding E-10. Retired rather than built out.
    pythia: true,
    hem_netjer: true,
    volva: true,
    stoa: true,
    sage_of_the_way: true,
    keeper_of_the_fire: true,
    sufi: true, // NOT authorized — placeholder grant only; kept live on operator decision (2026-08-30)
    elder_of_country: false, // ICIP consult pending (v3 Territory 4)
    babalawo: true,  // authorized — Fama Aina Udoyi, June 16 2026
    mekubal:  true, // authorized — Getzel Davis, July 15 2026
    vedic:    true,  // NOT authorized — placeholder grant only; kept live on operator decision (2026-08-30)
    bhikkhu:  true, // authorized — Shalom Ormsby, July 31 2026
    chukchi_shaman: false, // scaffolding — no consent grant, no tradition-bearer, no corpus
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
