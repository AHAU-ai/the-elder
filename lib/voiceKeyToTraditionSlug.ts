import type { VoiceKey } from '@/src/resilience/flags';

// lib/traditions.ts's TRADITION_MAP uses a different key vocabulary than the
// live VoiceKey union -- an older "tradition slug" set (e.g. "kiche" for the
// Maya voice, whose real VoiceKey is "ojer_tzij"). This is the inverse of
// lineageToVoiceKey.ts's map, translating into that vocabulary so
// lib/dualGuardian.ts's getTradition() lookup resolves correctly.
//
// 'bhikkhu' has no entry: TRADITION_MAP predates the Theravada voice's
// authorization (2026-07-31, Shalom Ormsby) and no one has authored its
// tradition boundary (canon anchors, forbidden list) yet. Per Lineage
// Integrity of Voice, that content must come from the lineage holder, not
// be invented here. Callers must handle a null return by skipping guardian
// review for this voice specifically, not by guessing a mapping.
const MAP: Partial<Record<VoiceKey, string>> = {
  ojer_tzij: 'kiche',
  keeper_of_the_fire: 'default',
  volva: 'norse',
  pythia: 'greek',
  hem_netjer: 'egyptian',
  sage_of_the_way: 'taoist',
  vedic: 'vedic',
  babalawo: 'yoruba',
  sufi: 'sufi',
  stoa: 'stoic',
  mekubal: 'mekubal',
  elder_of_country: 'dreamtime',
};

export function voiceKeyToTraditionSlug(voiceKey: VoiceKey): string | null {
  return MAP[voiceKey] ?? null;
}
