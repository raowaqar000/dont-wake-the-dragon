import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import { ART_SCALE, artKey, hasArt } from '../systems/ArtAssets';

const P = TUNING.portals;
const PA = TUNING.art.portal;

/**
 * One end of a portal pair and a soft glow drawn above the darkness so it shows from afar.
 * Painted art: the stone portal image, a spinning swirl and a thin glow ring in the pair's color.
 * Code-drawn fallback: dark ring on the floor and two counter-spinning swirls.
 * PortalSystem owns the teleport logic; this is the visual + arm state.
 */
export class Portal {
  public partner!: Portal;
  /** False right after arriving here; PortalSystem re-arms it once the player steps away. */
  public armed = true;
  /** Earliest time (scene ms) this portal may re-arm. */
  public rearmAt = 0;

  private readonly scene: Phaser.Scene;
  private readonly swirls: Phaser.GameObjects.Image[];
  /** Painted art: the stone portal (pulses on burst) and the pair-colored ring. */
  private readonly artImage?: Phaser.GameObjects.Image;
  private readonly artRing?: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    public readonly x: number,
    public readonly y: number,
    public readonly color: number,
  ) {
    this.scene = scene;
    const size = P.swirlSize;

    if (hasArt(scene, 'portal')) {
      this.artImage = scene.add
        .image(x, y, artKey('portal'))
        .setScale(ART_SCALE * PA.displayScale)
        .setDepth(P.depth - 1);
      const w = this.artImage.displayWidth;
      const h = this.artImage.displayHeight;
      // Spinning swirl in the pair's color, flattened (by its container) to match the oval.
      const swirl = scene.add
        .image(0, 0, TEXTURE_KEYS.portalSwirl)
        .setDisplaySize(w * PA.swirlScale, w * PA.swirlScale)
        .setTint(color)
        .setAlpha(PA.swirlAlpha)
        .setBlendMode(Phaser.BlendModes.ADD);
      scene.add.container(x, y, [swirl]).setScale(1, PA.swirlFlatten).setDepth(P.depth);
      scene.tweens.add({ targets: swirl, angle: 360, duration: P.swirlSpinMs, repeat: -1 });
      this.swirls = [swirl];
      // Thin glow ring in the pair's color, above the darkness so pairs read from afar.
      this.artRing = scene.add
        .graphics({ x, y })
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(TUNING.lighting.depth + 1);
      this.artRing.lineStyle(PA.ringWidth, color, PA.ringAlpha);
      this.artRing.strokeEllipse(0, 0, w * PA.ringScale * 2, h * PA.ringScale * 2 * PA.swirlFlatten);
      this.addGlow(scene, x, y, color);
      return;
    }

    const ring = scene.add.graphics({ x, y }).setDepth(P.depth - 1);
    ring.fillStyle(0x000000, 0.5);
    ring.fillCircle(0, 0, size * 0.5);
    ring.lineStyle(3, color, 0.85);
    ring.strokeCircle(0, 0, size * 0.5);

    const outer = scene.add
      .image(x, y, TEXTURE_KEYS.portalSwirl)
      .setDisplaySize(size, size)
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(P.depth);
    const inner = scene.add
      .image(x, y, TEXTURE_KEYS.portalSwirl)
      .setDisplaySize(size * 0.6, size * 0.6)
      .setTint(0xffffff)
      .setAlpha(0.7)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(P.depth);
    this.swirls = [outer, inner];

    scene.tweens.add({ targets: outer, angle: 360, duration: P.swirlSpinMs, repeat: -1 });
    scene.tweens.add({ targets: inner, angle: -360, duration: P.swirlSpinMs * 0.7, repeat: -1 });
    this.addGlow(scene, x, y, color);
  }

  /** Soft glow above the darkness, pulsing. */
  private addGlow(scene: Phaser.Scene, x: number, y: number, color: number): void {
    const glow = scene.add
      .image(x, y, TEXTURE_KEYS.softGlow)
      .setDisplaySize(P.glowRadius * 2, P.glowRadius * 2)
      .setTint(color)
      .setAlpha(P.glowAlpha)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(TUNING.lighting.depth + 1);
    scene.tweens.add({
      targets: glow,
      alpha: P.glowAlpha * 0.55,
      scale: glow.scale * 0.85,
      duration: P.glowPulseMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  setArmed(armed: boolean, rearmAt = 0): void {
    this.armed = armed;
    this.rearmAt = rearmAt;
    if (this.artImage) {
      this.swirls[0].setAlpha(PA.swirlAlpha * (armed ? 1 : P.disarmedAlpha));
      this.artRing?.setAlpha(armed ? 1 : P.disarmedAlpha);
      return;
    }
    this.swirls[0].setAlpha(armed ? 1 : P.disarmedAlpha);
  }

  /** Expanding ring + swirl pulse, used on enter and exit. */
  burst(): void {
    const ring = this.scene.add
      .graphics({ x: this.x, y: this.y })
      .setDepth(TUNING.lighting.depth + 2)
      .setBlendMode(Phaser.BlendModes.ADD);
    ring.lineStyle(6, this.color, 1);
    ring.strokeCircle(0, 0, P.swirlSize * 0.5);
    ring.fillStyle(this.color, 0.35);
    ring.fillCircle(0, 0, P.swirlSize * 0.5);
    ring.setScale(0.4);
    this.scene.tweens.add({
      targets: ring,
      scale: 2.2,
      alpha: 0,
      duration: P.burstMs,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });

    const outer = this.artImage ?? this.swirls[0];
    const base = outer.scale;
    this.scene.tweens.add({
      targets: outer,
      scale: base * 1.35,
      duration: P.burstMs / 2,
      yoyo: true,
      ease: 'Sine.easeOut',
      onComplete: () => outer.setScale(base),
    });
  }
}
