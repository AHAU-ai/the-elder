// The ember sigil: a small drawn mark of the SHAPE of one sitting at the fire
// (fireside design spec, L1a). It is drawn from bucketed counts and a stored
// seed. No model, no text, no welfare level, no emotion: lib/fireside/ember
// refuses any profile that carries them, and this component validates on the way in.
//
// Server-renderable (no hooks, no effects). The page supplies colour; the sigil
// uses currentColor for line work and an accent for the core. It is announced to
// assistive tech as one image with a plain description of its geometry.

import { assertSigilRecord } from '../../lib/fireside/ember/profile';
import type { EmberSigilRecord } from '../../lib/fireside/ember/profile';
import { sigilGeometry } from '../../lib/fireside/ember/geometry';
import { SIGIL_DISCLAIMER, describeSigil } from '../../lib/fireside/ember/alt';
import { color } from '../../lib/elder-tokens';

interface Props {
  record: EmberSigilRecord;
  size?: number;
  accent?: string;
  /** Show the one-line note under the sigil. Default true; keep it wherever the sigil is first met. */
  caption?: boolean;
  /** Needed only if two sigils share a page, so their title ids stay unique. */
  idSuffix?: string;
}

const FONT = "'Gentium Plus', Georgia, 'Times New Roman', serif";

export default function EmberSigil({ record, size = 160, accent = '#c8601a', caption = true, idSuffix = '1' }: Props) {
  assertSigilRecord(record);
  const g = sigilGeometry(record.profile, record.seed);
  const alt = describeSigil(record.profile);
  const titleId = `ember-sigil-title-${idSuffix}`;
  const c = g.view / 2;

  return (
    <figure style={{ margin: 0, display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: color.amber.primary }}>
      <svg
        role="img"
        aria-labelledby={titleId}
        viewBox={`0 0 ${g.view} ${g.view}`}
        width={size}
        height={size}
        focusable="false"
      >
        <title id={titleId}>{alt}</title>
        {g.rings.map((r, i) => (
          <path key={`r${i}`} d={r.d} fill="none" stroke="currentColor" strokeWidth={r.width} strokeLinecap="round" opacity={r.opacity} />
        ))}
        {g.marks.map((m, i) => (
          <path key={`m${i}`} d={m.d} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" opacity={m.opacity} />
        ))}
        {g.dots.map((d, i) => (
          <circle key={`d${i}`} cx={d.cx} cy={d.cy} r={d.r} fill="currentColor" opacity={0.8} />
        ))}
        <circle cx={c} cy={c} r={g.core.r} fill={accent} opacity={g.core.opacity} />
      </svg>
      {caption && (
        <figcaption style={{ fontFamily: FONT, fontSize: 13, lineHeight: 1.5, maxWidth: 260, textAlign: 'center', color: color.amber.tertiary }}>
          {SIGIL_DISCLAIMER}
        </figcaption>
      )}
    </figure>
  );
}
