// scripts/fireside/ember-contact-sheet.ts
// Writes a single HTML page showing the ember sigil across motifs and bands, for a human to look at.
// Usage: npx tsx scripts/fireside/ember-contact-sheet.ts [out.html]
import { writeFileSync } from 'node:fs';
import { EMBER_MOTIFS } from '../../lib/fireside/ember/profile';
import type { EmberProfile } from '../../lib/fireside/ember/profile';
import { renderSigilSvg } from '../../lib/fireside/ember/geometry';
import { describeSigil } from '../../lib/fireside/ember/alt';

const out = process.argv[2] ?? 'ember-contact-sheet.html';
const make = (motif: EmberProfile['motif'], d: number, s: number, r: number, si: number, de: number): EmberProfile =>
  ({ v: 1, durationBand: d, segmentBand: s, reactionBands: [r, Math.min(3, r), 0], silenceBand: si, depthStage: de, motif }) as EmberProfile;

const rows: { label: string; prof: (m: EmberProfile['motif']) => EmberProfile; seed: number }[] = [
  { label: 'shortest, sparsest', prof: (m) => make(m, 0, 0, 0, 0, 0), seed: 11 },
  { label: 'short, quiet', prof: (m) => make(m, 1, 1, 1, 1, 1), seed: 22 },
  { label: 'long, full', prof: (m) => make(m, 3, 3, 3, 0, 3), seed: 33 },
  { label: 'long, wide silence', prof: (m) => make(m, 3, 2, 2, 3, 2), seed: 44 },
  { label: 'same profile, seed 1', prof: (m) => make(m, 2, 2, 2, 2, 2), seed: 1 },
  { label: 'same profile, seed 2', prof: (m) => make(m, 2, 2, 2, 2, 2), seed: 2 },
];

const cells = rows.map((r) => `<tr><th>${r.label}</th>${EMBER_MOTIFS.map((m) => { const p = r.prof(m); return `<td>${renderSigilSvg(p, r.seed, { stroke: '#d2af64', accent: '#c8601a', size: 150, title: describeSigil(p) })}</td>`; }).join('')}</tr>`).join('\n');
const html = `<!doctype html><meta charset="utf-8"><title>Ember sigil contact sheet</title>
<style>body{background:#0e0b08;color:#d2af64;font:14px Georgia,serif;margin:24px}table{border-collapse:collapse}th{text-align:right;padding:0 16px;font-weight:normal;width:150px}td{padding:6px}thead th{text-align:center}</style>
<table><thead><tr><th></th>${EMBER_MOTIFS.map((m) => `<th>${m}</th>`).join('')}</tr></thead><tbody>${cells}</tbody></table>`;
writeFileSync(out, html);
console.log(`wrote ${out}`);
