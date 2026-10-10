// lib/portalTexture.ts
//
// The look of the portal door (app/components/PortalGate.tsx): a procedural,
// seeded, photographic-feeling wood texture for the two leaves, and a second
// texture of abstract "light veins" -- thin branching threads of ember light
// that grow from the seam across the grain.
//
// No image assets, no fetches: both are drawn on offscreen canvases once, after
// the first paint, and handed to CSS as object URLs. The same seed gives the
// same door every visit. If anything fails (no canvas, blocked, out of memory)
// the caller keeps the plain CSS door underneath -- the textures only ever
// fade in over it.
//
// What the veins are NOT (docs/portal-crossing.md, "No lineage imagery"):
// they are noise-driven branching lines. No glyphs, runes, sigils, symmetric
// ornament or anything that belongs to a tradition. Light, grain and wear only.
//
// Texture space is the LEFT leaf: the seam (where the light is) is the right
// edge, x = W. The right leaf mirrors it with scaleX(-1) in CSS, which also
// mirrors the baked lighting so the seam is lit on both.

export const TEX_W = 325;
export const TEX_H = 1000; // leaf aspect is 0.325 : 1 (door is 0.65 : 1, two leaves)

/* ── seeded randomness (pure, unit-tested) ── */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

/** Smooth value noise in [0, 1]. */
export function makeNoise(seed: number): (x: number, y: number) => number {
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
    const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
    return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
  };
}

export function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves: number): number {
  let sum = 0, amp = 0.5, norm = 0, f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * f, y * f) * amp;
    norm += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}

/* ── the light veins: pure geometry, no canvas ── */

export interface Vein {
  /** Polyline in texture pixels. */
  pts: Array<[number, number]>;
  /** 0 = trunk, 1.. = branch depth. Thinner and dimmer as it deepens. */
  depth: number;
}

function angDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Thin branching threads that leave the seam edge and wander out across the
 * wood. Steered by a smooth flow field (so neighbours curl together like
 * roots or frost) with random forks. Deterministic for a seed; every point is
 * inside [0, W] x [0, H].
 */
export function traceVeins(seed: number, W = TEX_W, H = TEX_H): Vein[] {
  const rnd = mulberry32(seed);
  const flow = makeNoise(seed ^ 0x9e3779b9);
  const veins: Vein[] = [];
  const STEP = 6;
  const MAX_DEPTH = 3;

  const grow = (x: number, y: number, theta: number, depth: number, budget: number) => {
    const pts: Array<[number, number]> = [[x, y]];
    let t = theta;
    for (let i = 0; i < budget; i++) {
      // The field says which way the light "wants" to go here; the thread
      // relaxes toward it, so close threads share a mood without overlapping.
      const phi = Math.PI + (fbm(flow, x * 0.012, y * 0.0045, 3) - 0.5) * 3.1;
      t += angDiff(phi, t) * 0.32 + (rnd() - 0.5) * 0.42;
      x += Math.cos(t) * STEP;
      y += Math.sin(t) * STEP;
      if (x < 6 || x > W - 1 || y < 2 || y > H - 2) break;
      pts.push([x, y]);
      if (depth < MAX_DEPTH && i > 5 && rnd() < 0.05) {
        const side = rnd() < 0.5 ? -1 : 1;
        grow(x, y, t + side * (0.5 + rnd() * 0.7), depth + 1, Math.floor(budget * (0.45 + rnd() * 0.2)));
      }
    }
    if (pts.length > 3) veins.push({ pts, depth });
  };

  const seeds = 15;
  for (let s = 0; s < seeds; s++) {
    // Stratified along the seam so the whole height carries light, jittered
    // so it never reads as a row of identical sprouts.
    const y = ((s + 0.15 + rnd() * 0.7) / seeds) * H;
    const theta = Math.PI + (rnd() - 0.5) * 1.1;
    grow(W - 2 - rnd() * 6, y, theta, 0, 38 + Math.floor(rnd() * 26));
  }
  return veins;
}

/* ── rendering (browser only) ── */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// Light comes from the seam (right) and above, a little toward the viewer.
const LX = 0.62, LY = -0.45, LZ = 0.64;
const FLAT = LZ; // N.L of an upright flat surface, used to normalise

// Door joinery, in texture pixels (mirrors the CSS panels: 16% in, 7%/52% down).
const PANEL_X0 = 0.16 * TEX_W, PANEL_X1 = 0.84 * TEX_W;
const PANELS: Array<[number, number]> = [[0.07 * TEX_H, 0.45 * TEX_H], [0.52 * TEX_H, 0.93 * TEX_H]];
const BEVEL = 12;
const GROOVE = 2;

