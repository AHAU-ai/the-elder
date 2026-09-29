// app/tradition-bearers/page.tsx
//
// The "how a tradition-bearer joins" surface. Exists because the honest
// per-voice authorization gate (src/resilience/flags.ts,
// docs/reading-shape-voice-review.md, lib/mythopoetics/cardConfig.ts's
// AUTHORIZED_ACCENTS) was previously a one-way door: a lineage could be
// marked unauthorized, but nothing on the site told the person who could
// actually change that how to reach the project. This page is that path.
//
// Deliberately not a form that grants anything by itself. Submitting an
// inquiry writes a lead (lib/traditionBearerLedger.ts) for a real,
// specific review -- the same shape as the Stanzione ask in
// docs/reading-shape-voice-review.md's Track 1 (draft an ask, get an
// actual answer, record it). Nothing here flips a flag.

import ClientTraditionBearerPage from './ClientTraditionBearerPage';

// Status text here mirrors src/resilience/flags.ts / lib/lineages.ts as of
// 2026-09-21. This is documentation, not the source of truth -- if this
// list and the flags/lineages files disagree, the code is what's real and
// this file should be corrected (same convention as
// docs/shareable-card-visual-system.md).
export const LINEAGE_STATUS: {
  key: string;
  label: string;
  status: 'authorized' | 'unauthorized' | 'scaffolding';
  note: string;
}[] = [
  { key: 'maya', label: "K'iche' Maya (Ajq'ij)", status: 'authorized',
    note: 'Voice authorized by Vincent Stanzione. A further, narrower review (closing-shape convention, tree motif) is drafted but not yet sent — see below.' },
  { key: 'yoruba', label: 'Yorùbá (Babalawo)', status: 'authorized',
    note: 'Authorized by Fama Aina Udoyi, June 16 2026.' },
  { key: 'mekubal', label: 'Jewish Kabbalah (Mekubal)', status: 'authorized',
    note: 'Authorized by Getzel Davis, July 15 2026.' },
  { key: 'buddhist', label: 'Theravada Buddhist (Bhikkhu)', status: 'authorized',
    note: 'Voice authorized by Shalom Ormsby, July 31 2026. A further, narrower review of one closing convention came back CONTRADICTED and is honored — that convention is not applied to this voice.' },
  { key: 'sufi', label: 'Sufi', status: 'unauthorized',
    note: 'No named tradition-bearer has reviewed this voice. Live on an operator decision, not on the strength of any authorization.' },
  { key: 'vedic', label: 'Vedic', status: 'unauthorized',
    note: 'No named tradition-bearer has reviewed this voice. Live on an operator decision, not on the strength of any authorization.' },
  { key: 'dreamtime', label: 'Dreamtime (Elder of Country)', status: 'unauthorized',
    note: 'Off by default pending a proper ICIP (Indigenous Cultural and Intellectual Property) consultation.' },
  { key: 'chukchi', label: 'Siberian Shaman (Chukchi)', status: 'scaffolding',
    note: 'Structural scaffolding only — no corpus content, no consent grant, off by default. Waiting on a Chukchi cultural authority or Siberian Indigenous-studies specialist.' },
  { key: 'norse', label: 'Norse (Völva)', status: 'unauthorized',
    note: 'Corpus is live without a completed tradition-bearer review — recorded here plainly rather than left unstated.' },
  { key: 'greek', label: 'Greek (Pythia of Delphi)', status: 'unauthorized',
    note: 'Textual/historical corpus; no living tradition-bearer relationship established yet.' },
  { key: 'egyptian', label: 'Egyptian (Hem-netjer)', status: 'unauthorized',
    note: 'Textual/historical corpus; no living tradition-bearer relationship established yet.' },
  { key: 'taoist', label: 'Taoist (Sage of the Way)', status: 'unauthorized',
    note: 'Textual/historical corpus; no living tradition-bearer relationship established yet.' },
  { key: 'stoic', label: 'Stoic (Philosopher of the Stoa)', status: 'unauthorized',
    note: 'Textual/historical corpus; no living tradition-bearer relationship established yet.' },
];

export default function TraditionBearersPage() {
  return <ClientTraditionBearerPage lineages={LINEAGE_STATUS} />;
}
