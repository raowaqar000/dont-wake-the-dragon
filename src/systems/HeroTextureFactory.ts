import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';

/**
 * Draws the treasure hunter at boot into one texture atlas and registers
 * his animations. Swap this file for real sprite art later: PlayerVisual
 * only needs the texture keys, heroAnimKey() and heroFrameInfo().
 */

const V = TUNING.playerVisual;
const C = V.colors;

export type HeroDir = 'down' | 'up' | 'side';
export type HeroPose = 'idle' | 'sneak' | 'run';

const DIRS: readonly HeroDir[] = ['down', 'up', 'side'];
const POSES: readonly HeroPose[] = ['idle', 'sneak', 'run'];
const FRAME_COUNTS: Record<HeroPose, number> = { idle: 2, sneak: 4, run: 4 };
const FPS: Record<HeroPose, number> = { idle: V.idleFps, sneak: V.sneakFps, run: V.runFps };

/** 0-based run frames where a foot plants (dust puff). */
export const RUN_FOOTFALL_FRAMES: readonly number[] = [1, 3];

/** Frame-local layout (logical px). Origin top-left of a frame. */
const F = V.frameSize;
const CX = F / 2;
const CY = F / 2;
const FEET_Y = 41;
const SACK_SIZE = 22;
const DUST_SIZE = 16;

export function heroAnimKey(dir: HeroDir, pose: HeroPose): string {
  return `hero_${dir}_${pose}`;
}

function frameName(dir: HeroDir, pose: HeroPose, i: number): string {
  return `${dir}_${pose}_${i}`;
}

/** Parses a frame name back into its parts (used for sack anchoring and footfalls). */
export function heroFrameInfo(name: string | number): { dir: HeroDir; pose: HeroPose; index: number } | null {
  const [dir, pose, index] = String(name).split('_');
  if (!DIRS.includes(dir as HeroDir) || !POSES.includes(pose as HeroPose)) return null;
  return { dir: dir as HeroDir, pose: pose as HeroPose, index: Number(index) };
}

interface FrameParams {
  /** Foot offset (+ = left/near foot forward). */
  step: number;
  /** Vertical body offset (negative = up). */
  bob: number;
  /** Body height multiplier measured from the feet. */
  crouch: number;
  lean: number;
  flap: number;
  /** Sneaky "careful hands" pose. */
  handsUp: boolean;
}

function frameParams(pose: HeroPose, i: number): FrameParams {
  if (pose === 'idle') {
    // Frame 1 = breathe out: body sinks and squashes a touch.
    return { step: 0, bob: i === 1 ? 0.8 : 0, crouch: i === 1 ? 0.97 : 1, lean: 0, flap: 0, handsUp: false };
  }
  const wave = Math.round(Math.sin((i / FRAME_COUNTS[pose]) * Math.PI * 2) * 1000) / 1000; // 0, 1, 0, -1
  if (pose === 'sneak') {
    return { step: wave * V.sneakStride, bob: -Math.abs(wave) * 0.8, crouch: V.sneakCrouch, lean: 0, flap: 0, handsUp: true };
  }
  return {
    step: wave * V.runStride,
    bob: -Math.abs(wave) * 1.5,
    crouch: 0.97,
    lean: V.runLean,
    flap: (i % 2 === 0 ? 1 : -1) * V.runFlap,
    handsUp: false,
  };
}

/** Applies crouch, bob and forward lean to an upper-body point. Feet are not transformed. */
function bodyPoint(dir: HeroDir, p: FrameParams, x: number, y: number): [number, number] {
  const h = (FEET_Y - y) / 30; // 0 at the feet, ~1 at the head
  let nx = x;
  let ny = FEET_Y - (FEET_Y - y) * p.crouch + p.bob;
  if (dir === 'side') nx += p.lean * h;
  else if (dir === 'down') ny += p.lean * 0.5 * h;
  else ny -= p.lean * 0.5 * h;
  return [nx, ny];
}

/** Sack attach point for a frame, relative to the frame center (logical px). */
export function heroSackAnchor(dir: HeroDir, pose: HeroPose, index: number): { x: number; y: number } {
  const o = V.sack.offsets[dir];
  const [x, y] = bodyPoint(dir, frameParams(pose, index), CX + o.x, CY + o.y);
  return { x: x - CX, y: y - CY };
}

