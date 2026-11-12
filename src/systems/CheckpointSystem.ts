import Phaser from 'phaser';
import { TUNING } from '../config';
import { Checkpoint } from '../entities/Checkpoint';
import type { Player } from '../entities/Player';
import type { TilePos } from './LevelParser';
import { LootFx } from './LootFx';
import type { LootSystem } from './LootSystem';
import { loadCheckpoint, saveCheckpoint, type CheckpointSave } from './SaveData';

const CP = TUNING.checkpoint;

export interface CheckpointSystemDeps {
  levelId: string;
  player: Player;
  loot: LootSystem;
  /** Current run time (ms), stored with the checkpoint. */
  runTimeMs: () => number;
  /** While true nothing is reached (teleport, run over). */
  isPaused: () => boolean;
}

/**
 * Checkpoints 'F'. Touching one saves the spot (SaveData, memory only): trap deaths and
 * "Try again" restart the scene, which then respawns here with the loot taken before it.
 * Everything after it (loot, traps) resets with the scene.
 */
export class CheckpointSystem {
  private readonly flags: Checkpoint[];
  private readonly fx: LootFx;
  private readonly reached: Set<string>;
  private readonly r2 = CP.triggerRadius * CP.triggerRadius;

  /** Loot that survives a death (the total at the last checkpoint). */
  public keptLoot: number;
  /** True once any checkpoint on this level was reached. */
  get hasCheckpoint(): boolean {
    return this.reached.size > 0;
  }

  /** The save this run started from (undefined = level start). */
  public readonly resumed?: CheckpointSave;

  constructor(
    scene: Phaser.Scene,
    tiles: readonly TilePos[],
    private readonly deps: CheckpointSystemDeps,
  ) {
    this.fx = new LootFx(scene);
    this.flags = tiles.map((t) => new Checkpoint(scene, t));
    this.resumed = loadCheckpoint(deps.levelId);
    this.reached = new Set(this.resumed?.reached ?? []);
    this.keptLoot = this.resumed?.loot ?? 0;
    for (const f of this.flags) if (this.reached.has(tileKey(f.tile))) f.activate(false);
  }

  /** Respawn point in world px for a level, or null to use the level start. */
  static spawnFor(levelId: string): Phaser.Math.Vector2 | null {
    const s = loadCheckpoint(levelId);
    if (!s) return null;
    const ts = TUNING.level.tileSize;
    return new Phaser.Math.Vector2((s.x + 0.5) * ts, (s.y + 0.5) * ts);
  }

  get debugLine(): string {
    const s = this.resumed;
    return `checkpoint: ${this.reached.size}/${this.flags.length}${s ? ` from ${s.x},${s.y}` : ''}`;
  }

  update(): void {
    if (this.deps.isPaused()) return;
    const { x, y } = this.deps.player;
    for (const f of this.flags) {
      if (f.active) continue;
      if ((f.x - x) ** 2 + (f.y - y) ** 2 <= this.r2) this.reach(f);
    }
  }

  private reach(f: Checkpoint): void {
    f.activate(true);
    this.reached.add(tileKey(f.tile));
    const loot = this.deps.loot.snapshot();
    saveCheckpoint(this.deps.levelId, {
      x: f.tile.x,
      y: f.tile.y,
      reached: [...this.reached],
      pickups: loot.pickups,
      chests: loot.chests,
      loot: this.deps.loot.loot,
      timeMs: this.deps.runTimeMs(),
    });
    this.keptLoot = this.deps.loot.loot;
    this.fx.sparkle(f.x, f.y - 10, CP.sparkles, CP.sparkleTint);
    this.fx.floatText(f.x, f.y - 26, CP.text, CP.textColor, CP.fontSize);
    console.info(`[checkpoint] ${f.tile.x},${f.tile.y} saved`);
  }
}

function tileKey(t: TilePos): string {
  return `${t.x},${t.y}`;
}
