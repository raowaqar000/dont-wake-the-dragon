import Phaser from 'phaser';
import { TUNING } from '../config';
import { RESERVED_TILES, TILE, type LevelData } from '../levels/types';

const L = TUNING.level;

/** Pure grid parse result, in tile units. No Phaser objects. */
export interface ParsedLevel {
  cols: number;
  rows: number;
  /** wall[y][x] */
  wall: boolean[][];
  start: { x: number; y: number };
  /** Bounding box of all 'E' tiles (tile units). */
  exit: { x: number; y: number; w: number; h: number };
  /** Merged wall rectangles (tile units). */
  wallRects: { x: number; y: number; w: number; h: number }[];
}

export interface BuiltLevel {
  widthPx: number;
  heightPx: number;
  playerStart: Phaser.Math.Vector2;
  exitRect: Phaser.Geom.Rectangle;
  walls: Phaser.Physics.Arcade.StaticGroup;
}

const KNOWN = new Set<string>([...Object.values(TILE), ...Object.values(RESERVED_TILES)]);
const RESERVED = new Set<string>(Object.values(RESERVED_TILES));

export function parseLevel(data: LevelData): ParsedLevel {
  const grid = data.grid;
  const rows = grid.length;
  if (rows === 0) throw new Error(`[${data.id}] grid is empty`);
  const cols = grid[0].length;

  const wall: boolean[][] = [];
  const starts: { x: number; y: number }[] = [];
  let ex0 = Infinity, ey0 = Infinity, ex1 = -Infinity, ey1 = -Infinity;
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
      if (ch === TILE.exit) {
        ex0 = Math.min(ex0, x);
        ey0 = Math.min(ey0, y);
        ex1 = Math.max(ex1, x);
        ey1 = Math.max(ey1, y);
      }
    }
    wall.push(line);
  });

  if (starts.length !== 1) throw new Error(`[${data.id}] needs exactly one '${TILE.playerStart}', found ${starts.length}`);
  if (ex1 < 0) throw new Error(`[${data.id}] needs at least one '${TILE.exit}'`);

  return {
    cols,
    rows,
    wall,
    start: starts[0],
    exit: { x: ex0, y: ey0, w: ex1 - ex0 + 1, h: ey1 - ey0 + 1 },
    wallRects: mergeWalls(wall),
  };
}

/**
 * Merges wall tiles into few rectangles: horizontal runs per row, then
 * identical runs in consecutive rows stack into one taller rectangle.
 * Fewer bodies = cheaper physics and fewer internal seams to snag on.
 */
function mergeWalls(wall: boolean[][]): ParsedLevel['wallRects'] {
  const done: ParsedLevel['wallRects'] = [];
  let open = new Map<string, ParsedLevel['wallRects'][number]>();

  wall.forEach((line, y) => {
    const next = new Map<string, ParsedLevel['wallRects'][number]>();
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

/** Builds physics walls and the baked floor/wall image for a level. */
export class LevelLoader {
  static build(scene: Phaser.Scene, data: LevelData): BuiltLevel {
    const parsed = parseLevel(data);
    const ts = L.tileSize;
    const widthPx = parsed.cols * ts;
    const heightPx = parsed.rows * ts;

    LevelLoader.drawTiles(scene, data.id, parsed, widthPx, heightPx);

    const walls = scene.physics.add.staticGroup();
    for (const r of parsed.wallRects) {
      const zone = scene.add.zone((r.x + r.w / 2) * ts, (r.y + r.h / 2) * ts, r.w * ts, r.h * ts);
      walls.add(zone);
    }
    walls.refresh();

    return {
      widthPx,
      heightPx,
      playerStart: new Phaser.Math.Vector2((parsed.start.x + 0.5) * ts, (parsed.start.y + 0.5) * ts),
      exitRect: new Phaser.Geom.Rectangle(parsed.exit.x * ts, parsed.exit.y * ts, parsed.exit.w * ts, parsed.exit.h * ts),
      walls,
    };
  }

  /** Draws every tile once into a single RenderTexture (one draw call per frame). */
  private static drawTiles(scene: Phaser.Scene, seed: string, p: ParsedLevel, w: number, h: number): void {
    const ts = L.tileSize;
    const rng = new Phaser.Math.RandomDataGenerator([seed]);
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    const floor = Phaser.Display.Color.IntegerToColor(L.floorColor);
    const rock = Phaser.Display.Color.IntegerToColor(L.wallColor);

    for (let y = 0; y < p.rows; y++) {
      for (let x = 0; x < p.cols; x++) {
        const px = x * ts;
        const py = y * ts;
        if (!p.wall[y][x]) {
          g.fillStyle(shade(floor, rng.realInRange(-L.floorShadeVariation, L.floorShadeVariation)), 1);
          g.fillRect(px, py, ts, ts);
          // A few pebbles for texture.
          g.fillStyle(shade(floor, -0.25), 1);
          for (let i = 0; i < 2; i++) {
            g.fillRect(px + rng.between(4, ts - 8), py + rng.between(4, ts - 8), rng.between(2, 4), rng.between(2, 3));
          }
          // Soft shadow cast by a wall directly above.
          if (y > 0 && p.wall[y - 1][x]) {
            g.fillStyle(0x000000, 0.25);
            g.fillRect(px, py, ts, L.wallEdgeHeight);
          }
          continue;
        }

        g.fillStyle(shade(rock, rng.realInRange(-L.wallShadeVariation, L.wallShadeVariation)), 1);
        g.fillRect(px, py, ts, ts);
        // Rocky speckles.
        g.fillStyle(shade(rock, 0.35), 1);
        for (let i = 0; i < 3; i++) {
          g.fillRect(px + rng.between(2, ts - 8), py + rng.between(2, ts - 8), rng.between(3, 6), rng.between(2, 4));
        }
        // Lighter top edge where the wall meets open floor above it.
        if (y > 0 && !p.wall[y - 1][x]) {
          g.fillStyle(L.wallEdgeColor, 1);
          g.fillRect(px, py, ts, L.wallEdgeHeight);
        }
      }
    }

    const rt = scene.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setDepth(L.depth);
    rt.draw(g);
    g.destroy();
  }
}

function shade(base: Phaser.Display.Color, amount: number): number {
  const f = 1 + amount;
  const c = (v: number) => Phaser.Math.Clamp(Math.round(v * f), 0, 255);
  return Phaser.Display.Color.GetColor(c(base.red), c(base.green), c(base.blue));
}
