import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import { CrumbleTile } from '../entities/CrumbleTile';
import type { Player } from '../entities/Player';
import { SpikeTrap } from '../entities/SpikeTrap';
import type { FailEffect } from './FailSystem';
import type { ParsedLevel, TilePos } from './LevelParser';

const T = TUNING.traps;

export type TrapKind = 'spikes' | 'pit';

export interface TrapSystemDeps {
  player: Player;
  /** Turns a tile into an open pit (collapsed floor). JumpSystem handles falling in. */
  addPit: (tile: TilePos) => void;
  onCaught: (kind: TrapKind, effect: FailEffect) => void;
  /** A crumbling floor just collapsed (treasure on it is lost). */
  onFloorCollapsed?: (tile: TilePos) => void;
  /** While true, traps keep animating but can't catch or be triggered (teleport, run over). */
  isPaused: () => boolean;
}

/** Runs every trap (no dragon needed): spike timers, crumbling floors, player hit checks. */
export class TrapSystem {
  private readonly spikes: SpikeTrap[];
  private readonly crumbles: CrumbleTile[];
  private readonly dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(
    private readonly scene: Phaser.Scene,
    level: ParsedLevel,
    private readonly deps: TrapSystemDeps,
  ) {
    const C = T.crumble;
    const s = 1 / TUNING.playerVisual.textureResolution;
    this.dustEmitter = scene.add
      .particles(0, 0, TEXTURE_KEYS.dust, {
        lifespan: 500,
        speed: { min: 10, max: 45 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.6 * s, end: 1.6 * s },
        alpha: { start: 0.55, end: 0 },
        tint: C.dustColor,
        emitting: false,
      })
      .setDepth(TUNING.playerVisual.depth + 1);

    this.spikes = level.spikeGroups.map((g) => new SpikeTrap(scene, g));
    this.crumbles = level.crumbles.map(
      (t) =>
        new CrumbleTile(
          scene,
          t,
          (x, y, n) => this.dustEmitter.explode(n, x, y),
          (tile) => this.onCollapse(tile),
        ),
    );
  }

  /** Short status for the debug overlay. */
  get debugLine(): string {
    const up = this.spikes.filter((s) => s.dangerous).length;
    const gone = this.crumbles.filter((c) => c.state === 'collapsed').length;
    return `traps: spikes up ${up}/${this.spikes.length}, pits ${gone}/${this.crumbles.length}`;
  }

  update(): void {
    const now = this.scene.time.now;
    for (const s of this.spikes) s.update(now);
    for (const c of this.crumbles) c.update(now);
    // In the air: spikes can't hit and crumbling floors don't notice you.
    if (this.deps.isPaused() || this.deps.player.airborne) return;

    const { x, y } = this.deps.player;
    const r = TUNING.player.bodyRadius;

    for (const s of this.spikes) {
      if (s.dangerous && s.overlapsCircle(x, y, r, T.hitInset)) {
        this.deps.onCaught('spikes', { kind: 'hit' });
        return;
      }
    }
    for (const c of this.crumbles) {
      if (c.state === 'intact' && c.contains(x, y)) c.trigger(now);
    }
  }

  /** The slab is gone: the tile is a pit now (still jumpable; JumpSystem decides falls). */
  private onCollapse(tile: CrumbleTile): void {
    this.deps.addPit(tile.tile);
    this.deps.onFloorCollapsed?.(tile.tile);
  }
}
