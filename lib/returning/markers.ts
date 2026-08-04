// lib/returning/markers.ts
//
// extractMarkers(): pulls the Elder's proposed markers out of raw response
// text. Original implementation — restored after an accidental overwrite
// 2026-06-30; do not remove.
//
// selectMarkerToOffer() / buildMarkerOffer(): §1.5 marker confirmation —
// selects the single marker to offer back to the person, and generates the
// interrogative, in-register offer text.
// Per elder-1.5-marker-confirmation-spec.md.
//
// NOTE: selectMarkerToOffer was originally designed around an emphasisScore
// per marker, but extractMarkers() returns a flat MythicMarkers object with
// no score — there is no real emphasis signal available. Simplified to
// fixed-priority selection only (2026-06-30). If real emphasis scoring is
// ever added to extractMarkers(), this can be revisited.

import type { MythicMarkers } from "@/lib/returning/visit";
import Anthropic from '@anthropic-ai/sdk';
import { PRIMARY_MODEL } from '@/lib/model.config';
import { buildSystemPrompt } from '@/lib/system-prompt-builder';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** Extract the <markers>{...}</markers> JSON the Elder emits; return display text stripped of it. */
export function extractMarkers(raw: string): { displayText: string; markers: MythicMarkers } {
  const m = raw.match(/<markers>([\s\S]*?)<\/markers>/);
  let markers: MythicMarkers = {};
  if (m) {
    try {
      const parsed = JSON.parse(m[1]);
      markers = Object.fromEntries(
        Object.entries(parsed).filter(([, v]) => v != null && v !== "")
      ) as MythicMarkers;
    } catch {
      markers = {};
    }
  }
  return { displayText: raw.replace(/<markers>[\s\S]*?<\/markers>/, "").trim(), markers };
}

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
 * for this visit. Fixed priority order — no emphasis scoring available.
 * Returns null if no markers were proposed at all.
 */
export function selectMarkerToOffer(markers: MythicMarkers): MarkerSelection | null {
  for (const field of FALLBACK_PRIORITY) {
    const value = markers[field];
    if (value) {
      return { field, proposedText: value };
    }
  }
  return null;
}

export async function buildMarkerOffer(
  selection: MarkerSelection,
  languageName: string = 'English'
): Promise<string> {
  const systemPrompt = buildSystemPrompt('maya', false, false, languageName);

  const instruction = `You are reflecting back a single mythic marker you sensed beneath the seeker's words — not delivering a Reading, not in Council. This is a single, contained moment of offering.

What you sensed: ${selection.proposedText}

Offer this back to the seeker in your voice, as the ojer_tzij field would — interrogatively, never declaratively. Do not name it as a category or use clinical language (no "marker," "wound," "pattern," or similar taxonomy words). Reflect the content itself, then ask, in a single question, whether you have read it rightly — leaving real room for the seeker to say no or reshape it. This is co-authorship, not confirmation of an answer you already hold.`;

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