/** Foot position for a dust puff, relative to the frame center (logical px). */
export function heroFootOffset(dir: HeroDir, index: number): { x: number; y: number } {
  if (dir === 'side') return { x: -3, y: FEET_Y - CY };
  return { x: index === 1 ? -5 : 5, y: FEET_Y - CY };
}

/** Graphics wrapper: logical coordinates, per-frame offset, resolution scale, thick outlines. */
class Painter {
  constructor(
    private readonly g: Phaser.GameObjects.Graphics,
    private readonly res: number,
    public ox = 0,
    public oy = 0,
  ) {}

  ellipse(x: number, y: number, w: number, h: number, fill: number, outline: number = V.outlineWidth): void {
    const { g, res } = this;
    const px = (this.ox + x) * res;
    const py = (this.oy + y) * res;
    if (outline > 0) {
      g.fillStyle(C.outline, 1);
      g.fillEllipse(px, py, (w + outline * 2) * res, (h + outline * 2) * res);
    }
    g.fillStyle(fill, 1);
    g.fillEllipse(px, py, w * res, h * res);
  }

  poly(points: [number, number][], fill: number, outline: number = V.outlineWidth): void {
    const { g, res } = this;
    const pts = points.map(([x, y]) => new Phaser.Math.Vector2((this.ox + x) * res, (this.oy + y) * res));
    if (outline > 0) {
      g.lineStyle(outline * 2 * res, C.outline, 1);
      g.strokePoints(pts, true, true);
    }
    g.fillStyle(fill, 1);
    g.fillPoints(pts, true, true);
  }
}

function drawFrame(pt: Painter, dir: HeroDir, p: FrameParams): void {
  const bp = (x: number, y: number) => bodyPoint(dir, p, x, y);
  const at = (x: number, y: number, w: number, h: number, fill: number, outline?: number) => {
    const [nx, ny] = bp(x, y);
    pt.ellipse(nx, ny, w, h, fill, outline);
  };

  if (dir === 'side') {
    // Facing right. Left is the same frame flipped.
    pt.ellipse(CX - 1 - p.step, FEET_Y - 0.5, 8, 5, C.bootsShade); // far foot
    pt.ellipse(CX + 1 + p.step, FEET_Y + 0.5, 8, 5, C.boots); // near foot
    const trail = Math.abs(p.flap);
    pt.poly(
      [
        bp(CX - 6, 22),
        bp(CX + 6, 22),
        bp(CX + 9, 31),
        bp(CX + 9, 38),
        bp(CX + 2, 39),
        bp(CX - 6, 39 + p.flap * 0.5),
        bp(CX - 11 - trail, 37 - p.flap * 0.5),
        bp(CX - 9, 30),
      ],
      C.cloak,
    );
    at(CX - 2, 27, 4, 8, C.cloakLight, 0);
    if (p.handsUp) at(CX + 9, 26, 5, 5, C.gloves);
    else at(CX + 6 + p.step * 0.8, 31, 5, 5, C.gloves);
    // Hood with its tip trailing back, face peeking out the front.
    pt.poly([bp(CX - 4, 8), bp(CX - 2, 20), bp(CX - 13, 12)], C.cloak);
    at(CX + 1, 15, 20, 20, C.cloak);
    at(CX + 6.5, 18, 8, 10, C.skin, 1.2);
    at(CX + 4.5, 13.2, 12, 5, C.cloakShade, 0);
    at(CX + 8.5, 18.5, 2.4, 3, C.eyes, 0);
    at(CX + 8.9, 17.8, 0.9, 0.9, 0xffffff, 0);
    at(CX + 5, 23.5, 4, 3.5, C.clasp, 1);
    return;
  }

  // Down (facing camera) and up (back view) share the body silhouette.
  pt.ellipse(CX - 5, FEET_Y + (dir === 'down' ? p.step : -p.step), 7, 5, C.boots);
  pt.ellipse(CX + 5, FEET_Y + (dir === 'down' ? -p.step : p.step), 7, 5, C.boots);
  pt.poly(
    [
      bp(CX - 8, 22),
      bp(CX + 8, 22),
      bp(CX + 11, 31),
      bp(CX + 12, 38),
      bp(CX + 4, 39 + p.flap),
      bp(CX - 4, 39 - p.flap),
      bp(CX - 12, 38),
      bp(CX - 11, 31),
    ],
    C.cloak,
  );
  at(CX - 5, 28, 4, 8, C.cloakLight, 0);

  const swing = (p.handsUp ? 0.3 : 0.6) * p.step;
  if (p.handsUp) {
    at(CX - 9.5, 26 - swing, 5, 5, C.gloves);
    at(CX + 9.5, 26 + swing, 5, 5, C.gloves);
  } else {
    at(CX - 12, 31 - swing, 5, 5, C.gloves);
    at(CX + 12, 31 + swing, 5, 5, C.gloves);
  }

  pt.poly([bp(CX - 5, 9), bp(CX + 5, 9), bp(CX, 2.5)], C.cloak); // hood tip
  at(CX, 15, 21, 20, C.cloak);

  if (dir === 'down') {
    at(CX, 18.5, 13, 10, C.skin, 1.2);
    at(CX, 13.6, 17, 6, C.cloakShade, 0); // hood shadow over the brow
    at(CX - 3, 19.5, 2.6, 3, C.eyes, 0);
    at(CX + 3, 19.5, 2.6, 3, C.eyes, 0);
    at(CX - 2.6, 18.8, 0.9, 0.9, 0xffffff, 0);
    at(CX + 3.4, 18.8, 0.9, 0.9, 0xffffff, 0);
    at(CX, 23.5, 4, 3.5, C.clasp, 1);
  } else {
    at(CX, 16, 3, 14, C.cloakShade, 0); // hood seam
    at(CX - 4, 11, 5, 4, C.cloakLight, 0);
  }
}

