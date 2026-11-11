import Phaser from 'phaser';
import { SCENE_KEYS, TUNING } from '../config';
import { Player } from '../entities/Player';
import { PlayerVisual } from '../entities/PlayerVisual';
import { ExitZone } from '../entities/ExitZone';
import { getLevel } from '../levels';
import type { LevelData } from '../levels/types';
import { CameraRig } from '../systems/CameraRig';
import { JUMP_EVENTS, JumpSystem, type JumpTakeoff } from '../systems/JumpSystem';
import { applyTrapVariants } from '../systems/LevelParser';
import { PitMap } from '../systems/PitMap';
import { TrollTrapSystem } from '../systems/TrollTrapSystem';
import { JumpButton } from '../ui/JumpButton';
import { DragonSystem } from '../systems/DragonSystem';
import { FAIL_REASONS, FailSystem } from '../systems/FailSystem';
import { HapticsService } from '../systems/HapticsService';
import { NoiseSystem } from '../systems/NoiseSystem';
import { LevelLoader } from '../systems/LevelLoader';
import { Lighting } from '../systems/Lighting';
import { LOOT_EVENTS, LootSystem, sackScaleFor, type LootChange } from '../systems/LootSystem';
import { addDeath, loadBestLoot, loadDeaths, saveBestLoot, startAttempt } from '../systems/SaveData';
import { PortalSystem } from '../systems/PortalSystem';
import { TrapSystem } from '../systems/TrapSystem';
import { Joystick } from '../ui/Joystick';
import { DebugOverlay } from '../ui/DebugOverlay';
import { EscapeOverlay } from '../ui/EscapeOverlay';
import { Hud } from '../ui/Hud';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private joystick!: Joystick;
  private fail!: FailSystem;
  private portals!: PortalSystem;
  private traps!: TrapSystem;
  private loot!: LootSystem;
  private noise!: NoiseSystem;
  private dragons!: DragonSystem;
  private hud!: Hud;
  private jump!: JumpSystem;
  private jumpButton!: JumpButton;
  private troll!: TrollTrapSystem;
  private debug?: DebugOverlay;
  private level!: LevelData;
  private deaths = 0;
  /** Time of the first joystick touch; null until the player starts. */
  private startTime: number | null = null;

  constructor() {
    super(SCENE_KEYS.game);
  }

  create(): void {
    this.startTime = null;
    this.debug = undefined;

    // Temporary level switch (TUNING.debug.startLevel) until the level select exists.
    const base = getLevel(TUNING.debug.startLevel);
    const attempts = startAttempt(base.id);
    this.deaths = loadDeaths(base.id);
    // Optional per-level trap shuffle between attempts (off unless the level sets varyTraps).
    this.level = applyTrapVariants(base, attempts - 1);

    // Multi-touch: joystick + future action buttons at the same time.
    // Guarded so scene restarts don't keep adding pointers.
    const wantedPointers = 1 + TUNING.input.extraPointers;
    const missing = wantedPointers - this.input.manager.pointersTotal;
    if (missing > 0) this.input.addPointer(missing);

    // First, so every later object is routed to the right camera.
    const rig = new CameraRig(this);

    const built = LevelLoader.build(this, this.level);
    this.physics.world.setBounds(0, 0, built.widthPx, built.heightPx);

    const exit = new ExitZone(this, built.exitRect);

    this.player = new Player(this, built.playerStart.x, built.playerStart.y);
    const visual = new PlayerVisual(this, this.player);
    this.physics.add.collider(this.player, built.walls);
    this.physics.add.overlap(this.player, exit.zone, this.onEscape, undefined, this);

    rig.follow(this.player, built.widthPx, built.heightPx);

    if (TUNING.lighting.enabled) {
      new Lighting(this, this.player);
    }

    // Jump button first: it's interactive, so the joystick ignores touches that start on it.
    this.jumpButton = new JumpButton(this);
    this.joystick = new Joystick(this);

    this.fail = new FailSystem(this, {
      player: this.player,
      visual,
      joystick: this.joystick,
      camera: rig.world,
      onRetry: () => this.scene.restart(),
      // Loot only counts if you escape.
      resultLines: () => [
        { text: `Loot lost: ${this.loot.loot}`, color: TUNING.hud.lootColor, fontSize: 44 },
        { text: `Deaths: ${this.deaths}`, color: TUNING.hud.deathsColor, fontSize: 40 },
      ],
      onDeath: () => {
        this.jumpButton.setEnabled(false);
        this.deaths = addDeath(this.level.id);
        this.hud?.setDeaths(this.deaths);
      },
      onGodModeIgnored: () => this.jump?.resetFall(),
    });

    // Every sound in the cave goes through emitNoise (footsteps, chests, portals, landings, traps).
    const N = TUNING.noise;
    const noise = new NoiseSystem(this, built.parsed.wall);
    this.noise = noise;
    // Steps on rubble (fallen ceiling rock) are louder than a sneak step.
    visual.onFootstep = (pose, x, y) => {
      const rubble = this.troll?.isRubble(x, y) ?? false;
      noise.emitNoise(x, y, rubble ? Math.max(N.footstep[pose], N.rubbleStep) : N.footstep[pose], 'footstep');
    };

    // Pits: '-' gaps from the start; crumble / trap floors / moving pits are added when they drop.
    const p = built.parsed;
    const pits = new PitMap(p.cols, p.rows, TUNING.level.tileSize, p.gaps);
    this.jump = new JumpSystem(this, {
      player: this.player,
      visual,
      joystick: this.joystick,
      pits,
      isPaused: () => this.fail.isOver || this.portals.isTeleporting,
    });
    this.jumpButton.onPress = () => this.jump.press();
    this.jump.on(JUMP_EVENTS.land, (e: { x: number; y: number }) => noise.emitNoise(e.x, e.y, N.land, 'land'));
    this.jump.on(JUMP_EVENTS.fell, (e: { x: number; y: number }) => this.fail.quickFail(FAIL_REASONS.pit, { kind: 'fall', x: e.x, y: e.y }));

    this.portals = new PortalSystem(
      this,
      built.parsed.portals,
      this.player,
      visual,
      rig,
      () => this.fail.isOver,
      (x, y) => noise.emitNoise(x, y, N.portal, 'portal'),
    );

    this.loot = new LootSystem(this, built.parsed, {
      player: this.player,
      camera: rig.world,
      isPaused: () => this.fail.isOver || this.portals.isTeleporting,
      onNoise: (x, y, loudness) => noise.emitNoise(x, y, loudness, 'chest'),
    });
    this.loot.on(LOOT_EVENTS.changed, (e: LootChange) => {
      visual.growSack(sackScaleFor(e.total));
      this.player.speedMultiplier = this.loot.speedMultiplier;
    });

    this.traps = new TrapSystem(this, built.parsed, {
      player: this.player,
      addPit: (t) => pits.set(t.x, t.y),
      onFloorCollapsed: (tile) => this.loot.onFloorCollapsed(tile),
      // Trap deaths: quick restart, no overlay.
      onCaught: (kind, effect) => this.fail.quickFail(kind === 'pit' ? FAIL_REASONS.pit : FAIL_REASONS.trap, effect),
      isPaused: () => this.fail.isOver || this.portals.isTeleporting,
    });

    this.troll = new TrollTrapSystem(this, built.parsed, {
      player: this.player,
      pits,
      exit,
      camera: rig.world,
      onCaught: (reason, effect) => this.fail.quickFail(reason, effect),
      onNoise: (x, y, loudness) => noise.emitNoise(x, y, loudness, 'trap'),
      onFloorDropped: (tile) => this.loot.onFloorCollapsed(tile),
      isPaused: () => this.fail.isOver || this.portals.isTeleporting,
    });
    this.physics.add.collider(this.player, this.troll.wallBodies);
    this.loot.on(LOOT_EVENTS.fakeTaken, (tile: { x: number; y: number }) => this.troll.onFakeTaken(tile));
    this.jump.on(JUMP_EVENTS.takeoff, (e: JumpTakeoff) => this.troll.onTakeoff(e));

    this.dragons = new DragonSystem(this, built.parsed.dragons, {
      noise,
      player: this.player,
      fail: this.fail,
      rig,
      haptics: new HapticsService(),
      isPaused: () => this.portals.isTeleporting,
    });

    this.hud = new Hud(this, this.loot, { deaths: this.deaths, attempts });

    if (TUNING.debug.enabled) {
      this.debug = new DebugOverlay(this);
    }
  }

  update(_time: number, delta: number): void {
    this.joystick.update();
    if (this.startTime === null && this.joystick.isActive) this.startTime = this.time.now;
    this.player.applyInput(this.joystick.direction, this.joystick.strength, delta);
    this.jump.update();
    this.portals.update();
    this.traps.update();
    this.troll.update(delta);
    this.loot.update(delta);
    this.dragons.update(delta);
    if (this.startTime !== null && !this.fail.isOver) this.hud.setTime(this.time.now - this.startTime);
    this.debug?.update(delta, this.player, this.joystick, () => this.debugLines());
  }

  private debugLines(): string[] {
    const ts = TUNING.level.tileSize;
    return [
      `tile:  ${Math.floor(this.player.x / ts)},${Math.floor(this.player.y / ts)}`,
      this.portals.debugLine,
      this.traps.debugLine,
      this.troll.debugLine,
      this.jump.debugLine,
      this.loot.debugLine,
      this.dragons.debugLine,
      this.noise.debugLine,
    ];
  }

  private onEscape(): void {
    if (this.portals.isTeleporting || !this.fail.lock()) return;

    const elapsed = this.startTime === null ? 0 : this.time.now - this.startTime;
    this.player.freeze();
    this.joystick.setEnabled(false);
    this.jumpButton.setEnabled(false);
    this.hud.setTime(elapsed);

    const loot = this.loot.loot;
    const previousBest = loadBestLoot(this.level.id);
    const newBest = loot > previousBest;
    if (newBest) saveBestLoot(this.level.id, loot);

    new EscapeOverlay(
      this,
      {
        timeMs: elapsed,
        loot,
        gems: this.loot.gemsFound,
        gemsTotal: this.loot.gemsTotal,
        chests: this.loot.chestsFound,
        chestsTotal: this.loot.chestsTotal,
        previousBest,
        newBest,
        deaths: this.deaths,
      },
      () => this.scene.restart(),
    );
  }
}
