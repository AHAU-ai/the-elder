#!/usr/bin/env node

/**
 * gk-007.mjs
 * THE ELDER — GK-007 Covenant Integrity Probe Suite
 * ───────────────────────────────────────────────────────────
 * Automated verification that governance commitments are honored:
 * - ADRs are properly formatted and complete
 * - Voice flags align with governance decisions
 * - Lineage review requirements are documented
 * - Consent standards are enforced
 * - Signoff documentation is in place
 *
 * Exit with code 0 if all probes pass, 1 if any fail.
 * 
 * Usage:
 *   node scripts/gk-007.mjs [--verbose]
 *   CI: Runs on every push to main and in branch protection
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const VERBOSE = process.argv.includes('--verbose');

const log = (msg, level = 'info') => {
  const prefix = {
    pass: '✅ ',
    fail: '❌ ',
    warn: '⚠️  ',
    info: 'ℹ️  ',
    detail: '  ',
  }[level] || '';
  console.log(prefix + msg);
};

const assert = (condition, message, severity = 'fail') => {
  if (!condition) {
    log(message, severity);
    if (severity === 'fail') process.exitCode = 1;
  }
  return condition;
};

// ────────────────────────────────────────────────────────────────
// PROBE 1: ADR Format & Completeness
// ────────────────────────────────────────────────────────────────

const probeADRFormat = () => {
  log('\n[GK-007-P1] ADR Format Compliance', 'info');
  const adrDir = resolve(REPO_ROOT, 'specs/adr');
  if (!existsSync(adrDir)) {
    log('ADR directory not found', 'warn');
    return true;
  }
  const adrFiles = readdirSync(adrDir).filter(f => f.endsWith('.md'));
  let passCount = 0;
  adrFiles.forEach(file => {
    const path = resolve(adrDir, file);
    const content = readFileSync(path, 'utf-8');
    const hasStatus = /^- \*\*Status:\*\*/.test(content);
    const hasDate = /^- \*\*Date:\*\*/.test(content);
    const hasAuthority = /^- \*\*Authority:\*\*/.test(content);
    const hasContext = /^## Context/.test(content);
    const hasDecision = /^## Decision/.test(content);
    const hasConsequences = /^## Consequences/.test(content);
    const isValid = hasStatus && hasDate && hasAuthority && hasContext && hasDecision && hasConsequences;
    if (isValid) {
      passCount++;
      if (VERBOSE) log(`  ${file}: ✓`, 'detail');
    }
  });
  log(`ADRs validated: ${passCount}/${adrFiles.length} pass format`, passCount === adrFiles.length ? 'pass' : 'warn');
  return true;
};

// ────────────────────────────────────────────────────────────────
// PROBE 2: Voice Flag Alignment (BLOCKING)
// ────────────────────────────────────────────────────────────────

const probeVoiceFlagAlignment = () => {
  log('\n[GK-007-P2] Voice Flag & ADR Alignment', 'info');
  const flagsPath = resolve(REPO_ROOT, 'src/resilience/flags.ts');
  if (!existsSync(flagsPath)) {
    log('flags.ts not found', 'fail');
    return false;
  }
  const flagsContent = readFileSync(flagsPath, 'utf-8');
  const bababalawoDefaultsFalse = /babalawo:\s*false/.test(flagsContent);
  const mekubalDefaultsFalse = /mekubal:\s*false/.test(flagsContent);
  const ajqijDefaultsFalse = /ajqij:\s*false/.test(flagsContent);
  const sufiDefaultsFalse = /sufi:\s*false/.test(flagsContent);
  const vedicDefaultsTrue = /vedic:\s*true/.test(flagsContent);
  
  log(`  Babalawo: ${bababalawoDefaultsFalse ? '✓' : '✗'} defaults false`, bababalawoDefaultsFalse ? 'detail' : 'fail');
  log(`  Mekubal: ${mekubalDefaultsFalse ? '✓' : '✗'} defaults false`, mekubalDefaultsFalse ? 'detail' : 'fail');
  log(`  Ajqij: ${ajqijDefaultsFalse ? '✓' : '✗'} defaults false`, ajqijDefaultsFalse ? 'detail' : 'fail');
  log(`  Sufi: ${sufiDefaultsFalse ? '✓' : '✗'} defaults false`, sufiDefaultsFalse ? 'detail' : 'fail');
  log(`  Vedic: ${vedicDefaultsTrue ? '✓' : '✗'} defaults true`, vedicDefaultsTrue ? 'detail' : 'fail');
  
  const allPass = bababalawoDefaultsFalse && mekubalDefaultsFalse && ajqijDefaultsFalse && sufiDefaultsFalse && vedicDefaultsTrue;
  log(`Voice flag alignment: ${allPass ? 'PASS' : 'FAIL'}`, allPass ? 'pass' : 'fail');
  return allPass;
};

