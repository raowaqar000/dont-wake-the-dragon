/**
 * Level format
 * ------------
 * A level is a grid of equal-length strings, one character per tile
 * (tile size comes from TUNING.level.tileSize). Row 0 is the top of the world.
 *
 * Implemented symbols:
 *   '#'  cave wall (solid)
 *   '.'  floor
 *   'P'  player start (floor tile, exactly one per level)
 *   'E'  exit zone (floor tile, at least one; touching 'E' tiles merge into one exit)
 *
 * Reserved for future features (parsed as floor for now, with a console warning):
 *   'T'  treasure
 *   'D'  dragon spawn
 *   '~'  hazard (water / lava)
 *   'S'  spikes / trap
 */
export const TILE = {
  wall: '#',
  floor: '.',
  playerStart: 'P',
  exit: 'E',
} as const;

export const RESERVED_TILES = {
  treasure: 'T',
  dragon: 'D',
  hazard: '~',
  spikes: 'S',
} as const;

export interface LevelData {
  /** Stable id, also used to seed the floor shade variation. */
  id: string;
  name: string;
  grid: readonly string[];
}
