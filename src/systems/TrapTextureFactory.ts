import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';

/**
 * Procedural textures for portals and traps, drawn once at boot.
 * Swirl and glow are white so each portal pair can tint them.
 */

const SWIRL_SIZE = 128;
const GLOW_SIZE = 128;
/** Spike/crumble textures are drawn at this multiple of the tile size and scaled down. */
const RES = 2;

export function createTrapTextures(scene: Phaser.Scene): void {
  createSwirl(scene);
  createGlow(scene);
  createSpikes(scene);
  createCrumble(scene);
}

/** Display scale to use for the spike and crumble textures. */
export const TRAP_TEXTURE_SCALE = 1 / RES;

function createSwirl(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.portalSwirl)) return;
  const tex = scene.textures.createCanvas(TEXTURE_KEYS.portalSwirl, SWIRL_SIZE, SWIRL_SIZE);
  if (!tex) return;
  const ctx = tex.getContext();
  const c = SWIRL_SIZE / 2;
  const maxR = c - 4;

  // Soft core.
  const core = ctx.createRadialGradient(c, c, 0, c, c, maxR);
  core.addColorStop(0, 'rgba(255,255,255,0.95)');
  core.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, SWIRL_SIZE, SWIRL_SIZE);

  // Three spiral arms, thick at the center, thinning outward.
  ctx.lineCap = 'round';
  const arms = 3;
  for (let a = 0; a < arms; a++) {
    const base = (a / arms) * Math.PI * 2;
    const steps = 40;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const p = (t: number) => {
        const r = 6 + t * (maxR - 6);
        const ang = base + t * Math.PI * 1.6;
        return { x: c + Math.cos(ang) * r, y: c + Math.sin(ang) * r };
      };
      const p0 = p(t0);
      const p1 = p(t1);
      ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - t0)})`;
      ctx.lineWidth = 10 * (1 - t0) + 2;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  }
  tex.refresh();
}

function createGlow(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.softGlow)) return;
  const tex = scene.textures.createCanvas(TEXTURE_KEYS.softGlow, GLOW_SIZE, GLOW_SIZE);
  if (!tex) return;
  const ctx = tex.getContext();
  const c = GLOW_SIZE / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, GLOW_SIZE, GLOW_SIZE);
  tex.refresh();
}

/** Spike base positions inside a tile, as fractions of the tile. Also used for the baked holes. */
export const SPIKE_LAYOUT: readonly { x: number; y: number }[] = [
  { x: 0.22, y: 0.54 },
  { x: 0.5, y: 0.54 },
  { x: 0.78, y: 0.54 },
  { x: 0.36, y: 0.88 },
  { x: 0.64, y: 0.88 },
];

/** Size of one spike (fractions of the tile), drawn as its own image so it can rise from its hole. */
export const SPIKE_SIZE = { w: 0.26, h: 0.46 } as const;

/** One spike; origin should be (0.5, 1) so it grows up from its base. */
function createSpikes(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.spikes)) return;
  const S = TUNING.traps.spikes;
  const ts = TUNING.level.tileSize;
  const w = Math.round(SPIKE_SIZE.w * ts * RES);
  const h = Math.round(SPIKE_SIZE.h * ts * RES);
  const cx = w / 2;
  const o = 3; // outline
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  g.fillStyle(S.outlineColor, 1);
  g.fillTriangle(0, h, w, h, cx, 0);
  g.fillStyle(S.steelShadeColor, 1);
  g.fillTriangle(o, h - o / 2, w - o, h - o / 2, cx, o * 1.5);
  g.fillStyle(S.steelColor, 1);
  g.fillTriangle(o, h - o / 2, cx, h - o / 2, cx, o * 1.5);
  g.generateTexture(TEXTURE_KEYS.spikes, w, h);
  g.destroy();
}

function createCrumble(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.crumble)) return;
  const C = TUNING.traps.crumble;
  const L = TUNING.level;
  const s = L.tileSize * RES;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);

  g.fillStyle(L.floorColor, 1);
  g.fillRect(0, 0, s, s);

  // Cracks: a few jagged lines from a point near the center, with a light edge.
  const rng = new Phaser.Math.RandomDataGenerator(['crumble']);
  const cx = s * 0.48;
  const cy = s * 0.52;
  const drawCracks = (color: number, width: number, dx: number, dy: number) => {
    const r = new Phaser.Math.RandomDataGenerator(['crumble-cracks']);
    g.lineStyle(width, color, 1);
    for (let i = 0; i < 5; i++) {
      let x = cx + dx;
      let y = cy + dy;
      const ang = (i / 5) * Math.PI * 2 + r.realInRange(-0.4, 0.4);
      g.beginPath();
      g.moveTo(x, y);
      const segs = r.between(2, 4);
      for (let k = 0; k < segs; k++) {
        const len = r.realInRange(0.1, 0.18) * s;
        const a = ang + r.realInRange(-0.5, 0.5);
        x = Phaser.Math.Clamp(x + Math.cos(a) * len, 2, s - 2);
        y = Phaser.Math.Clamp(y + Math.sin(a) * len, 2, s - 2);
        g.lineTo(x, y);
      }
      g.strokePath();
    }
  };
  drawCracks(C.crackLightColor, 2, 1, 2);
  drawCracks(C.crackColor, 3, 0, 0);

  // A couple of loose chips.
  g.fillStyle(C.crackColor, 1);
  for (let i = 0; i < 4; i++) g.fillRect(rng.between(8, s - 14), rng.between(8, s - 14), 4, 3);

  // Thin dark border so the slab reads as a separate piece.
  g.lineStyle(2, C.crackColor, 0.8);
  g.strokeRect(1, 1, s - 2, s - 2);

  g.generateTexture(TEXTURE_KEYS.crumble, s, s);
  g.destroy();
}
