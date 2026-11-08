/**
 * Level format
 * ------------
 * A level is a grid of equal-length strings, one character per tile
 * (tile size comes from TUNING.level.tileSize). Row 0 is the top of the world.
 *
 * Implemented symbols:
 *   '#'      cave wall (solid)
 *   '.'      floor
 *   'P'      player start (floor tile, exactly one per level)
 *   'E'      exit zone (floor tile, at least one; touching 'E' tiles merge into one exit)
 *   '1'-'9'  teleport portal. Each digit must appear exactly twice: the two tiles are
 *            one pair and lead to each other. Pair colors: TUNING.portals.colors[digit - 1].
 *   '^'      spike trap. Touching spike tiles form one group that moves together.
 *            Groups are offset automatically (TUNING.traps.spikes.groupOffsetMs);
 *            override per group with LevelData.spikeOverrides.
 *   '%'      crumbling floor. Shakes once stepped on, then collapses into a pit (wall).
 *            Levels must stay finishable with every '%' collapsed (checked at load).
 *   'c'      treasure: coin (floor tile, instant pickup)
 *   'g'      treasure: gem / diamond (floor tile, instant pickup)
 *   'T'      treasure: chest (solid). Stand still next to it to open it.
 *            Every treasure must be reachable (checked at load).
 *   'D'      sleeping dragon. Touching 'D' tiles form one dragon; it must be a
 *            3 wide x 2 tall rectangle (lying sideways). Solid. It hears noise and
 *            wakes up when its sleep meter is full. Facing and hearing per dragon:
 *            LevelData.dragonOverrides. Every tile must stay reachable around it.
 *
 * Treasure on top of another tile (e.g. a gem on a crumbling floor) goes in
 * LevelData.treasureOnTiles instead of the grid. If that floor collapses first,
 * the treasure falls in and is lost.
 *
 * Reserved for future features (parsed as floor for now, with a console warning):
 *   '~'  hazard (water / lava)
 *   'S'  special (unassigned)
 *   'x'  noisy floor: broken glass
 *   'h'  noisy floor: chains
 *   'r'  noisy floor: loose rocks
 *   '_'  boulder trap: pressure plate
 *   'O'  boulder trap: boulder start
 *
 * Keep this file free of imports: the level validator runs it outside the game.
 */
export const TILE = {
  wall: '#',
  floor: '.',
  playerStart: 'P',
  exit: 'E',
  spikes: '^',
  crumble: '%',
  coin: 'c',
  gem: 'g',
  chest: 'T',
  dragon: 'D',
} as const;

/** Portal pair symbols, '1'..'9'. */
export const PORTAL_SYMBOLS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export const RESERVED_TILES = {
  hazard: '~',
  special: 'S',
  noiseGlass: 'x',
  noiseChains: 'h',
  noiseRocks: 'r',
  boulderPlate: '_',
  boulder: 'O',
} as const;

/** Timing override for one spike group. (x, y) is any tile of that group. */
export interface SpikeOverride {
  x: number;
  y: number;
  /** Phase offset in ms (default: groupIndex * groupOffsetMs). */
  offsetMs?: number;
  downMs?: number;
  upMs?: number;
}

export type PickupKind = 'coin' | 'gem';

/** A coin or gem placed on top of a non-floor tile (crumbling floor, spikes...). */
export interface TreasureOnTile {
  x: number;
  y: number;
  kind: PickupKind;
}

/**
 * Dragon footprints in tiles, per orientation. Only 'sideways' exists for now;
 * an upright 2x3 dragon would add `upright: { w: 2, h: 3 }` here.
 */
export const DRAGON_FOOTPRINTS = {
  sideways: { w: 3, h: 2 },
} as const;

export type DragonOrientation = keyof typeof DRAGON_FOOTPRINTS;

/** Which way a dragon's head points. */
export type DragonFacing = 'left' | 'right';

/** Per-dragon settings. (x, y) is any tile of that dragon. */
export interface DragonOverride {
  x: number;
  y: number;
  /** Default: the side with more open floor next to it. */
  facing?: DragonFacing;
  /** Hearing multiplier (default TUNING.dragon.hearing). */
  hearing?: number;
}

export interface LevelData {
  /** Stable id, also used to seed the floor shade variation. */
  id: string;
  name: string;
  grid: readonly string[];
  spikeOverrides?: readonly SpikeOverride[];
  treasureOnTiles?: readonly TreasureOnTile[];
  dragonOverrides?: readonly DragonOverride[];
}
