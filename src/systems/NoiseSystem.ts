import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import { NOISE_RING_TEXTURE_RADIUS } from './DragonTextureFactory';

const N = TUNING.noise;
const R = N.ring;

/** Where a noise came from. Later: noisy floors ('floor'), thrown objects ('throw'). */
export type NoiseSource = 'footstep' | 'chest' | 'portal' | 'floor' | 'throw' | 'land' | 'trap';

/** Anything that can hear noise (dragons now, maybe guards later). */
export interface NoiseListener {
  /** Hearing multiplier (1 = normal). */
  readonly hearing: number;
  /** False when it should ignore noise (already awake, run over...). */
  canHear(): boolean;
  /** Writes the point of the listener's body nearest to (x, y) into `out` (world px). */
  nearestPoint(x: number, y: number, out: Phaser.Math.Vector2): void;
  /** Called with the meter points this noise is worth after falloff and walls. */
  hear(amount: number, source: NoiseSource): void;
}

/**
 * One entry point for every sound in the cave: emitNoise(x, y, loudness, source).
 * A noise carries loudness * rangePerLoudness px. Listeners inside that range get
 * points with distance falloff; a wall on the straight line between them dampens it
 * (cheap grid DDA over the level's original walls; collapsed pits let sound through).
 * Each noise also shows a fading ring that grows to exactly its carry range.
 */
export class NoiseSystem {
  private readonly listeners: NoiseListener[] = [];
  private readonly rings: Phaser.GameObjects.Image[] = [];
  private nextRing = 0;
  private readonly near = new Phaser.Math.Vector2();
  private readonly ts = TUNING.level.tileSize;
  private lastLine = 'noise: -';

  constructor(
    private readonly scene: Phaser.Scene,
    /** wall[y][x] from the parsed level (static walls only). */
    private readonly wall: boolean[][],
  ) {
    for (let i = 0; i < R.pool; i++) {
      this.rings.push(scene.add.image(0, 0, TEXTURE_KEYS.noiseRing).setDepth(R.depth).setVisible(false));
    }
  }

  addListener(listener: NoiseListener): void {
    this.listeners.push(listener);
  }

  get debugLine(): string {
    return this.lastLine;
  }

  /** Carry range in px for a loudness. */
  static rangeFor(loudness: number): number {
    return loudness * N.rangePerLoudness;
  }

  /**
   * Makes a noise at (x, y). Every listener in range hears it.
   * @param loudness 1 = a running footstep
   */
  emitNoise(x: number, y: number, loudness: number, source: NoiseSource): void {
    if (loudness <= 0) return;
    const range = NoiseSystem.rangeFor(loudness);
    this.showRing(x, y, range * R.scale, R.colors[source]);

    let best = 0;
    for (const l of this.listeners) {
      if (!l.canHear()) continue;
      l.nearestPoint(x, y, this.near);
      const d = Phaser.Math.Distance.Between(x, y, this.near.x, this.near.y);
      if (d >= range) continue;
      let amount = loudness * N.meterPerLoudness * Math.pow(1 - d / range, N.falloffExponent) * l.hearing;
      if (this.wallBetween(x, y, this.near.x, this.near.y)) amount *= N.wallDampening;
      l.hear(amount, source);
      if (amount > best) best = amount;
    }
    this.lastLine = `noise: ${source} ${loudness.toFixed(2)} -> +${best.toFixed(1)}`;
  }

  /** A ring with no hearing attached (e.g. the dragon's roar). */
  showRing(x: number, y: number, radius: number, color: number): void {
    if (radius < R.minRadius) return;
    // Reuse the oldest ring when all are busy.
    const ring = this.rings[this.nextRing];
    this.nextRing = (this.nextRing + 1) % this.rings.length;
    this.scene.tweens.killTweensOf(ring);

    const toScale = (r: number) => r / NOISE_RING_TEXTURE_RADIUS;
    ring
      .setPosition(x, y)
      .setTint(color)
      .setScale(toScale(R.startRadius))
      .setAlpha(R.alpha)
      .setVisible(true);
    const ms = R.baseMs + radius * R.msPerPx;
    this.scene.tweens.add({ targets: ring, scale: toScale(radius), duration: ms, ease: 'Cubic.easeOut' });
    this.scene.tweens.add({
      targets: ring,
      alpha: 0,
      duration: ms,
      ease: 'Quad.easeIn',
      onComplete: () => ring.setVisible(false),
    });
  }

  /**
   * True if a wall tile lies on the line between two points (Amanatides-Woo grid walk).
   * The start and end tiles themselves don't count. No allocations.
   */
  private wallBetween(x0: number, y0: number, x1: number, y1: number): boolean {
    const ts = this.ts;
    let tx = Math.floor(x0 / ts);
    let ty = Math.floor(y0 / ts);
    const ex = Math.floor(x1 / ts);
    const ey = Math.floor(y1 / ts);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const stepX = dx > 0 ? 1 : -1;
    const stepY = dy > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(ts / dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(ts / dy) : Infinity;
    let tMaxX = dx !== 0 ? (dx > 0 ? (tx + 1) * ts - x0 : x0 - tx * ts) / Math.abs(dx) : Infinity;
    let tMaxY = dy !== 0 ? (dy > 0 ? (ty + 1) * ts - y0 : y0 - ty * ts) / Math.abs(dy) : Infinity;

    // One step per tile crossed; the guard stops float edge cases from looping.
    for (let guard = 0; guard < 256; guard++) {
      if (tx === ex && ty === ey) return false;
      if (tMaxX > 1 && tMaxY > 1) return false; // the segment ends in this tile
      if (tMaxX < tMaxY) {
        tx += stepX;
        tMaxX += tDeltaX;
      } else {
        ty += stepY;
        tMaxY += tDeltaY;
      }
      if (tx === ex && ty === ey) return false;
      if (this.wall[ty]?.[tx] !== false) return true;
    }
    return false;
  }
}
