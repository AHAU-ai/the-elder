import assert from 'node:assert/strict';
import * as ReactNS from 'react';
import { holdsSlot, useOfferSlot, OfferSlotProvider } from './offerSlot';

(globalThis as { React?: typeof ReactNS }).React = ReactNS;

(async () => {
  // Pure rule
  assert.equal(holdsSlot({ marker: 1, carry: 3 }, 'marker', 1, true), true, 'lowest number holds it');
  assert.equal(holdsSlot({ marker: 1, carry: 3 }, 'carry', 3, true), false, 'carry waits for marker');
  assert.equal(holdsSlot({ carry: 3 }, 'carry', 3, true), true, 'carry alone holds it');
  assert.equal(holdsSlot({ marker: 1, stage: 2, carry: 3 }, 'stage', 2, true), false, 'stage waits for marker');
  assert.equal(holdsSlot({ stage: 2, carry: 3 }, 'stage', 2, true), true, 'marker gone: stage is next');
  assert.equal(holdsSlot({ stage: 2, carry: 3 }, 'carry', 3, true), false, 'carry still waits for stage');
  assert.equal(holdsSlot({}, 'marker', 1, true), false, 'unregistered waits one beat');
  assert.equal(holdsSlot({ marker: 1 }, 'marker', 1, false), false, 'not asking never holds');

  // Outside a provider an offer behaves exactly as before: always may show.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const Probe = ({ wants }: { wants: boolean }) => ReactNS.createElement('i', null, String(useOfferSlot('x', 5, wants)));
  assert.equal(renderToStaticMarkup(ReactNS.createElement(Probe, { wants: true })), '<i>true</i>');
  // Inside a provider, on first render nothing is registered yet, so it waits a beat.
  assert.equal(renderToStaticMarkup(ReactNS.createElement(OfferSlotProvider, null, ReactNS.createElement(Probe, { wants: true }))), '<i>false</i>');
  console.log('offerSlot: 10 checks passed');
})();
