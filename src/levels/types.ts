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
 *
 * Reserved for future features (parsed as floor for now, with a console warning):
 *   'c'  treasure: coin
 *   'g'  treasure: gem / diamond
 *   'T'  treasure: chest
 *   'D'  dragon spawn
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
} as const;

/** Portal pair symbols, '1'..'9'. */
export const PORTAL_SYMBOLS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export const RESERVED_TILES = {
  coin: 'c',
  gem: 'g',
  chest: 'T',
  dragon: 'D',
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

export interface LevelData {
  /** Stable id, also used to seed the floor shade variation. */
  id: string;
  name: string;
  grid: readonly string[];
  spikeOverrides?: readonly SpikeOverride[];
}
