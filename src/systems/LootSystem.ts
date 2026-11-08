import Phaser from 'phaser';
import { TUNING } from '../config';
import { Chest } from '../entities/Chest';
import { Pickup } from '../entities/Pickup';
import type { Player } from '../entities/Player';
import type { ParsedLevel, TilePos } from './LevelParser';
import { LootFx } from './LootFx';

const T = TUNING.treasure;
const L = TUNING.loot;

export type LootKind = 'coin' | 'gem' | 'chest';

export const LOOT_EVENTS = {
  /** Loot total went up. Payload: LootChange. */
  changed: 'loot-changed',
} as const;

export interface LootChange {
  kind: LootKind;
  delta: number;
  total: number;
  coins: number;
  gems: number;
  gemsTotal: number;
  chests: number;
  chestsTotal: number;
}

export interface LootSystemDeps {
  player: Player;
  /** World camera, for culling idle animations and the chest shake. */
  camera: Phaser.Cameras.Scene2D.Camera;
  /** While true, nothing can be picked up or opened (teleport, run over). */
  isPaused: () => boolean;
}

/** Sack scale for a loot value (1 = starting size). */
export function sackScaleFor(loot: number): number {
  return 1 + Math.min(1, loot / L.sack.fullLoot) * (L.sack.maxScale - 1);
}

/**
 * Owns all treasure in the level: pickups, chest opening, totals.
 * Emits LOOT_EVENTS.changed; the HUD and the sack listen to it.
 */
export class LootSystem extends Phaser.Events.EventEmitter {
  private readonly pickups: Pickup[];
  private readonly chests: Chest[];
  private readonly fx: LootFx;
  private readonly view = new Phaser.Geom.Rectangle();

  private total = 0;
  private coins = 0;
  private gems = 0;
  private openedChests = 0;
  private opening?: Chest;
  private openProgressMs = 0;

  public readonly gemsTotal: number;
  public readonly chestsTotal: number;

  constructor(
    private readonly scene: Phaser.Scene,
    level: ParsedLevel,
    private readonly deps: LootSystemDeps,
  ) {
    super();
    this.fx = new LootFx(scene);
    this.pickups = [
      ...level.coins.map((t) => new Pickup(scene, 'coin', t)),
      ...level.gems.map((t) => new Pickup(scene, 'gem', t)),
    ];
    this.chests = level.chests.map((t) => new Chest(scene, t));
    this.gemsTotal = level.gems.length;
    this.chestsTotal = level.chests.length;

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeAllListeners());
  }

  get loot(): number {
    return this.total;
  }

  get gemsFound(): number {
    return this.gems;
  }

  get chestsFound(): number {
    return this.openedChests;
  }

  /** Greed hook: movement speed multiplier for the current loot (1 = no slowdown for now). */
  get speedMultiplier(): number {
    const G = L.greed;
    return Math.max(G.minSpeedMultiplier, 1 - this.total * G.speedPenaltyPerLoot);
  }

  get debugLine(): string {
    const open = this.opening ? ` opening ${Math.round((this.openProgressMs / T.chest.openMs) * 100)}%` : '';
    return `loot:  ${this.total} (c${this.coins} g${this.gems} t${this.openedChests})${open}`;
  }

  update(deltaMs: number): void {
    this.animateVisible();
    if (this.deps.isPaused()) {
      this.resetOpening();
      return;
    }

    const { x, y } = this.deps.player;
    for (const p of this.pickups) {
      if (p.state !== 'idle') continue;
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy <= p.radiusSq) this.collect(p);
    }

    this.updateChest(x, y, deltaMs);
  }

  /** A crumbling floor collapsed: anything lying on it falls in and is lost. */
  onFloorCollapsed(tile: TilePos): void {
    for (const p of this.pickups) {
      if (p.state === 'idle' && p.tile.x === tile.x && p.tile.y === tile.y) p.lose();
    }
  }

  private animateVisible(): void {
    const now = this.scene.time.now;
    const m = T.cullMargin;
    const wv = this.deps.camera.worldView;
    this.view.setTo(wv.x - m, wv.y - m, wv.width + m * 2, wv.height + m * 2);
    for (const p of this.pickups) {
      if (p.state === 'idle' && this.view.contains(p.x, p.y)) p.animate(now);
    }
  }

  private collect(p: Pickup): void {
    p.collect();
    const isCoin = p.kind === 'coin';
    const cfg = isCoin ? T.coin : T.gem;
    if (isCoin) this.coins++;
    else this.gems++;
    this.fx.sparkle(p.x, p.y, cfg.sparkles, cfg.sparkleTint);
    this.fx.floatText(p.x, p.y - 10, `+${p.value}`, cfg.textColor);
    this.addLoot(p.kind, p.value);
  }

  private updateChest(x: number, y: number, deltaMs: number): void {
    const C = T.chest;
    const r2 = C.openRadius * C.openRadius;
    let near: Chest | undefined;
    let best = Infinity;
    for (const c of this.chests) {
      if (c.state !== 'closed') continue;
      const d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d <= r2 && d < best) {
        best = d;
        near = c;
      }
    }

    const still = this.deps.player.speed < C.idleSpeed && this.deps.player.moveState === 'idle';
    if (!near || !still) {
      this.resetOpening();
      return;
    }

    if (near !== this.opening) {
      this.resetOpening();
      this.opening = near;
    }
    this.openProgressMs += Math.min(deltaMs, TUNING.movement.maxDeltaMs);
    const p = this.openProgressMs / C.openMs;
    if (p >= 1) {
      this.openChest(near);
    } else {
      near.setProgress(p);
    }
  }

  private resetOpening(): void {
    this.opening?.setProgress(0);
    this.opening = undefined;
    this.openProgressMs = 0;
  }

  private openChest(c: Chest): void {
    const C = T.chest;
    this.opening = undefined;
    this.openProgressMs = 0;
    c.open();
    this.openedChests++;
    this.fx.coinBurst(c.x, c.y - 6, C.burstCoins);
    this.fx.sparkle(c.x, c.y - 6, C.burstSparkles, C.sparkleTint);
    this.fx.floatText(c.x, c.y - 24, `+${c.value}`, C.textColor, T.floatText.chestFontSize);
    this.deps.camera.shake(C.shakeMs, C.shakeIntensity);
    this.addLoot('chest', c.value);
  }

  private addLoot(kind: LootKind, delta: number): void {
    this.total += delta;
    const change: LootChange = {
      kind,
      delta,
      total: this.total,
      coins: this.coins,
      gems: this.gems,
      gemsTotal: this.gemsTotal,
      chests: this.openedChests,
      chestsTotal: this.chestsTotal,
    };
    this.emit(LOOT_EVENTS.changed, change);
  }
}
