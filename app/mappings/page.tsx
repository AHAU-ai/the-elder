// app/mappings/page.tsx
// Route: /mappings -- a signed-in seeker's own kept Figure Continuity pairings,
// with the means to remove one, release a myth's, or release everything.
// A thin wrapper, like app/letters/page.tsx. Reachable by URL always (releasing
// your own data is never withheld); the link to it is shown only when the
// server reports the capability (see /api/auth/me and Threshold.tsx).

import FigureMappings from '@/app/components/FigureMappings';

export default function MappingsPage() {
  return <FigureMappings />;
}
