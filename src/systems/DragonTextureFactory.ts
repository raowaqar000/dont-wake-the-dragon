import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';

/**
 * Procedural dragon art, drawn once at boot: a big curled-up red dragon seen from above
 * (head facing right; Dragon flips it for 'left'). Parts are separate textures so they
 * can move: body (with folded wings, wrapped tail, scales), head (horns, closed eyes),
 * tail tip, eye overlays (half / fully open), a "z", smoke puff, flame and the noise ring.
 */

const D = TUNING.dragon;
const C = D.colors;
const RES = D.textureResolution;
const OUT = 2; // outline width (logical px)

/** Display scale for the dragon textures. */
export const DRAGON_TEXTURE_SCALE = 1 / RES;

/** Neck position inside the head texture (logical px from its top-left). */
const HEAD_NECK_X = 14;
/** Head texture origin = the neck, so the head turns around it. */
export const DRAGON_HEAD_ORIGIN = { x: HEAD_NECK_X / D.headTexture.w, y: 0.5 } as const;

const TAIL_TIP = { w: 24, h: 20, baseX: 2 };
/** Tail tip texture origin = where it joins the tail. */
export const DRAGON_TAIL_TIP_ORIGIN = { x: TAIL_TIP.baseX / TAIL_TIP.w, y: 0.5 } as const;

/** Radius (texture px) of the ring drawn in the noise ring texture. Scale = radius / this. */
export const NOISE_RING_TEXTURE_RADIUS = 124;
const RING_SIZE = 256;
const PUFF_SIZE = 32;

type Pt = { x: number; y: number };

export function createDragonTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  bake(scene, g, TEXTURE_KEYS.dragonBody, D.bodyTexture.w, D.bodyTexture.h, drawBody);
  bake(scene, g, TEXTURE_KEYS.dragonHead, D.headTexture.w, D.headTexture.h, drawHead);
  bake(scene, g, TEXTURE_KEYS.dragonTailTip, TAIL_TIP.w, TAIL_TIP.h, drawTailTip);
  bake(scene, g, TEXTURE_KEYS.dragonEyeHalf, 14, 10, (gr) => drawEye(gr, 7, 5, false));
  bake(scene, g, TEXTURE_KEYS.dragonEyeOpen, 14, 12, (gr) => drawEye(gr, 7, 6, true));
  bake(scene, g, TEXTURE_KEYS.dragonZ, 18, 18, drawZ);
  g.destroy();

  softPuff(scene, TEXTURE_KEYS.smokePuff, [
    [0, 'rgba(255,255,255,0.9)'],
    [0.6, 'rgba(255,255,255,0.35)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  softPuff(scene, TEXTURE_KEYS.flame, [
    [0, 'rgba(255,255,255,1)'],
    [0.4, 'rgba(255,255,255,0.7)'],
    [1, 'rgba(255,255,255,0)'],
  ]);
  noiseRing(scene);
}

function bake(
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

/** Filled ellipse with an outline. (x, y) = center, w/h = full size. */
function blob(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: number): void {
  g.fillStyle(C.outline, 1);
  g.fillEllipse(x, y, w + OUT * 2, h + OUT * 2);
  g.fillStyle(fill, 1);
  g.fillEllipse(x, y, w, h);
}

/** Filled polygon with an outline. */
function poly(g: Phaser.GameObjects.Graphics, pts: Pt[], fill: number): void {
  g.lineStyle(OUT * 2, C.outline, 1);
  g.strokePoints(pts, true, true);
  g.fillStyle(fill, 1);
  g.fillPoints(pts, true, true);
}

const shift = (pts: Pt[], ox: number, oy: number): Pt[] => pts.map((p) => ({ x: p.x + ox, y: p.y + oy }));
const mirrorY = (pts: Pt[], axis: number): Pt[] => pts.map((p) => ({ x: p.x, y: axis * 2 - p.y }));

/** Points along the tail: wraps from behind the body, under it, up to the front paws. */
function tailPoints(): { x: number; y: number; r: number }[] {
  const pts: { x: number; y: number; r: number }[] = [];
  const steps = 26;
  const a0 = Phaser.Math.DegToRad(200);
  const a1 = Phaser.Math.DegToRad(40);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = a0 + (a1 - a0) * t;
    pts.push({ x: -4 + 62 * Math.cos(a), y: 4 + 40 * Math.sin(a), r: 15 - 10 * t });
  }
  return pts;
}

