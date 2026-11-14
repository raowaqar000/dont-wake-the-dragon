import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';

/**
 * Code-drawn, painted-style placeholders for the trap hints and the HUD sound icon:
 *   hint_bones, hint_skull, hint_scratches, hint_crack_ring, hint_sign, danger_bubble,
 *   icon_sound_on, icon_sound_off.
 * Drawn at RES x and shown at HINT_TEXTURE_SCALE. Replace with painted art later (same keys).
 */
const H = TUNING.hints;
const RES = H.textureResolution;
export const HINT_TEXTURE_SCALE = 1 / RES;

function rgba(c: number, a = 1): string {
  const col = Phaser.Display.Color.IntegerToColor(c);
  return `rgba(${col.red},${col.green},${col.blue},${a})`;
}

/** Makes one square canvas texture (logical px * RES) and hands its context to draw. */
function canvas(scene: Phaser.Scene, key: string, logical: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): void {
  if (scene.textures.exists(key)) return;
  const s = Math.round(logical * RES);
  const tex = scene.textures.createCanvas(key, s, s);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx, s);
  tex.refresh();
}

export function createHintTextures(scene: Phaser.Scene): void {
  canvas(scene, TEXTURE_KEYS.hintBones, H.clueSize, bones);
  canvas(scene, TEXTURE_KEYS.hintSkull, H.clueSize, skull);
  canvas(scene, TEXTURE_KEYS.hintScratches, H.clueSize, scratches);
  canvas(scene, TEXTURE_KEYS.hintCrackRing, H.crackRingSize, crackRing);
  canvas(scene, TEXTURE_KEYS.hintSign, H.signSize, sign);
  canvas(scene, TEXTURE_KEYS.dangerBubble, H.bubbleSize, bubble);
  const B = TUNING.sound.button;
  canvas(scene, TEXTURE_KEYS.iconSoundOn, B.iconSize, (ctx, s) => speaker(ctx, s, true));
  canvas(scene, TEXTURE_KEYS.iconSoundOff, B.iconSize, (ctx, s) => speaker(ctx, s, false));
}

