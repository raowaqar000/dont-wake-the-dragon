import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import type { SpikeGroup, TilePos } from '../systems/LevelParser';
import { SPIKE_LAYOUT, TRAP_TEXTURE_SCALE } from '../systems/TrapTextureFactory';

const S = TUNING.traps.spikes;

export type SpikeState = 'down' | 'warn' | 'rising' | 'up' | 'lowering';

/**
 * One group of touching spike tiles that move together on a timer:
 *   down (downMs, last warnMs shakes) -> rising -> up (hurts) -> lowering -> down.
 * The hole plates are baked into the level texture; this draws the spikes.
 */
export class SpikeTrap {
  public state: SpikeState = 'down';
  public readonly tiles: TilePos[];

  private readonly downMs: number;
  private readonly upMs: number;
  private readonly offsetMs: number;
  private readonly spikes: { img: Phaser.GameObjects.Image; baseX: number }[] = [];

  constructor(scene: Phaser.Scene, group: SpikeGroup) {
    const ts = TUNING.level.tileSize;
    this.tiles = group.tiles;
    this.downMs = group.override?.downMs ?? S.downMs;
    this.upMs = group.override?.upMs ?? S.upMs;
    this.offsetMs = group.override?.offsetMs ?? group.index * S.groupOffsetMs;

    for (const t of group.tiles) {
      for (const p of SPIKE_LAYOUT) {
        const baseX = (t.x + p.x) * ts;
        const img = scene.add
          .image(baseX, (t.y + p.y) * ts, TEXTURE_KEYS.spikes)
          .setOrigin(0.5, 1)
          .setScale(TRAP_TEXTURE_SCALE, 0)
          .setVisible(false)
          // Front row draws over the back row.
          .setDepth(S.depth + p.y * 0.01);
        this.spikes.push({ img, baseX });
      }
    }
  }

  /** True only while the spikes are fully up. */
  get dangerous(): boolean {
    return this.state === 'up';
  }

  update(now: number): void {
    const cycle = this.downMs + this.upMs;
    const phase = (((now + this.offsetMs) % cycle) + cycle) % cycle;

    let height = 0;
    if (phase < this.downMs) {
      const warn = phase >= this.downMs - S.warnMs;
      this.state = warn ? 'warn' : 'down';
      height = warn ? S.warnPeek : 0;
    } else {
      const t = phase - this.downMs;
      if (t < S.riseMs) {
        this.state = 'rising';
        height = t / S.riseMs;
      } else if (t > this.upMs - S.lowerMs) {
        this.state = 'lowering';
        height = (this.upMs - t) / S.lowerMs;
      } else {
        this.state = 'up';
        height = 1;
      }
    }

    const shake = this.state === 'warn' ? Math.sin(now * 0.09) * S.warnShakePx : 0;
    for (const s of this.spikes) {
      s.img.setVisible(height > 0);
      s.img.scaleY = TRAP_TEXTURE_SCALE * height;
      s.img.x = s.baseX + shake;
    }
  }

  /** Circle (cx, cy, r) vs. any tile of this group, each tile shrunk by `inset`. */
  overlapsCircle(cx: number, cy: number, r: number, inset: number): boolean {
    const ts = TUNING.level.tileSize;
    for (const t of this.tiles) {
      const x0 = t.x * ts + inset;
      const y0 = t.y * ts + inset;
      const x1 = (t.x + 1) * ts - inset;
      const y1 = (t.y + 1) * ts - inset;
      const nx = Phaser.Math.Clamp(cx, x0, x1);
      const ny = Phaser.Math.Clamp(cy, y0, y1);
      if ((cx - nx) ** 2 + (cy - ny) ** 2 < r * r) return true;
    }
    return false;
  }
}
