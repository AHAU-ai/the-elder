// lib/overDwelling.ts
//
// The over-dwelling guard (M7, docs/inhabiting-the-elder.md). Pure and
// client-safe: the numbers, the rule, and the register check. The server-side
// count and the governance gate live in lib/returning/dwelling.ts.
//
// What it is: when completed sittings pile up in a short window, the CLOSE of
// a sitting is quieter. The fire is banked a little lower, the closing ring
// draws in more slowly, and (if the reviewer has chosen one) one plain line
// stands where the optional closing acknowledgment would.
//
// What it is not, and must never become:
//   - It counts ONE thing: completed Readings in the visit ledger. Not page
//     loads, not time on site, not what was said, not the hour.
//   - It changes only the instrument's manner. Nothing is locked, hidden,
//     delayed or rate-limited by it; "return to the fire" is always there.
//   - It never speaks about the pattern: no number, no "again", no "enough".
//   - It infers nothing about the seeker.
//
// The values below are ENGINEERING'S STRAWMAN, not evidence
// (docs/signoff/over-dwelling-threshold-packet.md, Artifact 2). The guard is
// inert until the reviewer has approved `overDwellingThreshold` in
// lib/compliance/signoff-status.json AND has chosen the wording below. The
// reviewer changes these; engineering does not choose them.

export interface DwellingParams {
  /** Rolling window the sittings are counted in. */
  windowMs: number;
  /** This many completed Readings in the window, or more, quiets the close. */
  threshold: number;
}

export const OVER_DWELLING: DwellingParams = {
  windowMs: 24 * 60 * 60 * 1000,
  threshold: 3,
};

/**
 * The one plain line. null until the reviewer adopts one: with no line the
 * close is still quieter and slower, it simply says nothing extra. Whatever is
 * adopted must pass closingLineViolations() (enforced in
 * lib/overDwelling.test.ts and scripts/check-opening-register.mjs).
 */
export const QUIET_CLOSING_LINE: string | null = null;

/**
 * The one sentence About says (packet: "It is disclosed"). null until the
 * reviewer adopts wording; the guard does not run while this is null, so it
 * can never be live undisclosed. It must not give the number. Adopting it
 * means adding it to every language catalog through lib/i18n.
 */
export const QUIET_DISCLOSURE: string | null = null;

/** How much slower the closing ring draws in during a quiet close. */
export const QUIET_CLOSE_SLOWDOWN = 1.5;

/**
 * The fire's extra dimming during the window. Strictly below the M5 ceiling
 * (BANK_VEIL_MAX in lib/hearthBank.ts, 0.28): clearly lit, never a dead fire.
 */
export const QUIET_VEIL_MAX = 0.14;
export const QUIET_VEIL_MS = 9000;

/** Device-local, like the bank: the end of the window as the server last told this browser. */
export const QUIET_UNTIL_KEY = 'elder_hearth_quiet_until_v1';
/** Dispatched on window when the server reports a quiet close, so the fire can follow. */
export const QUIET_EVENT = 'elder:dwelling-quiet';

export interface DwellingAssessment {
  quiet: boolean;
  /** Milliseconds until the count would fall below the threshold. 0 when not quiet. */
  untilMs: number;
}

/**
 * Pure rule over visit timestamps (epoch ms). Anything non-finite or in the
 * future is ignored rather than counted: a clock oddity must never quiet the
 * fire. Callers pass only what the ledger holds; this never sees content.
 */
export function assessDwelling(
  timestampsMs: readonly number[],
  nowMs: number,
  params: DwellingParams = OVER_DWELLING
): DwellingAssessment {
  const inWindow = timestampsMs
    .filter((t) => Number.isFinite(t) && t <= nowMs && nowMs - t < params.windowMs)
    .sort((a, b) => a - b);
  if (params.threshold < 1 || inWindow.length < params.threshold) return { quiet: false, untilMs: 0 };
  // Quiet until enough of the oldest sittings have aged out to drop below the threshold.
  const lastToAgeOut = inWindow[inWindow.length - params.threshold];
  return { quiet: true, untilMs: Math.max(0, lastToAgeOut + params.windowMs - nowMs) };
}

// Register rules for the closing line, mirrored in scripts/check-opening-register.mjs
// (that script keeps its own copy and reads the source as text, like the others).
const LINE_FORBIDDEN: ReadonlyArray<[RegExp, string]> = [
  [/\b(hello|hi|welcome|greetings|good (morning|evening|night))\b/i, 'greeting'],
  [/\d/, 'number'],
  [/\b(again|so soon|enough|rest|often|many|much|too|times?|once more|back|return(ed)?|today|tonight|lately|already|still)\b/i, 'refers to frequency or pattern'],
  [/\b(you|your|you're|yours)\b/i, 'addresses or characterises the seeker'],
  [/^\s*(close|open|breathe|sit|stand|walk|step|feel|let|begin|come|go|enter|receive|give|take|say|speak|ask|choose|name|look|listen|hold|rest|stop|wait|pause|remember|trust|know|try)\b/i, 'sentence-initial bare imperative'],
  [/\b(should|must|need to|have to)\b/i, 'directive'],
  [/[!?]/, 'exclamation or question'],
  [/\b(miss(ed)?|waiting|longing|wait for)\b/i, 'performs attachment'],
];

/** Reasons a candidate closing line is out of register. Empty means it may be adopted. */
export function closingLineViolations(line: string): string[] {
  return LINE_FORBIDDEN.filter(([re]) => re.test(line)).map(([, label]) => label);
}
