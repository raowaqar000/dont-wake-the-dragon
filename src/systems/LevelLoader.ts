import Phaser from 'phaser';
import { TUNING } from '../config';
import type { LevelData } from '../levels/types';
import { parseLevel, type ParsedLevel } from './LevelParser';
import { validateLevel, walkSeconds } from './LevelValidator';
import { SpikeTrap } from '../entities/SpikeTrap';
import { ART_SCALE, artKey, hasArt } from './ArtAssets';
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
  /** Real exit rect (runaway exit) or null. */
  realExitRect: Phaser.Geom.Rectangle | null;
}

/** Builds physics walls and the baked floor/wall image for a level (painted tiles, or flat colors as a fallback). */
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
      realExitRect: parsed.realExit
        ? new Phaser.Geom.Rectangle(parsed.realExit.x * ts, parsed.realExit.y * ts, parsed.realExit.w * ts, parsed.realExit.h * ts)
        : null,
    };
  }

  /** Dev-only: path search over the level. Throws on unreachable exit / floor. */
  private static check(data: LevelData, parsed: ParsedLevel): void {
    const T = TUNING.treasure;
    const report = validateLevel(
      parsed,
      { coin: T.coin.value, gem: T.gem.value, chest: T.chest.value },
      { maxJumpTiles: TUNING.jump.maxJumpTiles },
    );
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

  /**
   * Draws every tile once into a single RenderTexture (one draw call per frame).
   * Painted art: tiled floor and wall textures, then soft edges. Fallback: flat colored tiles.
   */
  private static drawTiles(scene: Phaser.Scene, seed: string, p: ParsedLevel, w: number, h: number): void {
    const ts = L.tileSize;
    const rt = scene.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setDepth(L.depth);
    const g = scene.make.graphics({ x: 0, y: 0 }, false);

    if (hasArt(scene, 'floor_tile', 'wall_tile')) LevelLoader.drawArtTiles(scene, rt, g, p, w, h);
    else LevelLoader.drawFlatTiles(g, seed, p);

    // Spike plates with holes (the spikes themselves are animated sprites). Painted spikes bring their own plate.
    if (!SpikeTrap.usesArt(scene)) {
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
          for (const hole of SPIKE_LAYOUT) g.fillEllipse(px + hole.x * ts, py + hole.y * ts - 2, ts * 0.2, ts * 0.1);
        }
      }
    }

    // Pits under crumbling floors; the cracked slab sprite hides them until collapse.
    const pitArt = hasArt(scene, 'pit');
    if (!pitArt) {
      const C = TUNING.traps.crumble;
      for (const t of [...p.crumbles, ...p.gaps]) {
        const px = t.x * ts;
        const py = t.y * ts;
        g.fillStyle(C.pitRimColor, 1);
        g.fillRect(px, py, ts, ts);
        g.fillStyle(C.pitColor, 1);
        g.fillRect(px + 4, py + 6, ts - 8, ts - 8);
      }
    }

    rt.draw(g);
    g.destroy();

    if (pitArt) {
      const scale = ART_SCALE * TUNING.art.pit.displayScale;
      for (const t of [...p.crumbles, ...p.gaps]) rt.stamp(artKey('pit'), undefined, (t.x + 0.5) * ts, (t.y + 0.5) * ts, { scale });
    }
  }

  /** Painted floor + walls (tiled textures), then the wall top edge, floor shadow and outline into `g`. */
  private static drawArtTiles(
    scene: Phaser.Scene,
    rt: Phaser.GameObjects.RenderTexture,
    g: Phaser.GameObjects.Graphics,
    p: ParsedLevel,
    w: number,
    h: number,
  ): void {
    const ts = L.tileSize;
    const A = TUNING.art.level;

    const floor = scene.make.tileSprite({ x: 0, y: 0, width: w, height: h, key: artKey('floor_tile') }, false);
    floor.setOrigin(0, 0).setTileScale(ART_SCALE * A.floorScale).setTint(A.floorTint);
    rt.draw(floor);
    floor.destroy();

    // Walls: tile the rock over the whole level on a scratch texture, cut out the floor, copy over.
    const walls = scene.make.renderTexture({ x: 0, y: 0, width: w, height: h }, false);
    const rock = scene.make.tileSprite({ x: 0, y: 0, width: w, height: h, key: artKey('wall_tile') }, false);
    rock.setOrigin(0, 0).setTileScale(ART_SCALE * A.wallScale).setTint(A.wallTint);
    walls.draw(rock);
    rock.destroy();
    const holes = scene.make.graphics({ x: 0, y: 0 }, false);
    holes.fillStyle(0xffffff, 1);
    for (let y = 0; y < p.rows; y++) {
      for (let x = 0; x < p.cols; x++) if (!p.wall[y][x]) holes.fillRect(x * ts, y * ts, ts, ts);
    }
    walls.erase(holes);
    holes.destroy();
    rt.draw(walls);
    walls.destroy();

    const isWall = (x: number, y: number) => y < 0 || x < 0 || y >= p.rows || x >= p.cols || p.wall[y][x];
    const o = A.outlineWidth;
    for (let y = 0; y < p.rows; y++) {
      for (let x = 0; x < p.cols; x++) {
        const px = x * ts;
        const py = y * ts;
        if (p.wall[y][x]) {
          // Lighter top edge where the wall meets open floor above it.
          if (A.wallEdge && y > 0 && !p.wall[y - 1][x]) {
            g.fillStyle(L.wallEdgeColor, A.wallEdgeAlpha);
            g.fillRect(px, py, ts, L.wallEdgeHeight);
          }
          continue;
        }
        // Soft shadow cast by a wall directly above.
        if (A.floorShadow && isWall(x, y - 1)) {
          g.fillStyle(0x000000, A.floorShadowAlpha);
          g.fillRect(px, py, ts, L.wallEdgeHeight);
        }
        // Dark line where floor meets wall.
        if (o > 0) {
          g.fillStyle(A.outlineColor, A.outlineAlpha);
          if (isWall(x, y - 1)) g.fillRect(px, py, ts, o);
          if (isWall(x, y + 1)) g.fillRect(px, py + ts - o, ts, o);
          if (isWall(x - 1, y)) g.fillRect(px, py, o, ts);
          if (isWall(x + 1, y)) g.fillRect(px + ts - o, py, o, ts);
        }
      }
    }
  }

  /** Code-drawn fallback: flat colored floor and wall tiles with speckles. */
  private static drawFlatTiles(g: Phaser.GameObjects.Graphics, seed: string, p: ParsedLevel): void {
    const ts = L.tileSize;
    const rng = new Phaser.Math.RandomDataGenerator([seed]);
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
  }
}

function shade(base: Phaser.Display.Color, amount: number): number {
  const f = 1 + amount;
  const c = (v: number) => Phaser.Math.Clamp(Math.round(v * f), 0, 255);
  return Phaser.Display.Color.GetColor(c(base.red), c(base.green), c(base.blue));
}
