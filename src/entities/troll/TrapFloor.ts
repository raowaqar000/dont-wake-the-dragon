import Phaser from 'phaser';
import { TUNING } from '../../config';
import { ART_SCALE, artKey, hasArt } from '../../systems/ArtAssets';
import type { TilePos } from '../../systems/LevelParser';

const TF = TUNING.troll.trapFloor;

/** Shows an open pit on a tile, above the baked floor (painted pit art or a flat fallback). */
export function addPitImage(scene: Phaser.Scene, tile: TilePos, depth: number): Phaser.GameObjects.Image | Phaser.GameObjects.Graphics {
  const ts = TUNING.level.tileSize;
  const cx = (tile.x + 0.5) * ts;
  const cy = (tile.y + 0.5) * ts;
  if (hasArt(scene, 'pit')) {
    return scene.add
      .image(cx, cy, artKey('pit'))
      .setScale(ART_SCALE * TUNING.art.pit.displayScale)
      .setDepth(depth);
  }
  const C = TUNING.traps.crumble;
  const g = scene.add.graphics({ x: cx, y: cy }).setDepth(depth);
  g.fillStyle(C.pitRimColor, 1);
  g.fillRect(-ts / 2, -ts / 2, ts, ts);
  g.fillStyle(C.pitColor, 1);
  g.fillRect(-ts / 2 + 4, -ts / 2 + 6, ts - 8, ts - 8);
  return g;
}

/**
 * Floor tile that drops into a pit. Trap floor 't': fires when the player gets close
 * (TrollTrapSystem decides) and drops after dropDelayMs. Moving pit 'M': drops at once.
 * Looks like plain floor until then (the tell is drawn by TrollTrapSystem).
 */
export class TrapFloor {
  public dropped = false;
  private armed = true;
  public readonly cx: number;
  public readonly cy: number;

  constructor(
    private readonly scene: Phaser.Scene,
    public readonly tile: TilePos,
    private readonly onDrop: (floor: TrapFloor) => void,
    private readonly dust: (x: number, y: number, n: number) => void,
  ) {
    const ts = TUNING.level.tileSize;
    this.cx = (tile.x + 0.5) * ts;
    this.cy = (tile.y + 0.5) * ts;
  }

  /** Starts the drop (once). */
  fire(delayMs: number = TF.dropDelayMs): void {
    if (!this.armed) return;
    this.armed = false;
    if (delayMs <= 0) this.drop();
    else this.scene.time.delayedCall(delayMs, () => this.drop());
  }

  private drop(): void {
    this.dropped = true;
    const pit = addPitImage(this.scene, this.tile, TUNING.troll.depth);
    pit.setScale(pit.scaleX * 0.3).setAlpha(0.4);
    const full = pit instanceof Phaser.GameObjects.Image ? ART_SCALE * TUNING.art.pit.displayScale : 1;
    this.scene.tweens.add({ targets: pit, scale: full, alpha: 1, duration: TF.collapseMs, ease: 'Back.easeOut' });
    this.dust(this.cx, this.cy, TF.dust);
    this.onDrop(this);
  }
}
