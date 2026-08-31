// app/tree/page.tsx
// Route: /tree — the seeker's tree, grown from their marker trajectory.
// A visual companion to /journal and /letters, drawn from
// /api/user/tree-state.

import TreeState from '@/app/components/TreeState';

export default function TreePage() {
  return <TreeState />;
}