function drawSack(pt: Painter): void {
  const c = SACK_SIZE / 2;
  pt.poly(
    [
      [c - 3.5, 6],
      [c + 3.5, 6],
      [c + 2.5, 1.5],
      [c, 3.2],
      [c - 2.5, 1.5],
    ],
    C.sackShade,
  );
  pt.ellipse(c, c + 2.5, 18, 15, C.sack);
  pt.ellipse(c + 2.5, c + 5, 9, 7, C.sackShade, 0);
  pt.ellipse(c - 3, c + 0.5, 4, 3, C.sackLight, 0);
  pt.ellipse(c, 6.5, 9, 3.5, C.rope, 1);
}

function drawDust(g: Phaser.GameObjects.Graphics, res: number): void {
  const c = (DUST_SIZE / 2) * res;
  for (let i = 4; i >= 1; i--) {
    g.fillStyle(0xffffff, 0.22);
    g.fillCircle(c, c, (i / 4) * c);
  }
}

/** Call once at boot. Safe to call again (no-op). */
export function createHeroAssets(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.hero)) return;

  const res = V.textureResolution;
  const cols = POSES.reduce((n, p) => n + FRAME_COUNTS[p], 0);
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const pt = new Painter(g, res);
  const frames: { name: string; col: number; row: number }[] = [];

  DIRS.forEach((dir, row) => {
    let col = 0;
    for (const pose of POSES) {
      for (let i = 0; i < FRAME_COUNTS[pose]; i++) {
        pt.ox = col * F;
        pt.oy = row * F;
        drawFrame(pt, dir, frameParams(pose, i));
        frames.push({ name: frameName(dir, pose, i), col, row });
        col++;
      }
    }
  });
  g.generateTexture(TEXTURE_KEYS.hero, cols * F * res, DIRS.length * F * res);
  const tex = scene.textures.get(TEXTURE_KEYS.hero);
  for (const f of frames) tex.add(f.name, 0, f.col * F * res, f.row * F * res, F * res, F * res);

  g.clear();
  pt.ox = 0;
  pt.oy = 0;
  drawSack(pt);
  g.generateTexture(TEXTURE_KEYS.heroSack, SACK_SIZE * res, SACK_SIZE * res);

  g.clear();
  drawDust(g, res);
  g.generateTexture(TEXTURE_KEYS.dust, DUST_SIZE * res, DUST_SIZE * res);
  g.destroy();

  for (const dir of DIRS) {
    for (const pose of POSES) {
      const key = heroAnimKey(dir, pose);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: Array.from({ length: FRAME_COUNTS[pose] }, (_, i) => ({ key: TEXTURE_KEYS.hero, frame: frameName(dir, pose, i) })),
        frameRate: FPS[pose],
        repeat: -1,
      });
    }
  }
}
