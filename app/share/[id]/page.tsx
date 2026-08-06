// app/share/[id]/page.tsx
// Route: /share/[id] — public, read-only view of a shared card. A viewer
// can leave one wordless glyph back for the sharer; no account needed.

import SharedCardView from '@/app/components/SharedCardView';

export default function SharePage({ params }: { params: { id: string } }) {
  return <SharedCardView id={params.id} />;
}
