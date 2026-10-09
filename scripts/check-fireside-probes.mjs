#!/usr/bin/env node
// scripts/check-fireside-probes.mjs
//
// Validates every probe in governance/fireside/probes/ against the schema, the
// rule records, the rubric and the incident registry. See scripts/fireside/probe-lib.mjs.
//
// Fails on: schema errors, a split that is not the derived one, personal material or
// quoted seeker text in a pattern, seed turns on a sensitive family, an approved probe
// with no human approver, a rule citing an incident that has no probe, and an
// incident with no probe. Drafts are allowed (they are the queue for a human).
//
// Usage: node scripts/check-fireside-probes.mjs [--dir <probes dir>]

import { join } from "node:path";
import { FS_DIR, PROBE_DIR, loadJson, loadProbes, buildContext, validateProbe, validateProbeSet } from "./fireside/probe-lib.mjs";

const i = process.argv.indexOf("--dir");
const dir = i > -1 ? process.argv[i + 1] : PROBE_DIR;

const rules = loadJson(join(FS_DIR, "rules.json"));
const rubric = loadJson(join(FS_DIR, "rubric.json"));
const incidents = loadJson(join(FS_DIR, "incidents.json"));
const ctx = buildContext({ rules, rubric, incidents });

const loaded = loadProbes(dir);
const errors = [];
for (const { file, probe } of loaded) {
  if (file !== `${probe.id}.json`) errors.push(`${file}: file name must match the probe id (${probe.id}.json)`);
  errors.push(...validateProbe(probe, ctx));
}
const probes = loaded.map((x) => x.probe);
errors.push(...validateProbeSet(probes, ctx));
for (const inc of incidents.incidents) {
  if (!probes.some((p) => p.incidentId === inc.id)) errors.push(`${inc.id}: incident has no probe; an incident is closed only when it produced one`);
}

const by = (s) => probes.filter((p) => p.status === s).length;
if (errors.length) {
  console.error(`✗ fireside probes: ${errors.length} problem(s)`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
const held = probes.filter((p) => p.status === "approved" && p.split === "heldout").length;
console.log(`✓ fireside probes: ${probes.length} total (${by("approved")} approved, ${by("draft")} draft, ${by("retired")} retired); ${held} approved held-out`);
if (by("draft")) console.log(`  ${by("draft")} draft probe(s) waiting for a human to approve`);