function drawBody(g: Phaser.GameObjects.Graphics): void {
  const ox = D.bodyTexture.w / 2;
  const oy = D.bodyTexture.h / 2;
  const L = (pts: Pt[]) => shift(pts, ox, oy);

  // Soft shadow on the floor.
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(ox, oy + 8, 156, 94);

  // Tail behind everything, wrapped around the body (outline pass, shade pass, top pass).
  const tail = tailPoints();
  g.fillStyle(C.outline, 1);
  for (const p of tail) g.fillCircle(ox + p.x, oy + p.y, p.r + OUT);
  g.fillStyle(C.bodyShade, 1);
  for (const p of tail) g.fillCircle(ox + p.x, oy + p.y, p.r);
  g.fillStyle(C.body, 1);
  for (const p of tail) g.fillCircle(ox + p.x - p.r * 0.12, oy + p.y - p.r * 0.22, p.r * 0.72);
  // Little spikes along the tail.
  g.fillStyle(C.spine, 1);
  for (let i = 3; i < tail.length - 3; i += 3) {
    const p = tail[i];
    const n = tail[i + 1];
    const ang = Math.atan2(n.y - p.y, n.x - p.x);
    const s = 2.5 + p.r * 0.12;
    const bx = ox + p.x;
    const by = oy + p.y;
    g.fillTriangle(
      bx + Math.cos(ang + Math.PI / 2) * s,
      by + Math.sin(ang + Math.PI / 2) * s,
      bx - Math.cos(ang + Math.PI / 2) * s,
      by - Math.sin(ang + Math.PI / 2) * s,
      bx - Math.cos(ang) * s * 2,
      by - Math.sin(ang) * s * 2,
    );
  }

  // Haunches (back legs) and front paws.
  blob(g, ox - 38, oy - 30, 34, 22, C.bodyShade);
  blob(g, ox - 38, oy + 24, 34, 22, C.bodyShade);
  for (const py of [-22, 16]) {
    blob(g, ox + 36, oy + py, 22, 14, C.body);
    g.fillStyle(C.claw, 1);
    for (const cy of [-4, 0, 4]) g.fillCircle(ox + 47, oy + py + cy, 1.6);
  }

  // Main body: dark base, lit top, highlight.
  blob(g, ox - 6, oy - 3, 112, 76, C.bodyShade);
  g.fillStyle(C.body, 1);
  g.fillEllipse(ox - 8, oy - 7, 104, 62);
  g.fillStyle(C.bodyLight, 0.45);
  g.fillEllipse(ox - 20, oy - 18, 56, 20);
  // Belly peeks out on the inside of the curl, next to the tail.
  g.fillStyle(C.belly, 1);
  g.fillEllipse(ox - 2, oy + 28, 54, 9);

  // Scale pattern: little "u" arcs in offset rows.
  g.lineStyle(1.2, C.bodyShade, 0.9);
  for (let row = 0, sy = -28; sy <= 22; sy += 8, row++) {
    for (let sx = -52 + (row % 2) * 4.5; sx <= 34; sx += 9) {
      const ex = (sx + 8) / 50;
      const ey = (sy + 6) / 32;
      if (ex * ex + ey * ey > 1) continue;
      g.beginPath();
      g.arc(ox + sx, oy + sy, 3.4, 0, Math.PI, false);
      g.strokePath();
    }
  }

  // Folded wings along both sides of the back, with ribs.
  const shoulder = { x: 14, y: -14 };
  const wingTop: Pt[] = [
    shoulder,
    { x: 4, y: -33 },
    { x: -12, y: -30 },
    { x: -20, y: -40 },
    { x: -36, y: -33 },
    { x: -46, y: -38 },
    { x: -60, y: -22 },
    { x: -42, y: -16 },
    { x: -22, y: -13 },
    { x: -4, y: -11 },
  ];
  const axis = -3;
  for (const wing of [wingTop, mirrorY(wingTop, axis)]) {
    poly(g, L(wing), C.wing);
    const sh = wing[0];
    g.fillStyle(C.wingShade, 1);
    g.fillPoints(L([sh, wing[1], wing[3], wing[6], wing[7], wing[9]]), true, true);
    g.lineStyle(1.6, C.wingRib, 1);
    for (const i of [1, 3, 5, 6]) {
      g.beginPath();
      g.moveTo(ox + sh.x, oy + sh.y);
      g.lineTo(ox + wing[i].x, oy + wing[i].y);
      g.strokePath();
    }
    blob(g, ox + sh.x, oy + sh.y, 9, 9, C.wing);
  }

  // Spine ridge down the middle of the back, pointing toward the tail.
  for (let x = 12, s = 5; x > -62; x -= 9, s = Math.max(2.5, s - 0.35)) {
    const pts = L([
      { x, y: axis - s },
      { x, y: axis + s },
      { x: x - s * 1.6, y: axis },
    ]);
    poly(g, pts, C.spine);
  }

  // Neck joins the head (head is its own sprite on top).
  blob(g, ox + D.neck.x - 6, oy + D.neck.y, 30, 26, C.body);
}

