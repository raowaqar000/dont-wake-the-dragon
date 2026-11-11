import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';

/**
 * Code-drawn placeholders for feature 8 (to be replaced by painted art later):
 * ceiling rock, rock shadow, rubble and the jump button icon.
 * Drawn at RES x and shown at 1 / RES (TROLL_TEXTURE_SCALE), like the other factories.
 */
const RES = 2;
export const TROLL_TEXTURE_SCALE = 1 / RES;

export function createTrollTextures(scene: Phaser.Scene): void {
  createRock(scene);
  createShadow(scene);
  createRubble(scene);
  createJumpIcon(scene);
  createPitOverlay(scene);
}

/**
 * Laid over every pit so it reads as a hole from top-down: dark radial center, a shadow
 * under the near (top) edge, and a light rim on the far (bottom) edge, which faces the viewer.
 */
function createPitOverlay(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.pitOverlay)) return;
  const P = TUNING.art.pit;
  const s = TUNING.level.tileSize * RES;
  const tex = scene.textures.createCanvas(TEXTURE_KEYS.pitOverlay, s, s);
  if (!tex) return;
  const ctx = tex.getContext();
  const c = Phaser.Display.Color.IntegerToColor(P.centerColor);
  const rgba = (col: Phaser.Display.Color, a: number) => `rgba(${col.red},${col.green},${col.blue},${a})`;

  // Dark center, fading toward the edges.
  const grad = ctx.createRadialGradient(s / 2, s * 0.45, 0, s / 2, s * 0.45, s * 0.62);
  grad.addColorStop(0, rgba(c, P.overlayAlpha));
  grad.addColorStop(0.55, rgba(c, P.overlayAlpha * 0.7));
  grad.addColorStop(1, rgba(c, P.overlayAlpha * 0.25));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);

  // Shadow under the near (top) edge.
  const sh = ctx.createLinearGradient(0, 0, 0, s * 0.35);
  sh.addColorStop(0, rgba(c, P.shadowAlpha));
  sh.addColorStop(1, rgba(c, 0));
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, s, s * 0.35);

  // Light rim on the far (bottom) edge.
  const rim = Phaser.Display.Color.IntegerToColor(P.rimColor);
  const rh = P.rimPx * RES;
  const rg = ctx.createLinearGradient(0, s - rh * 2.5, 0, s);
  rg.addColorStop(0, rgba(rim, 0));
  rg.addColorStop(0.6, rgba(rim, P.rimAlpha));
  rg.addColorStop(1, rgba(rim, P.rimAlpha * 0.6));
  ctx.fillStyle = rg;
  ctx.fillRect(s * 0.06, s - rh * 2.5, s * 0.88, rh * 2.5);
  tex.refresh();
}

const OUTLINE = 0x0b0a0d;

/** Chunky cartoon boulder, a bit smaller than a tile. */
function createRock(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.ceilingRock)) return;
  const s = TUNING.level.tileSize * RES;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const pts = (scale: number, dx = 0, dy = 0) => {
    const c = s / 2;
    const r = s * 0.44 * scale;
    const shape = [1, 0.86, 0.95, 0.8, 0.98, 0.88, 0.92, 0.84];
    return shape.map((k, i) => {
      const a = (i / shape.length) * Math.PI * 2 - Math.PI / 2;
      return new Phaser.Math.Vector2(c + dx + Math.cos(a) * r * k, c + dy + Math.sin(a) * r * k);
    });
  };
  g.fillStyle(OUTLINE, 1);
  g.fillPoints(pts(1), true);
  g.fillStyle(0x5e5868, 1);
  g.fillPoints(pts(0.88), true);
  g.fillStyle(0x8a8296, 1);
  g.fillPoints(pts(0.6, -s * 0.07, -s * 0.08), true);
  g.fillStyle(0xb4aec0, 1);
  g.fillEllipse(s * 0.38, s * 0.32, s * 0.14, s * 0.08);
  // A couple of cracks.
  g.lineStyle(3, OUTLINE, 0.7);
  g.lineBetween(s * 0.55, s * 0.5, s * 0.68, s * 0.62);
  g.lineBetween(s * 0.68, s * 0.62, s * 0.66, s * 0.74);
  g.generateTexture(TEXTURE_KEYS.ceilingRock, s, s);
  g.destroy();
}

/** Soft dark ellipse; scaled up and faded in as the rock falls. */
function createShadow(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.rockShadow)) return;
  const s = TUNING.level.tileSize * RES;
  const tex = scene.textures.createCanvas(TEXTURE_KEYS.rockShadow, s, s);
  if (!tex) return;
  const ctx = tex.getContext();
  const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.9)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.6)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  tex.refresh();
}

/** Pile of broken stones covering one tile (passable but noisy). */
function createRubble(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.rubble)) return;
  const s = TUNING.level.tileSize * RES;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const rng = new Phaser.Math.RandomDataGenerator(['rubble']);
  for (let i = 0; i < 11; i++) {
    const x = rng.realInRange(0.18, 0.82) * s;
    const y = rng.realInRange(0.2, 0.84) * s;
    const w = rng.realInRange(0.12, 0.24) * s;
    const h = w * rng.realInRange(0.6, 0.85);
    g.fillStyle(OUTLINE, 1);
    g.fillEllipse(x, y, w + 5, h + 5);
    g.fillStyle(rng.pick([0x5e5868, 0x6e6878, 0x4e4858]), 1);
    g.fillEllipse(x, y, w, h);
    g.fillStyle(0x9a92a6, 1);
    g.fillEllipse(x - w * 0.15, y - h * 0.2, w * 0.35, h * 0.25);
  }
  g.generateTexture(TEXTURE_KEYS.rubble, s, s);
  g.destroy();
}

/** Two stacked up-chevrons ("hop"), white so the button can stay subtle. */
function createJumpIcon(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.jumpIcon)) return;
  const s = 96;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const chevron = (y: number, w: number) => {
    g.lineStyle(12, 0x000000, 0.35);
    g.beginPath();
    g.moveTo(s / 2 - w, y + w * 0.7 + 3);
    g.lineTo(s / 2, y + 3);
    g.lineTo(s / 2 + w, y + w * 0.7 + 3);
    g.strokePath();
    g.lineStyle(10, 0xffffff, 1);
    g.beginPath();
    g.moveTo(s / 2 - w, y + w * 0.7);
    g.lineTo(s / 2, y);
    g.lineTo(s / 2 + w, y + w * 0.7);
    g.strokePath();
  };
  chevron(18, 26);
  chevron(44, 26);
  g.generateTexture(TEXTURE_KEYS.jumpIcon, s, s);
  g.destroy();
}
