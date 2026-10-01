'use client';

// Extracted from CouncilTabs.tsx (PR4, decision D5) so this one welfare-
// critical rendering path can be protected in .github/CODEOWNERS at file
// granularity, same as scripts/check-crisis-directive.mjs already is --
// previously it was a few dozen lines inside a ~1200-line multi-purpose
// file with no way to require review on just this piece.
//
// Deliberately outside the ceremonial reveal system (no OracleText/
// OracleResponse animation, no fire chrome, no witness glyph). The
// instrument stepping outside its own persona to speak directly, matching
// what CEILING_PROTOCOL already instructs the model itself to do in this
// moment. Rendered plainly and in full immediately -- a safety message
// should never be drip-fed word by word.
//
// role="alert" (PR4): screen-reader users otherwise have no indication
// this notice appeared at all.
export default function CrisisNotice({ text }: { text: string }) {
  return (
    <div role="alert" style={{
      background: 'rgba(20,22,26,0.95)',
      border: '1px solid rgba(160,170,185,0.35)',
      borderRadius: 3,
      padding: '22px 26px',
      marginBottom: 16,
    }}>
      <div style={{
        fontFamily: "'Inter', Arial, sans-serif",
        fontSize: '0.62rem',
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: '#a0aab9',
        marginBottom: 10,
        opacity: 0.85,
      }}>
        The Elder speaks plainly
      </div>
      <div style={{
        fontFamily: "'Inter', Arial, sans-serif",
        fontSize: '0.95rem',
        lineHeight: 1.75,
        color: '#e4e8ee',
        whiteSpace: 'pre-wrap',
      }}>
        {text}
      </div>
    </div>
  );
}
