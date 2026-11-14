import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import type { HintLevel } from '../levels/types';
import { HINT_TEXTURE_SCALE } from './HintTextureFactory';
import type { ParsedLevel, TilePos } from './LevelParser';

const H = TUNING.hints;

/** What kind of clue a hidden trap gets. */
export type ClueKind = 'floor' | 'spikes' | 'rock' | 'walls' | 'fake';

/** One hidden trap (or a group of touching trap tiles of the same kind). */
export interface HintGroup {
  kind: ClueKind;
  tiles: TilePos[];
  /** False once the trap fired: no more danger sense for it. */
  isArmed: () => boolean;
}

interface GroupState extends HintGroup {
  sensed: boolean;
}

/**
 * Trap hints, so the player can sense danger (LevelData.hintLevel):
 *  - clues ('strong' and 'subtle'): a cracked floor ring on trap floors / moving pits,
 *    bones next to hidden spikes, a skull next to falling rocks and fake treasure,
 *    claw scratches at the mouth of closing walls;
 *  - 'strong' adds a tiny wooden warning sign on the approach side, and danger sense:
 *    check() reports a trap group the first time the hero comes within senseTiles of it.
 * Placement is decoration only (no bodies); clues sit on free floor next to the trap.
 */
export class TrapHints {
  private readonly groups: GroupState[];
  private readonly occupied = new Set<string>();
  /** Crack rings by tile key, removed when that floor drops. */
  private readonly rings = new Map<string, Phaser.GameObjects.Image>();
  private readonly rng: Phaser.Math.RandomDataGenerator;
  private readonly ts = TUNING.level.tileSize;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: ParsedLevel,
    groups: HintGroup[],
    private readonly hintLevel: HintLevel,
  ) {
    this.groups = groups.map((g) => ({ ...g, sensed: false }));
    this.rng = new Phaser.Math.RandomDataGenerator([`hints-${level.cols}x${level.rows}`]);
    if (hintLevel === 'none') return;
    this.markOccupied();
    for (const g of this.groups) this.drawClue(g);
  }

  get senses(): boolean {
    return this.hintLevel === 'strong';
  }

  /**
   * Danger sense: call when the hero enters a new tile. Returns the first trap tile of a
   * group that is armed, not sensed yet and within senseTiles (Chebyshev), else null.
   */
  check(px: number, py: number): TilePos | null {
    if (!this.senses) return null;
    for (const g of this.groups) {
      if (g.sensed) continue;
      for (const t of g.tiles) {
        if (Math.max(Math.abs(t.x - px), Math.abs(t.y - py)) > H.senseTiles) continue;
        g.sensed = true;
        return g.isArmed() ? t : null;
      }
    }
    return null;
  }

  /** A trap floor dropped: its crack ring goes (the pit shows instead). */
  onFloorDropped(t: TilePos): void {
    const k = key(t);
    this.rings.get(k)?.destroy();
    this.rings.delete(k);
  }

  // Placement ---------------------------------------------------------------

  /** Tiles that already show something (treasure, traps, portals...): no clue goes there. */
  private markOccupied(): void {
    const p = this.level;
    const lists: TilePos[][] = [
      [p.start],
      p.exitTiles,
      p.realExitTiles,
      p.portals.flatMap((pr) => [pr.a, pr.b]),
      p.spikeGroups.flatMap((g) => g.tiles),
      p.crumbles,
      p.coins,
      p.gems,
      p.chests,
      p.gaps,
      p.trapFloors,
      p.popSpikes,
      p.rocks,
      p.fakeCoins,
      p.fakeGems,
      p.fakeWalls,
      p.movingPits,
      p.checkpoints,
    ];
    for (const l of lists) for (const t of l) this.occupied.add(key(t));
    for (const d of p.dragons) {
      for (let y = d.rect.y; y < d.rect.y + d.rect.h; y++) for (let x = d.rect.x; x < d.rect.x + d.rect.w; x++) this.occupied.add(`${x},${y}`);
    }
  }

  private isFree(x: number, y: number): boolean {
    return this.level.wall[y]?.[x] === false && !this.occupied.has(`${x},${y}`);
  }

  /** First free tile next to the group, trying the offsets in order around each group tile. */
  private findSpot(tiles: TilePos[], offsets: readonly (readonly [number, number])[]): TilePos | null {
    for (const [dx, dy] of offsets) {
      for (const t of tiles) {
        const x = t.x + dx;
        const y = t.y + dy;
        if (this.isFree(x, y)) return { x, y };
      }
    }
    return null;
  }

  private drawClue(g: GroupState): void {
    const ts = this.ts;
    const depth = H.depth;

    if (g.kind === 'floor') {
      // Cracked ring right on the trap tile(s).
      for (const t of g.tiles) {
        const img = this.scene.add
          .image((t.x + 0.5) * ts, (t.y + 0.5) * ts, TEXTURE_KEYS.hintCrackRing)
          .setScale(HINT_TEXTURE_SCALE)
          .setAngle(this.rng.between(0, 359))
          .setAlpha(H.crackRingAlpha)
          .setDepth(depth);
        this.rings.set(key(t), img);
      }
    } else {
      const texture =
        g.kind === 'spikes' ? TEXTURE_KEYS.hintBones : g.kind === 'walls' ? TEXTURE_KEYS.hintScratches : TEXTURE_KEYS.hintSkull;
      // Closing walls: the corridor itself is the trap; scratches go at its mouth (below, then above).
      const spot =
        g.kind === 'walls'
          ? this.findSpot(g.tiles, [[0, 1], [0, -1], [0, 0]]) ?? g.tiles[g.tiles.length - 1]
          : this.findSpot(g.tiles, NEIGHBORS);
      if (spot) {
        this.occupied.add(key(spot));
        // Nudge toward the trap so the clue reads as belonging to it.
        const near = nearestTile(g.tiles, spot);
        const nx = Math.sign(near.x - spot.x) * H.clueOffset;
        const ny = Math.sign(near.y - spot.y) * H.clueOffset;
        this.scene.add
          .image((spot.x + 0.5 + nx) * ts, (spot.y + 0.5 + ny) * ts, texture)
          .setScale(HINT_TEXTURE_SCALE)
          .setAngle(g.kind === 'walls' ? 0 : this.rng.between(-25, 25))
          .setAlpha(H.clueAlpha)
          .setDepth(depth);
      }
    }

    if (this.hintLevel !== 'strong') return;
    // Tiny wooden sign on the approach side (levels run north, so below first).
    const signSpot = this.findSpot(g.tiles, SIGN_OFFSETS);
    if (!signSpot) return;
    this.occupied.add(key(signSpot));
    this.scene.add
      .image((signSpot.x + 0.5 + H.clueOffset) * ts, (signSpot.y + 0.5 - H.clueOffset * 0.5) * ts, TEXTURE_KEYS.hintSign)
      .setScale(HINT_TEXTURE_SCALE)
      .setAlpha(H.signAlpha)
      .setDepth(depth + 0.1);
  }
}

/** Clue spots around a trap tile: sides first, then diagonals. */
const NEIGHBORS = [
  [-1, 0],
  [1, 0],
  [0, 1],
  [0, -1],
  [-1, 1],
  [1, 1],
  [-1, -1],
  [1, -1],
] as const;

/** Warning-sign spots: the approach side (below) first, then the sides, then above. */
const SIGN_OFFSETS = [
  [0, 2],
  [-1, 2],
  [1, 2],
  [0, 1],
  [-1, 1],
  [1, 1],
  [-1, 0],
  [1, 0],
  [-2, 0],
  [2, 0],
  [0, -1],
  [0, -2],
] as const;

function nearestTile(tiles: TilePos[], to: TilePos): TilePos {
  let best = tiles[0];
  let bestD = Infinity;
  for (const t of tiles) {
    const d = Math.abs(t.x - to.x) + Math.abs(t.y - to.y);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return best;
}

function key(t: TilePos): string {
  return `${t.x},${t.y}`;
}

