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

  const navigation = (
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
