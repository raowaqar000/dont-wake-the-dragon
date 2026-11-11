import {
  DRAGON_FOOTPRINTS,
  PORTAL_SYMBOLS,
  RESERVED_TILES,
  TILE,
  type DragonFacing,
  type DragonOrientation,
  type LevelData,
} from '../levels/types';

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
  /** Dragons are solid (one physics body each) but are NOT walls here. */
  dragons: DragonSpawn[];
  /** Merged wall rectangles. */
  wallRects: TileRect[];

  // Feature 8: gaps and troll traps ---------------------------------------
  /** '-' open pits from the start (not walls; jumpable). */
  gaps: TilePos[];
  trapFloors: TilePos[];
  popSpikes: TilePos[];
  rocks: TilePos[];
  closingWalls: ClosingWallSpec[];
  fakeCoins: TilePos[];
  fakeGems: TilePos[];
  /** Fake wall tiles: walkable, drawn as wall. */
  fakeWalls: TilePos[];
  movingPits: TilePos[];
  /** Real exit ('e' tiles) of a runaway exit, or null. */
  realExit: TileRect | null;
  realExitTiles: TilePos[];
  trapLinks: { from: TilePos; to: TilePos[] }[];
}

/**
 * Closing walls: '[' on the left, ']' on the right of the same rows, a corridor of
 * walkable tiles between them. Both slabs slide in and meet in the middle.
 */
export interface ClosingWallSpec {
  index: number;
  /** Corridor between the walls (tiles). */
  corridor: TileRect;
}

export interface DragonSpawn {
  index: number;
  /** Footprint in tiles. */
  rect: TileRect;
  orientation: DragonOrientation;
  facing: DragonFacing;
  /** Hearing multiplier override (undefined = default). */
  hearing?: number;
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
  const dragonTiles: TilePos[] = [];
  const gaps: TilePos[] = [];
  const trapFloors: TilePos[] = [];
  const popSpikes: TilePos[] = [];
  const rocks: TilePos[] = [];
  const fakeCoins: TilePos[] = [];
  const fakeGems: TilePos[] = [];
  const fakeWalls: TilePos[] = [];
  const movingPits: TilePos[] = [];
  const realExitTiles: TilePos[] = [];
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
      line.push(ch === TILE.wall || ch === TILE.closingWallLeft || ch === TILE.closingWallRight);
      if (ch === TILE.gap) gaps.push({ x, y });
      else if (ch === TILE.trapFloor) trapFloors.push({ x, y });
      else if (ch === TILE.popSpikes) popSpikes.push({ x, y });
      else if (ch === TILE.fallingRock) rocks.push({ x, y });
      else if (ch === TILE.fakeCoin) fakeCoins.push({ x, y });
      else if (ch === TILE.fakeGem) fakeGems.push({ x, y });
      else if (ch === TILE.fakeWall) fakeWalls.push({ x, y });
      else if (ch === TILE.movingPit) movingPits.push({ x, y });
      else if (ch === TILE.realExit) realExitTiles.push({ x, y });
      if (ch === TILE.playerStart) starts.push({ x, y });
      else if (ch === TILE.exit) exitTiles.push({ x, y });
      else if (ch === TILE.spikes) spikeTiles.push({ x, y });
      else if (ch === TILE.crumble) crumbles.push({ x, y });
      else if (ch === TILE.coin) coins.push({ x, y });
      else if (ch === TILE.gem) gems.push({ x, y });
      else if (ch === TILE.chest) chests.push({ x, y });
      else if (ch === TILE.dragon) dragonTiles.push({ x, y });
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
  if (realExitTiles.length > 0) {
    const a = boundsOf(exitTiles);
    const b = boundsOf(realExitTiles);
    if (a.w !== b.w || a.h !== b.h) throw new Error(`[${data.id}] runaway exit: 'e' tiles must match the 'E' size (${a.w}x${a.h})`);
  }

  const portals: PortalPair[] = [];
  for (const [id, tiles] of [...portalTiles].sort(([a], [b]) => a.localeCompare(b))) {
    if (tiles.length !== 2) throw new Error(`[${data.id}] portal '${id}' must appear exactly twice, found ${tiles.length}`);
    portals.push({ id, a: tiles[0], b: tiles[1] });
  }

  // Treasure on top of other tiles: only on walkable tiles that hold nothing else.
  const onTileOk = new Set<string>([TILE.floor, TILE.crumble, TILE.spikes, TILE.trapFloor, TILE.popSpikes]);
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
    dragons: groupDragons(data, dragonTiles, wall),
    wallRects: mergeWalls(wall),
    gaps,
    trapFloors,
    popSpikes,
    rocks,
    closingWalls: parseClosingWalls(data),
    fakeCoins,
    fakeGems,
    fakeWalls,
    movingPits,
    realExit: realExitTiles.length > 0 ? boundsOf(realExitTiles) : null,
    realExitTiles,
    trapLinks: (data.trapLinks ?? []).map((l) => ({ from: { x: l.from.x, y: l.from.y }, to: l.to.map((t) => ({ x: t.x, y: t.y })) })),
  };
}

function boundsOf(tiles: TilePos[]): TileRect {
  const x0 = Math.min(...tiles.map((t) => t.x));
  const y0 = Math.min(...tiles.map((t) => t.y));
  return { x: x0, y: y0, w: Math.max(...tiles.map((t) => t.x)) - x0 + 1, h: Math.max(...tiles.map((t) => t.y)) - y0 + 1 };
}

/**
 * Each row with '[' ... ']' gives a corridor span (the tiles between them).
 * Consecutive rows with the same span merge into one closing-wall pair.
 */
