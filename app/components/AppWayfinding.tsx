'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import type { MessageKey } from '../../lib/i18n/translate';

const destinations = [
  { href: '/', label: 'nav.fire' },
  { href: '/journal', label: 'nav.journal' },
  { href: '/letters', label: 'nav.letters' },
  { href: '/tree', label: 'nav.tree' },
  { href: '/about', label: 'nav.about' },
] as const satisfies ReadonlyArray<{ href: string; label: MessageKey }>;

// The fireside is a room like the others, but it exists only where it is lit
// for this seeker (docs/fireside.md). It stands beside the hearth, on the side
// of the Tree. Until the server says it is lit, it is simply not in the nav.
const fireside = { href: '/fireside', label: 'nav.fireside' } as const satisfies { href: string; label: MessageKey };

// One dwelling, not five pages (docs/inhabiting-the-elder.md, M3): the rooms
// stand around the hearth, and the hearth -- The Fire -- is always the one
// lit thing between them. Every room is open from the first visit; nothing
// here unlocks, counts, or shows progress.
const rooms = destinations.filter(({ href }) => href !== '/');
const hearth = destinations[0];
const leftRooms = rooms.slice(0, 2);   // Journal, Letters
const rightRooms = rooms.slice(2);     // Tree, About

const secondaryRoutes: ReadonlySet<string> = new Set([
  ...destinations.map(({ href }) => href).filter((href) => href !== '/'),
  fireside.href,
]);

export default function AppWayfinding({
  placement = 'header',
}: {
  placement?: 'header' | 'footer';
}) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [firesideLit, setFiresideLit] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/fireside/probe', { signal: ctrl.signal, cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { lit?: unknown }) => setFiresideLit(d.lit === true))
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  if (placement === 'header' && !secondaryRoutes.has(pathname)) return null;
  if (placement === 'footer' && pathname !== '/') return null;

  const renderItem = ({ href, label }: { href: string; label: MessageKey }, isHearth = false) => {
    const current = href === pathname;
    return (
      <li key={href}>
        <Link
          className={'app-wayfinding__link' + (isHearth ? ' app-wayfinding__link--hearth' : '')}
          href={href}
          aria-current={current ? 'page' : undefined}
        >
          {t(label)}
        </Link>
      </li>
    );
  };

  const navigation = placement === 'header' ? (
    <nav className="app-wayfinding__nav" aria-label={t('nav.aria')}>
      <ul className="app-wayfinding__list">
        {leftRooms.map((d) => renderItem(d))}
        {renderItem(hearth, true)}
        {firesideLit && renderItem(fireside)}
        {rightRooms.map((d) => renderItem(d))}
      </ul>
    </nav>
  ) : (
    <nav className="app-wayfinding__nav" aria-label={t('nav.aria')}>
      <ul className="app-wayfinding__list">
        {(firesideLit
          ? [destinations[0], fireside, ...destinations.slice(1)]
          : [...destinations]
        ).map(({ href, label }) => {
          const current = href === pathname;
          return (
            <li key={href}>
              <Link
                className="app-wayfinding__link"
                href={href}
                aria-current={current ? 'page' : undefined}
              >
                {t(label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  return placement === 'header'
    ? <header className="app-wayfinding">{navigation}</header>
    : <div className="app-wayfinding app-wayfinding--footer">{navigation}</div>;
}