/** One bone: a shaft with knobby ends; outline pass, fill pass, then a shade line. */
function bone(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number): void {
  const knob = w * 0.75;
  const nx = -(y1 - y0);
  const ny = x1 - x0;
  const len = Math.hypot(nx, ny) || 1;
  const ux = (nx / len) * knob * 0.6;
  const uy = (ny / len) * knob * 0.6;
  const ends: [number, number][] = [
    [x0 + ux, y0 + uy],
    [x0 - ux, y0 - uy],
    [x1 + ux, y1 + uy],
    [x1 - ux, y1 - uy],
  ];
  for (const pass of [0, 1]) {
    const grow = pass === 0 ? w * 0.3 : 0;
    const col = pass === 0 ? rgba(H.outlineColor) : rgba(H.boneColor);
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = w + grow * 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    for (const [ex, ey] of ends) {
      ctx.beginPath();
      ctx.arc(ex, ey, knob * 0.62 + grow, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.strokeStyle = rgba(H.boneShadeColor, 0.9);
  ctx.lineWidth = w * 0.3;
  ctx.beginPath();
  ctx.moveTo(x0 + (x1 - x0) * 0.2, y0 + (y1 - y0) * 0.2 + w * 0.25);
  ctx.lineTo(x0 + (x1 - x0) * 0.8, y0 + (y1 - y0) * 0.8 + w * 0.25);
  ctx.stroke();
}

function bones(ctx: CanvasRenderingContext2D, s: number): void {
  bone(ctx, s * 0.2, s * 0.3, s * 0.78, s * 0.72, s * 0.09);
  bone(ctx, s * 0.25, s * 0.74, s * 0.72, s * 0.34, s * 0.08);
}

function skull(ctx: CanvasRenderingContext2D, s: number): void {
  const cx = s / 2;
  const o = s * 0.05;
  // Cranium + jaw, outlined.
  for (const pass of [0, 1]) {
    const g = pass === 0 ? o : 0;
    ctx.fillStyle = pass === 0 ? rgba(H.outlineColor) : rgba(H.boneColor);
    ctx.beginPath();
    ctx.ellipse(cx, s * 0.44, s * 0.3 + g, s * 0.27 + g, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(cx - s * 0.17 - g, s * 0.58 - g, s * 0.34 + g * 2, s * 0.2 + g * 2, s * 0.05);
    ctx.fill();
  }
  // Shade on the lower right.
  ctx.fillStyle = rgba(H.boneShadeColor, 0.8);
  ctx.beginPath();
  ctx.ellipse(cx + s * 0.08, s * 0.52, s * 0.18, s * 0.1, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Eyes, nose, teeth.
  ctx.fillStyle = rgba(H.outlineColor);
  for (const dx of [-0.12, 0.12]) {
    ctx.beginPath();
    ctx.ellipse(cx + s * dx, s * 0.44, s * 0.075, s * 0.085, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(cx, s * 0.53);
  ctx.lineTo(cx - s * 0.035, s * 0.6);
  ctx.lineTo(cx + s * 0.035, s * 0.6);
  ctx.fill();
  ctx.strokeStyle = rgba(H.outlineColor);
  ctx.lineWidth = s * 0.025;
  for (const dx of [-0.08, 0, 0.08]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * dx, s * 0.66);
    ctx.lineTo(cx + s * dx, s * 0.76);
    ctx.stroke();
  }
}

function scratches(ctx: CanvasRenderingContext2D, s: number): void {
  // Four claw marks: a pale lip and a dark groove.
  for (let i = 0; i < 4; i++) {
    const x = s * (0.24 + i * 0.16);
    for (const pass of [0, 1]) {
      ctx.strokeStyle = pass === 0 ? rgba(H.boneShadeColor, 0.55) : rgba(H.scratchColor, 0.95);
      ctx.lineWidth = pass === 0 ? s * 0.07 : s * 0.04;
      const off = pass === 0 ? s * 0.02 : 0;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.06 + off, s * 0.16);
      ctx.quadraticCurveTo(x + s * 0.02 + off, s * 0.5, x - s * 0.04 + off, s * 0.84);
      ctx.stroke();
    }
  }
}

function crackRing(ctx: CanvasRenderingContext2D, s: number): void {
  const c = s / 2;
  const r = s * 0.4;
  ctx.strokeStyle = rgba(H.crackColor, 0.95);
  // Broken ring: arcs with gaps.
  ctx.lineWidth = s * 0.045;
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2 + 0.15;
    ctx.beginPath();
    ctx.arc(c, c, r * (0.94 + (i % 2) * 0.08), a0, a0 + 0.75);
    ctx.stroke();
  }
  // Jagged cracks toward the middle.
  ctx.lineWidth = s * 0.03;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    ctx.lineTo(c + Math.cos(a + 0.25) * r * 0.55, c + Math.sin(a + 0.25) * r * 0.55);
    ctx.lineTo(c + Math.cos(a - 0.1) * r * 0.2, c + Math.sin(a - 0.1) * r * 0.2);
    ctx.stroke();
  }
}

function sign(ctx: CanvasRenderingContext2D, s: number): void {
  const o = s * 0.05;
  // Post.
  ctx.fillStyle = rgba(H.outlineColor);
  ctx.fillRect(s * 0.44 - o, s * 0.45, s * 0.12 + o * 2, s * 0.5);
  ctx.fillStyle = rgba(H.woodShadeColor);
  ctx.fillRect(s * 0.44, s * 0.45, s * 0.12, s * 0.48);
  // Board, slightly tilted.
  ctx.save();
  ctx.translate(s / 2, s * 0.32);
  ctx.rotate(-0.08);
  ctx.fillStyle = rgba(H.outlineColor);
  ctx.beginPath();
  ctx.roundRect(-s * 0.4 - o, -s * 0.2 - o, s * 0.8 + o * 2, s * 0.4 + o * 2, s * 0.06);
  ctx.fill();
  ctx.fillStyle = rgba(H.woodColor);
  ctx.beginPath();
  ctx.roundRect(-s * 0.4, -s * 0.2, s * 0.8, s * 0.4, s * 0.05);
  ctx.fill();
  // Wood grain.
  ctx.strokeStyle = rgba(H.woodShadeColor, 0.8);
  ctx.lineWidth = s * 0.02;
  ctx.beginPath();
  ctx.moveTo(-s * 0.34, s * 0.12);
  ctx.lineTo(s * 0.34, s * 0.14);
  ctx.stroke();
  // Painted "!" mark.
  ctx.fillStyle = rgba(H.signMarkColor);
  ctx.fillRect(-s * 0.035, -s * 0.15, s * 0.07, s * 0.17);
  ctx.beginPath();
  ctx.arc(0, s * 0.09, s * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function bubble(ctx: CanvasRenderingContext2D, s: number): void {
  const c = s / 2;
  const cy = s * 0.44;
  const r = s * 0.38;
  const o = s * 0.06;
  // Outline (circle + little tail pointing down at the hero), then the fill.
  for (const pass of [0, 1]) {
    const g = pass === 0 ? o : 0;
    ctx.fillStyle = pass === 0 ? rgba(H.bubbleOutlineColor) : rgba(H.bubbleColor);
    ctx.beginPath();
    ctx.arc(c, cy, r + g, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(c - s * 0.12 - g, cy + r * 0.7);
    ctx.lineTo(c, s * 0.96 + g * 0.5);
    ctx.lineTo(c + s * 0.12 + g, cy + r * 0.7);
    ctx.fill();
  }
  ctx.fillStyle = rgba(H.bubbleMarkColor);
  ctx.beginPath();
  ctx.roundRect(c - s * 0.06, s * 0.16, s * 0.12, s * 0.3, s * 0.05);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c, s * 0.6, s * 0.065, 0, Math.PI * 2);
  ctx.fill();
}

function speaker(ctx: CanvasRenderingContext2D, s: number, on: boolean): void {
  const B = TUNING.sound.button;
  ctx.fillStyle = rgba(B.iconColor);
  ctx.strokeStyle = rgba(on ? B.iconColor : B.offColor);
  ctx.lineWidth = s * 0.08;
  ctx.beginPath();
  ctx.moveTo(s * 0.1, s * 0.38);
  ctx.lineTo(s * 0.28, s * 0.38);
  ctx.lineTo(s * 0.5, s * 0.18);
  ctx.lineTo(s * 0.5, s * 0.82);
  ctx.lineTo(s * 0.28, s * 0.62);
  ctx.lineTo(s * 0.1, s * 0.62);
  ctx.closePath();
  ctx.fill();
  if (on) {
    for (const r of [0.18, 0.32]) {
      ctx.beginPath();
      ctx.arc(s * 0.52, s * 0.5, s * r, -0.8, 0.8);
      ctx.stroke();
    }
    return;
  }
  ctx.beginPath();
  ctx.moveTo(s * 0.62, s * 0.34);
  ctx.lineTo(s * 0.9, s * 0.66);
  ctx.moveTo(s * 0.9, s * 0.34);
  ctx.lineTo(s * 0.62, s * 0.66);
  ctx.stroke();
}

