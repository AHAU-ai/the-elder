'use client';

// app/components/EmberDoor.tsx
//
// A wordless way into the Fire Meditation (/fire-meditation): one small lit
// ember, the same ember as the hearth link in the room header, breathing in
// opacity only. No visible text. The accessible name is aria/title only.
// Mounted in the Fireside Chat (the council) as its quiet neighbour: the chat
// is for speaking, the ember is for sitting without words.

import Link from 'next/link';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import { FIRE_MEDITATION_ROUTE } from '../../lib/fireMeditation';

export default function EmberDoor() {
  const { t } = useLanguage();
  return (
    <Link
      href={FIRE_MEDITATION_ROUTE}
      className="ember-door"
      aria-label={t('meditation.enter')}
      title={t('meditation.enter')}
    />
  );
}