function parseClosingWalls(data: LevelData): ClosingWallSpec[] {
  const L = TILE.closingWallLeft;
  const R = TILE.closingWallRight;
  const specs: ClosingWallSpec[] = [];
  let open: ClosingWallSpec | null = null;
  data.grid.forEach((row, y) => {
    const l = row.lastIndexOf(L);
    const r = row.indexOf(R);
    if (l < 0 && r < 0) {
      open = null;
      return;
    }
    if (l < 0 || r < 0 || r < l + 2) {
      throw new Error(`[${data.id}] row ${y}: closing walls need '${L}' left of '${R}' with floor between`);
    }
    for (let x = l + 1; x < r; x++) {
      const ch = row[x];
      if (ch === TILE.wall || ch === L || ch === R || ch === TILE.chest || ch === TILE.dragon) {
        throw new Error(`[${data.id}] closing-wall corridor at ${x},${y} must be walkable`);
      }
    }
    const prev: ClosingWallSpec | null = open;
    if (prev && prev.corridor.x === l + 1 && prev.corridor.w === r - l - 1 && prev.corridor.y + prev.corridor.h === y) {
      prev.corridor.h++;
    } else {
      open = { index: specs.length, corridor: { x: l + 1, y, w: r - l - 1, h: 1 } };
      specs.push(open);
    }
  });
  return specs;
}

/**
 * Trap variation between attempts: returns a copy of the level with each listed trap
 * moved to [original, ...alt][attempt % n]. Links pointing at a moved trap follow it.
 * Returns `data` itself when varyTraps is off.
 */
export function applyTrapVariants(data: LevelData, attempt: number): LevelData {
  if (!data.varyTraps || !data.trapVariants?.length) return data;
  const grid = data.grid.map((r) => r.split(''));
  const moved = new Map<string, TilePos>();
  for (const v of data.trapVariants) {
    const choice = attempt % (v.alt.length + 1);
    if (choice === 0) continue;
    const to = v.alt[choice - 1];
    const ch = grid[v.y]?.[v.x];
    if (ch === undefined || grid[to.y]?.[to.x] !== TILE.floor) {
      console.warn(`[${data.id}] trapVariant ${v.x},${v.y} -> ${to.x},${to.y} skipped (target must be '.')`);
      continue;
    }
    grid[to.y][to.x] = ch;
    grid[v.y][v.x] = TILE.floor;
    moved.set(`${v.x},${v.y}`, { x: to.x, y: to.y });
  }
  const follow = (t: { x: number; y: number }) => moved.get(`${t.x},${t.y}`) ?? t;
  return {
    ...data,
    grid: grid.map((r) => r.join('')),
    trapLinks: data.trapLinks?.map((l) => ({ from: follow(l.from), to: l.to.map(follow) })),
  };
}

/** 4-way flood fill of touching tiles. */
function floodGroups(tiles: TilePos[]): TilePos[][] {
  const key = (t: TilePos) => `${t.x},${t.y}`;
  const remaining = new Map(tiles.map((t) => [key(t), t]));
  const groups: TilePos[][] = [];
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
    groups.push(group);
  }
  return groups;
}

/** Touching 'D' tiles form one dragon; each must be a full rectangle of a known footprint. */
function groupDragons(data: LevelData, tiles: TilePos[], wall: boolean[][]): DragonSpawn[] {
  const dragons: DragonSpawn[] = [];
  for (const group of floodGroups(tiles)) {
    const x0 = Math.min(...group.map((t) => t.x));
    const y0 = Math.min(...group.map((t) => t.y));
    const w = Math.max(...group.map((t) => t.x)) - x0 + 1;
    const h = Math.max(...group.map((t) => t.y)) - y0 + 1;
    const orientation = (Object.keys(DRAGON_FOOTPRINTS) as DragonOrientation[]).find(
      (o) => DRAGON_FOOTPRINTS[o].w === w && DRAGON_FOOTPRINTS[o].h === h,
    );
    if (!orientation || group.length !== w * h) {
      const sizes = Object.values(DRAGON_FOOTPRINTS).map((f) => `${f.w}x${f.h}`).join(' or ');
      throw new Error(`[${data.id}] dragon at ${x0},${y0} is not a full ${sizes} rectangle (found ${group.length} tiles in ${w}x${h})`);
    }
    const rect = { x: x0, y: y0, w, h };
    dragons.push({ index: dragons.length, rect, orientation, facing: autoFacing(rect, wall) });
  }

  for (const o of data.dragonOverrides ?? []) {
    const d = dragons.find((dr) => o.x >= dr.rect.x && o.x < dr.rect.x + dr.rect.w && o.y >= dr.rect.y && o.y < dr.rect.y + dr.rect.h);
    if (!d) throw new Error(`[${data.id}] dragonOverride at ${o.x},${o.y} is not on a dragon tile`);
    if (o.facing) d.facing = o.facing;
    if (o.hearing !== undefined) d.hearing = o.hearing;
  }
  return dragons;
}

/** Head points to the side with more open floor (up to 3 tiles out, across the dragon's rows). */
function autoFacing(r: TileRect, wall: boolean[][]): DragonFacing {
  const openCount = (dir: -1 | 1) => {
    let n = 0;
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let i = 1; i <= 3; i++) {
        const x = dir < 0 ? r.x - i : r.x + r.w - 1 + i;
        if (wall[y]?.[x] !== false) break;
        n++;
      }
    }
    return n;
  };
  return openCount(1) >= openCount(-1) ? 'right' : 'left';
}

/** Flood-fills touching spike tiles (4-way) into groups and attaches overrides. */
function groupSpikes(data: LevelData, tiles: TilePos[]): SpikeGroup[] {
  const groups: SpikeGroup[] = floodGroups(tiles).map((group, index) => ({ index, tiles: group }));

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
