// lib/i18n/reviewStatus.ts
//
// What we know about how trustworthy each language's text is.
//
// governance/checklist.yaml ELD-049 records that "10 languages supported but
// ceremonial register has not been verified in each. Machine-translated
// invocations may be grammatically correct and ceremonially hollow," and its
// mitigation is native-speaker review of register, not just accuracy. Until
// that review happens, the honest state of every non-English catalog is
// "machine draft". This file is where that state lives, so it is data the code,
// the tests and docs/i18n.md all read, rather than a comment someone forgets.
//
// To record a review: set `status: 'native-reviewed'`, name the reviewer in
// `reviewedBy`, and date it. Do NOT flip a status without a named human.

import type { Locale } from './languages';

export type ReviewStatus = 'source' | 'machine-draft' | 'native-reviewed';

export interface LocaleReview {
  status: ReviewStatus;
  /** Who verified register and accuracy; null until a named person has. */
  reviewedBy: string | null;
  /** ISO date of the review, or null. */
  reviewedOn: string | null;
}

const DRAFT: LocaleReview = { status: 'machine-draft', reviewedBy: null, reviewedOn: null };

export const LOCALE_REVIEW: Record<Locale, LocaleReview> = {
  en: { status: 'source', reviewedBy: null, reviewedOn: null },
  es: DRAFT,
  ki: DRAFT,
  fr: DRAFT,
  pt: DRAFT,
  de: DRAFT,
  da: DRAFT,
  nl: DRAFT,
  ja: DRAFT,
  ko: DRAFT,
  zh: DRAFT,
};

/**
 * Languages that show a visible "draft translation" note when selected.
 * K'iche' is the one that does (decision recorded 2026-10-13): machine
 * translation into K'iche' is the least reliable of the eleven and its ceremonial
 * register needs a native speaker (checklist ELD-049; Vincent can broker). The
 * note is bilingual on purpose: the K'iche' line is itself unreviewed, so the
 * English gloss is what a reader can rely on.
 */
export const DRAFT_NOTE: Partial<Record<Locale, { native: string; english: string }>> = {
  ki: {
    native: "Re tzijonem re' xa nab'e tz'ib'am; k'a kerilix rumal jun winäq ri retaman ri K'iche'.",
    english: "This is a draft translation, awaiting review by a K'iche' speaker. Most of the text is shown in Spanish until a K'iche' speaker can translate it.",
  },
};

/** The note to show for a locale right now, or null when it has none or has been reviewed. */
export function draftNoteFor(locale: Locale): { native: string; english: string } | null {
  const note = DRAFT_NOTE[locale];
  if (!note) return null;
  return LOCALE_REVIEW[locale].status === 'native-reviewed' ? null : note;
}
