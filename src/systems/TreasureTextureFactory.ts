import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';

/**
 * Procedural treasure textures (coin, gem, chest closed/open, sparkle), drawn once at boot
 * at TUNING.treasure.textureResolution and shown at TREASURE_TEXTURE_SCALE.
 * Also used as HUD icons.
 */

const T = TUNING.treasure;
const RES = T.textureResolution;

/** Display scale for every treasure texture. */
export const TREASURE_TEXTURE_SCALE = 1 / RES;

export function createTreasureTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  drawTexture(scene, g, TEXTURE_KEYS.coin, T.coin.size, T.coin.size, drawCoin);
  drawTexture(scene, g, TEXTURE_KEYS.gem, T.gem.size, T.gem.size, drawGem);
  drawTexture(scene, g, TEXTURE_KEYS.chest, T.chest.width, T.chest.height, (gr) => drawChest(gr, false));
  drawTexture(scene, g, TEXTURE_KEYS.chestOpen, T.chest.width, T.chest.height, (gr) => drawChest(gr, true));
  drawTexture(scene, g, TEXTURE_KEYS.sparkle, T.sparkle.size, T.sparkle.size, drawSparkle);
  g.destroy();
}

function drawTexture(
  scene: Phaser.Scene,
  g: Phaser.GameObjects.Graphics,
  key: string,
  w: number,
  h: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) return;
  g.clear();
  g.save();
  g.scaleCanvas(RES, RES);
  draw(g);
  g.restore();
  g.generateTexture(key, w * RES, h * RES);
}

function drawCoin(g: Phaser.GameObjects.Graphics): void {
  const C = T.coin;
  const r = C.size / 2;
  g.fillStyle(C.outlineColor, 1);
  g.fillCircle(r, r, r);
  g.fillStyle(C.shadeColor, 1);
  g.fillCircle(r, r, r - 1.5);
  g.fillStyle(C.color, 1);
  g.fillCircle(r - 0.6, r - 0.6, r - 2.6);
  // Inner rim + embossed mark.
  g.lineStyle(1.2, C.shadeColor, 1);
  g.strokeCircle(r, r, r - 5);
  g.fillStyle(C.shadeColor, 1);
  g.fillRect(r - 1, r - 3.5, 2, 7);
  // Shine.
  g.fillStyle(C.lightColor, 0.9);
  g.fillEllipse(r - 3.5, r - 4, 4, 2.5);
}

function drawGem(g: Phaser.GameObjects.Graphics): void {
  const G = T.gem;
  const s = G.size;
  const c = s / 2;
  const top = 4;
  const girdle = s * 0.4;
  const bottom = s - 2;
  const left = 2;
  const right = s - 2;
  const outline = [
    { x: left + 4, y: top },
    { x: right - 4, y: top },
    { x: right, y: girdle },
    { x: c, y: bottom },
    { x: left, y: girdle },
  ];
  g.fillStyle(G.outlineColor, 1);
  g.fillPoints(outline.map((p) => ({ x: p.x + (p.x < c ? -1.2 : 1.2), y: p.y + (p.y < c ? -1.2 : 1.2) })), true);
  g.fillStyle(G.shadeColor, 1);
  g.fillPoints(outline, true);
  // Lit facets.
  g.fillStyle(G.color, 1);
  g.fillPoints([{ x: left + 4, y: top }, { x: c, y: top }, { x: c, y: bottom }, { x: left, y: girdle }], true);
  g.fillStyle(G.lightColor, 1);
  g.fillPoints([{ x: left + 4, y: top }, { x: c, y: top }, { x: c - 2, y: girdle }, { x: left, y: girdle }], true);
  g.lineStyle(1, G.outlineColor, 0.6);
  g.lineBetween(left, girdle, right, girdle);
}

function drawChest(g: Phaser.GameObjects.Graphics, open: boolean): void {
  const C = T.chest;
  const w = C.width;
  const h = C.height;
  const bodyTop = h * 0.45;
  const o = 1.6;

  if (open) {
    // Lid tipped back, seen from the inside.
    g.fillStyle(C.outlineColor, 1);
    g.fillRoundedRect(2, 0, w - 4, bodyTop - 2, 5);
    g.fillStyle(C.woodShadeColor, 1);
    g.fillRoundedRect(2 + o, o, w - 4 - o * 2, bodyTop - 2 - o * 2, 4);
    g.fillStyle(C.insideColor, 1);
    g.fillRect(6, bodyTop - 6, w - 12, 6);
  } else {
    // Rounded lid.
    g.fillStyle(C.outlineColor, 1);
    g.fillRoundedRect(1, 3, w - 2, bodyTop + 2, { tl: 10, tr: 10, bl: 0, br: 0 });
    g.fillStyle(C.woodColor, 1);
    g.fillRoundedRect(1 + o, 3 + o, w - 2 - o * 2, bodyTop + 2 - o * 2, { tl: 9, tr: 9, bl: 0, br: 0 });
    g.fillStyle(C.woodLightColor, 1);
    g.fillRect(6, 6, w - 12, 3);
  }

  // Box.
  g.fillStyle(C.outlineColor, 1);
  g.fillRect(1, bodyTop, w - 2, h - bodyTop - 1);
  g.fillStyle(C.woodColor, 1);
  g.fillRect(1 + o, bodyTop + o, w - 2 - o * 2, h - bodyTop - 1 - o * 2);
  g.fillStyle(C.woodShadeColor, 1);
  g.fillRect(1 + o, h - 6, w - 2 - o * 2, 3.5);

  if (open) {
    // Gold heaped inside the open box.
    g.fillStyle(C.goldColor, 1);
    g.fillEllipse(w / 2, bodyTop + 1, w - 12, 9);
    g.fillStyle(0xfff2a8, 1);
    g.fillCircle(w / 2 - 6, bodyTop - 1, 2);
    g.fillCircle(w / 2 + 5, bodyTop, 1.5);
  }

  // Metal bands + lock.
  g.fillStyle(C.bandColor, 1);
  g.fillRect(7, open ? bodyTop : 4, 4, open ? h - bodyTop - 2 : h - 6);
  g.fillRect(w - 11, open ? bodyTop : 4, 4, open ? h - bodyTop - 2 : h - 6);
  if (!open) {
    g.fillStyle(C.outlineColor, 1);
    g.fillRect(w / 2 - 4.5, bodyTop - 3.5, 9, 10);
    g.fillStyle(C.bandColor, 1);
    g.fillRect(w / 2 - 3, bodyTop - 2, 6, 7);
    g.fillStyle(C.outlineColor, 1);
    g.fillRect(w / 2 - 0.8, bodyTop, 1.6, 3);
  }
}

/** White 4-point star; tinted per use. */
function drawSparkle(g: Phaser.GameObjects.Graphics): void {
  const s = T.sparkle.size;
  const c = s / 2;
  const t = s * 0.12;
  g.fillStyle(0xffffff, 1);
  g.fillPoints([{ x: c, y: 0 }, { x: c + t, y: c - t }, { x: s, y: c }, { x: c + t, y: c + t }, { x: c, y: s }, { x: c - t, y: c + t }, { x: 0, y: c }, { x: c - t, y: c - t }], true);
  g.fillCircle(c, c, t * 1.4);
}
