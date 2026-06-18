#!/usr/bin/env node
// scripts/attest-preflight.mjs
//
// PREFLIGHT HASH-MATCH GATE — fail-closed lineage activation check.
//
// Run this in CI and/or at boot before allowing a voice to transmit.
// It answers ONE question: may voice <id> go live right now?
//
// It returns LIVE only if ALL hold:
//   1. A contract exists and passes shape validation.
//   2. The deployed spec file's sha256 matches contract.specSha256
//      (the spec has not drifted since it was attested).
//   3. The Ed25519 signature verifies against the canonical payload
//      using the public key embedded in the contract.
//   4. The attestor role is recognized for this voice.
//
// Any failure → status REVIEW (or SCAFFOLDING) → the voice CANNOT transmit.
// The gate never grants LIVE on its own authority; it only confirms a human
// holder's signed attestation still binds to the exact deployed artifact.
//
// USAGE:
//   node scripts/attest-preflight.mjs \
//     --contract attestations/babalawo/contract.json \
//     --spec     lib/voices/babalawo.voice.mjs
//
// EXIT: 0 = LIVE (verified), 1 = blocked, 2 = usage error.

import { readFileSync, existsSync } from 'node:fs';
import { createHash, verify as edVerify, createPublicKey } from 'node:crypto';
import {
  canonicalSigningPayload,
  validateContractShape,
  GOVERNANCE_STATUS,
  RECOGNIZED_ATTESTOR_ROLES,
} from '../lib/attestationSchema.mjs';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2), next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i++; } else out[key] = true;
    }
  }
  return out;
}

const args = parseArgs(process.argv);
if (!args.contract || !args.spec) {
  console.error('usage: attest-preflight.mjs --contract <path> --spec <path>');
  process.exit(2);
}

const fail = (reason) => {
  console.error(`🔴 BLOCKED — status: ${GOVERNANCE_STATUS.REVIEW}`);
  console.error(`   reason: ${reason}`);
  console.error('   The voice may NOT transmit. Activation denied (fail-closed).');
  process.exit(1);
};

// --- 1. contract present + shape ------------------------------------------
if (!existsSync(args.contract)) fail(`contract not found: ${args.contract}`);
let contract;
try { contract = JSON.parse(readFileSync(args.contract, 'utf8')); }
catch (e) { fail(`contract is not valid JSON: ${e.message}`); }

const shape = validateContractShape(contract);
if (!shape.ok) fail(`contract shape invalid:\n     - ${shape.errors.join('\n     - ')}`);

// --- 2. deployed spec hash matches attested hash --------------------------
if (!existsSync(args.spec)) fail(`deployed spec not found: ${args.spec}`);
const deployedHash = createHash('sha256').update(readFileSync(args.spec)).digest('hex');
if (deployedHash !== contract.specSha256) {
  fail(`spec drift detected.\n` +
       `     attested sha256 : ${contract.specSha256}\n` +
       `     deployed sha256 : ${deployedHash}\n` +
       `     The deployed voice spec differs from what was attested.`);
}

// --- 3. signature verifies -------------------------------------------------
let pubKey;
try {
  pubKey = createPublicKey({
    key: Buffer.from(contract.signature.publicKeyHex, 'hex'),
    format: 'der', type: 'spki',
  });
} catch (e) { fail(`could not load public key: ${e.message}`); }

const payload = Buffer.from(canonicalSigningPayload(contract), 'utf8');
const sigBytes = Buffer.from(contract.signature.value, 'hex');
const sigOk = edVerify(null, payload, pubKey, sigBytes);
if (!sigOk) fail('signature does not verify against canonical payload.');

// --- 4. role recognized (belt-and-suspenders; shape already checks) -------
const roles = RECOGNIZED_ATTESTOR_ROLES[contract.voiceId] || [];
if (!roles.includes(contract.attestor.role)) {
  fail(`attestor role "${contract.attestor.role}" not recognized for "${contract.voiceId}".`);
}

// --- PASS ------------------------------------------------------------------
console.error(`🟢 LIVE — status: ${GOVERNANCE_STATUS.LIVE}`);
console.error(`   voice     : ${contract.voiceId} (${contract.tradition})`);
console.error(`   attestor  : ${contract.attestor.name} — ${contract.attestor.role}`);
console.error(`   lineage   : ${contract.attestor.lineage}`);
console.error(`   accountab.: ${contract.lineageAccountabilityHolder ?? '—'}`);
console.error(`   spec      : ${args.spec}`);
console.error(`   sha256    : ${deployedHash}`);
console.error(`   signature : verified (ed25519)`);
console.error('   This voice is cleared to transmit.');
// stdout = machine-readable result for CI consumption
process.stdout.write(JSON.stringify({ status: GOVERNANCE_STATUS.LIVE, voiceId: contract.voiceId, specSha256: deployedHash }) + '\n');
process.exit(0);
