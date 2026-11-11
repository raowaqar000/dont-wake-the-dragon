import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import { approachVelocity, resolveMoveState, speedForState, type MoveState } from '../systems/MovementSystem';

export class Player extends Phaser.Physics.Arcade.Sprite {
  /** Current movement mode, read by other systems (noise, dragon, UI...). */
  public moveState: MoveState = 'idle';
  /** When frozen, input is ignored and the player stands still. */
  public frozen = false;
  /** Scales sneak/run speed. Hook for the greed mechanic (set from LootSystem.speedMultiplier). */
  public speedMultiplier = 1;
  /** True during a hop: pits and floor traps are ignored, walls still block. */
  public airborne = false;
  private airSpeed = 0;

  private readonly currentVelocity = new Phaser.Math.Vector2();
  private readonly targetVelocity = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TEXTURE_KEYS.player);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const r = TUNING.player.bodyRadius;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(r, this.width / 2 - r, this.height / 2 - r);
    this.setCollideWorldBounds(true);
    // Physics only; PlayerVisual draws the character.
    this.setVisible(false);
  }

  /**
   * Drive the player from joystick input.
   * @param direction normalized direction (zero when idle)
   * @param strength 0..1 joystick push amount
   */
  applyInput(direction: Phaser.Math.Vector2, strength: number, deltaMs: number): void {
    if (this.frozen) return;
    if (this.airborne) {
      this.steerInAir(direction, strength, deltaMs);
      return;
    }
    this.moveState = resolveMoveState(strength, this.moveState);
    const speed = speedForState(this.moveState) * this.speedMultiplier;
    this.targetVelocity.set(direction.x * speed, direction.y * speed);

    // Start from the body's real velocity so collisions (walls, bounds) are respected.
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.currentVelocity.set(body.velocity.x, body.velocity.y);
    approachVelocity(this.currentVelocity, this.targetVelocity, deltaMs);
    this.setVelocity(this.currentVelocity.x, this.currentVelocity.y);
  }

  /**
   * Starts a hop: fixed air speed (same at sneak and run) in `dir`, or a hop on the spot
   * when dir is zero. JumpSystem ends it with land().
   */
  takeOff(dirX: number, dirY: number): void {
    this.airborne = true;
    this.airSpeed = (TUNING.jump.distanceTiles * TUNING.level.tileSize) / (TUNING.jump.airMs / 1000);
    this.setVelocity(dirX * this.airSpeed, dirY * this.airSpeed);
  }

  land(): void {
    this.airborne = false;
  }

  /** Air control: velocity turns toward the joystick, speed stays fixed. */
  private steerInAir(direction: Phaser.Math.Vector2, strength: number, deltaMs: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (strength <= 0) return; // keep the takeoff velocity
    const k = 1 - Math.exp((-TUNING.jump.airControlPerSec * Math.min(deltaMs, TUNING.movement.maxDeltaMs)) / 1000);
    const tx = direction.x * this.airSpeed;
    const ty = direction.y * this.airSpeed;
    this.setVelocity(body.velocity.x + (tx - body.velocity.x) * k, body.velocity.y + (ty - body.velocity.y) * k);
  }

  freeze(): void {
    this.frozen = true;
    this.airborne = false;
    this.moveState = 'idle';
    this.setVelocity(0, 0);
  }

  unfreeze(): void {
    this.frozen = false;
  }

  /** Instantly moves the player (and its body) and stops it. */
  teleportTo(x: number, y: number): void {
    (this.body as Phaser.Physics.Arcade.Body).reset(x, y);
  }

  /** Actual speed in px/s. */
  get speed(): number {
    return (this.body as Phaser.Physics.Arcade.Body).velocity.length();
  }
}
