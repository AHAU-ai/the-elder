'use client';

// app/components/LineageConfirm.tsx
//
// A2 (design action items, 2026-08-19): confirm-step UI for the free-text
// inquiry path in LineageSelector.tsx. lib/mythRoutingIndex.ts's
// routeInquiry() only PROPOSES a lineage with a one-line reason; this
// component is where the seeker explicitly accepts that proposal or picks
// differently. No free-text inquiry is ever routed to a lineage without
// this confirmation landing first -- the router does not get to act as
// silent automatic voice selection (explicitly rejected in the design
// review: "Not recommended -- fully-automatic voice selection").

import { LINEAGES, LineageKey } from '../../lib/lineages';
import type { RoutedCandidate } from '../../lib/mythRoutingIndex';

const FONT_HEADER = "'Inter', Arial, sans-serif";
const FONT_BODY = "'Gentium Plus', Georgia, 'Times New Roman', serif";

export default function LineageConfirm({
  candidate,
  onAccept,
  onChooseDifferently,
}: {
  candidate: RoutedCandidate;
  onAccept: (key: LineageKey) => void;
  onChooseDifferently: () => void;
}) {
  const lineage = LINEAGES[candidate.lineageKey];
  if (!lineage) return null;

  return (
    <div
      role="dialog"
      aria-label="Confirm the proposed tradition"
      style={{
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 28,
        padding: '18px 22px',
        border: `1px solid ${lineage.palette.primary}33`,
        borderRadius: 6,
        maxWidth: 420,
        marginLeft: 'auto',
        marginRight: 'auto',
        background: `rgba(${hexToRgb(lineage.palette.primary)}, 0.04)`,
      }}
    >
      <div
        style={{
          fontFamily: FONT_HEADER,
          // Same legibility pass as LineageSelector's guide sentence and
          // node labels: 0.52rem at a dim #5a4a3a was below comfortable
          // reading size/contrast on a small phone.
          fontSize: '0.68rem',
          letterSpacing: '0.24em',
          color: '#a8916f',
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        Before we cross —
      </div>
      <div
        style={{
          fontFamily: FONT_BODY,
          fontStyle: 'italic',
          fontSize: '0.98rem',
          color: '#ede0c4',
          lineHeight: 1.7,
          marginBottom: 6,
        }}
      >
        The fire hears kinship with the {lineage.tradition}.
      </div>
      {/* the one-line reason, never more -- this is a proposal, not an
          argument. routeInquiry() only ever surfaces a pointer (a named
          figure, a motif tag, a register word), never corpus content, so
          there is nothing longer to honestly say here. */}
      <div
        style={{
          fontFamily: FONT_BODY,
          fontSize: '0.82rem',
          color: lineage.palette.primary,
          opacity: 0.85,
          marginBottom: 18,
        }}
      >
        {candidate.reason}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => onAccept(candidate.lineageKey)}
          style={{
            background: `${lineage.palette.primary}14`,
            border: `1px solid ${lineage.palette.primary}`,
            color: lineage.palette.primary,
            fontFamily: FONT_HEADER,
            fontSize: '0.7rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            padding: '11px 20px',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Yes — enter here
        </button>
        <button
          onClick={onChooseDifferently}
          style={{
            background: 'transparent',
            border: '1px solid rgba(212,168,67,0.22)',
            color: '#c4b89a',
            fontFamily: FONT_HEADER,
            fontSize: '0.7rem',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            padding: '11px 20px',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Choose differently
        </button>
      </div>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
