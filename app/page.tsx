'use client';

import { useState } from 'react';
import BreathGate from './components/BreathGate';
import Threshold from './components/Threshold';

export default function Home() {
  const [gateComplete, setGateComplete] = useState(false);

  return (
    <>
      {!gateComplete && (
        <BreathGate onComplete={() => setGateComplete(true)} />
      )}
      <Threshold />
    </>
  );
}
