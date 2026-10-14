'use client';

// app/components/CeremonyDrone.tsx
//
// Holds the ceremonial drone (lib/ceremonyDrone.ts) for the whole ceremony.
// Mounted once in the root layout and never unmounted, so the drone spans the
// portal, the breath, the threshold and the reading as one continuous sound
// rather than following whichever fire component happens to be on screen.
// Renders nothing. Respects the same on-device sound choice the portal door
// writes (readSoundPref); the fireside chat silences it from Threshold.

import { useEffect } from 'react';
import { acquireCeremonyDrone, releaseCeremonyDrone } from '../../lib/ceremonyDrone';
import { readSoundPref } from '../../lib/portalLure';

export default function CeremonyDrone() {
  useEffect(() => {
    if (!readSoundPref()) return;
    acquireCeremonyDrone();
    return () => releaseCeremonyDrone();
  }, []);
  return null;
}
