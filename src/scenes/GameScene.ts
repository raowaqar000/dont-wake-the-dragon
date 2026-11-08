import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS, TUNING } from '../config';
import { Player } from '../entities/Player';
import { Joystick } from '../ui/Joystick';
import { DebugOverlay } from '../ui/DebugOverlay';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private joystick!: Joystick;
  private debug?: DebugOverlay;

  constructor() {
    super(SCENE_KEYS.game);
  }

  create(): void {
    // Multi-touch: joystick + future action buttons at the same time.
    this.input.addPointer(TUNING.input.extraPointers);

    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.player = new Player(this, GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.joystick = new Joystick(this);

    if (TUNING.debug.enabled) {
      this.debug = new DebugOverlay(this);
    }
  }

  update(_time: number, delta: number): void {
    this.joystick.update();
    this.player.applyInput(this.joystick.direction, this.joystick.strength, delta);
    this.debug?.update(delta, this.player, this.joystick);
  }
}
