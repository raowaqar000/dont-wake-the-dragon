import type { ParsedLevel, TilePos } from './LevelParser';

/**
 * Pure path search over a parsed level (no Phaser), run at load and from the
 * command line. Movement is 8-way (diagonals only when both side tiles are open,
 * like the real circle body). Walking onto a portal tile puts you on its partner.
 * Chests and dragons are solid; a chest counts as reachable when a tile beside it (4-way) is.
 */

export interface PathResult {
  /** Path length in tiles (diagonal = sqrt 2), or Infinity if the exit is unreachable. */
  length: number;
  /** Tiles walked, start to exit (portal jumps show as a gap). */
  path: TilePos[];
}

/** Treasure counts; maxLoot only when values were passed to validateLevel. */
export interface TreasureTotals {
  coins: number;
  gems: number;
  chests: number;
  maxLoot: number;
}

export interface TreasureValues {
  coin: number;
  gem: number;
  chest: number;
}

export interface LevelReport {
  /** Shortest route with every crumble tile intact. */
  shortest: PathResult;
  /** Shortest route with every crumble tile already collapsed (worst case). */
  shortestCollapsed: PathResult;
  /** Floor tiles that can never be reached from the start. */
  unreachable: TilePos[];
  /** Treasure that can never be collected. */
  unreachableTreasure: TilePos[];
  treasure: TreasureTotals;
  /** Human-readable problems; empty = level is fine. */
  errors: string[];
}

export interface ValidateOptions {
  /** Widest pit run (tiles) a jump clears. 0 = no jumping. */
  maxJumpTiles?: number;
}

export function validateLevel(p: ParsedLevel, values?: TreasureValues, opts: ValidateOptions = {}): LevelReport {
  const maxJump = opts.maxJumpTiles ?? 0;
  const intact = search(p, false, maxJump);
  const collapsed = search(p, true, maxJump);
  const at = (x: number, y: number) => y * p.cols + x;
  const chestSet = new Set(p.chests.map((c) => at(c.x, c.y)));
  const dragonSet = new Set(dragonTiles(p).map((t) => at(t.x, t.y)));
  const gapSet = new Set(p.gaps.map((g) => at(g.x, g.y)));

  const unreachable: TilePos[] = [];
  for (let y = 0; y < p.rows; y++) {
    for (let x = 0; x < p.cols; x++) {
      const i = at(x, y);
      if (!p.wall[y][x] && !chestSet.has(i) && !dragonSet.has(i) && !gapSet.has(i) && !intact.reached[i]) unreachable.push({ x, y });
    }
  }

  const unreachableTreasure: TilePos[] = [...p.coins, ...p.gems].filter((t) => !intact.reached[at(t.x, t.y)]);
  for (const c of p.chests) {
    const side = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => {
      const x = c.x + dx;
      const y = c.y + dy;
      return x >= 0 && y >= 0 && x < p.cols && y < p.rows && intact.reached[at(x, y)] && !chestSet.has(at(x, y));
    });
    if (!side) unreachableTreasure.push(c);
  }

  const treasure: TreasureTotals = {
    coins: p.coins.length,
    gems: p.gems.length,
    chests: p.chests.length,
    maxLoot: values ? p.coins.length * values.coin + p.gems.length * values.gem + p.chests.length * values.chest : 0,
  };

  const errors: string[] = [];
  if (!Number.isFinite(intact.result.length)) errors.push('exit is not reachable');
  if (!Number.isFinite(collapsed.result.length)) {
    errors.push('exit is not reachable once crumbling / trap floors and moving pits drop');
  }
  // Runaway exit: the decoy door must be reachable too (you have to get near it).
  if (p.realExit && !p.exitTiles.some((t) => intact.reached[at(t.x, t.y)])) errors.push("runaway exit: the decoy 'E' is not reachable");
  // Moving pits: the gap after widening must still be jumpable.
  for (const m of p.movingPits) {
    const w = widenedGap(p, m);
    if (w === 0) errors.push(`moving pit ${m.x},${m.y} is not next to a gap`);
    else if (w > maxJump) errors.push(`moving pit ${m.x},${m.y} widens the gap to ${w} tiles (max jump ${maxJump})`);
  }
  if (unreachable.length > 0) {
    errors.push(`${unreachable.length} floor tile(s) unreachable: ${unreachable.map((t) => `${t.x},${t.y}`).join(' ')}`);
  }
  if (unreachableTreasure.length > 0) {
    errors.push(`${unreachableTreasure.length} treasure(s) unreachable: ${unreachableTreasure.map((t) => `${t.x},${t.y}`).join(' ')}`);
  }
  return {
    shortest: intact.result,
    shortestCollapsed: collapsed.result,
    unreachable,
    unreachableTreasure,
    treasure,
    errors,
  };
}

