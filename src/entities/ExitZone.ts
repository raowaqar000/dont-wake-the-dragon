import Phaser from 'phaser';
import { TUNING } from '../config';

const X = TUNING.exit;

/** Glowing doorway. Drawn above the darkness so it reads as a light source from afar. */
export class ExitZone {
  /** Invisible physics trigger covering the exit tiles. */
  public readonly zone: Phaser.GameObjects.Zone;

  constructor(scene: Phaser.Scene, rect: Phaser.Geom.Rectangle) {
    const cx = rect.centerX;
    const cy = rect.centerY;

    this.zone = scene.add.zone(cx, cy, rect.width, rect.height);
    scene.physics.add.existing(this.zone, true);

    // Bright floor of the doorway (under the darkness, lit by the glow above it).
    const floor = scene.add.graphics().setDepth(TUNING.level.depth + 1);
    floor.fillStyle(X.color, 0.35);
    floor.fillRect(rect.x, rect.y, rect.width, rect.height);

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

    scene.add
      .text(cx, rect.bottom + X.labelOffsetY, 'EXIT', {
        fontFamily: 'sans-serif',
        fontSize: `${X.labelFontSize}px`,
        fontStyle: 'bold',
        color: X.labelColor,
      })
      .setOrigin(0.5, 0)
      .setDepth(TUNING.lighting.depth + 2);
  }
}
