import type { LineageKey } from './lineages';
import type { VoiceKey } from '@/src/resilience/flags';

// Extracted from app/api/divine/route.ts so the card feature (client-side)
// can share the same mapping instead of duplicating it.
export function lineageToVoiceKey(lineageKey: LineageKey | string): VoiceKey {
  const map: Record<string, VoiceKey> = {
    maya:     'ojer_tzij',
    default:  'keeper_of_the_fire',
    norse:    'volva',
    greek:    'pythia',
    egyptian: 'hem_netjer',
    taoist:   'sage_of_the_way',
    vedic:    'vedic',
    yoruba:   'babalawo',
    sufi:     'sufi',
    stoic:    'stoa',
    mekubal:  'mekubal',
    dreamtime:'elder_of_country',
    buddhist: 'bhikkhu',
    chukchi:  'chukchi_shaman', // scaffolding — flag defaults false, see src/resilience/flags.ts
  };
  return map[lineageKey] ?? 'keeper_of_the_fire';
}