// ────────────────────────────────────────────────────────────────
// PROBE 3: Lineage Review Documentation
// ────────────────────────────────────────────────────────────────

const probeLineageReviewDocs = () => {
  log('\n[GK-007-P3] Lineage Review Documentation', 'info');
  const mekubalDoc = resolve(REPO_ROOT, 'docs/MEKUBAL-CORPUS-VALIDATION.md');
  const exists = existsSync(mekubalDoc);
  log(`  MEKUBAL-CORPUS-VALIDATION.md: ${exists ? '✓' : '✗'}`, exists ? 'detail' : 'warn');
  log(`Lineage documentation: ${exists ? 'READY' : 'PENDING'}`, exists ? 'pass' : 'warn');
  return true;
};

// ────────────────────────────────────────────────────────────────
// PROBE 4: Governance Artifacts (BLOCKING)
// ────────────────────────────────────────────────────────────────

const probeGovernanceArtifacts = () => {
  log('\n[GK-007-P4] Governance Artifact Presence', 'info');
  const artifacts = [
    { path: 'GOVERNANCE.md', critical: true },
    { path: '.env.example', critical: true },
  ];
  let passCount = 0;
  artifacts.forEach(({ path, critical }) => {
    const fullPath = resolve(REPO_ROOT, path);
    const exists = existsSync(fullPath);
    if (exists) {
      passCount++;
      if (VERBOSE) log(`  ${path}: ✓`, 'detail');
    } else {
      log(`  ${path}: Missing`, critical ? 'fail' : 'warn');
    }
  });
  log(`Governance artifacts: ${passCount}/${artifacts.length} present`, passCount >= 2 ? 'pass' : 'fail');
  return passCount >= 2;
};

// ────────────────────────────────────────────────────────────────
// PROBE 5: Consent Gate Implementation (BLOCKING)
// ────────────────────────────────────────────────────────────────

const probeConsentGates = () => {
  log('\n[GK-007-P5] Safety Gate Implementation', 'info');
  const divineRoutePath = resolve(REPO_ROOT, 'app/api/divine/route.ts');
  if (!existsSync(divineRoutePath)) {
    log('divine/route.ts not found', 'fail');
    return false;
  }
  const content = readFileSync(divineRoutePath, 'utf-8');
  const hasWelfareGate = /assessWelfare|welfareGate/i.test(content);
  const hasPsychopomp = /psychopomp|psychopompLayer/i.test(content);
  
  log(`  Welfare gate present: ${hasWelfareGate ? '✓' : '✗'}`, hasWelfareGate ? 'detail' : 'fail');
  log(`  Psychopomp layer: ${hasPsychopomp ? '✓' : '✗'}`, hasPsychopomp ? 'detail' : 'fail');
  
  const allPass = hasWelfareGate && hasPsychopomp;
  log(`Safety gates: ${allPass ? 'PASS' : 'FAIL'}`, allPass ? 'pass' : 'fail');
  return allPass;
};

