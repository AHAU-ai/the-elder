// app/fire/page.tsx
// Route: /fire — the fireside chat (before or after a ceremonial reading).
// Dark unless the operator lights it: see lib/fireside/flag.ts and docs/fireside/GO-LIVE.md.

import FiresideChat from '@/app/components/FiresideChat';

export const metadata = { title: 'The Fireside — The Elder' };

export default function FirePage() {
  return <FiresideChat />;
}
