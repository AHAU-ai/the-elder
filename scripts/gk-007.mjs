#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const log = (msg, level = 'info') => {
  const prefix = { pass: '✅ ', fail: '❌ ', warn: '⚠️  ', info: 'ℹ️  ' }[level] || '';
  console.log(prefix + msg);
};

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║           GK-007 COVENANT INTEGRITY PROBE SUITE                ║');
console.log('╚════════════════════════════════════════════════════════════════╝');

let failCount = 0;

// Probe: Voice flags
const flagsPath = resolve(REPO_ROOT, 'src/resilience/flags.ts');
log('\n[GK-007-P2] Voice Flag Alignment', 'info');
if (existsSync(flagsPath)) {
  const content = readFileSync(flagsPath, 'utf-8');
  const mekubal_ok = /mekubal:\s*false/.test(content);
  const ajqij_ok = /ajqij:\s*false/.test(content);
  const sufi_ok = /sufi:\s*false/.test(content);
  const vedic_ok = /vedic:\s*true/.test(content);
  
  log('  Mekubal: ' + (mekubal_ok ? '✓' : '✗') + ' defaults false', mekubal_ok ? 'detail' : 'fail');
  log('  Ajqij: ' + (ajqij_ok ? '✓' : '✗') + ' defaults false', ajqij_ok ? 'detail' : 'fail');
  log('  Sufi: ' + (sufi_ok ? '✓' : '✗') + ' defaults false', sufi_ok ? 'detail' : 'fail');
  log('  Vedic: ' + (vedic_ok ? '✓' : '✗') + ' defaults true', vedic_ok ? 'detail' : 'fail');
  
  const all_ok = mekubal_ok && ajqij_ok && sufi_ok && vedic_ok;
  log('Voice flag alignment: ' + (all_ok ? 'PASS' : 'FAIL'), all_ok ? 'pass' : 'fail');
  if (!all_ok) failCount++;
}

// Probe: Governance artifacts
log('\n[GK-007-P4] Governance Artifacts', 'info');
const gov_ok = existsSync(resolve(REPO_ROOT, 'GOVERNANCE.md'));
const env_ok = existsSync(resolve(REPO_ROOT, '.env.example'));
log('  GOVERNANCE.md: ' + (gov_ok ? '✓' : '✗'), gov_ok ? 'detail' : 'fail');
log('  .env.example: ' + (env_ok ? '✓' : '✗'), env_ok ? 'detail' : 'fail');
const artifacts_ok = gov_ok && env_ok;
log('Governance artifacts: ' + (artifacts_ok ? 'PASS' : 'FAIL'), artifacts_ok ? 'pass' : 'fail');
if (!artifacts_ok) failCount++;

// Probe: Safety gates
log('\n[GK-007-P5] Safety Gates', 'info');
const divine_path = resolve(REPO_ROOT, 'app/api/divine/route.ts');
if (existsSync(divine_path)) {
  const content = readFileSync(divine_path, 'utf-8');
  const welfare_ok = /assessWelfare|welfareGate/.test(content);
  const psychopomp_ok = /psychopomp/i.test(content);
  
  log('  Welfare gate: ' + (welfare_ok ? '✓' : '✗'), welfare_ok ? 'detail' : 'fail');
  log('  Psychopomp layer: ' + (psychopomp_ok ? '✓' : '✗'), psychopomp_ok ? 'detail' : 'fail');
  
  const gates_ok = welfare_ok && psychopomp_ok;
  log('Safety gates: ' + (gates_ok ? 'PASS' : 'FAIL'), gates_ok ? 'pass' : 'fail');
  if (!gates_ok) failCount++;
}

console.log('\n' + '-'.repeat(66));
if (failCount === 0) {
  console.log('✅ GK-007 PASSED — All governance covenants verified');
  console.log('-'.repeat(66) + '\n');
  process.exit(0);
} else {
  console.log('❌ GK-007 FAILED — ' + failCount + ' probe(s) failed');
  console.log('-'.repeat(66) + '\n');
  process.exit(1);
}
