import type { TilePos } from './LevelParser';

/**
 * Which tiles are open pits right now: '-' gaps from the start, plus crumbling floors,
 * trap floors and moving pits once they drop. Pits have no physics body: walking over
 * one (body center inside the tile) means falling in, jumping over one is safe.
 * Plain arrays, no allocations per query.
 */
export class PitMap {
  private readonly pit: Uint8Array;

  constructor(
    private readonly cols: number,
    private readonly rows: number,
    private readonly tileSize: number,
    initial: readonly TilePos[],
  ) {
    this.pit = new Uint8Array(cols * rows);
    for (const t of initial) this.set(t.x, t.y);
  }

  set(tx: number, ty: number): void {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return;
    this.pit[ty * this.cols + tx] = 1;
  }

  isPit(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return false;
    return this.pit[ty * this.cols + tx] === 1;
  }

  /**
   * Pit tile under (x, y) if the point is inside it shrunk by `inset` px, else -1.
   * Returns the tile index (y * cols + x).
   */
  pitAt(x: number, y: number, inset: number): number {
    const ts = this.tileSize;
    const tx = Math.floor(x / ts);
    const ty = Math.floor(y / ts);
    if (!this.isPit(tx, ty)) return -1;
    const lx = x - tx * ts;
    const ly = y - ty * ts;
    if (lx < inset || ly < inset || lx > ts - inset || ly > ts - inset) return -1;
    return ty * this.cols + tx;
  }

  /** Tile index -> tile center in world px (written into `out`). */
  centerOf(index: number, out: { x: number; y: number }): void {
    const ts = this.tileSize;
    out.x = ((index % this.cols) + 0.5) * ts;
    out.y = (Math.floor(index / this.cols) + 0.5) * ts;
  }
}
