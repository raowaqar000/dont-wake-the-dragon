import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import type { PickupKind } from '../levels/types';
import type { TilePos } from '../systems/LevelParser';
import { ART_SCALE, artKey, hasArt } from '../systems/ArtAssets';
import { TREASURE_TEXTURE_SCALE } from '../systems/TreasureTextureFactory';

const T = TUNING.treasure;
const TWO_PI = Math.PI * 2;

export type PickupState = 'idle' | 'collected' | 'lost';

/**
 * Coin or gem lying on the floor. Instant pickup on overlap (LootSystem checks distance).
 * Idle animation is driven by LootSystem (no per-item tweens): coins spin + bob, gems bob + twinkle.
 */
export class Pickup {
  public state: PickupState = 'idle';
  public readonly x: number;
  public readonly y: number;
  public readonly value: number;
  public readonly radiusSq: number;

  private readonly image: Phaser.GameObjects.Image;
  /** Resting scale: painted art (TUNING.art.coin / gem) or the code-drawn texture. */
  private readonly baseScale: number;
  private twinkle?: Phaser.GameObjects.Image;
  /** Random phase so items don't all move in sync. */
  private readonly phase = Math.random() * TWO_PI;
  private nextTwinkleAt = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    public readonly kind: PickupKind,
    public readonly tile: TilePos,
  ) {
    const ts = TUNING.level.tileSize;
    const cfg = kind === 'coin' ? T.coin : T.gem;
    this.x = (tile.x + 0.5) * ts;
    this.y = (tile.y + 0.5) * ts;
    this.value = cfg.value;
    this.radiusSq = cfg.pickupRadius * cfg.pickupRadius;

    const art = hasArt(scene, kind);
    this.baseScale = art ? ART_SCALE * TUNING.art[kind].displayScale : TREASURE_TEXTURE_SCALE;
    const key = art ? artKey(kind) : kind === 'coin' ? TEXTURE_KEYS.coin : TEXTURE_KEYS.gem;
    this.image = scene.add.image(this.x, this.y, key).setScale(this.baseScale).setDepth(T.depth);

    if (kind === 'gem') {
      this.twinkle = scene.add
        .image(this.x + T.gem.size * 0.22, this.y - T.gem.size * 0.22, TEXTURE_KEYS.sparkle)
        .setScale(0)
        .setTint(T.gem.lightColor)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(T.depth + 1);
      this.nextTwinkleAt = Phaser.Math.Between(0, T.gem.twinkleMaxMs);
    }
  }

  /** Idle animation for this frame. LootSystem only calls it for on-screen items. */
  animate(now: number): void {
    if (this.state !== 'idle') return;
    const cfg = this.kind === 'coin' ? T.coin : T.gem;
    const bob = Math.sin((now / cfg.bobMs) * TWO_PI + this.phase) * cfg.bobPx;
    this.image.y = this.y + bob;

    if (this.kind === 'coin') {
      const spin = Math.cos((now / T.coin.spinMs) * TWO_PI + this.phase);
      this.image.scaleX = this.baseScale * Math.max(0.12, Math.abs(spin));
    } else if (this.twinkle && now >= this.nextTwinkleAt) {
      const G = T.gem;
      this.nextTwinkleAt = now + G.twinkleMs * 2 + Phaser.Math.Between(G.twinkleMinMs, G.twinkleMaxMs);
      this.twinkle.setPosition(
        this.x + Phaser.Math.FloatBetween(-0.25, 0.25) * G.size,
        this.y + bob - Phaser.Math.FloatBetween(0, 0.3) * G.size,
      );
      this.scene.tweens.add({
        targets: this.twinkle,
        scale: { from: 0, to: TREASURE_TEXTURE_SCALE * 1.1 },
        angle: { from: 0, to: 90 },
        duration: G.twinkleMs,
        yoyo: true,
        ease: 'Sine.easeOut',
      });
    }
  }

  /** Fake treasure tell: duller color, no twinkle. */
  makeFake(tint: number): void {
    this.image.setTint(tint);
    this.twinkle?.destroy();
    this.twinkle = undefined;
  }

  /** Picked up: pop and fade. */
  collect(): void {
    if (this.state !== 'idle') return;
    this.state = 'collected';
    this.twinkle?.destroy();
    this.scene.tweens.add({
      targets: this.image,
      scale: this.baseScale * T.popScale,
      alpha: 0,
      duration: T.popMs,
      ease: 'Back.easeOut',
      onComplete: () => this.image.destroy(),
    });
  }

  /** The floor under it collapsed: falls into the pit and is gone. */
  lose(): void {
    if (this.state !== 'idle') return;
    this.state = 'lost';
    this.twinkle?.destroy();
    this.scene.tweens.add({
      targets: this.image,
      scale: 0,
      alpha: 0.2,
      angle: 200,
      duration: T.lostMs,
      ease: 'Quad.easeIn',
      onComplete: () => this.image.destroy(),
    });
  }
}
