import { PORTAL_SYMBOLS, RESERVED_TILES, TILE, type LevelData } from '../levels/types';

/**
 * Pure grid parsing (no Phaser, no config), so the level validator can run it
 * from the command line too. Everything is in tile units.
 */

export interface TilePos {
  x: number;
  y: number;
}

export interface TileRect extends TilePos {
  w: number;
  h: number;
}

export interface PortalPair {
  /** Pair symbol '1'..'9'. */
  id: string;
  a: TilePos;
  b: TilePos;
}

export interface SpikeGroup {
  index: number;
  tiles: TilePos[];
  /** Timing override from LevelData, if any. */
  override?: { offsetMs?: number; downMs?: number; upMs?: number };
}

export interface ParsedLevel {
  cols: number;
  rows: number;
  /** wall[y][x]: solid from the start (crumble tiles are NOT walls here). */
  wall: boolean[][];
  start: TilePos;
  /** Bounding box of all 'E' tiles. */
  exit: TileRect;
  exitTiles: TilePos[];
  portals: PortalPair[];
  spikeGroups: SpikeGroup[];
  crumbles: TilePos[];
  /** Coins and gems (from the grid and LevelData.treasureOnTiles). */
  coins: TilePos[];
  gems: TilePos[];
  /** Chests are solid (they get a physics body) but are NOT walls here. */
  chests: TilePos[];
  /** Merged wall rectangles. */
  wallRects: TileRect[];
}

const PORTALS = new Set<string>(PORTAL_SYMBOLS);
const RESERVED = new Set<string>(Object.values(RESERVED_TILES));
const KNOWN = new Set<string>([...Object.values(TILE), ...PORTALS, ...RESERVED]);

export function parseLevel(data: LevelData): ParsedLevel {
  const grid = data.grid;
  const rows = grid.length;
  if (rows === 0) throw new Error(`[${data.id}] grid is empty`);
  const cols = grid[0].length;

  const wall: boolean[][] = [];
  const starts: TilePos[] = [];
  const exitTiles: TilePos[] = [];
  const portalTiles = new Map<string, TilePos[]>();
  const spikeTiles: TilePos[] = [];
  const crumbles: TilePos[] = [];
  const coins: TilePos[] = [];
  const gems: TilePos[] = [];
  const chests: TilePos[] = [];
  const warned = new Set<string>();

  grid.forEach((row, y) => {
    if (row.length !== cols) {
      throw new Error(`[${data.id}] row ${y} has ${row.length} tiles, expected ${cols}`);
    }
    const line: boolean[] = [];
    for (let x = 0; x < cols; x++) {
      const ch = row[x];
      if (!KNOWN.has(ch)) throw new Error(`[${data.id}] unknown tile '${ch}' at ${x},${y}`);
      if (RESERVED.has(ch) && !warned.has(ch)) {
        warned.add(ch);
        console.warn(`[${data.id}] tile '${ch}' is reserved but not implemented yet; treated as floor`);
      }
      line.push(ch === TILE.wall);
      if (ch === TILE.playerStart) starts.push({ x, y });
      else if (ch === TILE.exit) exitTiles.push({ x, y });
      else if (ch === TILE.spikes) spikeTiles.push({ x, y });
      else if (ch === TILE.crumble) crumbles.push({ x, y });
      else if (ch === TILE.coin) coins.push({ x, y });
      else if (ch === TILE.gem) gems.push({ x, y });
      else if (ch === TILE.chest) chests.push({ x, y });
      else if (PORTALS.has(ch)) {
        const list = portalTiles.get(ch) ?? [];
        list.push({ x, y });
        portalTiles.set(ch, list);
      }
    }
    wall.push(line);
  });

  if (starts.length !== 1) throw new Error(`[${data.id}] needs exactly one '${TILE.playerStart}', found ${starts.length}`);
  if (exitTiles.length === 0) throw new Error(`[${data.id}] needs at least one '${TILE.exit}'`);

  const portals: PortalPair[] = [];
  for (const [id, tiles] of [...portalTiles].sort(([a], [b]) => a.localeCompare(b))) {
    if (tiles.length !== 2) throw new Error(`[${data.id}] portal '${id}' must appear exactly twice, found ${tiles.length}`);
    portals.push({ id, a: tiles[0], b: tiles[1] });
  }

  // Treasure on top of other tiles: only on walkable tiles that hold nothing else.
  const onTileOk = new Set<string>([TILE.floor, TILE.crumble, TILE.spikes]);
  const placed = new Set<string>();
  for (const t of data.treasureOnTiles ?? []) {
    const ch = grid[t.y]?.[t.x];
    if (ch === undefined) throw new Error(`[${data.id}] treasureOnTiles ${t.x},${t.y} is outside the grid`);
    if (!onTileOk.has(ch)) throw new Error(`[${data.id}] treasureOnTiles ${t.x},${t.y} is on '${ch}' (needs '.', '%' or '^')`);
    const key = `${t.x},${t.y}`;
    if (placed.has(key)) throw new Error(`[${data.id}] treasureOnTiles has two items on ${key}`);
    placed.add(key);
    (t.kind === 'coin' ? coins : gems).push({ x: t.x, y: t.y });
  }

  const ex0 = Math.min(...exitTiles.map((t) => t.x));
  const ey0 = Math.min(...exitTiles.map((t) => t.y));
  const ex1 = Math.max(...exitTiles.map((t) => t.x));
  const ey1 = Math.max(...exitTiles.map((t) => t.y));

  return {
    cols,
    rows,
    wall,
    start: starts[0],
    exit: { x: ex0, y: ey0, w: ex1 - ex0 + 1, h: ey1 - ey0 + 1 },
    exitTiles,
    portals,
    spikeGroups: groupSpikes(data, spikeTiles),
    crumbles,
    coins,
    gems,
    chests,
    wallRects: mergeWalls(wall),
  };
}

