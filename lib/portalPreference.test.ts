import assert from 'node:assert/strict';
import { parsePortalBypass } from './portalPreference';

assert.equal(parsePortalBypass(true), true);
assert.equal(parsePortalBypass(false), false);
for (const bad of [undefined, null, 1, 0, 'true', 'false', {}, []]) {
  assert.equal(parsePortalBypass(bad), null, `not a boolean: ${JSON.stringify(bad)}`);
}
console.log('portalPreference tests passed');
