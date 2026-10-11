'use client';

// The way into the fireside chat: a small two-position toggle, "Before the reading | After the reading".
// It appears at the two moments it applies (arriving, and once a reading has been given). The position
// that applies right now is a link into /fire; the other is shown, muted, so the seeker can see both
// doors exist. Renders nothing unless the server reports the fireside is lit and the seeker is in the
// adult register (the fireside is for adults only).

import Link from 'next/link';
import { useEffect, useState } from 'react';

let enabledProbe: Promise<boolean> | null = null;
function probeEnabled(): Promise<boolean> {
  if (!enabledProbe) {
    enabledProbe = fetch('/api/fireside', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => d?.enabled === true)
      .catch(() => false);
  }
  return enabledProbe;
}

interface Props {
  /** Which door is open right now. */
  moment: 'before' | 'after';
  /** The seeker's narrative register. Anything but 'adult' hides the toggle. */
  register?: string;
}

const FONT = "'Gentium Plus', Georgia, 'Times New Roman', serif";

const segment = (active: boolean): React.CSSProperties => ({
  display: 'inline-block',
  padding: '9px 16px',
  fontFamily: FONT,
  fontSize: '0.74rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  color: active ? '#e8c97a' : 'rgba(190,165,125,0.75)',
  background: active ? 'rgba(212,168,67,0.10)' : 'transparent',
  border: '1px solid ' + (active ? 'rgba(212,168,67,0.45)' : 'rgba(212,168,67,0.14)'),
  cursor: active ? 'pointer' : 'default',
});

export default function FiresideEntry({ moment, register = 'adult' }: Props) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let live = true;
    probeEnabled().then((v) => { if (live) setEnabled(v); });
    return () => { live = false; };
  }, []);

  if (!enabled || register !== 'adult') return null;

  const note = moment === 'before'
    ? 'A few quiet words before the reading, if you want them.'
    : 'Talk it over, in your own words, if you want to.';

  return (
    <div
      role="group"
      aria-label="The fireside: talk with an AI host before or after the reading"
      style={{ position: 'relative', zIndex: 1, textAlign: 'center', margin: '22px auto 28px', maxWidth: 520, padding: '14px 20px', background: 'rgba(14,11,8,0.78)' }}
    >
      <div style={{ fontFamily: FONT, fontSize: '0.66rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#a8916f', marginBottom: 8 }}>
        The Fireside
      </div>
      <div style={{ display: 'inline-flex' }}>
        {moment === 'before' ? (
          <Link href="/fire?when=before" style={segment(true)} aria-current="true">Before the reading</Link>
        ) : (
          <span style={segment(false)} aria-disabled="true" title="This door is for before a reading">Before the reading</span>
        )}
        {moment === 'after' ? (
          <Link href="/fire?when=after" style={{ ...segment(true), borderLeft: 'none' }} aria-current="true">After the reading</Link>
        ) : (
          <span style={{ ...segment(false), borderLeft: 'none' }} aria-disabled="true" title="This door opens once you have had a reading">After the reading</span>
        )}
      </div>
      <div style={{ fontFamily: FONT, fontStyle: 'italic', fontSize: '0.8rem', color: '#a8916f', marginTop: 8, lineHeight: 1.5 }}>{note}</div>
    </div>
  );
}
