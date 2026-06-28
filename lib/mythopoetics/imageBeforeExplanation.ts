/**
 * lib/mythopoetics/imageBeforeExplanation.ts
 *
 * Image-Before-Explanation Constraint — Feature #2 of the Applied Mythopoetics scaffold.
 *
 * GOVERNANCE
 *   Scope:         ojer_tzij (maya) voice only. See VOICE-DIRECTIVE-PROTOCOL.md §5.3.
 *   Pipeline:      Post-processor. Runs on the response string AFTER model generation,
 *                  AFTER the welfare gate has already cleared. See protocol §3, step 4.
 *   Role:          Fallback safety net. If this fires frequently, the Ajq'ij Directive
 *                  (ajqijDirective.ts) needs strengthening — not this function.
 *   Stanzione:     Standing authorization covers all ojer_tzij architectural decisions.
 *   Shalom:        Requires PR sign-off before merge to main.
 *
 * WHAT THIS DOES
 *   Checks whether a response draft opens with archetypal image/personification
 *   or with abstract concept. If abstraction leads, restructures the opening
 *   to place the image first.
 *
 *   "Image" means: a named figure, creature, place, or action from the K'iche'
 *   mythological field — corn, the milpa, Xibalba, the Lords, the Hero Twins,
 *   a nahual, a count, a road, a fire, a seed, a threshold.
 *
 *   "Abstraction" means: a concept word leading the sentence without a prior
 *   image to ground it — pattern, cycle, transition, resistance, integration,
 *   process, dynamic, theme, aspect, energy, force.
 *
 * CALL SITE
 *   In app/api/divine/route.ts, after cleanText is assembled, before the
 *   final NextResponse.json return — and only when lineageKey === 'maya':
 *
 *     import { enforceImageFirst } from '@/lib/mythopoetics/imageBeforeExplanation';
 *
 *     const finalText = (body.lineageKey === 'maya')
 *       ? enforceImageFirst(cleanText)
 *       : cleanText;
 */

// -- Constants ---------------------------------------------------------------

/**
 * Abstract concept words that, if they open a response, indicate the
 * image-first constraint has been violated.
 * Lowercase. Matched against the first sentence of the draft.
 */
const ABSTRACTION_LEADS: readonly string[] = [
  'the pattern',
  'the cycle',
  'the dynamic',
  'the process',
  'the theme',
  'the aspect',
  'the energy',
  'the force',
  'the transition',
  'the integration',
  'the resistance',
  'the tension',
  'the movement',
  'the current',
  'the impulse',
  'this pattern',
  'this cycle',
  'this dynamic',
  'this process',
  'this theme',
  'this tension',
  'what you are',
  'what you describe',
  'what you carry',
  'you are experiencing',
  'you are in',
  'you are moving',
  'you are facing',
  'there is a',
  'there are',
  'i see a pattern',
  'i see a cycle',
  'i notice',
  'i sense',
];

/**
 * Image-anchor words from the K'iche' field that, if present in the first
 * sentence, confirm the constraint is already satisfied.
 */
const IMAGE_ANCHORS: readonly string[] = [
  'corn',
  'milpa',
  'seed',
  'fire',
  'smoke',
  'road',
  'house',
  'xibalba',
  'lord',
  'hero',
  'twin',
  'nahual',
  'count',
  'calendar',
  'day',
  'dawn',
  'dark',
  'buried',
  'planted',
  'threshold',
  'crossing',
  'jaguar',
  'quetzal',
  'mountain',
  'water',
  'river',
  'blood',
  'bone',
  'ancestor',
  'lineage',
  'sky',
  'earth',
  'chol',
  "q'ij",
  "ajq'ij",
  'popol',
  'wuj',
  'ixim',
];

// -- Core export -------------------------------------------------------------

/**
 * Checks whether the draft leads with archetypal image or abstraction.
 * If abstraction leads, prepends a restructuring instruction bracket
 * that signals the violation for logging — and returns the draft unchanged
 * so the seeker still receives a response.
 *
 * NOTE: This is a detection-and-flag implementation. Full rewrite logic
 * would require a second model call, which is outside the current scope.
 * If violation rate exceeds 10% in production, escalate to Shalom for
 * a rewrite-via-model-call architecture decision.
 */
export function enforceImageFirst(draft: string): string {
  const violation = detectsViolation(draft);

  if (!violation) return draft;

  // Log the violation signal inline — stripped by the client alongside
  // CEILING and READY tokens. Does not reach the seeker.
  const signal = '\u29c1IMAGE_FIRST_VIOLATION\u29c1';

  return draft + '\n' + signal;
}

/**
 * Returns true if the draft's first substantive sentence opens with
 * an abstraction rather than an image.
 */
export function detectsViolation(draft: string): boolean {
  const first = firstSentence(draft).toLowerCase();

  // If an image anchor is present in the first sentence, constraint satisfied.
  if (IMAGE_ANCHORS.some(anchor => first.includes(anchor))) return false;

  // If an abstraction lead is present, constraint violated.
  if (ABSTRACTION_LEADS.some(lead => first.startsWith(lead))) return true;

  return false;
}

// -- Helpers -----------------------------------------------------------------

/**
 * Extracts the first substantive sentence from the draft.
 * Skips section headers (lines starting with ## or ⊡).
 */
function firstSentence(draft: string): string {
  const lines = draft.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('##')) continue;
    if (trimmed.startsWith('\u29c1')) continue; // ⊡ section markers

    // Return up to the first sentence terminator
    const match = trimmed.match(/^[^.!?]+[.!?]/);
    return match ? match[0] : trimmed;
  }

  return draft.slice(0, 200);
}