/** Every tile covered by a dragon (dragons are solid). */
function dragonTiles(p: ParsedLevel): TilePos[] {
  const tiles: TilePos[] = [];
  for (const d of p.dragons) {
    for (let y = d.rect.y; y < d.rect.y + d.rect.h; y++) {
      for (let x = d.rect.x; x < d.rect.x + d.rect.w; x++) tiles.push({ x, y });
    }
  }
  return tiles;
}

/** Seconds to walk `tiles` at `speedPx` px/s. */
export function walkSeconds(tiles: number, tileSize: number, speedPx: number): number {
  return (tiles * tileSize) / speedPx;
}

/**
 * Widest pit run through a moving pit once it drops: for each direction where a
 * neighbour is a gap, count the gap tiles in that line plus the moving pit itself.
 * 0 = no gap next to it.
 */
function widenedGap(p: ParsedLevel, m: TilePos): number {
  const gap = new Set(p.gaps.map((g) => `${g.x},${g.y}`));
  let best = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let n = 0;
    while (gap.has(`${m.x + dx * (n + 1)},${m.y + dy * (n + 1)}`)) n++;
    if (n > 0) best = Math.max(best, n + 1);
  }
  return best;
}

/**
 * Dijkstra over walkable tiles. Pits can't be stood on, but a straight 4-way jump over
 * 1..maxJump pit tiles onto walkable ground is an edge (cost = tiles travelled).
 * worstCase: crumbling floors, trap floors and moving pits are already pits.
 * Target: the real exit ('e') if the level has a runaway exit, else the 'E' tiles.
 */
function search(p: ParsedLevel, worstCase: boolean, maxJump: number): { result: PathResult; reached: boolean[] } {
  const { cols, rows } = p;
  const n = cols * rows;
  const idx = (x: number, y: number) => y * cols + x;

  const blocked = new Array<boolean>(n).fill(false);
  const pit = new Array<boolean>(n).fill(false);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) blocked[idx(x, y)] = p.wall[y][x];
  for (const g of p.gaps) pit[idx(g.x, g.y)] = true;
  if (worstCase) for (const c of [...p.crumbles, ...p.trapFloors, ...p.movingPits]) pit[idx(c.x, c.y)] = true;
  for (const c of p.chests) blocked[idx(c.x, c.y)] = true;
  for (const t of dragonTiles(p)) blocked[idx(t.x, t.y)] = true;

  const partner = new Map<number, number>();
  for (const pr of p.portals) {
    partner.set(idx(pr.a.x, pr.a.y), idx(pr.b.x, pr.b.y));
    partner.set(idx(pr.b.x, pr.b.y), idx(pr.a.x, pr.a.y));
  }
  const exits = new Set((p.realExit ? p.realExitTiles : p.exitTiles).map((t) => idx(t.x, t.y)));
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows;
  const open = (x: number, y: number) => inside(x, y) && !blocked[idx(x, y)] && !pit[idx(x, y)];

  const dist = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  const reached = new Array<boolean>(n).fill(false);
  const start = idx(p.start.x, p.start.y);
  dist[start] = 0;
  reached[start] = true;

  // Grids are small (~1500 tiles), so a linear-scan Dijkstra is plenty.
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0) break;
    done[u] = true;
    const ux = u % cols;
    const uy = Math.floor(u / cols);

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const vx = ux + dx;
        const vy = uy + dy;
        if (!open(vx, vy)) continue;
        if (dx !== 0 && dy !== 0 && (!open(ux + dx, uy) || !open(ux, uy + dy))) continue;
        let v = idx(vx, vy);
        reached[v] = true;
        const step = dx !== 0 && dy !== 0 ? Math.SQRT2 : 1;
        // Stepping onto a portal moves you to its partner for free.
        const jump = partner.get(v);
        if (jump !== undefined) {
          reached[jump] = true;
          v = jump;
        }
        if (dist[u] + step < dist[v]) {
          dist[v] = dist[u] + step;
          prev[v] = u;
        }
      }
    }

    // Jumps: straight over 1..maxJump pit tiles, landing on walkable ground.
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let k = 1;
      while (k <= maxJump && inside(ux + dx * k, uy + dy * k) && pit[idx(ux + dx * k, uy + dy * k)]) k++;
      if (k === 1 || k > maxJump + 1) continue; // no pit right ahead, or too wide
      const lx = ux + dx * k;
      const ly = uy + dy * k;
      if (!open(lx, ly)) continue;
      const v = idx(lx, ly);
      reached[v] = true;
      if (dist[u] + k < dist[v]) {
        dist[v] = dist[u] + k;
        prev[v] = u;
      }
    }
  }

  let best = -1;
  for (const e of exits) if (dist[e] < Infinity && (best < 0 || dist[e] < dist[best])) best = e;
  if (best < 0) return { result: { length: Infinity, path: [] }, reached };

  const path: TilePos[] = [];
  for (let c = best; c >= 0; c = prev[c]) path.push({ x: c % cols, y: Math.floor(c / cols) });
  path.reverse();
  return { result: { length: dist[best], path }, reached };
}
