import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import type { Player } from '../entities/Player';
import type { ExitZone } from '../entities/ExitZone';
import { ClosingWall } from '../entities/troll/ClosingWall';
import { FallingRock } from '../entities/troll/FallingRock';
import { PopupSpikes } from '../entities/troll/PopupSpikes';
import { TrapFloor } from '../entities/troll/TrapFloor';
import { ART_SCALE, artKey, hasArt } from './ArtAssets';
import { FAIL_REASONS, type FailEffect, type FailReason } from './FailSystem';
import type { JumpTakeoff } from './JumpSystem';
import type { ParsedLevel, TilePos } from './LevelParser';
import type { PitMap } from './PitMap';

const TR = TUNING.troll;

export type TrollKind = 'trapFloor' | 'popSpikes' | 'rock' | 'closingWall' | 'fakeTreasure' | 'runawayExit' | 'movingPit';

export const TROLL_EVENTS = {
  /** A troll trap fired. Payload: { kind: TrollKind, x, y } (tile). */
  triggered: 'troll-triggered',
} as const;

export interface TrollTrapDeps {
  player: Player;
  pits: PitMap;
  exit: ExitZone;
  camera: Phaser.Cameras.Scene2D.Camera;
  onCaught: (reason: FailReason, effect: FailEffect) => void;
  onNoise: (x: number, y: number, loudness: number) => void;
  /** A floor tile dropped (treasure on it is lost). */
  onFloorDropped?: (tile: TilePos) => void;
  isPaused: () => boolean;
}

type FadeObj = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.AlphaSingle;

/**
 * Hidden "troll" traps. Triggers are tile based: proximity checks run only when the
 * player enters a new tile; hit checks are a few tile tests per frame. Every trap
 * registers a fire() under its tile key, so trap links can fire any trap from any other.
 */
