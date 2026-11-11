import Phaser from 'phaser';
import { TUNING } from '../../config';
import { ART_SCALE, artKey, hasArt } from '../../systems/ArtAssets';
import type { ClosingWallSpec } from '../../systems/LevelParser';

const CW = TUNING.troll.closingWall;

export type ClosingState = 'open' | 'warn' | 'closing' | 'closed' | 'opening';

/**
 * Two wall slabs hidden in the '[' and ']' columns. When fired they shake briefly, then
 * slide together across the corridor, stay shut for holdMs and slide back open
 * (re-armed, so it can fire again). Each slab is a moving immovable physics body, so it
 * pushes the hero; if the opening gets narrower than crushGapPx with him in it, he is crushed.
 */
export class ClosingWall {
  public state: ClosingState = 'open';
  /** 0 = open, 1 = shut. */
  private readonly t = { v: 0 };
  private stateUntil = 0;
  /** Corridor in px. */
  public readonly rect: Phaser.Geom.Rectangle;
  private readonly half: number;
  private readonly left: Phaser.GameObjects.Container;
  private readonly right: Phaser.GameObjects.Container;
  public readonly bodies: Phaser.GameObjects.Zone[];

  constructor(
    private readonly scene: Phaser.Scene,
    public readonly spec: ClosingWallSpec,
  ) {
    const ts = TUNING.level.tileSize;
    const c = spec.corridor;
    this.rect = new Phaser.Geom.Rectangle(c.x * ts, c.y * ts, c.w * ts, c.h * ts);
    this.half = this.rect.width / 2;
    const h = this.rect.height;

    const slab = (): Phaser.GameObjects.Container => {
      const parts: Phaser.GameObjects.GameObject[] = [];
      if (hasArt(scene, 'wall_tile')) {
        parts.push(
          scene.add
            .tileSprite(0, 0, this.half, h, artKey('wall_tile'))
            .setTileScale(ART_SCALE * TUNING.art.level.wallScale)
            .setTint(CW.tint),
        );
      } else {
        parts.push(scene.add.rectangle(0, 0, this.half, h, TUNING.level.wallColor));
      }
      const edge = scene.add.graphics();
      edge.lineStyle(2, TUNING.art.level.outlineColor, 0.8);
      edge.strokeRect(-this.half / 2, -h / 2, this.half, h);
      parts.push(edge);
      return scene.add.container(0, this.rect.centerY, parts).setDepth(TUNING.troll.depth + 0.8);
    };
    this.left = slab();
    this.right = slab();

    // Tell: a dark seam on the inner face of each wall column.
    const seam = scene.add.graphics().setDepth(TUNING.troll.depth + 0.7);
    seam.fillStyle(CW.seamColor, CW.seamAlpha);
    seam.fillRect(this.rect.x - 4, this.rect.y + 3, 2, h - 6);
    seam.fillRect(this.rect.right + 2, this.rect.y + 3, 2, h - 6);

    this.bodies = [this.left, this.right].map((s) => {
      const z = scene.add.zone(0, this.rect.centerY, this.half, h);
      scene.physics.add.existing(z, false);
      const b = z.body as Phaser.Physics.Arcade.Body;
      b.setImmovable(true);
      b.moves = false;
      b.enable = false;
      void s;
      return z;
    });
    this.place(0);
  }

  /** Inner edges: left slab right edge and right slab left edge, for t (0 open .. 1 shut). */
  private place(t: number): void {
    const travel = this.half * t;
    const lx = this.rect.x - this.half / 2 + travel;
    const rx = this.rect.right + this.half / 2 - travel;
    this.left.x = lx;
    this.right.x = rx;
    this.bodies[0].x = lx;
    this.bodies[1].x = rx;
  }

  /** Width of the opening left (px). */
  get gap(): number {
    return this.rect.width * (1 - this.t.v);
  }

  /** Bodies only block while the slabs stick out of the walls. */
  private setSolid(on: boolean): void {
    for (const z of this.bodies) (z.body as Phaser.Physics.Arcade.Body).enable = on;
  }

  fire(now: number): void {
    if (this.state !== 'open') return;
    this.state = 'warn';
    this.stateUntil = now + CW.warnMs;
  }

  /** Returns true the moment the walls start closing (for noise). */
  update(now: number): boolean {
    switch (this.state) {
      case 'warn': {
        const s = Math.sin(now * 0.09) * CW.warnShakePx;
        this.left.y = this.rect.centerY + s;
        this.right.y = this.rect.centerY - s;
        if (now < this.stateUntil) return false;
        this.left.y = this.right.y = this.rect.centerY;
        this.state = 'closing';
        this.setSolid(true);
        this.scene.tweens.add({
          targets: this.t,
          v: 1,
          duration: CW.closeMs,
          ease: 'Quad.easeIn',
          onUpdate: () => this.place(this.t.v),
          onComplete: () => {
            this.state = 'closed';
            this.stateUntil = this.scene.time.now + CW.holdMs;
          },
        });
        return true;
      }
      case 'closed':
        if (now >= this.stateUntil) {
          this.state = 'opening';
          this.scene.tweens.add({
            targets: this.t,
            v: 0,
            duration: CW.openMs,
            ease: 'Sine.easeInOut',
            onUpdate: () => this.place(this.t.v),
            onComplete: () => {
              this.state = 'open';
              this.setSolid(false);
            },
          });
        }
        return false;
      default:
        return false;
    }
  }
}
