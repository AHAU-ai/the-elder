// lib/petalDraw.ts
//
// One white petal, drawn on a 2D canvas. Shared by the doorway (PortalGate) and
// the arrival (BreathGate) so the petals that leave the door are the very same
// petals that arrive in the vortex.
//
// Blossoms: the owner asked (2026-10-25) for blooming lotus blossoms on the
// doorway floor. The lotus is a flower several traditions hold, and "No lineage
// imagery, ever" (docs/portal-crossing.md) still governs, so a blossom here is a
// loose, naturalistic cluster of the same white petals -- uneven angles, uneven
// lengths, no symmetric ring, no centre mark, no pattern: a flower on the floor,
// never an emblem. blossomPetals() jitters every petal on purpose.

export type RGB = [number, number, number];

/** White, and the faintest blush: never a saturated colour. */
export const PETAL_COLS: RGB[] = [
  [255, 255, 255], [255, 250, 248], [255, 244, 246], [252, 246, 255], [255, 238, 242],
];

export interface PetalLook {
  x: number; y: number;
  size: number;      // petal length (px)
  rot: number;       // radians
  flip: number;      // -1..1, the petal turning over (its width follows |flip|)
  alpha: number;
  col: RGB;
  /** Soft halo. On by default; the many resting petals turn it off (it is the costly part). */
  glow?: boolean;
}

export interface BlossomPetal { x: number; y: number; rot: number; len: number; flip: number; layer: number }

/** Petals per layer, back to front: 4 + 3 + 2. */
export const BLOSSOM_PETALS = 9;
const LAYERS: { angles: number[]; len: number }[] = [
  { angles: [-1.05, -0.38, 0.38, 1.05], len: 1 },
  { angles: [-0.62, 0, 0.62], len: 0.86 },
  { angles: [-0.22, 0.24], len: 0.7 },
];

/** Where each petal of a blossom sits, back layer first. open 0 = a closed bud
 *  (all petals upright and narrow), 1 = fully open. jit: BLOSSOM_PETALS values in -1..1. */
export function blossomPetals(x: number, y: number, size: number, open: number, jit: number[]): BlossomPetal[] {
  const o = open < 0 ? 0 : open > 1 ? 1 : open;
  const out: BlossomPetal[] = [];
  let i = 0;
  LAYERS.forEach((layer, li) => {
    for (const ang of layer.angles) {
      const j = jit[i++] ?? 0;
      const rot = ang * o + j * 0.1;
      const len = size * layer.len * (0.55 + 0.45 * o) * (1 + j * 0.08);
      out.push({
        x: x + Math.sin(rot) * len * 0.82,
        y: y - Math.cos(rot) * len * 0.82,
        rot, len, flip: 0.45 + 0.55 * o, layer: li,
      });
    }
  });
  return out;
}

export function drawBlossom(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, open: number, jit: number[], alpha: number): void {
  for (const bp of blossomPetals(x, y, size, open, jit)) {
    drawPetal(ctx, { x: bp.x, y: bp.y, size: bp.len, rot: bp.rot, flip: bp.flip, alpha: alpha * (0.78 + 0.1 * bp.layer), col: PETAL_COLS[bp.layer], glow: false });
  }
}

export function drawPetal(ctx: CanvasRenderingContext2D, p: PetalLook): void {
  const a = p.alpha;
  if (a <= 0.005) return;
  const sx = 0.3 + 0.7 * Math.abs(p.flip);   // never fully edge-on
  const sz = p.size;
  const [r, g, b] = p.col;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.scale(sx, 1);
  ctx.beginPath();
  ctx.moveTo(0, -sz);
  ctx.bezierCurveTo(sz * 0.62, -sz * 0.5, sz * 0.5, sz * 0.62, 0, sz * 0.82);
  ctx.bezierCurveTo(-sz * 0.5, sz * 0.62, -sz * 0.62, -sz * 0.5, 0, -sz);
  ctx.closePath();
  const gr = ctx.createLinearGradient(0, sz * 0.8, 0, -sz);
  gr.addColorStop(0, `rgba(255,${Math.round(g * 0.9)},${Math.round(b * 0.93)},${a.toFixed(3)})`);   // faint blush at the base
  gr.addColorStop(0.55, `rgba(${r},${g},${b},${a.toFixed(3)})`);
  gr.addColorStop(1, `rgba(255,255,255,${(a * 0.95).toFixed(3)})`);
  ctx.fillStyle = gr;
  if (p.glow !== false) {
    ctx.shadowColor = `rgba(255,236,214,${(a * 0.55).toFixed(3)})`;   // a soft glow, so white reads against the dark
    ctx.shadowBlur = sz * 0.5;
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(0, -sz * 0.75); ctx.lineTo(0, sz * 0.5);
  ctx.strokeStyle = `rgba(236,214,222,${(a * 0.4).toFixed(3)})`;
  ctx.lineWidth = Math.max(0.6, sz * 0.045);
  ctx.stroke();
  ctx.restore();
}
