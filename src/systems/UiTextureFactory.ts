import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';

/**
 * Code-drawn UI textures (placeholders in the painted style until heart art exists):
 * full heart, empty heart, the two broken halves, and the red screen-edge glow.
 * Hearts are drawn at RES x and shown at 1 / RES (UI_TEXTURE_SCALE).
 */
const L = TUNING.lives;
const RES = L.textureResolution;
export const UI_TEXTURE_SCALE = 1 / RES;

export function createUiTextures(scene: Phaser.Scene): void {
  const s = L.heartSize * RES;
  heart(scene, TEXTURE_KEYS.heartFull, s, 'full');
  heart(scene, TEXTURE_KEYS.heartEmpty, s, 'empty');
  heart(scene, TEXTURE_KEYS.heartShardLeft, s, 'left');
  heart(scene, TEXTURE_KEYS.heartShardRight, s, 'right');
  vignette(scene);
}

type HeartPart = 'full' | 'empty' | 'left' | 'right';

/** Heart outline path (two lobes and a point), inset by `pad` px. */
function heartPath(ctx: CanvasRenderingContext2D, s: number, pad: number): void {
  const w = s - pad * 2;
  const x = pad;
  const y = pad;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y + w * 0.92);
  ctx.bezierCurveTo(x + w * 0.1, y + w * 0.62, x - w * 0.04, y + w * 0.3, x + w * 0.2, y + w * 0.12);
  ctx.bezierCurveTo(x + w * 0.34, y + w * 0.02, x + w * 0.46, y + w * 0.1, x + w / 2, y + w * 0.24);
  ctx.bezierCurveTo(x + w * 0.54, y + w * 0.1, x + w * 0.66, y + w * 0.02, x + w * 0.8, y + w * 0.12);
  ctx.bezierCurveTo(x + w * 1.04, y + w * 0.3, x + w * 0.9, y + w * 0.62, x + w / 2, y + w * 0.92);
  ctx.closePath();
}

/** Jagged crack down the middle, used to clip the two halves. */
function crackClip(ctx: CanvasRenderingContext2D, s: number, side: 'left' | 'right'): void {
  const zig = [
    [0.5, 0],
    [0.5, 0.24],
    [0.42, 0.38],
    [0.56, 0.52],
    [0.45, 0.66],
    [0.53, 0.8],
    [0.5, 1],
  ];
  ctx.beginPath();
  ctx.moveTo(side === 'left' ? 0 : s, 0);
  for (const [zx, zy] of zig) ctx.lineTo(zx * s, zy * s);
  ctx.lineTo(side === 'left' ? 0 : s, s);
  ctx.closePath();
  ctx.clip();
}

function hex(c: number, a = 1): string {
  const col = Phaser.Display.Color.IntegerToColor(c);
  return `rgba(${col.red},${col.green},${col.blue},${a})`;
}

function heart(scene: Phaser.Scene, key: string, s: number, part: HeartPart): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, s, s);
  if (!tex) return;
  const ctx = tex.getContext();
  const outline = Math.max(2, s * 0.07);

  ctx.save();
  if (part === 'left' || part === 'right') crackClip(ctx, s, part);

  // Dark outline (the whole shape), then the fill inset inside it.
  ctx.fillStyle = hex(L.outlineColor);
  heartPath(ctx, s, 1);
  ctx.fill();

  if (part === 'empty') {
    ctx.fillStyle = hex(L.emptyFillColor, L.emptyAlpha);
    heartPath(ctx, s, 1 + outline);
    ctx.fill();
    // Faint inner rim so the empty slot still reads as a heart.
    ctx.strokeStyle = hex(L.shadeColor, 0.55);
    ctx.lineWidth = s * 0.03;
    heartPath(ctx, s, 1 + outline * 1.4);
    ctx.stroke();
  } else {
    // Painted look: base red with a darker lower-right shade and a soft highlight.
    const g = ctx.createLinearGradient(s * 0.2, s * 0.15, s * 0.8, s * 0.95);
    g.addColorStop(0, hex(L.fillColor));
    g.addColorStop(0.6, hex(L.fillColor));
    g.addColorStop(1, hex(L.shadeColor));
    ctx.fillStyle = g;
    heartPath(ctx, s, 1 + outline);
    ctx.fill();

    ctx.fillStyle = hex(L.highlightColor, 0.85);
    ctx.beginPath();
    ctx.ellipse(s * 0.3, s * 0.3, s * 0.1, s * 0.065, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hex(0xffffff, 0.7);
    ctx.beginPath();
    ctx.arc(s * 0.4, s * 0.23, s * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Broken halves get a dark edge along the crack.
  if (part === 'left' || part === 'right') {
    ctx.save();
    heartPath(ctx, s, 1);
    ctx.clip();
    ctx.strokeStyle = hex(L.outlineColor);
    ctx.lineWidth = outline * 0.8;
    ctx.beginPath();
    ctx.moveTo(0.5 * s, 0);
    for (const [zx, zy] of [
      [0.5, 0.24],
      [0.42, 0.38],
      [0.56, 0.52],
      [0.45, 0.66],
      [0.53, 0.8],
      [0.5, 1],
    ]) ctx.lineTo(zx * s, zy * s);
    ctx.stroke();
    ctx.restore();
  }
  tex.refresh();
}

/** Clear center, red toward the edges. Stretched over the whole screen. */
function vignette(scene: Phaser.Scene): void {
  const key = TEXTURE_KEYS.dangerVignette;
  if (scene.textures.exists(key)) return;
  const w = L.vignetteTextureW;
  const h = L.vignetteTextureH;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  const c = L.vignetteColor;
  // Radial gradient in a unit circle, scaled to the screen's aspect so it hugs every edge.
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(w / 2, h / 2);
  const g = ctx.createRadialGradient(0, 0, L.vignetteInner, 0, 0, Math.SQRT2);
  g.addColorStop(0, `rgba(${c.r},${c.g},${c.b},0)`);
  g.addColorStop(0.45, `rgba(${c.r},${c.g},${c.b},0.55)`);
  g.addColorStop(1, `rgba(${c.r},${c.g},${c.b},1)`);
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  tex.refresh();
}
