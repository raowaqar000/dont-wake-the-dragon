import Phaser from 'phaser';
import { TUNING } from '../config';
import { ART_SCALE, artKey, hasArt } from '../systems/ArtAssets';

const X = TUNING.exit;

/** Glowing doorway. Drawn above the darkness so it reads as a light source from afar. */
export class ExitZone {
  /** Invisible physics trigger covering the exit tiles. */
  public readonly zone: Phaser.GameObjects.Zone;
  /** Everything that moves with the door (runaway exit). */
  private readonly parts: (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform)[] = [];
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, rect: Phaser.Geom.Rectangle) {
    this.scene = scene;
    const cx = rect.centerX;
    const cy = rect.centerY;

    this.zone = scene.add.zone(cx, cy, rect.width, rect.height);
    scene.physics.add.existing(this.zone, true);

    // Bright floor of the doorway (under the darkness, lit by the glow above it).
    const floor = scene.add.graphics().setDepth(TUNING.level.depth + 1);
    floor.fillStyle(X.color, 0.35);
    floor.fillRect(rect.x, rect.y, rect.width, rect.height);
    this.parts.push(floor);

    // Painted stone doorway: centered on the zone, bottom edge on the zone's bottom edge.
    if (hasArt(scene, 'exit_door')) {
      const D = TUNING.art.exitDoor;
      this.parts.push(
        scene.add
          .image(cx, rect.bottom + D.offsetY, artKey('exit_door'))
          .setOrigin(0.5, 1)
          .setScale(ART_SCALE * D.displayScale)
          .setDepth(TUNING.level.depth + 2),
      );
    }

    // Soft glow: stacked translucent ellipses, additive so it brightens the darkness.
    const glow = scene.add.graphics({ x: cx, y: cy }).setDepth(TUNING.lighting.depth + 1);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    const layers = 6;
    for (let i = layers; i >= 1; i--) {
      const t = i / layers;
      glow.fillStyle(X.color, X.glowAlpha / layers);
      glow.fillEllipse(0, 0, rect.width * (0.9 + t * 1.1), rect.height * (0.9 + t * 2.4));
    }

    scene.tweens.add({
      targets: glow,
      alpha: { from: 1, to: X.pulseMinAlpha },
      scale: { from: 1, to: X.pulseScale },
      duration: X.pulseMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.parts.push(
      glow,
      scene.add
        .text(cx, rect.bottom + X.labelOffsetY, 'EXIT', {
          fontFamily: 'sans-serif',
          fontSize: `${X.labelFontSize}px`,
          fontStyle: 'bold',
          color: X.labelColor,
        })
        .setOrigin(0.5, 0)
        .setDepth(TUNING.lighting.depth + 2),
    );
  }

  /**
   * Runaway exit: the door slides by (dx, dy) px over `ms`. The trigger zone jumps to the
   * new spot at the end, so the old spot never counts as an escape.
   */
  slideBy(dx: number, dy: number, ms: number): void {
    const body = this.zone.body as Phaser.Physics.Arcade.StaticBody;
    body.enable = false;
    for (const p of this.parts) {
      this.scene.tweens.add({ targets: p, x: p.x + dx, y: p.y + dy, duration: ms, ease: 'Back.easeInOut' });
    }
    this.scene.time.delayedCall(ms, () => {
      this.zone.setPosition(this.zone.x + dx, this.zone.y + dy);
      body.updateFromGameObject();
      body.enable = true;
    });
  }
}
