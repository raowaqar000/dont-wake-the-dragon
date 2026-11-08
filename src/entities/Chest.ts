import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import type { TilePos } from '../systems/LevelParser';
import { TREASURE_TEXTURE_SCALE } from '../systems/TreasureTextureFactory';

const C = TUNING.treasure.chest;
const S = TREASURE_TEXTURE_SCALE;

export type ChestState = 'closed' | 'open';

/**
 * Solid treasure chest (its physics body is added by LevelLoader).
 * Faint glow above the darkness so it shows from afar, a progress ring while
 * the player stands still next to it, and a lid-open squash. LootSystem owns the logic.
 */
export class Chest {
  public state: ChestState = 'closed';
  public readonly x: number;
  public readonly y: number;
  public readonly value = C.value;

  private readonly image: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly glowTween: Phaser.Tweens.Tween;
  private readonly ring: Phaser.GameObjects.Graphics;
  private ringFade?: Phaser.Tweens.Tween;
  private shownProgress = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    public readonly tile: TilePos,
  ) {
    const ts = TUNING.level.tileSize;
    this.x = (tile.x + 0.5) * ts;
    this.y = (tile.y + 0.5) * ts;

    this.image = scene.add.image(this.x, this.y, TEXTURE_KEYS.chest).setScale(S).setDepth(TUNING.treasure.depth);

    this.glow = scene.add
      .image(this.x, this.y, TEXTURE_KEYS.softGlow)
      .setDisplaySize(C.glowRadius * 2, C.glowRadius * 2)
      .setTint(C.glowColor)
      .setAlpha(C.glowAlpha)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(TUNING.lighting.depth + 1);
    this.glowTween = scene.tweens.add({
      targets: this.glow,
      alpha: C.glowAlpha * 0.5,
      duration: C.glowPulseMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.ring = scene.add.graphics({ x: this.x, y: this.y }).setDepth(C.ringDepth);
  }

  /** 0..1 opening progress. 0 fades the ring out. */
  setProgress(p: number): void {
    if (p === this.shownProgress) return;
    const wasShown = this.shownProgress > 0;
    this.shownProgress = p;

    if (p <= 0) {
      if (wasShown) {
        this.ringFade = this.scene.tweens.add({
          targets: this.ring,
          alpha: 0,
          duration: C.ringFadeMs,
          onComplete: () => this.ring.clear(),
        });
      }
      return;
    }

    if (this.ringFade) {
      this.ringFade.stop();
      this.ringFade = undefined;
    }
    this.ring.setAlpha(1);
    const g = this.ring;
    const start = -Math.PI / 2;
    g.clear();
    g.lineStyle(C.ringWidth, C.ringBackColor, C.ringBackAlpha);
    g.strokeCircle(0, 0, C.ringRadius);
    g.lineStyle(C.ringWidth, C.ringColor, 1);
    g.beginPath();
    g.arc(0, 0, C.ringRadius, start, start + Math.min(1, p) * Math.PI * 2);
    g.strokePath();
  }

  /** Lid opens with a squash; glow and ring go away. */
  open(): void {
    if (this.state === 'open') return;
    this.state = 'open';
    this.shownProgress = 0;
    this.ringFade?.stop();
    this.ring.clear();

    this.image.setTexture(TEXTURE_KEYS.chestOpen);
    this.scene.tweens.add({
      targets: this.image,
      scaleX: { from: S * 1.25, to: S },
      scaleY: { from: S * 0.7, to: S },
      duration: C.openSquashMs,
      ease: 'Back.easeOut',
    });

    this.glowTween.stop();
    this.scene.tweens.add({
      targets: this.glow,
      alpha: 0,
      duration: C.openSquashMs * 2,
      onComplete: () => this.glow.destroy(),
    });
  }
}
