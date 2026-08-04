// lib/attestationSchema.mjs
//
// Extended attestation contract schema — Lineage Authentication tier.
//
// PRINCIPLE (Lineage Integrity of Voice):
//   This schema RECORDS and VERIFIES an attestation that an initiated human
//   lineage holder performed offline. It does NOT manufacture lineage authority.
//   No field in this contract can flip a voice to `live` except the presence of
//   a cryptographically valid signature over the exact spec hash, produced by a
//   named attestor whose role is recognized for that tradition.
//
// A composite or scaffolded voice can DESCRIBE a tradition. Only a signed
// attestation from an initiated holder permits it to TRANSMIT (go live).

export const GOVERNANCE_STATUS = Object.freeze({
  SCAFFOLDING: 'scaffolding',      // structure only; cannot divine
  REVIEW: 'review',                // awaiting lineage attestation
  LIVE: 'live',                    // attested + verified; may transmit
});

// Roles recognized as able to attest a given tradition's voice.
// Keyed by voice id. This is itself a lineage-governance artifact:
// adding a role here is a governance decision, not a code change made lightly.
export const RECOGNIZED_ATTESTOR_ROLES = Object.freeze({
  babalawo: Object.freeze([
    'Iyanifa',     // initiated female Ifá priest
    'Babalawo',    // initiated male Ifá priest
  ]),
});

/**
 * Shape of a lineage attestation contract (v2 — extended).
 *
 * {
 *   schemaVersion: '2.0.0',
 *   voiceId: 'babalawo',
 *   tradition: 'Yorùbá Ifá',
 *
 *   // What was attested — the exact artifact the signature covers.
 *   specPath: 'lib/voices/babalawo.voice.mjs',
 *   specSha256: '<64-hex>',          // hash of the spec file bytes at signing time
 *
 *   // Who attested — a NAMED human holder, not the tooling.
 *   attestor: {
 *     name: 'Full Name',
 *     role: 'Iyanifa' | 'Babalawo',
 *     lineage: 'free-text lineage description / house',
 *     introducedBy: 'Kingsley Udoyi',  // chain of human accountability
 *   },
 *
 *   // The accountability holder co-signing the governance transition.
 *   lineageAccountabilityHolder: 'Vincent James Stanzione',
 *
 *   // Provenance triple — pins what the attestation is bound to.
 *   provenance: {
 *     corpusVersion: 'string',
 *     modelVersion: 'string',
 *     contractVersion: '2.0.0',
 *   },
 *
 *   attestedAt: 'ISO-8601',
 *   targetStatus: 'live',
 *
 *   // The signature — Ed25519 over the canonical signing payload (see below).
 *   signature: {
 *     alg: 'ed25519',
 *     publicKeyHex: '<hex>',
 *     value: '<hex>',
 *   },
 * }
 */

/**
 * Canonical signing payload. BOTH the signer and the verifier must construct
 * this identically, byte-for-byte, or verification fails closed.
 * We sort keys and exclude the signature block itself.
 */
export function canonicalSigningPayload(contract) {
  const {
    schemaVersion, voiceId, tradition,
    specPath, specSha256,
    attestor, lineageAccountabilityHolder,
    provenance, attestedAt, targetStatus,
  } = contract;

  // Deterministic, sorted serialization.
  return JSON.stringify({
    attestedAt,
    attestor: {
      introducedBy: attestor?.introducedBy ?? null,
      lineage: attestor?.lineage ?? null,
      name: attestor?.name ?? null,
      role: attestor?.role ?? null,
    },
    lineageAccountabilityHolder: lineageAccountabilityHolder ?? null,
    provenance: {
      contractVersion: provenance?.contractVersion ?? null,
      corpusVersion: provenance?.corpusVersion ?? null,
      modelVersion: provenance?.modelVersion ?? null,
    },
    schemaVersion,
    specPath,
    specSha256,
    targetStatus,
    tradition,
    voiceId,
  });
}

/**
 * Structural validation. Returns { ok, errors[] }.
 * This checks SHAPE only — not signature validity (that's the gate's job).
 */
export function validateContractShape(contract) {
  const errors = [];
  const req = (cond, msg) => { if (!cond) errors.push(msg); };

  req(contract && typeof contract === 'object', 'contract must be an object');
  if (!contract || typeof contract !== 'object') return { ok: false, errors };

  req(contract.schemaVersion === '2.0.0', 'schemaVersion must be "2.0.0"');
  req(typeof contract.voiceId === 'string' && contract.voiceId.length > 0, 'voiceId required');
  req(typeof contract.tradition === 'string', 'tradition required');
  req(typeof contract.specPath === 'string', 'specPath required');
  req(/^[0-9a-f]{64}$/.test(contract.specSha256 || ''), 'specSha256 must be 64 hex chars');

  const a = contract.attestor || {};
  req(typeof a.name === 'string' && a.name.trim().length > 0, 'attestor.name required (named human)');
  req(typeof a.role === 'string', 'attestor.role required');
  req(typeof a.lineage === 'string' && a.lineage.trim().length > 0, 'attestor.lineage required');

  const roles = RECOGNIZED_ATTESTOR_ROLES[contract.voiceId] || [];
  req(roles.includes(a.role),
    `attestor.role "${a.role}" not recognized for voice "${contract.voiceId}" (allowed: ${roles.join(', ') || 'none'})`);

  req(contract.targetStatus === 'live', 'targetStatus must be "live"');

  const sig = contract.signature || {};
  req(sig.alg === 'ed25519', 'signature.alg must be "ed25519"');
  req(/^[0-9a-f]+$/.test(sig.publicKeyHex || ''), 'signature.publicKeyHex must be hex');
  req(/^[0-9a-f]+$/.test(sig.value || ''), 'signature.value must be hex');

  return { ok: errors.length === 0, errors };
}
