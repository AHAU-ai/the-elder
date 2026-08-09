/**
 * signoffStatus.ts
 *
 * Source of truth for whether a human with actual legal/clinical
 * authority has signed off on a given compliance-gated item. Backed by
 * signoff-status.json, which is meant to be hand-edited only after a real
 * review happens (see docs/signoff/*.md for the packets sent to
 * reviewers) -- never flipped to "approved" as a code change alone.
 */

import statusData from './signoff-status.json';

export type SignoffState = 'not_reviewed' | 'approved' | 'approved_with_conditions' | 'rejected';

export type SignoffKey = 'coppaChildTier' | 'crisisCopyChild' | 'crisisCopyYoungAdult';

interface SignoffRecord {
  status: SignoffState;
  reviewer: string | null;
  date: string | null;
  packet: string;
  notes: string;
}

const STATUS = statusData as Record<SignoffKey, SignoffRecord>;

export function getSignoff(key: SignoffKey): SignoffRecord {
  return STATUS[key];
}

/** True only for a clean "approved" -- "approved_with_conditions" requires a human to have applied those conditions in code first, so it does not auto-pass here. */
export function isApproved(key: SignoffKey): boolean {
  return STATUS[key]?.status === 'approved';
}
