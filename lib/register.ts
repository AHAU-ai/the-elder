// lib/register.ts
//
// AUDIENCE REGISTER — content-appropriateness tier for The Elder.
//
// Principle: the register narrows what a voice may speak into, without
// permitting it to dilute or euphemize its own tradition. A voice that
// cannot honestly speak within a register's bounds declines ceremonially
// rather than performing a softened version of itself. This is the same
// fail-closed posture as the Guardian itself: ambiguity resolves toward
// the more conservative register, never the looser one.

export type AudienceRegister = "adult" | "young_adult" | "youth";

export type ThemeTag =
  | "sexuality_fertility"
  | "suffering_affliction"
  | "violence_warfare"
  | "transgression_taboo";

export interface RegisterProfile {
  id: AudienceRegister;
  lexicalTier: 1 | 2 | 3;
  gatedThemes: ThemeTag[];
  declineOverDilute: boolean;
  requiresGuardianConsent: boolean;
  version: string;
}

export const REGISTER_PROFILES: Record<AudienceRegister, RegisterProfile> = {
  adult: {
    id: "adult",
    lexicalTier: 3,
    gatedThemes: [],
    declineOverDilute: false,
    requiresGuardianConsent: false,
    version: "1.0.0",
  },
  young_adult: {
    id: "young_adult",
    lexicalTier: 2,
    gatedThemes: ["sexuality_fertility", "suffering_affliction"],
    declineOverDilute: true,
    requiresGuardianConsent: false,
    version: "1.0.0",
  },
  youth: {
    id: "youth",
    lexicalTier: 1,
    gatedThemes: [
      "sexuality_fertility",
      "suffering_affliction",
      "violence_warfare",
      "transgression_taboo",
    ],
    declineOverDilute: true,
    requiresGuardianConsent: true,
    version: "1.0.0",
  },
};

const THEME_DESCRIPTIONS: Record<ThemeTag, string> = {
  sexuality_fertility: "explicit sexuality or fertility content",
  suffering_affliction: "graphic suffering, illness, or affliction",
  violence_warfare: "graphic violence or warfare",
  transgression_taboo: "transgression or taboo-breaking as a central image",
};

export function describeGatedThemes(profile: RegisterProfile): string {
  if (profile.gatedThemes.length === 0) return "";
  return profile.gatedThemes.map((t) => THEME_DESCRIPTIONS[t]).join(", ");
}
