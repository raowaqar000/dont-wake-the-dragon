import type { ParsedLevel, TilePos } from './LevelParser';

/**
 * Pure path search over a parsed level (no Phaser), run at load and from the
 * command line. Movement is 8-way (diagonals only when both side tiles are open,
 * like the real circle body). Walking onto a portal tile puts you on its partner.
 */

export interface PathResult {
  /** Path length in tiles (diagonal = sqrt 2), or Infinity if the exit is unreachable. */
  length: number;
  /** Tiles walked, start to exit (portal jumps show as a gap). */
  path: TilePos[];
}

export interface LevelReport {
  /** Shortest route with every crumble tile intact. */
  shortest: PathResult;
  /** Shortest route with every crumble tile already collapsed (worst case). */
  shortestCollapsed: PathResult;
  /** Floor tiles that can never be reached from the start. */
  unreachable: TilePos[];
  /** Human-readable problems; empty = level is fine. */
  errors: string[];
}

export function validateLevel(p: ParsedLevel): LevelReport {
  const intact = search(p, false);
  const collapsed = search(p, true);

  const unreachable: TilePos[] = [];
  for (let y = 0; y < p.rows; y++) {
    for (let x = 0; x < p.cols; x++) {
      if (!p.wall[y][x] && !intact.reached[y * p.cols + x]) unreachable.push({ x, y });
    }
  }

  const errors: string[] = [];
  if (!Number.isFinite(intact.result.length)) errors.push('exit is not reachable');
  if (!Number.isFinite(collapsed.result.length)) errors.push('exit is not reachable once crumbling floors collapse');
  if (unreachable.length > 0) {
    errors.push(`${unreachable.length} floor tile(s) unreachable: ${unreachable.map((t) => `${t.x},${t.y}`).join(' ')}`);
  }
  return { shortest: intact.result, shortestCollapsed: collapsed.result, unreachable, errors };
}

/** Seconds to walk `tiles` at `speedPx` px/s. */
export function walkSeconds(tiles: number, tileSize: number, speedPx: number): number {
  return (tiles * tileSize) / speedPx;
}

function search(p: ParsedLevel, crumblesCollapsed: boolean): { result: PathResult; reached: boolean[] } {
  const { cols, rows } = p;
  const n = cols * rows;
  const idx = (x: number, y: number) => y * cols + x;

  const blocked = new Array<boolean>(n).fill(false);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) blocked[idx(x, y)] = p.wall[y][x];
  if (crumblesCollapsed) for (const c of p.crumbles) blocked[idx(c.x, c.y)] = true;

  const partner = new Map<number, number>();
  for (const pr of p.portals) {
    partner.set(idx(pr.a.x, pr.a.y), idx(pr.b.x, pr.b.y));
    partner.set(idx(pr.b.x, pr.b.y), idx(pr.a.x, pr.a.y));
  }
  const exits = new Set(p.exitTiles.map((t) => idx(t.x, t.y)));
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < cols && y < rows && !blocked[idx(x, y)];

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
  }

  let best = -1;
  for (const e of exits) if (dist[e] < Infinity && (best < 0 || dist[e] < dist[best])) best = e;
  if (best < 0) return { result: { length: Infinity, path: [] }, reached };

  const path: TilePos[] = [];
  for (let c = best; c >= 0; c = prev[c]) path.push({ x: c % cols, y: Math.floor(c / cols) });
  path.reverse();
  return { result: { length: dist[best], path }, reached };
}
