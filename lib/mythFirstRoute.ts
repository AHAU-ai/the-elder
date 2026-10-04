// lib/mythFirstRoute.ts
//
// Route-side glue for myth-first Readings (docs/myth-first-spec.md, MF-4).
// Everything the divine route needs to decide or shape, kept pure so it can be
// tested without a server, a model or a database. The route owns the I/O: it
// starts the selector, reads the welfare result and the seeker's stored
// archetype, and hands the results here.
//
// With the flag off nothing in this file changes a response: the route calls
// mythFirstStageAllows() first and skips the rest.

import type { ArchetypeCard } from './archetypes';
import {
  findCard,
  mythFirstDelivery,
  mythFirstEligibility,
  mythFirstMoreToCome,
  type MythFirstDecision,
  type MythFirstDelivery,
  type MythFirstEligibilityInput,
  type MythFirstIneligibleReason,
  type MythFirstPlan,
} from './mythFirst';
import { getCatalog } from './mythFirst';
import type { SelectorResult } from './mythFirstSelector';

interface Msg {
  role: string;
  content: unknown;
}

/** Longest figure name we will look at from the client before comparing it to the catalog. */
const CLIENT_FIGURE_MAX = 120;

/** What the client asked for. Advisory only: eligibility is decided on the server. */
export interface MythFirstRequest {
  requested: boolean;
  /** The client's figure name, or null when absent or not a short string. */
  clientFigure: string | null;
}

export function readMythFirstRequest(body: { readingForm?: unknown; figure?: unknown }): MythFirstRequest {
  const requested = body.readingForm === 'myth_first';
  const f = body.figure;
  const clientFigure = typeof f === 'string' && f.length > 0 && f.length <= CLIENT_FIGURE_MAX ? f : null;
  return { requested, clientFigure };
}

/**
 * Rollout stage (decision D10, testers first). The master switch is
 * MYTH_FIRST_ENABLED. While MYTH_FIRST_ALL_SEEKERS is not "true", only tester
 * accounts are eligible, which is stage 1 of the rollout in MF-8. Both are
 * read at call time and fail closed.
 */
export function mythFirstStageAllows(i: { flagOn: boolean; openToAll: boolean; isTester: boolean }): boolean {
  if (!i.flagOn) return false;
  return i.openToAll || i.isTester;
}

/** The number of assistant turns in the history the route has validated. */
export function priorAssistantTurns(messages: readonly Msg[]): number {
  return messages.filter((m) => m.role === 'assistant').length;
}

export interface SelectorNeed {
  stageAllows: boolean;
  requested: boolean;
  lineageKey: string;
  voiceKey: string;
  mode: string;
  isDeepen: boolean;
  segmentIndex: number | null;
  /** The client's figure, already checked against the catalog. */
  clientCard: ArchetypeCard | null;
  wholeVoices?: ReadonlySet<string>;
}

/**
 * Whether the route should spend a selector call. Only at the start of a
 * myth-first Reading (segment 0, or the single request of a whole delivery),
 * or on a later segment whose figure the client failed to send back. Cheap
 * checks only; the full eligibility decision still follows.
 */
export function selectorNeeded(i: SelectorNeed): boolean {
  if (!i.stageAllows || !i.requested || i.isDeepen) return false;
  if (i.mode !== 'reading' && i.mode !== 'council') return false;
  if (getCatalog(i.lineageKey).length === 0) return false;
  const delivery = mythFirstDelivery(i.voiceKey, i.wholeVoices);
  if (delivery === null) return false;
  if (delivery === 'segmented') {
    if (i.segmentIndex === null) return false;
    if (i.segmentIndex === 0) return true;
    return i.clientCard === null;
  }
  return i.segmentIndex === null;
}

/**
 * The retrieval query for a myth-first Reading: the figure, not the seeker's
 * story, so the myth is told from the lineage's own text and the story stays
 * out of the first movement.
 */
export function figureRetrievalQuery(card: ArchetypeCard): string {
  return `${card.name}. ${card.role}`;
}

export interface ResolveInput extends Omit<MythFirstEligibilityInput, 'flagOn' | 'requested' | 'figure'> {
  stageAllows: boolean;
  /** The resolved narrative register. The child tier is never myth-first (D17). */
  register: string | null;
  request: MythFirstRequest;
  /** The selector's result, or null when the route did not run it. */
  selector: SelectorResult | null;
}

export interface ResolvedMythFirst {
  /** Non-null means the Reading is told myth-first. */
  plan: MythFirstPlan | null;
  decision: MythFirstDecision;
  /** Short codes for the route to log: why a requested Reading fell back. */
  notes: string[];
}

/**
 * Pick the figure and apply the eligibility rules. On segment 0 and for a
 * whole delivery the selector's figure is used and the client's is ignored; on
 * later segments the client's figure is used when it is in the catalog, else
 * the selector's. A failure anywhere is a story-first Reading.
 */
export function resolveMythFirst(i: ResolveInput): ResolvedMythFirst {
  const notes: string[] = [];
  const { stageAllows, request, selector, register, ...rest } = i;

  if (register === 'child') {
    const asked = request.requested && stageAllows;
    return {
      plan: null,
      decision: { eligible: false, reason: 'welfare' },
      notes: asked ? ['myth_first_fallback:child_register'] : [],
    };
  }

  const clientCard = request.clientFigure ? findCard(i.lineageKey, request.clientFigure) : null;
  if (request.clientFigure && !clientCard && i.segmentIndex !== null && i.segmentIndex > 0) {
    notes.push('figure_off_catalog');
  }

  const continuing = i.segmentIndex !== null && i.segmentIndex > 0;
  let figure: unknown = null;
  if (continuing) {
    figure = clientCard ? clientCard.name : selector?.figure?.name ?? null;
  } else {
    figure = selector?.figure?.name ?? null;
  }
  if (selector && selector.figure === null && selector.note) notes.push(selector.note);

  const decision = mythFirstEligibility({
    ...rest,
    flagOn: stageAllows,
    requested: request.requested,
    figure,
  });

  if (decision.eligible) {
    return { plan: { delivery: decision.delivery, card: decision.card }, decision, notes };
  }
  if (request.requested && stageAllows) notes.push('myth_first_fallback:' + ('reason' in decision ? decision.reason : 'unknown'));
  return { plan: null, decision, notes };
}

export type { MythFirstIneligibleReason };

/** moreToCome for a myth-first response: the server decides, whatever the model emitted. */
export function mythFirstServerMoreToCome(plan: MythFirstPlan, segmentIndex: number | null): boolean {
  return mythFirstMoreToCome(plan.delivery, segmentIndex);
}

/** The archetype the Reading persists: the chosen figure, on the final segment or a whole delivery. */
export function mythFirstArchetypeName(plan: MythFirstPlan, moreToCome: boolean): string | null {
  return moreToCome ? null : plan.card.name;
}

export interface MythFirstResponseFields {
  form: 'myth_first' | 'story_first';
  delivery?: MythFirstDelivery;
  figure?: string;
}

/**
 * The fields added to the response. With the flag off, or when the request
 * did not ask, the route adds nothing, so the response shape is unchanged.
 */
export function mythFirstResponseFields(plan: MythFirstPlan | null, asked: boolean): MythFirstResponseFields | null {
  if (plan) return { form: 'myth_first', delivery: plan.delivery, figure: plan.card.name };
  return asked ? { form: 'story_first' } : null;
}