export class TrollTrapSystem extends Phaser.Events.EventEmitter {
  private readonly ts = TUNING.level.tileSize;
  private readonly trapFloors: TrapFloor[];
  private readonly movingPits: TrapFloor[];
  private readonly popSpikes: PopupSpikes[];
  /** Spike rings around fake treasure, by fake tile key. */
  private readonly rings = new Map<string, PopupSpikes[]>();
  private readonly allSpikes: PopupSpikes[] = [];
  private readonly rocks: FallingRock[];
  private readonly walls: ClosingWall[];
  private readonly fakeWalls: { img: FadeObj; rect: Phaser.Geom.Rectangle }[] = [];
  private readonly rubble = new Set<number>();
  private readonly firers = new Map<string, () => void>();
  private readonly links = new Map<string, TilePos[]>();
  private readonly dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly view = new Phaser.Geom.Rectangle();
  private lastTile = -1;
  private exitArmed: boolean;
  private movingPitUsed = false;
  private fired = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly level: ParsedLevel,
    private readonly deps: TrollTrapDeps,
  ) {
    super();
    const s = 1 / TUNING.playerVisual.textureResolution;
    this.dustEmitter = scene.add
      .particles(0, 0, TEXTURE_KEYS.dust, {
        lifespan: 500,
        speed: { min: 10, max: 45 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.6 * s, end: 1.6 * s },
        alpha: { start: 0.55, end: 0 },
        tint: TUNING.traps.crumble.dustColor,
        emitting: false,
      })
      .setDepth(TR.fxDepth + 1);
    const dust = (x: number, y: number, n: number) => this.dustEmitter.explode(n, x, y);

    this.trapFloors = level.trapFloors.map((t) => new TrapFloor(scene, t, (f) => this.onDrop(f), dust));
    this.movingPits = level.movingPits.map((t) => new TrapFloor(scene, t, (f) => this.onDrop(f), dust));
    this.popSpikes = level.popSpikes.map((t) => new PopupSpikes(scene, t));
    this.allSpikes.push(...this.popSpikes);
    this.rocks = level.rocks.map(
      (t) => new FallingRock(scene, t, (r) => this.onSlam(r), (x, y) => this.dustEmitter.explode(1, x, y)),
    );
    this.walls = level.closingWalls.map((w) => new ClosingWall(scene, w));
    this.exitArmed = level.realExit !== null;
    this.registerAll();
    this.drawTells();
    this.drawFakeWalls();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeAllListeners());
  }

  /** Closing-wall bodies, for the player collider. */
  get wallBodies(): Phaser.GameObjects.Zone[] {
    return this.walls.flatMap((w) => w.bodies);
  }

  get debugLine(): string {
    return `troll: fired ${this.fired}, rubble ${this.rubble.size}`;
  }

  /** True if (x, y) is on rubble (footsteps there are louder). */
  isRubble(x: number, y: number): boolean {
    return this.rubble.has(this.tileIndex(x, y));
  }

  private tileIndex(x: number, y: number): number {
    return Math.floor(y / this.ts) * this.level.cols + Math.floor(x / this.ts);
  }

  // Firing ------------------------------------------------------------------

  private registerAll(): void {
    const { level, scene } = this;
    const fakes = [...level.fakeCoins, ...level.fakeGems];
    for (const f of fakes) this.buildRing(f);
    for (const f of this.trapFloors) this.register(f.tile, 'trapFloor', () => f.fire());
    for (const m of this.movingPits) this.register(m.tile, 'movingPit', () => this.fireMovingPit(m));
    for (const p of this.popSpikes) this.register(p.tile, 'popSpikes', () => p.fire(scene.time.now));
    for (const r of this.rocks) this.register(r.tile, 'rock', () => r.fire());
    for (const w of this.walls) {
      const c = w.spec.corridor;
      this.register({ x: c.x, y: c.y }, 'closingWall', () => w.fire(scene.time.now));
    }
    for (const f of fakes) this.register(f, 'fakeTreasure', () => this.fireRing(f));
    for (const t of level.realExitTiles.slice(0, 1)) this.register(t, 'runawayExit', () => this.fireExit());
    for (const l of level.trapLinks) {
      if (!this.firers.has(key(l.from))) console.warn(`[troll] trapLink from ${key(l.from)} is not on a trap`);
      for (const t of l.to) if (!this.firers.has(key(t))) console.warn(`[troll] trapLink to ${key(t)} is not on a trap`);
      this.links.set(key(l.from), [...(this.links.get(key(l.from)) ?? []), ...l.to]);
    }
  }

  private register(t: TilePos, kind: TrollKind, fire: () => void): void {
    this.firers.set(key(t), () => {
      this.fired++;
      this.emit(TROLL_EVENTS.triggered, { kind, x: t.x, y: t.y });
      fire();
    });
  }

  /** Fires the trap at `t` and everything linked to it (each trap once per chain). */
  private fire(t: TilePos, seen = new Set<string>()): void {
    const k = key(t);
    if (seen.has(k)) return;
    seen.add(k);
    this.firers.get(k)?.();
    for (const to of this.links.get(k) ?? []) this.fire(to, seen);
  }

  /** LootSystem event: a fake coin/gem was grabbed. */
  onFakeTaken(tile: TilePos): void {
    this.fire(tile);
  }

  /** JumpSystem takeoff: a moving pit touching the gap ahead drops (once per level). */
  onTakeoff(e: JumpTakeoff): void {
    if (this.movingPitUsed || this.movingPits.length === 0 || (e.dirX === 0 && e.dirY === 0)) return;
    const steps = TR.movingPit.lookAheadTiles * 2;
    const stepPx = this.ts / 2;
    for (let i = 1; i <= steps; i++) {
      const tx = Math.floor((e.x + e.dirX * stepPx * i) / this.ts);
      const ty = Math.floor((e.y + e.dirY * stepPx * i) / this.ts);
      if (!this.deps.pits.isPit(tx, ty)) continue;
      const m = this.movingPits.find((p) => !p.dropped && Math.abs(p.tile.x - tx) + Math.abs(p.tile.y - ty) === 1);
      if (m) {
        this.fire(m.tile);
        return;
      }
    }
  }

  private fireMovingPit(m: TrapFloor): void {
    if (this.movingPitUsed) return;
    this.movingPitUsed = true;
    m.fire(0);
  }

  private onDrop(f: TrapFloor): void {
    this.deps.pits.set(f.tile.x, f.tile.y);
    this.deps.onFloorDropped?.(f.tile);
    this.deps.onNoise(f.cx, f.cy, TUNING.noise.floorDrop);
  }

  private onSlam(r: FallingRock): void {
    const { player, camera } = this.deps;
    this.rubble.add(r.tile.y * this.level.cols + r.tile.x);
    this.dustEmitter.explode(TR.rock.slamDust, r.cx, r.cy);
    camera.shake(TR.rock.shakeMs, TR.rock.shakeIntensity);
    this.deps.onNoise(r.cx, r.cy, TUNING.noise.rockSlam);
    if (!this.deps.isPaused() && r.contains(player.x, player.y, TUNING.traps.hitInset)) {
      this.deps.onCaught(FAIL_REASONS.crushed, { kind: 'crush' });
    }
  }

  private buildRing(f: TilePos): void {
    const ring: PopupSpikes[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const x = f.x + dx;
        const y = f.y + dy;
        if (this.level.wall[y]?.[x] !== false || this.deps.pits.isPit(x, y)) continue;
        const p = new PopupSpikes(this.scene, { x, y });
        ring.push(p);
        this.allSpikes.push(p);
      }
    }
    this.rings.set(key(f), ring);
  }

  private fireRing(f: TilePos): void {
    const ts = this.ts;
    this.deps.onNoise((f.x + 0.5) * ts, (f.y + 0.5) * ts, TUNING.noise.fakeTreasure);
    this.scene.time.delayedCall(TR.fakeTreasure.ringDelayMs, () => {
      for (const p of this.rings.get(key(f)) ?? []) p.fire(this.scene.time.now);
    });
  }

  private fireExit(): void {
    const re = this.level.realExit;
    if (!re || !this.exitArmed) return;
    this.exitArmed = false;
    const e = this.level.exit;
    this.deps.exit.slideBy((re.x - e.x) * this.ts, (re.y - e.y) * this.ts, TR.runawayExit.slideMs);
    this.deps.camera.shake(120, 0.004);
  }

  // Per frame ---------------------------------------------------------------

  update(deltaMs: number): void {
    const now = this.scene.time.now;
    const { player } = this.deps;
    for (const p of this.allSpikes) p.update(now);
    for (const w of this.walls) {
      if (w.update(now)) this.deps.onNoise(w.rect.centerX, w.rect.centerY, TUNING.noise.wallsClose);
    }
    this.updateTells(now);
    this.updateFakeWalls(deltaMs);
    if (this.deps.isPaused()) return;

    // Proximity triggers: only when the player enters a new tile.
    const tile = this.tileIndex(player.x, player.y);
    if (tile !== this.lastTile) {
      this.lastTile = tile;
      this.checkTriggers(tile % this.level.cols, Math.floor(tile / this.level.cols));
    }

    // Hits. Spikes can't reach you in the air; closing walls can.
    const r = TUNING.player.bodyRadius;
    if (!player.airborne) {
      for (const p of this.allSpikes) {
        if (p.dangerous && p.overlapsCircle(player.x, player.y, r, TUNING.traps.hitInset)) {
          this.deps.onCaught(FAIL_REASONS.trap, { kind: 'hit' });
          return;
        }
      }
    }
    for (const w of this.walls) {
      if (w.state !== 'closing' && w.state !== 'closed') continue;
      if (w.gap < TR.closingWall.crushGapPx && w.rect.contains(player.x, player.y)) {
        this.deps.onCaught(FAIL_REASONS.crushed, { kind: 'crush' });
        return;
      }
    }
  }

  private checkTriggers(px: number, py: number): void {
    const near = (t: TilePos, d: number) => Math.max(Math.abs(t.x - px), Math.abs(t.y - py)) <= d;
    const on = (t: TilePos) => t.x === px && t.y === py;
    for (const f of this.trapFloors) {
      // Fires from ~1 tile away, never from on top (you must jump at the last moment).
      if (!f.dropped && near(f.tile, TR.trapFloor.triggerTiles) && !on(f.tile)) this.fire(f.tile);
    }
    for (const p of this.popSpikes) {
      if (p.state === 'hidden' && near(p.tile, TR.popSpikes.triggerTiles) && !on(p.tile)) this.fire(p.tile);
    }
    for (const r of this.rocks) {
      if (r.state === 'waiting' && near(r.tile, TR.rock.triggerTiles)) this.fire(r.tile);
    }
    for (const w of this.walls) {
      const c = w.spec.corridor;
      const a = TR.closingWall.triggerAheadTiles;
      if (w.state === 'open' && px >= c.x && px < c.x + c.w && py >= c.y - a && py < c.y + c.h + a) this.fire({ x: c.x, y: c.y });
    }
    if (this.exitArmed && this.level.realExitTiles.length > 0) {
      const e = this.level.exit;
      const d = TR.runawayExit.triggerTiles;
      if (px >= e.x - d && px < e.x + e.w + d && py >= e.y - d && py < e.y + e.h + d) this.fire(this.level.realExitTiles[0]);
    }
  }

  // Tells and fake walls ----------------------------------------------------

  /** Static tells, drawn once (subtle on purpose). */
  private drawTells(): void {
    const ts = this.ts;
    const g = this.scene.add.graphics().setDepth(TR.depth);
    const rng = new Phaser.Math.RandomDataGenerator([`tells-${this.level.cols}x${this.level.rows}`]);

    // Trap floor: one thin crack.
    g.lineStyle(1.5, TR.trapFloor.crackColor, TR.trapFloor.crackAlpha);
    for (const f of this.level.trapFloors) {
      const x = f.x * ts;
      const y = f.y * ts;
      g.beginPath();
      g.moveTo(x + ts * 0.25, y + ts * rng.realInRange(0.3, 0.45));
      g.lineTo(x + ts * 0.5, y + ts * rng.realInRange(0.45, 0.6));
      g.lineTo(x + ts * 0.72, y + ts * rng.realInRange(0.5, 0.7));
      g.strokePath();
    }
    // Pop-up spikes: tiny pinholes.
    g.fillStyle(TR.popSpikes.holeColor, TR.popSpikes.holeAlpha);
    const holes = [[0.3, 0.4], [0.55, 0.35], [0.45, 0.65], [0.7, 0.6]];
    for (const p of this.level.popSpikes) {
      for (const [hx, hy] of holes) g.fillCircle((p.x + hx) * ts, (p.y + hy) * ts, 1.4);
    }
    // Moving pit: one loose pebble.
    for (const m of this.level.movingPits) {
      g.fillStyle(0x0b0a0d, 0.5);
      g.fillEllipse((m.x + 0.62) * ts, (m.y + 0.42) * ts, 7, 5);
      g.fillStyle(0x8a8296, 0.8);
      g.fillEllipse((m.x + 0.61) * ts, (m.y + 0.4) * ts, 5, 3.5);
    }
    // Runaway exit: scuff marks from the decoy door toward the real one.
    const re = this.level.realExit;
    if (re) {
      const e = this.level.exit;
      const ax = (e.x + e.w / 2) * ts;
      const ay = (e.y + e.h + 0.5) * ts;
      const bx = (re.x + re.w / 2) * ts;
      const by = (re.y + re.h + 0.5) * ts;
      g.lineStyle(2, TR.runawayExit.scuffColor, TR.runawayExit.scuffAlpha);
      for (let i = 0; i < 4; i++) {
        const t = 0.2 + i * 0.18;
        const x = Phaser.Math.Linear(ax, bx, t);
        const y = Phaser.Math.Linear(ay, by, t);
        g.lineBetween(x - 6, y - 2, x + 6, y + 2);
      }
    }
  }

  /** Rocks: grit only while on screen. */
  private updateTells(now: number): void {
    const wv = this.deps.camera.worldView;
    this.view.setTo(wv.x - 48, wv.y - 48, wv.width + 96, wv.height + 96);
    for (const r of this.rocks) if (this.view.contains(r.cx, r.cy)) r.updateTell(now);
  }

  /** Fake walls: wall look over walkable tiles, drawn above the hero; fade while he's inside. */
  private drawFakeWalls(): void {
    const ts = this.ts;
    const art = hasArt(this.scene, 'wall_tile');
    const depth = TUNING.playerVisual.depth + 1;
    const tileScale = ART_SCALE * TUNING.art.level.wallScale;
    for (const t of this.level.fakeWalls) {
      const x = t.x * ts;
      const y = t.y * ts;
      const img: FadeObj = art
        ? this.scene.add
            .tileSprite(x, y, ts, ts, artKey('wall_tile'))
            .setOrigin(0, 0)
            .setTileScale(tileScale)
            .setTilePosition(x / tileScale, y / tileScale)
            .setTint(TR.fakeWall.tint)
            .setDepth(depth)
        : this.scene.add.rectangle(x, y, ts, ts, TUNING.level.wallColor).setOrigin(0, 0).setDepth(depth);
      // Same raised-wall edges as real walls (lit lip / sides where it touches floor).
      const glint = this.scene.add.graphics().setDepth(depth + 0.1);
      const A = TUNING.art.level;
      const L = TUNING.level;
      const floor = (tx: number, ty: number) =>
        this.level.wall[ty]?.[tx] === false && !this.level.fakeWalls.some((f) => f.x === tx && f.y === ty);
      if (A.wallEdge) {
        if (floor(t.x, t.y - 1)) {
          glint.fillStyle(L.wallEdgeColor, A.wallEdgeAlpha);
          glint.fillRect(x, y, ts, L.wallEdgeHeight);
        }
        glint.fillStyle(L.wallEdgeColor, A.wallSideEdgeAlpha);
        if (floor(t.x - 1, t.y)) glint.fillRect(x, y, A.wallSideEdgePx, ts);
        if (floor(t.x + 1, t.y)) glint.fillRect(x + ts - A.wallSideEdgePx, y, A.wallSideEdgePx, ts);
        if (floor(t.x, t.y + 1)) glint.fillRect(x, y + ts - A.wallSideEdgePx, ts, A.wallSideEdgePx);
      }
      // Tell: a small glint, kept visible on the darker rock.
      glint.lineStyle(1.5, 0xffffff, TR.fakeWall.glintAlpha);
      glint.lineBetween(x + ts * 0.2, y + ts * 0.36, x + ts * 0.44, y + ts * 0.3);
      const rect = new Phaser.Geom.Rectangle(x - 14, y - 14, ts + 28, ts + 28);
      this.fakeWalls.push({ img, rect }, { img: glint, rect });
    }
  }

  private updateFakeWalls(deltaMs: number): void {
    if (this.fakeWalls.length === 0) return;
    const { x, y } = this.deps.player;
    const k = Math.min(1, (TR.fakeWall.fadePerSec * deltaMs) / 1000);
    for (const f of this.fakeWalls) {
      const target = f.rect.contains(x, y) ? TR.fakeWall.insideAlpha : 1;
      f.img.setAlpha(f.img.alpha + (target - f.img.alpha) * k);
    }
  }
}

function key(t: TilePos): string {
  return `${t.x},${t.y}`;
}
