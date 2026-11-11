import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import type { TilePos } from '../systems/LevelParser';
import { ART_SCALE, artKey, hasArt } from '../systems/ArtAssets';
import { TRAP_TEXTURE_SCALE } from '../systems/TrapTextureFactory';

const C = TUNING.traps.crumble;

export type CrumbleState = 'intact' | 'shaking' | 'collapsed';

/**
 * Cracked floor slab. Stepping on it starts a shake; after shakeMs it collapses
 * and reveals the pit baked into the level texture underneath. TrapSystem turns
 * the pit into a wall and decides whether the player fell in.
 */
export class CrumbleTile {
  public state: CrumbleState = 'intact';
  public readonly cx: number;
  public readonly cy: number;

  private readonly image: Phaser.GameObjects.Image;
  private readonly baseScale: number;
  private shakeStart = 0;
  private lastDust = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    public readonly tile: TilePos,
    private readonly dust: (x: number, y: number, count: number) => void,
    private readonly onCollapse: (tile: CrumbleTile) => void,
  ) {
    const ts = TUNING.level.tileSize;
    this.cx = (tile.x + 0.5) * ts;
    this.cy = (tile.y + 0.5) * ts;
    const art = hasArt(scene, 'crumble');
    this.baseScale = art ? ART_SCALE * TUNING.art.crumble.displayScale : TRAP_TEXTURE_SCALE;
    this.image = scene.add
      .image(this.cx, this.cy, art ? artKey('crumble') : TEXTURE_KEYS.crumble)
      .setScale(this.baseScale)
      .setDepth(C.depth);
  }

  /** Point inside the tile, shrunk by `inset` on every side. */
  contains(px: number, py: number, inset = 0): boolean {
    const half = TUNING.level.tileSize / 2 - inset;
    return Math.abs(px - this.cx) <= half && Math.abs(py - this.cy) <= half;
  }

  trigger(now: number): void {
    if (this.state !== 'intact') return;
    this.state = 'shaking';
    this.shakeStart = now;
    this.lastDust = now;
  }

  update(now: number): void {
    if (this.state !== 'shaking') return;
    const t = now - this.shakeStart;
    // Shake gets stronger toward the collapse.
    const amp = C.shakePx * (0.5 + 0.5 * Math.min(1, t / C.shakeMs));
    this.image.setPosition(
      this.cx + Phaser.Math.FloatBetween(-amp, amp),
      this.cy + Phaser.Math.FloatBetween(-amp, amp),
    );
    if (now - this.lastDust >= C.shakeDustEveryMs) {
      this.lastDust = now;
      const ts = TUNING.level.tileSize;
      this.dust(this.cx + Phaser.Math.FloatBetween(-ts / 3, ts / 3), this.cy + Phaser.Math.FloatBetween(-ts / 3, ts / 3), C.shakeDust);
    }
    if (t >= C.shakeMs) this.collapse();
  }

  private collapse(): void {
    this.state = 'collapsed';
    this.image.setPosition(this.cx, this.cy);
    this.dust(this.cx, this.cy, C.collapseDust);
    this.scene.tweens.add({
      targets: this.image,
      scale: this.baseScale * 0.45,
      alpha: 0,
      angle: Phaser.Math.Between(-40, 40),
      duration: C.collapseMs,
      ease: 'Quad.easeIn',
      onComplete: () => this.image.destroy(),
    });
    this.onCollapse(this);
  }
}
