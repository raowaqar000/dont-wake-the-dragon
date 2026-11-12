import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import type { TilePos } from '../systems/LevelParser';

const CP = TUNING.checkpoint;

/**
 * Checkpoint 'F': a small code-drawn flag on a stone base with a soft glow above the
 * darkness. Dim blue until reached, then gold. CheckpointSystem owns the logic.
 */
export class Checkpoint {
  public readonly x: number;
  public readonly y: number;
  public active = false;
  private readonly root: Phaser.GameObjects.Container;
  private readonly cloth: Phaser.GameObjects.Graphics;
  private readonly glow: Phaser.GameObjects.Image;
  private glowTween: Phaser.Tweens.Tween;

  constructor(
    private readonly scene: Phaser.Scene,
    public readonly tile: TilePos,
  ) {
    const ts = TUNING.level.tileSize;
    this.x = (tile.x + 0.5) * ts;
    this.y = (tile.y + 0.5) * ts;
    // Pole foot a little below the tile center.
    const footY = this.y + ts * 0.3;

    const base = scene.add.graphics();
    base.fillStyle(0x000000, 0.3);
    base.fillEllipse(0, 2, 22, 8);
    base.fillStyle(CP.baseColor, 1);
    base.fillEllipse(0, 0, 16, 6);
    base.fillStyle(CP.poleColor, 1);
    base.fillRect(-1.5, -CP.poleHeight, 3, CP.poleHeight);

    this.cloth = scene.add.graphics({ x: 1.5, y: -CP.poleHeight });
    this.drawCloth(CP.idleColor);

    this.root = scene.add.container(this.x, footY, [base, this.cloth]).setDepth(CP.depth);
    scene.tweens.add({
      targets: this.cloth,
      angle: { from: -CP.waveDeg, to: CP.waveDeg },
      duration: CP.waveMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.glow = scene.add
      .image(this.x, footY - CP.poleHeight * 0.6, TEXTURE_KEYS.softGlow)
      .setDisplaySize(CP.glowRadius * 2, CP.glowRadius * 2)
      .setTint(CP.idleColor)
      .setAlpha(CP.glowIdleAlpha)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(TUNING.lighting.depth + 1);
    this.glowTween = this.pulse(CP.glowIdleAlpha);
  }

  /** Reached: gold flag, brighter glow; `pop` adds a little bounce (not on respawn). */
  activate(pop: boolean): void {
    if (this.active) return;
    this.active = true;
    this.drawCloth(CP.activeColor);
    this.glow.setTint(CP.activeColor).setAlpha(CP.glowActiveAlpha);
    this.glowTween.stop();
    this.glowTween = this.pulse(CP.glowActiveAlpha);
    if (pop) {
      this.scene.tweens.add({ targets: this.root, scale: CP.popScale, duration: CP.popMs / 2, yoyo: true, ease: 'Quad.easeOut' });
    }
  }

  private drawCloth(color: number): void {
    const g = this.cloth;
    g.clear();
    g.fillStyle(color, 1);
    g.fillTriangle(0, 0, CP.clothW, CP.clothH / 2, 0, CP.clothH);
    g.lineStyle(1, 0x000000, 0.45);
    g.strokeTriangle(0, 0, CP.clothW, CP.clothH / 2, 0, CP.clothH);
  }

  private pulse(alpha: number): Phaser.Tweens.Tween {
    return this.scene.tweens.add({
      targets: this.glow,
      alpha: alpha * 0.55,
      duration: CP.glowPulseMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}
