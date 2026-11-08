import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TEXTURE_KEYS, TUNING } from '../config';

const LT = TUNING.lighting;

/** Texture resolution of the gradient. It's scaled up; gradients survive that fine. */
const TEX_SIZE = 512;
/** Display size: big enough that the image covers the whole screen from any player position. */
const COVER_SIZE = Math.ceil(Math.hypot(GAME_WIDTH, GAME_HEIGHT) * 2) + 64;

/**
 * Cheap darkness: one big radial-gradient image centered on the player.
 * Clear in the middle, fading to TUNING.lighting.darkness at lightRadius.
 */
export class Lighting {
  private readonly image: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, private readonly target: Phaser.GameObjects.Components.Transform) {
    Lighting.ensureTexture(scene);
    this.image = scene.add
      .image(target.x, target.y, TEXTURE_KEYS.darkness)
      .setDisplaySize(COVER_SIZE, COVER_SIZE)
      .setDepth(LT.depth);

    // Follow after physics has synced the player's position, so the light never lags a frame.
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.follow, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.follow, this);
    });
  }

  private follow(): void {
    this.image.setPosition(this.target.x, this.target.y);
  }

  private static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(TEXTURE_KEYS.darkness)) return;

    const tex = scene.textures.createCanvas(TEXTURE_KEYS.darkness, TEX_SIZE, TEX_SIZE);
    if (!tex) return;
    const ctx = tex.getContext();
    const c = TEX_SIZE / 2;
    const scale = TEX_SIZE / COVER_SIZE;
    const outer = LT.lightRadius * scale;
    const inner = outer * (1 - LT.softness);
    const rgb = Phaser.Display.Color.IntegerToColor(LT.color);
    const rgba = (a: number) => `rgba(${rgb.red},${rgb.green},${rgb.blue},${a})`;

    const grad = ctx.createRadialGradient(c, c, inner, c, c, outer);
    grad.addColorStop(0, rgba(0));
    grad.addColorStop(0.5, rgba(LT.darkness * 0.45));
    grad.addColorStop(1, rgba(LT.darkness));
    ctx.fillStyle = rgba(LT.darkness);
    ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
    ctx.clearRect(c - outer - 1, c - outer - 1, outer * 2 + 2, outer * 2 + 2);
    ctx.fillStyle = grad;
    ctx.fillRect(c - outer - 1, c - outer - 1, outer * 2 + 2, outer * 2 + 2);
    tex.refresh();
  }
}
