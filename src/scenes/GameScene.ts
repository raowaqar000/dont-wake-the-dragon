import Phaser from 'phaser';
import { SCENE_KEYS, TUNING } from '../config';
import { Player } from '../entities/Player';
import { PlayerVisual } from '../entities/PlayerVisual';
import { ExitZone } from '../entities/ExitZone';
import { level01 } from '../levels/level01';
import type { LevelData } from '../levels/types';
import { CameraRig } from '../systems/CameraRig';
import { FAIL_REASONS, FailSystem } from '../systems/FailSystem';
import { LevelLoader } from '../systems/LevelLoader';
import { Lighting } from '../systems/Lighting';
import { PortalSystem } from '../systems/PortalSystem';
import { TrapSystem } from '../systems/TrapSystem';
import { Joystick } from '../ui/Joystick';
import { DebugOverlay } from '../ui/DebugOverlay';
import { EscapeOverlay } from '../ui/EscapeOverlay';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private joystick!: Joystick;
  private fail!: FailSystem;
  private portals!: PortalSystem;
  private traps!: TrapSystem;
  private debug?: DebugOverlay;
  private level: LevelData = level01;
  /** Time of the first joystick touch; null until the player starts. */
  private startTime: number | null = null;

  constructor() {
    super(SCENE_KEYS.game);
  }

  create(): void {
    this.startTime = null;
    this.debug = undefined;

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

    this.joystick = new Joystick(this);

    this.fail = new FailSystem(this, {
      player: this.player,
      visual,
      joystick: this.joystick,
      camera: rig.world,
      onRetry: () => this.scene.restart(),
    });

    this.portals = new PortalSystem(this, built.parsed.portals, this.player, visual, rig, () => this.fail.isOver);

    this.traps = new TrapSystem(this, built.parsed, {
      player: this.player,
      addWallTile: built.addWallTile,
      onCaught: (kind, effect) => this.fail.fail(kind === 'pit' ? FAIL_REASONS.pit : FAIL_REASONS.trap, effect),
      isPaused: () => this.fail.isOver || this.portals.isTeleporting,
    });

    if (TUNING.debug.enabled) {
      this.debug = new DebugOverlay(this);
    }
  }

  update(_time: number, delta: number): void {
    this.joystick.update();
    if (this.startTime === null && this.joystick.isActive) this.startTime = this.time.now;
    this.player.applyInput(this.joystick.direction, this.joystick.strength, delta);
    this.portals.update();
    this.traps.update();
    this.debug?.update(delta, this.player, this.joystick, () => this.debugLines());
  }

  private debugLines(): string[] {
    const ts = TUNING.level.tileSize;
    return [
      `tile:  ${Math.floor(this.player.x / ts)},${Math.floor(this.player.y / ts)}`,
      this.portals.debugLine,
      this.traps.debugLine,
    ];
  }

  private onEscape(): void {
    if (this.portals.isTeleporting || !this.fail.lock()) return;

    const elapsed = this.startTime === null ? 0 : this.time.now - this.startTime;
    this.player.freeze();
    this.joystick.setEnabled(false);
    new EscapeOverlay(this, elapsed, () => this.scene.restart());
  }
}
