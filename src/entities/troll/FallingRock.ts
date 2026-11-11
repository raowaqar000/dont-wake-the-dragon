import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../../config';
import type { TilePos } from '../../systems/LevelParser';
import { TROLL_TEXTURE_SCALE } from '../../systems/TrollTextureFactory';

const RK = TUNING.troll.rock;

export type RockState = 'waiting' | 'shadow' | 'landed';

/**
 * Falling ceiling rock 'R'. Fired: a shadow grows on the tile, the rock drops from
 * above during the last fallMs, slams (onSlam: kill check, noise, shake) and leaves
 * passable rubble. Tell while waiting: a grain of grit falls now and then.
 */
export class FallingRock {
  public state: RockState = 'waiting';
  public readonly cx: number;
  public readonly cy: number;
  private nextGritAt: number;

  constructor(
    private readonly scene: Phaser.Scene,
    public readonly tile: TilePos,
    private readonly onSlam: (rock: FallingRock) => void,
    private readonly grit: (x: number, y: number) => void,
  ) {
    const ts = TUNING.level.tileSize;
    this.cx = (tile.x + 0.5) * ts;
    this.cy = (tile.y + 0.5) * ts;
    this.nextGritAt = scene.time.now + Phaser.Math.Between(0, RK.gritMaxMs);
  }

  fire(): void {
    if (this.state !== 'waiting') return;
    this.state = 'shadow';
    const sc = this.scene;
    const shadow = sc.add
      .image(this.cx, this.cy, TEXTURE_KEYS.rockShadow)
      .setScale(TROLL_TEXTURE_SCALE * 0.2)
      .setAlpha(0)
      .setDepth(TUNING.troll.depth + 0.5);
    sc.tweens.add({
      targets: shadow,
      scale: TROLL_TEXTURE_SCALE * 1.05,
      alpha: RK.shadowMaxAlpha,
      duration: RK.shadowMs,
      ease: 'Quad.easeIn',
    });

    const rockScale = TROLL_TEXTURE_SCALE * RK.displayScale;
    const rock = sc.add
      .image(this.cx, this.cy - RK.dropHeightPx, TEXTURE_KEYS.ceilingRock)
      .setScale(rockScale * 1.3)
      .setAlpha(0)
      .setDepth(TUNING.troll.fxDepth);
    sc.tweens.add({
      targets: rock,
      y: this.cy,
      scale: rockScale,
      alpha: 1,
      delay: Math.max(0, RK.shadowMs - RK.fallMs),
      duration: RK.fallMs,
      ease: 'Quad.easeIn',
      onComplete: () => {
        shadow.destroy();
        rock.destroy();
        this.state = 'landed';
        sc.add.image(this.cx, this.cy, TEXTURE_KEYS.rubble).setScale(TROLL_TEXTURE_SCALE).setDepth(TUNING.troll.depth + 0.6);
        this.onSlam(this);
      },
    });
  }

  /** Idle tell: grit trickles down (only called for on-screen rocks). */
  updateTell(now: number): void {
    if (this.state !== 'waiting' || now < this.nextGritAt) return;
    this.nextGritAt = now + Phaser.Math.Between(RK.gritMinMs, RK.gritMaxMs);
    const ts = TUNING.level.tileSize;
    this.grit(this.cx + Phaser.Math.FloatBetween(-ts * 0.25, ts * 0.25), this.cy + Phaser.Math.FloatBetween(-ts * 0.25, ts * 0.25));
  }

  contains(x: number, y: number, inset: number): boolean {
    const half = TUNING.level.tileSize / 2 - inset;
    return Math.abs(x - this.cx) <= half && Math.abs(y - this.cy) <= half;
  }
}
