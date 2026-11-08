import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import { approachVelocity, resolveMoveState, speedForState, type MoveState } from '../systems/MovementSystem';

export class Player extends Phaser.Physics.Arcade.Sprite {
  /** Current movement mode, read by other systems (noise, dragon, UI...). */
  public moveState: MoveState = 'idle';

  private readonly currentVelocity = new Phaser.Math.Vector2();
  private readonly targetVelocity = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURE_KEYS.player);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const r = TUNING.player.radius;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(r, this.width / 2 - r, this.height / 2 - r);
    this.setCollideWorldBounds(true);
  }

  /**
   * Drive the player from joystick input.
   * @param direction normalized direction (zero when idle)
   * @param strength 0..1 joystick push amount
   */
  applyInput(direction: Phaser.Math.Vector2, strength: number, deltaMs: number): void {
    this.moveState = resolveMoveState(strength, this.moveState);
    const speed = speedForState(this.moveState);
    this.targetVelocity.set(direction.x * speed, direction.y * speed);

    // Start from the body's real velocity so collisions (walls, bounds) are respected.
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.currentVelocity.set(body.velocity.x, body.velocity.y);
    approachVelocity(this.currentVelocity, this.targetVelocity, deltaMs);
    this.setVelocity(this.currentVelocity.x, this.currentVelocity.y);
  }

  /** Actual speed in px/s. */
  get speed(): number {
    return (this.body as Phaser.Physics.Arcade.Body).velocity.length();
  }
}
