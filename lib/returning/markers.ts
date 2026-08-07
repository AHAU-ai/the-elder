// lib/returning/markers.ts
//
// selectMarkerToOffer() / buildMarkerOffer(): §1.5 marker confirmation —
// selects the single marker to offer back to the person, and generates the
// interrogative, in-register offer text. Markers themselves come from
// lib/markerExtractor.ts (a separate model call, mirroring mythExtractor.ts)
// — not from a tag the primary model emits inline; see that module's header
// for why.
//
// NOTE: selectMarkerToOffer was originally designed around an emphasisScore
// per marker, but the extractor returns a flat MythicMarkers object with
// no score — there is no real emphasis signal available. Simplified to
// fixed-priority selection only (2026-06-30). If real emphasis scoring is
// ever added, this can be revisited.

import type { MythicMarkers } from "@/lib/returning/visit";
import Anthropic from '@anthropic-ai/sdk';
import { PRIMARY_MODEL } from '@/lib/model.config';
import { buildSystemPrompt } from '@/lib/system-prompt-builder';
import type { LineageKey } from '@/lib/lineages';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type MarkerField = 'wound' | 'figure' | 'threshold' | 'exile' | 'pattern';

// Design constraint 1: ONE marker offered per encounter, not all five.
const FALLBACK_PRIORITY: MarkerField[] = [
  'wound',
  'threshold',
  'pattern',
  'exile',
  'figure',
];

export interface MarkerSelection {
  field: MarkerField;
  proposedText: string;
}

/**
 * Select the single marker to offer back, from the markers already proposed
 * for this visit. Walks `priorityOrder` (defaults to the static
 * FALLBACK_PRIORITY) and returns the first marker present. A returning
 * seeker's personalized deficit order (see lib/returning/markerDeficit.ts)
 * can be passed in its place without touching this function's core logic.
 * Returns null if no markers were proposed at all.
 */
export function selectMarkerToOffer(
  markers: MythicMarkers,
  priorityOrder: MarkerField[] = FALLBACK_PRIORITY
): MarkerSelection | null {
  for (const field of priorityOrder) {
    const value = markers[field];
    if (value) {
      return { field, proposedText: value };
    }
  }
  return null;
}

export async function buildMarkerOffer(
  selection: MarkerSelection,
  lineageKey: string = 'default',
  languageName: string = 'English'
): Promise<string> {
  // Speak the offer in the SAME voice that delivered the visit's Reading —
  // the caller passes visit.lineageKey. Hardcoding one tradition here would
  // bleed its register into every other lineage's fire.
  const systemPrompt = buildSystemPrompt((lineageKey as LineageKey) || 'default', false, false, languageName);

  const instruction = `You are reflecting back a single mythic marker you sensed beneath the seeker's words — not delivering a Reading, not in Council. This is a single, contained moment of offering.

What you sensed: ${selection.proposedText}

Offer this back to the seeker in your voice, as your own field would — interrogatively, never declaratively. Do not name it as a category or use clinical language (no "marker," "wound," "pattern," or similar taxonomy words). Reflect the content itself, then ask, in a single question, whether you have read it rightly — leaving real room for the seeker to say no or reshape it. This is co-authorship, not confirmation of an answer you already hold.`;

  const response = await anthropic.messages.create({
    model: PRIMARY_MODEL,
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: 'user', content: instruction }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('marker_offer_empty_response');
  }

  return textBlock.text.trim();
}