/** Flood-fills touching spike tiles (4-way) into groups and attaches overrides. */
function groupSpikes(data: LevelData, tiles: TilePos[]): SpikeGroup[] {
  const key = (t: TilePos) => `${t.x},${t.y}`;
  const remaining = new Map(tiles.map((t) => [key(t), t]));
  const groups: SpikeGroup[] = [];

  for (const seed of tiles) {
    if (!remaining.has(key(seed))) continue;
    const group: TilePos[] = [];
    const queue = [seed];
    remaining.delete(key(seed));
    while (queue.length > 0) {
      const t = queue.shift()!;
      group.push(t);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const k = `${t.x + dx},${t.y + dy}`;
        const n = remaining.get(k);
        if (n) {
          remaining.delete(k);
          queue.push(n);
        }
      }
    }
    groups.push({ index: groups.length, tiles: group });
  }

  for (const o of data.spikeOverrides ?? []) {
    const g = groups.find((gr) => gr.tiles.some((t) => t.x === o.x && t.y === o.y));
    if (!g) throw new Error(`[${data.id}] spikeOverride at ${o.x},${o.y} is not on a spike tile`);
    g.override = { offsetMs: o.offsetMs, downMs: o.downMs, upMs: o.upMs };
  }
  return groups;
}

/**
 * Merges wall tiles into few rectangles: horizontal runs per row, then
 * identical runs in consecutive rows stack into one taller rectangle.
 * Fewer bodies = cheaper physics and fewer internal seams to snag on.
 */
function mergeWalls(wall: boolean[][]): TileRect[] {
  const done: TileRect[] = [];
  let open = new Map<string, TileRect>();

  wall.forEach((line, y) => {
    const next = new Map<string, TileRect>();
    let x = 0;
    while (x < line.length) {
      if (!line[x]) {
        x++;
        continue;
      }
      const x0 = x;
      while (x < line.length && line[x]) x++;
      const key = `${x0}:${x}`;
      const rect = open.get(key);
      if (rect) {
        rect.h++;
        open.delete(key);
        next.set(key, rect);
      } else {
        next.set(key, { x: x0, y, w: x - x0, h: 1 });
      }
    }
    open.forEach((r) => done.push(r));
    open = next;
  });
  open.forEach((r) => done.push(r));
  return done;
}
