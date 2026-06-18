#!/usr/bin/env node
// scripts/attest-sign.mjs
//
// OFFLINE signing tool for lineage attestation.
//
// USAGE (run AIR-GAPPED — disconnect network before signing):
//   node scripts/attest-sign.mjs \
//     --spec      lib/voices/babalawo.voice.mjs \
//     --voice     babalawo \
//     --tradition "Yorùbá Ifá" \
//     --name      "Full Name" \
//     --role      "Iyanifa" \
//     --lineage   "House / lineage description" \
//     --introduced-by "Kingsley Udoyi" \
//     --accountability "Dr. Vincent James Stanzione" \
//     --corpus    v1 --model claude-sonnet-4-6 \
//     --key       attestations/babalawo/attestor.ed25519.key \
//     --out       attestations/babalawo/contract.json
//
// If --key does not exist, the tool generates a NEW keypair, writes the
// private key (0600) and prints the public key. The private key never leaves
// the machine it was generated on. The holder keeps it; only the public key
// and the signed contract are shared.
//
// This tool DOES NOT activate anything. It produces a contract that the
// preflight gate later verifies. Signing is the human holder's act.

import { readFileSync, writeFileSync, existsSync, chmodSync, mkdirSync } from 'node:fs';
import { createHash, generateKeyPairSync, sign as edSign, createPrivateKey, createPublicKey } from 'node:crypto';
import { dirname } from 'node:path';
import {
  canonicalSigningPayload,
  validateContractShape,
  RECOGNIZED_ATTESTOR_ROLES,
} from '../lib/attestationSchema.mjs';

// ---- crude arg parser (no deps; offline-friendly) -------------------------
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) { out[key] = next; i++; }
      else out[key] = true;
    }
  }
  return out;
}

function die(msg) { console.error(`✗ ${msg}`); process.exit(1); }

const args = parseArgs(process.argv);

for (const r of ['spec', 'voice', 'tradition', 'name', 'role', 'lineage', 'out']) {
  if (!args[r]) die(`missing required --${r}`);
}

const roles = RECOGNIZED_ATTESTOR_ROLES[args.voice] || [];
if (!roles.includes(args.role)) {
  die(`role "${args.role}" not recognized for voice "${args.voice}" (allowed: ${roles.join(', ') || 'none'})`);
}

if (!existsSync(args.spec)) die(`spec file not found: ${args.spec}`);

// 1) Hash the exact spec bytes being attested.
const specBytes = readFileSync(args.spec);
const specSha256 = createHash('sha256').update(specBytes).digest('hex');

// 2) Load or generate the holder's keypair.
const keyPath = args.key || 'attestations/attestor.ed25519.key';
let privateKey, publicKeyHex;

if (existsSync(keyPath)) {
  privateKey = createPrivateKey(readFileSync(keyPath));
  const pub = createPublicKey(privateKey);
  publicKeyHex = pub.export({ type: 'spki', format: 'der' }).toString('hex');
  console.error(`• Using existing key: ${keyPath}`);
} else {
  const { publicKey, privateKey: priv } = generateKeyPairSync('ed25519');
  privateKey = priv;
  publicKeyHex = publicKey.export({ type: 'spki', format: 'der' }).toString('hex');
  mkdirSync(dirname(keyPath), { recursive: true });
  writeFileSync(keyPath, priv.export({ type: 'pkcs8', format: 'pem' }));
  chmodSync(keyPath, 0o600);
  console.error(`• Generated NEW keypair → ${keyPath} (mode 0600)`);
  console.error('  KEEP THIS PRIVATE KEY OFFLINE. Share only the public key + contract.');
}

// 3) Assemble the contract (without signature).
const contract = {
  schemaVersion: '2.0.0',
  voiceId: args.voice,
  tradition: args.tradition,
  specPath: args.spec,
  specSha256,
  attestor: {
    name: args.name,
    role: args.role,
    lineage: args.lineage,
    introducedBy: args['introduced-by'] || null,
  },
  lineageAccountabilityHolder: args.accountability || null,
  provenance: {
    corpusVersion: args.corpus || null,
    modelVersion: args.model || null,
    contractVersion: '2.0.0',
  },
  attestedAt: new Date().toISOString(),
  targetStatus: 'live',
};

// 4) Sign the canonical payload.
const payload = Buffer.from(canonicalSigningPayload(contract), 'utf8');
const signature = edSign(null, payload, privateKey).toString('hex');

contract.signature = { alg: 'ed25519', publicKeyHex, value: signature };

// 5) Validate shape before writing (catch mistakes at signing time).
const { ok, errors } = validateContractShape(contract);
if (!ok) die(`contract failed shape validation:\n  - ${errors.join('\n  - ')}`);

mkdirSync(dirname(args.out), { recursive: true });
writeFileSync(args.out, JSON.stringify(contract, null, 2) + '\n');

console.error('');
console.error('✓ Attestation signed.');
console.error(`  spec        : ${args.spec}`);
console.error(`  spec sha256 : ${specSha256}`);
console.error(`  attestor    : ${args.name} (${args.role})`);
console.error(`  public key  : ${publicKeyHex.slice(0, 32)}…`);
console.error(`  contract    : ${args.out}`);
console.error('');
console.error('Next: run scripts/attest-preflight.mjs against the DEPLOYED spec to verify.');