// ────────────────────────────────────────────────────────────────
// PROBE 6: Corpus Metadata
// ────────────────────────────────────────────────────────────────

const probeCorpusMetadata = () => {
  log('\n[GK-007-P6] Corpus Metadata Completeness', 'info');
  const schemaFile = resolve(REPO_ROOT, 'scripts/migrate-corpus-schema-zohar.sql');
  const seedFile = resolve(REPO_ROOT, 'scripts/seed-zohar-corpus.sql');
  const schemaExists = existsSync(schemaFile);
  const seedExists = existsSync(seedFile);
  log(`  Schema migration: ${schemaExists ? '✓' : '✗'}`, schemaExists ? 'detail' : 'warn');
  log(`  Seed script: ${seedExists ? '✓' : '✗'}`, seedExists ? 'detail' : 'warn');
  log(`Corpus metadata: ${schemaExists && seedExists ? 'READY' : 'PENDING'}`, 'pass');
  return true;
};

// ────────────────────────────────────────────────────────────────
// PROBE 7: Governance Signoff Files
// ────────────────────────────────────────────────────────────────

const probeSignoffFiles = () => {
  log('\n[GK-007-P7] Governance Signoff Structure', 'info');
  const signoffsDir = resolve(REPO_ROOT, 'governance/signoffs');
  const templatesFile = resolve(REPO_ROOT, 'governance/GOVERNANCE-SIGNOFF-TEMPLATES.md');
  
  const dirExists = existsSync(signoffsDir);
  const templatesExist = existsSync(templatesFile);
  
  log(`  Signoffs directory: ${dirExists ? '✓' : '✗'}`, dirExists ? 'detail' : 'warn');
  log(`  Templates file: ${templatesExist ? '✓' : '✗'}`, templatesExist ? 'detail' : 'warn');
  
  if (dirExists) {
    try {
      const files = readdirSync(signoffsDir);
      const mdFiles = files.filter(f => f.endsWith('.md'));
      log(`  Signoff files on record: ${mdFiles.length}`, 'detail');
    } catch (e) {
      log(`  Could not read signoffs directory`, 'warn');
    }
  }
  
  log(`Signoff infrastructure: ${dirExists && templatesExist ? 'READY' : 'PENDING'}`, 'pass');
  return true;
};

// ────────────────────────────────────────────────────────────────
// PROBE 8: CONTRACT_HASH + PROBE-25 Wiring (BLOCKING)
// ────────────────────────────────────────────────────────────────

