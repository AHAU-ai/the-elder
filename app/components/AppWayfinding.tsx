'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const destinations = [
  { href: '/', label: 'The Fire' },
  { href: '/journal', label: 'Journal' },
  { href: '/letters', label: 'Letters' },
  { href: '/tree', label: 'Tree' },
  { href: '/about', label: 'About' },
] as const;

// One dwelling, not five pages (docs/inhabiting-the-elder.md, M3): the rooms
// stand around the hearth, and the hearth -- The Fire -- is always the one
// lit thing between them. Every room is open from the first visit; nothing
// here unlocks, counts, or shows progress.
const rooms = destinations.filter(({ href }) => href !== '/');
const hearth = destinations[0];
const leftRooms = rooms.slice(0, 2);   // Journal, Letters
const rightRooms = rooms.slice(2);     // Tree, About

const secondaryRoutes: ReadonlySet<string> = new Set(
  destinations.map(({ href }) => href).filter((href) => href !== '/'),
);

export default function AppWayfinding({
  placement = 'header',
}: {
  placement?: 'header' | 'footer';
}) {
  const pathname = usePathname();

  if (placement === 'header' && !secondaryRoutes.has(pathname)) return null;
  if (placement === 'footer' && pathname !== '/') return null;

  const renderItem = ({ href, label }: (typeof destinations)[number], isHearth = false) => {
    const current = href === pathname;
    return (
      <li key={href}>
        <Link
          className={'app-wayfinding__link' + (isHearth ? ' app-wayfinding__link--hearth' : '')}
          href={href}
          aria-current={current ? 'page' : undefined}
        >
          {label}
        </Link>
      </li>
    );
  };

  const navigation = placement === 'header' ? (
    <nav className="app-wayfinding__nav" aria-label="The Elder">
      <ul className="app-wayfinding__list">
        {leftRooms.map((d) => renderItem(d))}
        {renderItem(hearth, true)}
        {rightRooms.map((d) => renderItem(d))}
      </ul>
    </nav>
  ) : (
    <nav className="app-wayfinding__nav" aria-label="The Elder">
      <ul className="app-wayfinding__list">
        {destinations.map(({ href, label }) => {
          const current = href === pathname;
          return (
            <li key={href}>
              <Link
                className="app-wayfinding__link"
                href={href}
                aria-current={current ? 'page' : undefined}
              >
                {label}
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
