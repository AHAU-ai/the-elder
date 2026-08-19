'use client';

// Thin client boundary so the server-rendered root layout can still host a
// presence-reactive layer without itself becoming a client component.

import { usePresence } from '@/lib/usePresence';
import { MistLayer } from './MistLayer';

export default function PresenceAtmosphere() {
  const presence = usePresence();
  return <MistLayer density={presence} />;
}
