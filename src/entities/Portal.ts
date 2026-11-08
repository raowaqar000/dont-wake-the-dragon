import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';

const P = TUNING.portals;

/**
 * One end of a portal pair: dark ring on the floor, two counter-spinning swirls,
 * and a soft glow drawn above the darkness so it shows from afar.
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

  constructor(
    scene: Phaser.Scene,
    public readonly x: number,
    public readonly y: number,
    public readonly color: number,
  ) {
    this.scene = scene;
    const size = P.swirlSize;

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

    const outer = this.swirls[0];
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
