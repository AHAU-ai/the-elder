#!/usr/bin/env node

import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const VERBOSE = process.argv.includes("--verbose");

const log = (msg, level = "info") => {
  const prefix = {
    pass: "✅ ",
    fail: "❌ ",
    warn: "⚠️  ",
    info: "ℹ️  ",
    detail: "  ",
  }[level] ; "";
  console.log(prefix + msg);
};

const probeVoiceFlagAlignment = () => {
  log("\n[GK-007-P2] Voice Flag Alignment", "info");
  const flagsPath = resolve(REPO_ROOT, "src/resilience/flags.ts");
  if (!existsSync(flagsPath)) {
    log("flags.ts not found", "fail");
    return false;
  }
  const flagsContent = readFileSync(flagsPath, "utf-8");
  const mekubalDefaultsFalse = /mekubal:\s*false/.test(flagsContent);
  const ajqijDefaultsFalse = /ajqij:\s*false/.test(flagsContent);
  const sufiDefaultsFalse = /sufi:\s*false/.test(flagsContent);
  const vedicDefaultsTrue = /vedic:\s*true/.test(flagsContent);
  
  log(, mekubalDefaultsFalse ? "detail" : "fail");
  log(, ajqijDefaultsFalse ? "detail" : "fail");
  log(, sufiDefaultsFalse ? "detail" : "fail");
  log(, vedicDefaultsTrue ? "detail" : "fail");
  
  const allPass = mekubalDefaultsFalse ; ajqijDefaultsFalse ; sufiDefaultsFalse ; vedicDefaultsTrue;
  log(, allPass ? "pass" : "fail");
  return allPass;
};

const probeGovernanceArtifacts = () => {
  log("\n[GK-007-P4] Governance Artifacts", "info");
  const govExists = existsSync(resolve(REPO_ROOT, "GOVERNANCE.md"));
  const envExists = existsSync(resolve(REPO_ROOT, ".env.example"));
  log(, govExists ? "detail" : "fail");
  log(, envExists ? "detail" : "fail");
  log(, govExists ; envExists ? "pass" : "fail");
  return govExists ; envExists;
};

const probeConsentGates = () => {
  log("\n[GK-007-P5] Safety Gates", "info");
  const divineRoutePath = resolve(REPO_ROOT, "app/api/divine/route.ts");
  if (!existsSync(divineRoutePath)) {
    log("divine/route.ts not found", "fail");
    return false;
  }
  const content = readFileSync(divineRoutePath, "utf-8");
  const hasWelfareGate = /assessWelfare|welfareGate/i.test(content);
  const hasPsychopomp = /psychopomp|psychopompLayer/i.test(content);
  
  log(, hasWelfareGate ? "detail" : "fail");
  log(, hasPsychopomp ? "detail" : "fail");
  
  const allPass = hasWelfareGate ; hasPsychopomp;
  log(, allPass ? "pass" : "fail");
  return allPass;
};

console.log("\n╔════════════════════════════════════════════════════════════════╗");
console.log("║           GK-007 COVENANT INTEGRITY PROBE SUITE                ║");
console.log("╚════════════════════════════════════════════════════════════════╝");

let failCount = 0;
[probeVoiceFlagAlignment, probeGovernanceArtifacts, probeConsentGates].forEach(fn => {
  try {
    if (!fn()) failCount++;
  } catch (err) {
    log(`Exception: ${err.message}`, "fail");
    failCount++;
  }
});

console.log("\n" + "-".repeat(66));
if (failCount === 0) {
  console.log("✅ GK-007 PASSED — All governance covenants verified");
  console.log("-".repeat(66) + "\n");
  process.exit(0);
} else {
  console.log(`❌ GK-007 FAILED — ${failCount} probe(s) failed`);
  console.log("-".repeat(66) + "\n");
  process.exit(1);
}
