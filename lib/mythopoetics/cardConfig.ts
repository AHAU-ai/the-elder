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

// A CardQuote is text that has already passed through pullQuote() below --
// the only place permitted to mint one. Everything downstream that used to
// just trust callers to pass "the short quote, not the raw paragraph" now
// has that trust checked by tsc instead of by someone re-tracing every
// caller by hand: ShareableCard's `line` prop, the /api/share request body,
// shareLedger's `createShareCard` param, and `ShareCardEntry.line` all
// require CardQuote, not string. A raw string handed to any of those is a
// compile error, not a silent content mismatch between the rasterized PNG,
// the persisted share record, and the public /share/[id] page.
export type CardQuote = string & { readonly __brand: 'CardQuote' }

// Hard ceiling on a card quote's length. ShareableCard.tsx sizes the card
// to its content (no fixed aspectRatio) rather than clipping, but that only
// works if the text itself can't grow without bound. Exported so
// app/api/share/route.ts can enforce the same ceiling server-side -- the
// CardQuote brand only binds callers that go through tsc; a modified or
// hostile client can still POST an arbitrary string, so the wire boundary
// needs its own runtime check against the real limit, not a looser one.
export const MAX_LINE_CHARS = 170

function truncateLine(raw: string, max: number): string {
  const trimmed = raw.trim()
  if (trimmed.length <= max) return trimmed
  const cut = trimmed.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

// `raw` reaches this two ways: CouncilTabs.tsx / Threshold.tsx's "Keep This
// Gift" pass the full returnGift paragraph from lib/psychopompLayer.ts
// unedited (~250-315 chars of connected prose); Threshold.tsx's "Make this
// your card" (a text-selection popover) passes whatever the seeker
// deliberately highlighted -- usually already short, but not guaranteed.
//
// If it already fits, it's returned exactly as given -- untouched. This
// matters even for the auto-populated case: some returnGift paragraphs are
// themselves short and multi-sentence ("What is in your prohairesis... And
// the duty you now return to, undistorted.", 142 chars), and always
// extracting "the last sentence" would silently drop the first one even
// though nothing needed to be cut.
//
// Past the cap, the last sentence is extracted rather than truncating from
// the front. This is tuned for the returnGift case specifically -- that
// prose is consistently written to close on a short, aphoristic final
// sentence ("Delphi gives the question, not the answer."), so the last
// sentence beats keeping the setup and cutting the payoff. It's a weaker
// fit for an over-cap deliberate selection spanning multiple sentences,
// but that's a narrow edge case not worth a caller-aware special path.
export function pullQuote(raw: string, max: number = MAX_LINE_CHARS): CardQuote {
  const trimmed = raw.trim()
  if (trimmed.length <= max) return trimmed as CardQuote
  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean)
  const candidate = sentences[sentences.length - 1] ?? trimmed
  return truncateLine(candidate, max) as CardQuote
}

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
