'use client';

// app/components/MythPortrait.tsx
//
// "Your myth, so far" (docs/myth-so-far.md). The one place the seeker can see
// what the sittings are building toward: a road of four stations that ends at
// the Core Myth page only they can write, with the figures that have come and
// the words they have laid down so far gathered along it.
//
// What this component must NOT become (each is enforced upstream in
// lib/returning/mythPortraitDerive.ts, not just here):
//   - a scoreboard: no numerals about the seeker, no percent, no level, no
//     streak. Lit/unlit only, and unlit is an invitation, never a deficit.
//   - a blend: figures are listed one per tradition and never summarized
//     across traditions.
//   - a story the Elder tells about the seeker: the gathered lines are the
//     seeker's own confirmed words, rendered as a flat list. Nothing here
//     connects two of them.
//   - a nudge: no animation, no pulsing "next" marker, one optional door.
//
// Self-contained (fetches its own data) and silent on any failure: a portrait
// that cannot be assembled truthfully renders nothing at all.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '../../lib/i18n/LanguageContext';
import { useLocalizedLineages } from '../../lib/i18n/useLocalizedLineages';
import type { LineageKey } from '../../lib/lineages';
import { STATION_ORDER, type MythPortrait as Portrait, type StationKey } from '../../lib/returning/mythPortraitDerive';

const C = {
  gold:  '#d4a843',
  bone:  '#ede0c4',
  ash:   '#c4b89a',
  smoke: '#a8916f',
};

const LABEL: React.CSSProperties = {
  fontSize: '0.56rem',
  letterSpacing: '0.28em',
  color: C.gold,
  textTransform: 'uppercase',
  opacity: 0.85,
};

export default function MythPortrait() {
  const { t, tp } = useLanguage();
  const L = useLocalizedLineages();
  const [portrait, setPortrait] = useState<Portrait | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/user/portrait')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (live && d?.portrait) setPortrait(d.portrait as Portrait); })
      .catch(() => { /* silent: no portrait is better than a wrong one */ });
    return () => { live = false; };
  }, []);

  if (!portrait) return null;

  const { figures, stations, gathered, horizon, nextDoor } = portrait;

  const door = nextDoor
    ? nextDoor.kind === 'arrival'
      ? { href: '/', text: t('portrait.door_arrival') }
      : nextDoor.kind === 'return'
        ? { href: '/', text: t('portrait.door_return', { figure: nextDoor.figure }) }
        : { href: '/letters', text: t('portrait.door_naming') }
    : null;

  const text = (k: StationKey): string => t(`portrait.${k}_${stations[k] ? 'lit' : 'unlit'}` as const);

  return (
    <section aria-label={t('portrait.aria')} style={{ marginBottom: 48 }}>
      <div style={{ ...LABEL, marginBottom: 14, textAlign: 'center' }}>{t('portrait.title')}</div>
      <p style={{ fontStyle: 'italic', color: C.ash, fontSize: '0.92rem', lineHeight: 1.85, textAlign: 'center', margin: '0 auto 30px', maxWidth: 520 }}>
        {t('portrait.intro')}
      </p>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative' }}>
        {/* the road: one hairline running down toward the page at its end */}
        <span aria-hidden="true" style={{ position: 'absolute', left: 5, top: 8, bottom: 8, width: 1, background: C.gold, opacity: 0.18 }} />
        {STATION_ORDER.map((k) => {
          const lit = stations[k];
          return (
            <li key={k} style={{ position: 'relative', paddingLeft: 30, paddingBottom: 22 }}>
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute', left: 0, top: 6, width: 11, height: 11, borderRadius: '50%',
                  boxSizing: 'border-box',
                  background: lit ? C.gold : 'transparent',
                  border: `1px solid ${C.gold}`,
                  opacity: lit ? 0.85 : 0.3,
                }}
              />
              <div style={{ fontSize: '0.95rem', lineHeight: 1.7, fontStyle: 'italic', color: lit ? C.bone : C.smoke, opacity: lit ? 1 : 0.7 }}>
                {text(k)}
              </div>

              {k === 'arrival' && lit && (
                <div style={{ marginTop: 10 }}>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {figures.map((f) => (
                      <li key={f.lineageKey}>
                        <div style={{ color: C.bone, fontSize: '0.92rem' }}>{f.archetypeName}</div>
                        <div style={{ color: C.smoke, fontSize: '0.64rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>
                          {(L[f.lineageKey as LineageKey]?.tradition ?? f.lineageKey)} · {f.returned ? t('portrait.returned') : t('portrait.met')}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {figures.length > 1 && (
                    <div style={{ color: C.smoke, fontSize: '0.74rem', fontStyle: 'italic', marginTop: 10, opacity: 0.8 }}>
                      {t('portrait.apart')}
                    </div>
                  )}
                </div>
              )}

              {k === 'naming' && lit && gathered.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ ...LABEL, fontSize: '0.5rem', color: C.smoke, marginBottom: 8 }}>{t('portrait.gathered')}</div>
                  {/* A flat list of the seeker's own words. Never joined, never summarized. */}
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {gathered.map((g) => (
                      <li key={`${g.kind}-${g.id}`} style={{ fontStyle: 'italic', color: C.ash, fontSize: '0.84rem', lineHeight: 1.7 }}>
                        &ldquo;{g.label}&rdquo;
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {!horizon.written && (
        <div style={{ marginTop: 4, marginLeft: 30, border: `1px dashed ${C.gold}33`, padding: '18px 22px' }}>
          <div style={{ fontStyle: 'italic', color: C.ash, fontSize: '0.88rem', lineHeight: 1.85 }}>
            {horizon.open ? t('portrait.page_open') : tp('portrait.horizon', horizon.required)}
          </div>
        </div>
      )}

      {door && (
        <div style={{ marginTop: 18, marginLeft: 30 }}>
          <Link
            href={door.href}
            style={{ color: C.gold, fontSize: '0.64rem', letterSpacing: '0.18em', textTransform: 'uppercase', textDecoration: 'underline', opacity: 0.85 }}
          >
            {door.text}
          </Link>
        </div>
      )}

      {horizon.written && (
        <div style={{ marginTop: 6, marginLeft: 30, fontStyle: 'italic', color: C.smoke, fontSize: '0.8rem', lineHeight: 1.8, opacity: 0.85 }}>
          {t('portrait.rest')}
        </div>
      )}
    </section>
  );
}