function drawHead(g: Phaser.GameObjects.Graphics): void {
  const ox = HEAD_NECK_X;
  const oy = D.headTexture.h / 2;
  const L = (pts: Pt[]) => shift(pts, ox, oy);

  // Horns sweep back from the skull.
  const horn: Pt[] = [
    { x: 8, y: -9 },
    { x: 0, y: -15 },
    { x: -12, y: -23 },
    { x: -5, y: -13 },
    { x: 2, y: -6 },
  ];
  for (const h of [horn, mirrorY(horn, 0)]) {
    poly(g, L(h), C.horn);
    g.lineStyle(1.2, C.hornShade, 1);
    g.beginPath();
    g.moveTo(ox + h[0].x - 2, oy + h[0].y * 0.9);
    g.lineTo(ox + h[2].x + 4, oy + h[2].y * 0.85);
    g.strokePath();
  }
  // Cheek frills.
  for (const s of [-1, 1]) {
    poly(g, L([{ x: 10, y: 11 * s }, { x: 2, y: 19 * s }, { x: 16, y: 13 * s }]), C.bodyShade);
  }

  // Skull and snout.
  blob(g, ox + 14, oy, 36, 30, C.bodyShade);
  g.fillStyle(C.body, 1);
  g.fillEllipse(ox + 13, oy - 1, 32, 25);
  blob(g, ox + 32, oy, 28, 21, C.body);
  g.fillStyle(C.bodyLight, 0.5);
  g.fillEllipse(ox + 30, oy - 3, 18, 8);
  g.fillStyle(C.bodyLight, 0.35);
  g.fillEllipse(ox + 10, oy - 5, 16, 7);

  // Little fangs peeking out of the mouth.
  g.fillStyle(C.claw, 1);
  for (const s of [-1, 1]) g.fillTriangle(ox + 36, oy + 9 * s, ox + 40, oy + 9 * s, ox + 38, oy + 13 * s);

  // Nostrils.
  g.fillStyle(C.nostril, 1);
  g.fillEllipse(ox + 42, oy - 4, 4, 3);
  g.fillEllipse(ox + 42, oy + 4, 4, 3);

  // Brow ridges and closed, sleepy eyes (overlays draw the open ones).
  for (const e of D.eyes) {
    g.lineStyle(2.2, C.bodyShade, 1);
    g.beginPath();
    g.arc(ox + e.x - 1, oy + e.y, 6, Phaser.Math.DegToRad(200), Phaser.Math.DegToRad(340), false);
    g.strokePath();
    g.lineStyle(1.8, C.lid, 1);
    g.beginPath();
    g.arc(ox + e.x, oy + e.y - 1.5, 3.8, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
    g.strokePath();
  }

  // A few light spots on top of the head.
  g.fillStyle(C.bodyLight, 0.8);
  for (const [sx, sy] of [[6, -2], [9, 3], [4, 4]]) g.fillCircle(ox + sx, oy + sy, 1.2);
}

function drawTailTip(g: Phaser.GameObjects.Graphics): void {
  const bx = TAIL_TIP.baseX;
  const cy = TAIL_TIP.h / 2;
  const spade: Pt[] = [
    { x: bx, y: cy - 3 },
    { x: bx + 9, y: cy - 8 },
    { x: bx + 20, y: cy },
    { x: bx + 9, y: cy + 8 },
    { x: bx, y: cy + 3 },
  ];
  poly(g, spade, C.bodyShade);
  g.fillStyle(C.body, 1);
  g.fillTriangle(bx + 3, cy - 2, bx + 9, cy - 5.5, bx + 16, cy);
}

/** Glowing dragon eye seen from above: almond shape with a slit pupil. */
function drawEye(g: Phaser.GameObjects.Graphics, cx: number, cy: number, open: boolean): void {
  const w = 11;
  const h = open ? 8 : 4.2;
  g.fillStyle(C.outline, 1);
  g.fillEllipse(cx, cy, w + 2, h + 2);
  g.fillStyle(C.eyeIris, 1);
  g.fillEllipse(cx, cy, w, h);
  g.fillStyle(C.eyeLight, 0.9);
  g.fillEllipse(cx - 1.5, cy - h * 0.18, w * 0.45, h * 0.35);
  g.fillStyle(C.pupil, 1);
  g.fillEllipse(cx + 0.5, cy, 1.8, h * 0.85);
}

function drawZ(g: Phaser.GameObjects.Graphics): void {
  const pts: Pt[] = [
    { x: 4, y: 4 },
    { x: 14, y: 4 },
    { x: 4, y: 14 },
    { x: 14, y: 14 },
  ];
  g.lineStyle(5, C.outline, 0.8);
  g.strokePoints(pts, false, false);
  g.lineStyle(2.6, 0xffffff, 1);
  g.strokePoints(pts, false, false);
}

/** White soft radial blob (tinted per use). */
function softPuff(scene: Phaser.Scene, key: string, stops: [number, string][]): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, PUFF_SIZE, PUFF_SIZE);
  if (!tex) return;
  const ctx = tex.getContext();
  const c = PUFF_SIZE / 2;
  const grad = ctx.createRadialGradient(c, c, 0, c, c, c);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, PUFF_SIZE, PUFF_SIZE);
  tex.refresh();
}

/** White ring with a faint inner glow, tinted per noise source. */
function noiseRing(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.noiseRing)) return;
  const tex = scene.textures.createCanvas(TEXTURE_KEYS.noiseRing, RING_SIZE, RING_SIZE);
  if (!tex) return;
  const ctx = tex.getContext();
  const c = RING_SIZE / 2;
  const r = NOISE_RING_TEXTURE_RADIUS;
  const glow = ctx.createRadialGradient(c, c, r * 0.75, c, c, r);
  glow.addColorStop(0, 'rgba(255,255,255,0)');
  glow.addColorStop(1, 'rgba(255,255,255,0.18)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.stroke();
  tex.refresh();
}
