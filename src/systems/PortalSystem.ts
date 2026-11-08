import Phaser from 'phaser';
import { TUNING } from '../config';
import { Portal } from '../entities/Portal';
import type { Player } from '../entities/Player';
import type { PlayerVisual } from '../entities/PlayerVisual';
import type { CameraRig } from './CameraRig';
import type { PortalPair } from './LevelParser';

const P = TUNING.portals;

/**
 * Teleports the player between paired portals:
 * shrink at the entry -> jump -> fast camera pan -> pop in at the exit.
 * The exit portal stays disarmed until the player has stepped away from it
 * (rearmRadius) and cooldownMs has passed, so he can't bounce back and forth.
 */
export class PortalSystem {
  private readonly portals: Portal[] = [];
  private teleporting = false;

  constructor(
    private readonly scene: Phaser.Scene,
    pairs: PortalPair[],
    private readonly player: Player,
    private readonly visual: PlayerVisual,
    private readonly rig: CameraRig,
    /** True once the run is over; teleports never start or finish into play then. */
    private readonly isOver: () => boolean,
  ) {
    const ts = TUNING.level.tileSize;
    const center = (t: { x: number; y: number }) => [(t.x + 0.5) * ts, (t.y + 0.5) * ts] as const;
    for (const pair of pairs) {
      const color = P.colors[(Number(pair.id) - 1) % P.colors.length];
      const a = new Portal(scene, ...center(pair.a), color);
      const b = new Portal(scene, ...center(pair.b), color);
      a.partner = b;
      b.partner = a;
      this.portals.push(a, b);
    }
  }

  get isTeleporting(): boolean {
    return this.teleporting;
  }

  /** Short status for the debug overlay. */
  get debugLine(): string {
    const cooling = this.portals.filter((p) => !p.armed).length;
    return `portal: ${this.teleporting ? 'jumping' : cooling > 0 ? 'cooldown' : 'ready'}`;
  }

  update(): void {
    if (this.teleporting || this.isOver()) return;
    const now = this.scene.time.now;
    const { x, y } = this.player;

    for (const p of this.portals) {
      const d = Phaser.Math.Distance.Between(x, y, p.x, p.y);
      if (!p.armed) {
        if (d > P.rearmRadius && now >= p.rearmAt) p.setArmed(true);
        continue;
      }
      if (d <= P.triggerRadius) {
        this.teleport(p);
        return;
      }
    }
  }

  private teleport(from: Portal): void {
    const to = from.partner;
    this.teleporting = true;
    this.player.freeze();
    to.setArmed(false, Infinity); // real cooldown starts when he lands
    from.burst();

    this.visual.shrinkOut(P.shrinkMs, () => {
      this.player.teleportTo(to.x, to.y);
      to.burst();
      this.rig.panToTarget();
      this.scene.time.delayedCall(P.popDelayMs, () => {
        this.visual.popIn(P.popMs, () => {
          this.teleporting = false;
          to.setArmed(false, this.scene.time.now + P.cooldownMs);
          if (!this.isOver()) this.player.unfreeze();
        });
      });
    });
  }
}
