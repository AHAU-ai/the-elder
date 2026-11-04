// app/tradition-bearers/page.tsx
//
// The "how a tradition-bearer joins" surface: a door for someone with real
// standing to speak for a lineage to reach the project. Submitting writes a
// lead (lib/traditionBearerLedger.ts) for a real, specific review -- it never
// flips a voice flag or authorizes anything by itself.

import { LINEAGES } from '@/lib/lineages';
import ClientTraditionBearerPage from './ClientTraditionBearerPage';

export default function TraditionBearersPage() {
  const lineages = Object.entries(LINEAGES)
    .filter(([key]) => key !== 'default')
    .map(([key, l]) => ({ key, label: l.label }));
  return <ClientTraditionBearerPage lineages={lineages} />;
}
