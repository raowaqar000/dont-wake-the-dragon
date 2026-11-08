import Phaser from 'phaser';
import { SCENE_KEYS, TUNING } from '../config';
import { Player } from '../entities/Player';
import { ExitZone } from '../entities/ExitZone';
import { level01 } from '../levels/level01';
import type { LevelData } from '../levels/types';
import { LevelLoader } from '../systems/LevelLoader';
import { Lighting } from '../systems/Lighting';
import { Joystick } from '../ui/Joystick';
import { DebugOverlay } from '../ui/DebugOverlay';
import { EscapeOverlay } from '../ui/EscapeOverlay';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private joystick!: Joystick;
  private debug?: DebugOverlay;
  private level: LevelData = level01;
  /** Time of the first joystick touch; null until the player starts. */
  private startTime: number | null = null;
  private escaped = false;

  constructor() {
    super(SCENE_KEYS.game);
  }

  create(): void {
    this.startTime = null;
    this.escaped = false;
    this.debug = undefined;

    // Multi-touch: joystick + future action buttons at the same time.
    // Guarded so scene restarts don't keep adding pointers.
    const wantedPointers = 1 + TUNING.input.extraPointers;
    const missing = wantedPointers - this.input.manager.pointersTotal;
    if (missing > 0) this.input.addPointer(missing);

    const built = LevelLoader.build(this, this.level);
    this.physics.world.setBounds(0, 0, built.widthPx, built.heightPx);

    const exit = new ExitZone(this, built.exitRect);

    this.player = new Player(this, built.playerStart.x, built.playerStart.y);
    this.player.setDepth(10);
    this.physics.add.collider(this.player, built.walls);
    this.physics.add.overlap(this.player, exit.zone, this.onEscape, undefined, this);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, built.widthPx, built.heightPx);
    cam.startFollow(this.player, true, TUNING.camera.lerp, TUNING.camera.lerp);

    if (TUNING.lighting.enabled) {
      new Lighting(this, this.player);
    }

    this.joystick = new Joystick(this);

    if (TUNING.debug.enabled) {
      this.debug = new DebugOverlay(this);
    }
  }

  update(_time: number, delta: number): void {
    this.joystick.update();
    if (this.startTime === null && this.joystick.isActive) this.startTime = this.time.now;
    this.player.applyInput(this.joystick.direction, this.joystick.strength, delta);
    this.debug?.update(delta, this.player, this.joystick);
  }

  private onEscape(): void {
    if (this.escaped) return;
    this.escaped = true;

    const elapsed = this.startTime === null ? 0 : this.time.now - this.startTime;
    this.player.freeze();
    this.joystick.setEnabled(false);
    new EscapeOverlay(this, elapsed, () => this.scene.restart());
  }
}
