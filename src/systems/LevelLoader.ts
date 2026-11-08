import Phaser from 'phaser';
import { TUNING } from '../config';
import type { LevelData } from '../levels/types';
import { parseLevel, type ParsedLevel, type TilePos } from './LevelParser';
import { validateLevel, walkSeconds } from './LevelValidator';
import { SPIKE_LAYOUT } from './TrapTextureFactory';

export { parseLevel, type ParsedLevel } from './LevelParser';

const L = TUNING.level;

export interface BuiltLevel {
  parsed: ParsedLevel;
  widthPx: number;
  heightPx: number;
  playerStart: Phaser.Math.Vector2;
  exitRect: Phaser.Geom.Rectangle;
  walls: Phaser.Physics.Arcade.StaticGroup;
  /** Adds a solid wall body on a tile at runtime (collapsed floor). */
  addWallTile: (tile: TilePos) => void;
}

/** Builds physics walls and the baked floor/wall image for a level. */
export class LevelLoader {
  static build(scene: Phaser.Scene, data: LevelData): BuiltLevel {
    const parsed = parseLevel(data);
    if (import.meta.env.DEV) LevelLoader.check(data, parsed);

    const ts = L.tileSize;
    const widthPx = parsed.cols * ts;
    const heightPx = parsed.rows * ts;

    LevelLoader.drawTiles(scene, data.id, parsed, widthPx, heightPx);

    const walls = scene.physics.add.staticGroup();
    const addRect = (x: number, y: number, w: number, h: number) => {
      walls.add(scene.add.zone((x + w / 2) * ts, (y + h / 2) * ts, w * ts, h * ts));
    };
    for (const r of parsed.wallRects) addRect(r.x, r.y, r.w, r.h);
    // Chests are solid from the start.
    for (const c of parsed.chests) addRect(c.x, c.y, 1, 1);
    // Dragons: one body each, a little smaller than the footprint (round body).
    const inset = TUNING.dragon.bodyInset;
    for (const d of parsed.dragons) {
      const r = d.rect;
      walls.add(scene.add.zone((r.x + r.w / 2) * ts, (r.y + r.h / 2) * ts, r.w * ts - inset * 2, r.h * ts - inset * 2));
    }
    walls.refresh();

    return {
      parsed,
      widthPx,
      heightPx,
      playerStart: new Phaser.Math.Vector2((parsed.start.x + 0.5) * ts, (parsed.start.y + 0.5) * ts),
      exitRect: new Phaser.Geom.Rectangle(parsed.exit.x * ts, parsed.exit.y * ts, parsed.exit.w * ts, parsed.exit.h * ts),
      walls,
      addWallTile: (t) => addRect(t.x, t.y, 1, 1),
    };
  }

  /** Dev-only: path search over the level. Throws on unreachable exit / floor. */
  private static check(data: LevelData, parsed: ParsedLevel): void {
    const T = TUNING.treasure;
    const report = validateLevel(parsed, { coin: T.coin.value, gem: T.gem.value, chest: T.chest.value });
    if (report.errors.length > 0) throw new Error(`[${data.id}] ${report.errors.join('; ')}`);
    const secs = (tiles: number) => walkSeconds(tiles, L.tileSize, TUNING.movement.sneakSpeed).toFixed(0);
    console.info(
      `[${data.id}] ok: shortest path ${report.shortest.length.toFixed(0)} tiles (~${secs(report.shortest.length)}s sneaking), ` +
        `${report.shortestCollapsed.length.toFixed(0)} tiles with every crumbling floor collapsed`,
    );
    const t = report.treasure;
    console.info(`[${data.id}] treasure: ${t.coins} coins, ${t.gems} gems, ${t.chests} chests, max loot ${t.maxLoot}`);
    console.info(`[${data.id}] dragons: ${parsed.dragons.map((d) => `${d.rect.x},${d.rect.y} ${d.facing}`).join(' | ') || 'none'}`);
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

    // Spike plates with holes (the spikes themselves are animated sprites).
    const S = TUNING.traps.spikes;
    for (const group of p.spikeGroups) {
      for (const t of group.tiles) {
        const px = t.x * ts;
        const py = t.y * ts;
        g.fillStyle(S.plateEdgeColor, 1);
        g.fillRect(px + 2, py + 2, ts - 4, ts - 4);
        g.fillStyle(S.plateColor, 1);
        g.fillRect(px + 4, py + 4, ts - 8, ts - 8);
        g.fillStyle(S.holeColor, 1);
        for (const h of SPIKE_LAYOUT) g.fillEllipse(px + h.x * ts, py + h.y * ts - 2, ts * 0.2, ts * 0.1);
      }
    }

    // Pits under crumbling floors; the cracked slab sprite hides them until collapse.
    const C = TUNING.traps.crumble;
    for (const t of p.crumbles) {
      const px = t.x * ts;
      const py = t.y * ts;
      g.fillStyle(C.pitRimColor, 1);
      g.fillRect(px, py, ts, ts);
      g.fillStyle(C.pitColor, 1);
      g.fillRect(px + 4, py + 6, ts - 8, ts - 8);
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
