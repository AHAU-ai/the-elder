// lib/petalDraw.ts
//
// One white petal, drawn on a 2D canvas. Shared by the doorway (PortalGate) and
// the arrival (BreathGate) so the petals that leave the door are the very same
// petals that arrive in the vortex. A petal only: no whole flower, no mark.
// "No lineage imagery" (docs/portal-crossing.md) is why: the lotus is a flower
// many traditions hold, so what is drawn is just its white, pointed petal.

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
  ctx.shadowColor = `rgba(255,236,214,${(a * 0.55).toFixed(3)})`;   // a soft glow, so white reads against the dark
  ctx.shadowBlur = sz * 0.5;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.moveTo(0, -sz * 0.75); ctx.lineTo(0, sz * 0.5);
  ctx.strokeStyle = `rgba(236,214,222,${(a * 0.4).toFixed(3)})`;
  ctx.lineWidth = Math.max(0.6, sz * 0.045);
  ctx.stroke();
  ctx.restore();
}
