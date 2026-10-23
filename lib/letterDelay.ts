// lib/letterDelay.ts
//
// The delays a seeker may choose for a kept Threshold Letter's email (M4,
// docs/inhabiting-the-elder.md). A CLOSED set on purpose:
//
//   - Each letter is still sent exactly once, ever (the cron's by-construction
//     guarantee). This is a choice of delay, not a recurring rhythm.
//   - No short option ("tomorrow", "next week"): a short delay makes the email
//     a nudge. Longer delays make it a keepsake -- dwelling, not retention.
//   - No randomness, no "surprise me".
//
// Pure: no DB, no clock. The values are mirrored by the CHECK constraints in
// migrations/028; change both together.

export const LETTER_DELAY_CHOICES = [3, 30, 90] as const;
export type LetterDelayDays = (typeof LETTER_DELAY_CHOICES)[number];

/** The original behaviour (migration 016) and the default for anyone who has not chosen. */
export const DEFAULT_LETTER_DELAY_DAYS: LetterDelayDays = 3;

/** Interface labels (the interface speaking, not the Elder's voice). */
export const LETTER_DELAY_LABELS: Record<LetterDelayDays, string> = {
  3: 'in a few days',
  30: 'in a month',
  90: 'in a season',
};

export const LETTER_DELAY_OFF_LABEL = 'not by email';

/** Accepts only the closed set; anything else is null (never coerced). */
export function parseLetterDelay(value: unknown): LetterDelayDays | null {
  return (LETTER_DELAY_CHOICES as readonly unknown[]).includes(value) ? (value as LetterDelayDays) : null;
}
