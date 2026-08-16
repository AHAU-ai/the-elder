// lib/mythopoetics/cardConfig.ts
//
// Visual language for the shareable reading card. Reuses the existing
// Lintel/Threshold color tokens (see app/components/LintelShared.tsx)
// rather than inventing a second palette system.
//
// Per-voice accent overrides are gated by authorization status, same
// principle as Lineage Integrity of Voice: a voice only gets its own
// visual accent once its tradition-bearer has actually looked at it.
// Everything else — the eight provisional voices — renders with the
// shared default. This mirrors DEFAULT_FLAGS in src/resilience/flags.ts;
// update the AUTHORIZED set here if that changes.
//
// DECISION: no AI-generated imagery on the card, ever. A diffusion model
// asked for K'iche'/Ifá/Theravada-adjacent visuals produces ceremonial-
// looking fabrication trained on scraped, unauthorized source imagery —
// the same integrity violation Lineage Integrity of Voice exists to
// prevent, just in a picture instead of a sentence. The card's visual
// field is a templated system instead: a fixed glyph + palette per
// marker/voice (this file), same authorization-artifact logic as the
// rest of the card. If a future pass wants a richer background, it
// must stay inside this templated system — not a generated image.

import type { VoiceKey } from '@/src/resilience/flags'

export type MarkerType = 'wound' | 'threshold' | 'pattern' | 'exile' | 'figure'

export const MARKER_GLYPHS: Record<MarkerType, string> = {
  wound: '◈',
  threshold: '◫',
  pattern: '◇',
  exile: '◌',
  figure: '◆',
}

export const MARKER_LABELS: Record<MarkerType, string> = {
  wound: 'The Wound',
  threshold: 'The Threshold',
  pattern: 'The Pattern',
  exile: 'The Exile',
  figure: 'The Figure',
}

// Rough keyword cues for auto-suggesting a marker from the selected
// line. This is a starting guess only — the seeker can always
// override it by picking a different glyph before generating the card.
const MARKER_CUES: Record<MarkerType, string[]> = {
  wound: ['wound', 'ache', 'grief', 'scar', 'broken', 'hurt', 'loss'],
  threshold: ['threshold', 'door', 'cross', 'edge', 'brink', 'gate', 'passage'],
  pattern: ['pattern', 'cycle', 'again', 'return', 'repeat', 'weave', 'thread'],
  exile: ['exile', 'alone', 'apart', 'cast out', 'wilderness', 'distance', 'far'],
  figure: ['figure', 'shape', 'form', 'one who', 'the one', 'presence'],
}

export function suggestMarker(line: string): MarkerType {
  const lower = line.toLowerCase()
  let best: MarkerType = 'pattern'
  let bestScore = 0
  ;(Object.keys(MARKER_CUES) as MarkerType[]).forEach(marker => {
    const score = MARKER_CUES[marker].filter(cue => lower.includes(cue)).length
    if (score > bestScore) {
      bestScore = score
      best = marker
    }
  })
  return best
}

// Voices whose tradition-bearer has reviewed the visual register.
// Keep in sync with the authorized set in src/resilience/flags.ts —
// this file does not import that set directly because authorization
// of the *voice* and authorization of its *card accent* are meant to
// be separate sign-offs (a bearer approving the divinatory register
// doesn't automatically approve a color choice).
const AUTHORIZED_ACCENTS: Partial<Record<VoiceKey, string>> = {
  // ojer_tzij: undefined until Vincent reviews a card-specific accent
  // babalawo: undefined until Fama reviews a card-specific accent
  // elder_of_country: undefined until Barbara reviews a card-specific accent
}

const DEFAULT_ACCENT = '#d4a843' // C.gold from LintelShared

export function accentForVoice(voice: VoiceKey): string {
  return AUTHORIZED_ACCENTS[voice] ?? DEFAULT_ACCENT
}
