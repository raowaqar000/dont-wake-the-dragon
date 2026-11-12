import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../../config';
import { TROLL_TEXTURE_SCALE } from '../../systems/TrollTextureFactory';
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

  /** False once fired (shaking or dropped). */
  get isArmed(): boolean {
    return this.armed;
  }

  /** Starts the drop (once). With a delay, the tile shakes first (the tell before it goes). */
  fire(delayMs: number = TF.dropDelayMs): void {
    if (!this.armed) return;
    this.armed = false;
    if (delayMs <= 0) {
      this.drop();
      return;
    }
    const patch = this.addShakePatch();
    this.dust(this.cx, this.cy, TF.shakeDust);
    const shake = this.scene.tweens.add({
      targets: patch,
      x: { from: this.cx - TF.shakePx, to: this.cx + TF.shakePx },
      duration: 45,
      yoyo: true,
      repeat: -1,
    });
    this.scene.time.delayedCall(delayMs, () => {
      shake.stop();
      patch.destroy();
      this.drop();
    });
  }

  /** A floor-colored patch with the crack over this tile, so the shake reads as the floor moving. */
  private addShakePatch(): Phaser.GameObjects.Container {
    const ts = TUNING.level.tileSize;
    const sc = this.scene;
    const parts: Phaser.GameObjects.GameObject[] = [];
    if (hasArt(sc, 'floor_tile')) {
      const A = TUNING.art.level;
      const scale = ART_SCALE * A.floorScale;
      parts.push(
        sc.add
          .tileSprite(0, 0, ts - 2, ts - 2, artKey('floor_tile'))
          .setTileScale(scale)
          .setTilePosition((this.cx - ts / 2) / scale, (this.cy - ts / 2) / scale)
          .setTint(A.floorTint),
      );
    } else {
      parts.push(sc.add.rectangle(0, 0, ts - 2, ts - 2, TUNING.level.floorColor));
    }
    const crack = sc.add.graphics();
    crack.lineStyle(2, TF.crackColor, Math.min(1, TF.crackAlpha + 0.25));
    crack.lineBetween(-ts * 0.25, -ts * 0.1, 0, ts * 0.04);
    crack.lineBetween(0, ts * 0.04, ts * 0.22, ts * 0.12);
    parts.push(crack);
    return sc.add.container(this.cx, this.cy, parts).setDepth(TUNING.troll.depth + 0.05);
  }

  private drop(): void {
    this.dropped = true;
    const pit = addPitImage(this.scene, this.tile, TUNING.troll.depth);
    pit.setScale(pit.scaleX * 0.3).setAlpha(0.4);
    const full = pit instanceof Phaser.GameObjects.Image ? ART_SCALE * TUNING.art.pit.displayScale : 1;
    this.scene.tweens.add({ targets: pit, scale: full, alpha: 1, duration: TF.collapseMs, ease: 'Back.easeOut' });
    // Same hole overlay as the baked pits (dark center, light far rim).
    const hole = this.scene.add
      .image(this.cx, this.cy, TEXTURE_KEYS.pitOverlay)
      .setScale(TROLL_TEXTURE_SCALE * 0.3)
      .setAlpha(0)
      .setDepth(TUNING.troll.depth + 0.01);
    this.scene.tweens.add({ targets: hole, scale: TROLL_TEXTURE_SCALE, alpha: 1, duration: TF.collapseMs, ease: 'Back.easeOut' });
    this.dust(this.cx, this.cy, TF.dust);
    this.onDrop(this);
  }
}
