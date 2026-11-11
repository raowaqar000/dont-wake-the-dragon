import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import { ART_SCALE, artKey, hasArt } from './ArtAssets';
import { TREASURE_TEXTURE_SCALE } from './TreasureTextureFactory';

const T = TUNING.treasure;
const S = TREASURE_TEXTURE_SCALE;

/**
 * Shared pickup effects: sparkle bursts, a coin fountain and floating "+N" text.
 * Two particle emitters for the whole level; drawn above the darkness.
 */
export class LootFx {
  private readonly sparkles: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly coins: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private readonly scene: Phaser.Scene) {
    const SP = T.sparkle;
    this.sparkles = scene.add
      .particles(0, 0, TEXTURE_KEYS.sparkle, {
        lifespan: SP.lifespanMs,
        speed: { min: SP.speedMin, max: SP.speedMax },
        angle: { min: 0, max: 360 },
        rotate: { min: 0, max: 180 },
        scale: { start: S * 1.2, end: 0 },
        alpha: { start: 1, end: 0.2 },
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(T.fxDepth);

    const CB = T.coinBurst;
    // Painted coin if it loaded, else the code-drawn one.
    const art = hasArt(scene, 'coin');
    const coinScale = art ? ART_SCALE * TUNING.art.coin.displayScale : S;
    this.coins = scene.add
      .particles(0, 0, art ? artKey('coin') : TEXTURE_KEYS.coin, {
        lifespan: CB.lifespanMs,
        speed: { min: CB.speedMin, max: CB.speedMax },
        // Upward fan (270 = straight up), falling back down with gravity.
        angle: { min: 225, max: 315 },
        gravityY: CB.gravityY,
        scale: { start: coinScale, end: coinScale * 0.6 },
        alpha: { start: 1, end: 0 },
        rotate: { min: -180, max: 180 },
        emitting: false,
      })
      .setDepth(T.fxDepth);
  }

  sparkle(x: number, y: number, count: number, tint: number): void {
    this.sparkles.particleTint = tint;
    this.sparkles.explode(count, x, y);
  }

  coinBurst(x: number, y: number, count: number): void {
    this.coins.explode(count, x, y);
  }

  /** "+10" that pops in, rises and fades. World space. */
  floatText(x: number, y: number, text: string, color: string, fontSize: number = T.floatText.fontSize): void {
    const F = T.floatText;
    const label = this.scene.add
      .text(x, y, text, {
        fontFamily: 'sans-serif',
        fontSize: `${fontSize}px`,
        fontStyle: 'bold',
        color,
        stroke: F.strokeColor,
        strokeThickness: F.strokeThickness,
      })
      .setOrigin(0.5, 1)
      .setDepth(T.fxDepth + 1)
      .setScale(0.6);
    this.scene.tweens.add({ targets: label, scale: 1, duration: F.ms * 0.25, ease: 'Back.easeOut' });
    this.scene.tweens.add({
      targets: label,
      y: y - F.risePx,
      alpha: { from: 1, to: 0, ease: 'Quad.easeIn' },
      duration: F.ms,
      ease: 'Cubic.easeOut',
      onComplete: () => label.destroy(),
    });
  }
}