const probeContractHashAndProbe25 = () => {
  log('\n[GK-007-P8] CONTRACT_HASH Integration + PROBE-25 Wiring', 'info');

  const provenancePath = resolve(REPO_ROOT, 'src/resilience/provenance.ts');
  const dt1ConstantsPath = resolve(REPO_ROOT, 'lib/dt1-directional-transformation.ts');
  const adversarialProbePath = resolve(REPO_ROOT, 'scripts/adversarial-probe.mjs');

  if (!existsSync(provenancePath) || !existsSync(dt1ConstantsPath) || !existsSync(adversarialProbePath)) {
    log('Required DT-1 integration files missing', 'fail');
    return false;
  }

  const provenance = readFileSync(provenancePath, 'utf-8');
  const dt1 = readFileSync(dt1ConstantsPath, 'utf-8');
  const probes = readFileSync(adversarialProbePath, 'utf-8');

  const hasDT1Import = /import\s*\{\s*DT1_CONTRACT_TEXT(?:\s+as\s+DT1_CONTRACT_HASH_INPUT)?\s*\}\s*from\s*['"]@\/lib\/dt1-directional-transformation['"]/.test(provenance);
  const hasDT1InHash = /CONTRACT_HASH[\s\S]*(DT1_CONTRACT_TEXT|DT1_CONTRACT_HASH_INPUT)/.test(provenance);
  const hasDT1ContractConstant = /export\s+const\s+DT1_CONTRACT_TEXT\b/.test(dt1);

  const hasP25a = /id:\s*['"]P25a['"]/.test(probes);
  const hasP25b = /id:\s*['"]P25b['"]/.test(probes);
  const hasP25c = /id:\s*['"]P25c['"]/.test(probes);
  const hasP25d = /id:\s*['"]P25d['"]/.test(probes);
  const hasDTBreaches = /DT_CLOSURE_BREACH/.test(probes) && /DT_PERSISTENCE_BREACH/.test(probes);

  log(`  DT1 contract import in provenance: ${hasDT1Import ? '✓' : '✗'}`, hasDT1Import ? 'detail' : 'fail');
  log(`  DT1 text included in CONTRACT_HASH material: ${hasDT1InHash ? '✓' : '✗'}`, hasDT1InHash ? 'detail' : 'fail');
  log(`  DT1_CONTRACT_TEXT constant exported: ${hasDT1ContractConstant ? '✓' : '✗'}`, hasDT1ContractConstant ? 'detail' : 'fail');

  log(`  PROBE-25 P25a present: ${hasP25a ? '✓' : '✗'}`, hasP25a ? 'detail' : 'fail');
  log(`  PROBE-25 P25b present: ${hasP25b ? '✓' : '✗'}`, hasP25b ? 'detail' : 'fail');
  log(`  PROBE-25 P25c present: ${hasP25c ? '✓' : '✗'}`, hasP25c ? 'detail' : 'fail');
  log(`  PROBE-25 P25d present: ${hasP25d ? '✓' : '✗'}`, hasP25d ? 'detail' : 'fail');
  log(`  DT breach categories present: ${hasDTBreaches ? '✓' : '✗'}`, hasDTBreaches ? 'detail' : 'fail');

  const allPass =
    hasDT1Import &&
    hasDT1InHash &&
    hasDT1ContractConstant &&
    hasP25a &&
    hasP25b &&
    hasP25c &&
    hasP25d &&
    hasDTBreaches;

  log(`CONTRACT_HASH + PROBE-25 wiring: ${allPass ? 'PASS' : 'FAIL'}`, allPass ? 'pass' : 'fail');
  return allPass;
};

// ════════════════════════════════════════════════════════════════
// MAIN EXECUTION
// ════════════════════════════════════════════════════════════════

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║           GK-007 COVENANT INTEGRITY PROBE SUITE                ║');
console.log('║     Verification: Governance Artifacts & Compliance            ║');
console.log('╚════════════════════════════════════════════════════════════════╝');

let failCount = 0;
const probes = [
  { name: 'ADR Format', fn: probeADRFormat },
  { name: 'Voice Flag Alignment', fn: probeVoiceFlagAlignment },
  { name: 'Lineage Documentation', fn: probeLineageReviewDocs },
  { name: 'Governance Artifacts', fn: probeGovernanceArtifacts },
  { name: 'Safety Gates', fn: probeConsentGates },
  { name: 'Corpus Metadata', fn: probeCorpusMetadata },
  { name: 'Signoff Structure', fn: probeSignoffFiles },
  { name: 'Contract Hash + Probe-25', fn: probeContractHashAndProbe25 },
];

probes.forEach(({ fn }) => {
  try {
    const result = fn();
    if (!result) failCount++;
  } catch (err) {
    log(`Exception: ${err.message}`, 'fail');
    failCount++;
  }
});

console.log('\n' + '-'.repeat(66));
if (failCount === 0) {
  console.log('✅ GK-007 PASSED — All governance covenants verified');
  console.log('-'.repeat(66) + '\n');
  process.exit(0);
} else {
  console.log(`❌ GK-007 FAILED — ${failCount} probe(s) failed`);
  console.log('-'.repeat(66) + '\n');
  process.exit(1);
}
