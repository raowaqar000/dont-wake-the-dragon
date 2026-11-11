import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../../config';
import { ART_SCALE, artKey, hasArt } from '../../systems/ArtAssets';
import type { TilePos } from '../../systems/LevelParser';
import { SPIKE_LAYOUT, TRAP_TEXTURE_SCALE } from '../../systems/TrapTextureFactory';

const P = TUNING.troll.popSpikes;
const S = TUNING.traps.spikes;

export type PopState = 'hidden' | 'warn' | 'up' | 'rearm';

/**
 * Hidden spikes on one tile. Invisible until fired; then they shoot up, hurt for upMs,
 * sink and stay visible as a plate (they are revealed now). Fired again later, they
 * warn first. Used for 'i' tiles and for the ring around fake treasure.
 */
export class PopupSpikes {
  public state: PopState = 'hidden';
  public revealed = false;
  public readonly cx: number;
  public readonly cy: number;
  private readonly root: Phaser.GameObjects.Container;
  private readonly raised: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Visible;
  private readonly plate?: Phaser.GameObjects.Image;
  private stateUntil = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    public readonly tile: TilePos,
  ) {
    const ts = TUNING.level.tileSize;
    this.cx = (tile.x + 0.5) * ts;
    this.cy = (tile.y + 0.5) * ts;
    this.root = scene.add.container(this.cx, this.cy).setDepth(S.depth);

    if (hasArt(scene, 'spikes_up', 'spikes_down')) {
      const sc = ART_SCALE * TUNING.art.spikes.displayScale;
      this.plate = scene.add.image(0, 0, artKey('spikes_down')).setScale(sc).setVisible(false);
      const up = scene.add.image(0, 0, artKey('spikes_up')).setScale(sc);
      this.raised = up;
      this.root.add([this.plate, up]);
    } else {
      const group = scene.add.container(0, 0);
      for (const p of SPIKE_LAYOUT) {
        group.add(
          scene.add
            .image((p.x - 0.5) * ts, (p.y - 0.5) * ts, TEXTURE_KEYS.spikes)
            .setOrigin(0.5, 1)
            .setScale(TRAP_TEXTURE_SCALE),
        );
      }
      this.raised = group;
      this.root.add(group);
    }
    this.raised.setVisible(false);
  }

  get dangerous(): boolean {
    return this.state === 'up';
  }

  /** Pops (hidden: almost at once; revealed: after a short warning). */
  fire(now: number): void {
    if (this.state !== 'hidden') return;
    this.state = 'warn';
    this.stateUntil = now + (this.revealed ? P.revealedWarnMs : P.popDelayMs);
  }

  update(now: number): void {
    if (this.state === 'hidden') return;
    if (this.state === 'warn') {
      if (this.revealed) this.root.x = this.cx + Math.sin(now * 0.09) * S.warnShakePx;
      if (now < this.stateUntil) return;
      this.root.x = this.cx;
      this.state = 'up';
      this.stateUntil = now + P.upMs;
      this.revealed = true;
      this.plate?.setVisible(true);
      this.raised.setVisible(true).setScale(1, 0.2);
      this.scene.tweens.add({ targets: this.raised, scaleY: 1, duration: S.riseMs, ease: 'Back.easeOut' });
      return;
    }
    if (this.state === 'up' && now >= this.stateUntil) {
      this.state = 'rearm';
      this.stateUntil = now + P.rearmMs;
      this.scene.tweens.add({
        targets: this.raised,
        scaleY: 0.1,
        duration: S.lowerMs,
        onComplete: () => this.raised.setVisible(false),
      });
      return;
    }
    if (this.state === 'rearm' && now >= this.stateUntil) this.state = 'hidden';
  }

  /** Circle vs. this tile (shrunk by inset). */
  overlapsCircle(x: number, y: number, r: number, inset: number): boolean {
    const half = TUNING.level.tileSize / 2 - inset;
    const nx = Phaser.Math.Clamp(x, this.cx - half, this.cx + half);
    const ny = Phaser.Math.Clamp(y, this.cy - half, this.cy + half);
    return (x - nx) ** 2 + (y - ny) ** 2 < r * r;
  }
}
