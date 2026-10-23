// lib/i18n/cardKeys.ts
// Catalog keys for the card's marker names, so ShareableCard and
// SharedCardView say them in the seeker's language. MARKER_LABELS in
// lib/mythopoetics/cardConfig.ts stays as the English source.
import type { MarkerType } from '../mythopoetics/cardConfig';
import type { MessageKey } from './translate';

export const MARKER_LABEL_KEYS: Record<MarkerType, MessageKey> = {
  wound: 'card.marker_wound',
  threshold: 'card.marker_threshold',
  pattern: 'card.marker_pattern',
  exile: 'card.marker_exile',
  figure: 'card.marker_figure',
};
