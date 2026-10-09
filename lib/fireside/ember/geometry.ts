/**
 * lib/fireside/ember/geometry.ts
 *
 * Deterministic drawing for the ember sigil. Pure functions, no DOM, no node: APIs,
 * safe in the browser. Same profile + same seed => byte-identical geometry.
 *
 * The drawing is neutral geometry. Nothing about it is warm, cold, happy or sad,
 * and no band maps to a colour. Colour is supplied by the page.
 */
import { assertEmberProfile } from './profile';
import type { EmberProfile } from './profile';

export const VIEW = 200;
const C = VIEW / 2;

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const f = (n: number) => String(Math.round(n * 100) / 100);
const pt = (r: number, a: number): [number, number] => [C + r * Math.cos(a), C + r * Math.sin(a)];
const TAU = Math.PI * 2;

export interface RingGeom { r: number; d: string; width: number; opacity: number }
export interface MarkGeom { d: string; opacity: number }
export interface DotGeom { cx: number; cy: number; r: number }
export interface SigilGeometry {
  view: number;
  rings: RingGeom[];
  marks: MarkGeom[];
  dots: DotGeom[];
  core: { r: number; opacity: number };
}

/** An arc path from angle a0 to a1 (radians, a1 > a0) at radius r. */
function arc(r: number, a0: number, a1: number): string {
  const [x0, y0] = pt(r, a0);
  const [x1, y1] = pt(r, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${f(x0)} ${f(y0)}A${f(r)} ${f(r)} 0 ${large} 1 ${f(x1)} ${f(y1)}`;
}

function ringPath(r: number, gapStart: number, gap: number): string {
  if (gap <= 0) {
    // A full circle needs two arcs to be representable.
    const [x0, y0] = pt(r, 0);
    const [x1, y1] = pt(r, Math.PI);
    return `M${f(x0)} ${f(y0)}A${f(r)} ${f(r)} 0 1 1 ${f(x1)} ${f(y1)}A${f(r)} ${f(r)} 0 1 1 ${f(x0)} ${f(y0)}`;
  }
  return arc(r, gapStart + gap, gapStart + TAU);
}

function marksFor(p: EmberProfile, rng: () => number, n: number, inner: number, outer: number): MarkGeom[] {
  const marks: MarkGeom[] = [];
  const golden = 2.399963229728653;
  const spin = rng() * TAU;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const jitter = (rng() - 0.5) * 0.12;
    const opacity = Math.round((0.55 + rng() * 0.4) * 100) / 100;
    let d = '';
    switch (p.motif) {
      case 'spiral': {
        const a = spin + i * golden;
        const r = inner + (outer - inner) * t;
        d = arc(r, a, a + 0.28 + jitter);
        break;
      }
      case 'rays': {
        const a = spin + (i / n) * TAU + jitter;
        const len = (outer - inner) * (0.4 + 0.6 * ((i % 3) / 2));
        const [x0, y0] = pt(inner, a);
        const [x1, y1] = pt(inner + len, a);
        d = `M${f(x0)} ${f(y0)}L${f(x1)} ${f(y1)}`;
        break;
      }
      case 'lattice': {
        const ring = i % 3;
        const r = inner + ((outer - inner) * (ring + 1)) / 3.4;
        const a = spin + (i / n) * TAU + ring * 0.2;
        const [x, y] = pt(r, a);
        const s = 3.4;
        d = `M${f(x - s)} ${f(y)}L${f(x + s)} ${f(y)}M${f(x)} ${f(y - s)}L${f(x)} ${f(y + s)}`;
        break;
      }
      case 'petals': {
        const a = spin + (i / n) * TAU;
        const [bx, by] = pt(inner, a);
        const [tx, ty] = pt(outer, a);
        const [lx, ly] = pt((inner + outer) / 2, a - 0.22);
        const [rx, ry] = pt((inner + outer) / 2, a + 0.22);
        d = `M${f(bx)} ${f(by)}Q${f(lx)} ${f(ly)} ${f(tx)} ${f(ty)}Q${f(rx)} ${f(ry)} ${f(bx)} ${f(by)}`;
        break;
      }
      case 'arcs': {
        const r = inner + (outer - inner) * (((i * 5) % n) / Math.max(1, n - 1));
        const a = spin + (i / n) * TAU * 2.0;
        d = arc(r, a, a + 0.4 + jitter);
        break;
      }
      case 'knot': {
        const r = inner + (outer - inner) * (0.35 + 0.5 * ((i % 2) as number));
        const a = spin + (i / n) * TAU;
        const [x, y] = pt(r, a);
        const s = 3.6;
        d = `M${f(x)} ${f(y - s)}L${f(x + s)} ${f(y)}L${f(x)} ${f(y + s)}L${f(x - s)} ${f(y)}Z`;
        break;
      }
    }
    marks.push({ d, opacity });
  }
  return marks;
}

export function sigilGeometry(profile: EmberProfile, seed: number): SigilGeometry {
  assertEmberProfile(profile);
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('seed must be an unsigned 32-bit integer');
  const rng = mulberry32(fnv1a(`${profile.v}|${profile.durationBand}${profile.segmentBand}${profile.reactionBands.join('')}${profile.silenceBand}${profile.depthStage}|${profile.motif}|${seed}`));

  const ringCount = 1 + profile.durationBand;
  const gap = profile.silenceBand === 0 ? 0 : 0.18 * profile.silenceBand;
  const rings: RingGeom[] = [];
  for (let i = 0; i < ringCount; i++) {
    const r = 92 - i * 7;
    rings.push({ r, d: ringPath(r, rng() * TAU, gap), width: i === 0 ? 1.6 : 1.1, opacity: Math.round((0.9 - i * 0.12) * 100) / 100 });
  }

  const innerEdge = 34;
  const outerEdge = 92 - ringCount * 7 - 4;
  const marks = marksFor(profile, rng, 6 + profile.segmentBand * 3, innerEdge, outerEdge);

  const dots: DotGeom[] = [];
  profile.reactionBands.forEach((b, slot) => {
    const base = (slot / 3) * TAU + rng() * 0.3;
    for (let j = 0; j < b; j++) {
      const [cx, cy] = pt(24, base + j * 0.34);
      dots.push({ cx: Number(f(cx)), cy: Number(f(cy)), r: 2.2 });
    }
  });

  return { view: VIEW, rings, marks, dots, core: { r: 6 + profile.depthStage * 3, opacity: Math.round((0.55 + profile.depthStage * 0.1) * 100) / 100 } };
}

export interface SvgOptions { stroke?: string; accent?: string; size?: number; title?: string }

/** The same drawing as a string, for places React is not available (share cards, contact sheets). */
export function renderSigilSvg(profile: EmberProfile, seed: number, o: SvgOptions = {}): string {
  const g = sigilGeometry(profile, seed);
  const stroke = o.stroke ?? 'currentColor';
  const accent = o.accent ?? stroke;
  const size = o.size ?? 160;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const parts: string[] = [];
  for (const r of g.rings) parts.push(`<path d="${r.d}" fill="none" stroke="${stroke}" stroke-width="${r.width}" stroke-linecap="round" opacity="${r.opacity}"/>`);
  for (const m of g.marks) parts.push(`<path d="${m.d}" fill="none" stroke="${stroke}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity="${m.opacity}"/>`);
  for (const d of g.dots) parts.push(`<circle cx="${d.cx}" cy="${d.cy}" r="${d.r}" fill="${stroke}" opacity="0.8"/>`);
  parts.push(`<circle cx="${C}" cy="${C}" r="${g.core.r}" fill="${accent}" opacity="${g.core.opacity}"/>`);
  const t = o.title ? `<title>${esc(o.title)}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.view} ${g.view}" width="${size}" height="${size}"${o.title ? ' role="img"' : ' aria-hidden="true"'}>${t}${parts.join('')}</svg>`;
}