function renderWood(canvas: HTMLCanvasElement, seed: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  const W = canvas.width, H = canvas.height;
  const img = ctx.createImageData(W, H);
  const px = img.data;

  const nWarp = makeNoise(seed + 1), nRing = makeNoise(seed + 2);
  const nFib = makeNoise(seed + 3), nPore = makeNoise(seed + 4), nWear = makeNoise(seed + 5);

  const S = 0.7, C = Math.sqrt(1 - S * S);
  const edgeNormal: Array<[number, number, number]> = [
    [-S, 0, C], // left edge of a panel: slopes away to the left
    [S, 0, C],  // right edge: faces the seam
    [0, -S, C], // top
    [0, S, C],  // bottom
  ];

  for (let y = 0; y < H; y++) {
    // Which board are we on, and which way does its grain run?
    let panelIdx = -1;
    for (let i = 0; i < PANELS.length; i++) if (y >= PANELS[i][0] && y <= PANELS[i][1]) panelIdx = i;
    const inStileBand = panelIdx >= 0;

    for (let x = 0; x < W; x++) {
      const inPanelX = x >= PANEL_X0 && x <= PANEL_X1;
      const inPanel = inStileBand && inPanelX;

      // Grain: stiles and panels run vertically; the rails between run across.
      let c: number, a: number, off: number;
      if (inPanel) { c = x; a = y; off = panelIdx === 0 ? 11 : 47; }
      else if (inStileBand) { c = x; a = y; off = x < PANEL_X0 ? 83 : 131; }
      else { c = y; a = x; off = 211 + Math.floor(y / 90) * 17; }

      const warp = fbm(nWarp, c * 0.016 + off, a * 0.0035 + off * 0.3, 3);
      const t = c * 0.082 + warp * 5.4 + nRing(c * 0.05 + off, a * 0.01) * 0.6;
      const frac = t - Math.floor(t);
      const ring = Math.pow(Math.abs(Math.sin(frac * Math.PI)), 0.7);
      const fib = nFib(c * 0.9 + off, a * 0.018);
      const pore = nPore(c * 1.7 + off, a * 0.2);
      let g = 0.36 + 0.40 * ring + 0.2 * (fib - 0.5);
      if (pore > 0.79) g -= (pore - 0.79) * 1.2;
      g = clamp01(g);

      // Warm walnut: deep brown to red-gold.
      let r = mix(34, 132, g), gg = mix(18, 80, g), b = mix(9, 38, g);

      // Joinery: groove, bevel, raised field -- lit from the seam.
      let nx = 0, ny = 0, nz = 1, ao = 1;
      if (inPanel) {
        const y0 = PANELS[panelIdx][0], y1 = PANELS[panelIdx][1];
        const dl = x - PANEL_X0, dr = PANEL_X1 - x, dt = y - y0, db = y1 - y;
        const d = Math.min(dl, dr, dt, db);
        const e = d === dl ? 0 : d === dr ? 1 : d === dt ? 2 : 3;
        const tilt = smooth(GROOVE - 0.5, GROOVE + 1.5, d) * (1 - smooth(BEVEL, BEVEL + 3, d));
        nx = edgeNormal[e][0] * tilt; ny = edgeNormal[e][1] * tilt;
        nz = 1 + (edgeNormal[e][2] - 1) * tilt;
        ao *= 0.28 + 0.72 * smooth(0, GROOVE + 1.2, d);     // the groove is dark
        r *= 1.05; gg *= 1.05; b *= 1.05;                   // raised field catches a little more
      } else {
        // Frame members sit proud of the groove: a thin shadow where they meet it.
        let near = Infinity;
        for (let i = 0; i < PANELS.length; i++) {
          const dx = Math.max(PANEL_X0 - x, 0, x - PANEL_X1);
          const dy = Math.max(PANELS[i][0] - y, 0, y - PANELS[i][1]);
          const dd = Math.hypot(dx, dy);
          if (dd < near) near = dd;
        }
        if (near < 5) ao *= 0.62 + 0.38 * smooth(0, 5, near);
      }
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const lambert = Math.max(0, (nx * LX + ny * LY + nz * LZ) / len) / FLAT;
      let shade = 0.28 + 0.72 * lambert;

      // Wear and soot: low-frequency dirt, darker toward the floor, and the
      // outer (hinge) edge sits in shadow while the seam edge is thin and crisp.
      const wear = nWear(x * 0.03, y * 0.011);
      ao *= 0.86 + 0.14 * wear;
      ao *= 1 - 0.28 * smooth(0.6, 1, y / H);
      ao *= 0.78 + 0.22 * smooth(0, 14, x);
      if (x > W - 2) ao *= 0.55;

      // Film grain, so it does not read as a vector fill.
      const grain = 1 + (hash2(x, y, seed + 9) - 0.5) * 0.07;
      const k = shade * ao * grain;

      const i = (y * W + x) * 4;
      px[i] = Math.min(255, r * k);
      px[i + 1] = Math.min(255, gg * k);
      px[i + 2] = Math.min(255, b * k);
      px[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Brass hinges on the outer edge: plate, barrel, screws, a soft cast shadow.
  const rr = (x: number, y: number, w: number, h: number, r: number) => {
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  };
  const brass = (x0: number, x1: number) => {
    const gr = ctx.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, '#5a3f14'); gr.addColorStop(0.35, '#d6ad4f');
    gr.addColorStop(0.55, '#f3dc94'); gr.addColorStop(1, '#6b4c18');
    return gr;
  };
  for (const cy of [0.15 * H, 0.5 * H, 0.85 * H]) {
    const h = 74;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 3;
    ctx.fillStyle = brass(2, 26);
    ctx.beginPath(); rr(2, cy - h / 2, 24, h, 3); ctx.fill();
    ctx.restore();
    ctx.fillStyle = brass(1, 9); // barrel
    ctx.beginPath(); rr(1, cy - h / 2 - 6, 8, h + 12, 4); ctx.fill();
    for (const dy of [-h / 2 + 12, h / 2 - 12]) {
      ctx.fillStyle = '#2a1c08'; ctx.beginPath(); ctx.arc(18, cy + dy, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,236,170,0.5)'; ctx.beginPath(); ctx.arc(17.4, cy + dy - 0.8, 1, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function renderVeins(canvas: HTMLCanvasElement, veins: Vein[]): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  const widthFor = (depth: number) => [2.4, 1.5, 1.0, 0.7][Math.min(3, depth)];
  const strokeVein = (v: Vein, scale: number, alpha: number, color: string) => {
    ctx.strokeStyle = color;
    const n = v.pts.length;
    for (let i = 1; i < n; i++) {
      const life = 1 - i / n; // fades toward the tip
      ctx.globalAlpha = alpha * (0.25 + 0.75 * life);
      ctx.lineWidth = Math.max(0.5, widthFor(v.depth) * scale * (0.35 + 0.65 * life));
      ctx.beginPath();
      ctx.moveTo(v.pts[i - 1][0], v.pts[i - 1][1]);
      ctx.lineTo(v.pts[i][0], v.pts[i][1]);
      ctx.stroke();
    }
  };

  // Wide soft bloom, then the hot core.
  for (const v of veins) strokeVein(v, 4.2, 0.1, 'rgb(255,120,30)');
  for (const v of veins) strokeVein(v, 2.0, 0.28, 'rgb(255,160,60)');
  for (const v of veins) strokeVein(v, 1.0, 0.95, 'rgb(255,226,160)');

  // Little suns where a thread forks or ends: the light pools.
  ctx.globalAlpha = 1;
  for (const v of veins) {
    const tip = v.pts[v.pts.length - 1];
    const r = 7 - v.depth * 1.2;
    const g = ctx.createRadialGradient(tip[0], tip[1], 0, tip[0], tip[1], r);
    g.addColorStop(0, 'rgba(255,230,170,0.75)'); g.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(tip[0], tip[1], r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}

export interface PortalTextures {
  /** Procedural wood; '' when the photographic doors are used and wood was skipped. */
  leafUrl: string;
  veinsUrl: string;
  /** Free the object URLs. Safe to call more than once. */
  revoke: () => void;
}

function toUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error('toBlob failed'));
      else resolve(URL.createObjectURL(blob));
    }, 'image/png');
  });
}

const SEED = 0x5eed1e; // fixed: the same door every visit

export async function buildPortalTextures(opts: { wood?: boolean } = {}): Promise<PortalTextures> {
  const withWood = opts.wood !== false;
  const wood = document.createElement('canvas');
  if (withWood) {
    wood.width = TEX_W; wood.height = TEX_H;
    renderWood(wood, SEED);
  }

  const veins = document.createElement('canvas');
  veins.width = TEX_W; veins.height = TEX_H;
  renderVeins(veins, traceVeins(SEED));

  const [leafUrl, veinsUrl] = await Promise.all([withWood ? toUrl(wood) : Promise.resolve(''), toUrl(veins)]);
  let done = false;
  return {
    leafUrl,
    veinsUrl,
    revoke: () => {
      if (done) return;
      done = true;
      if (leafUrl) URL.revokeObjectURL(leafUrl);
      URL.revokeObjectURL(veinsUrl);
    },
  };
}
