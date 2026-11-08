import Phaser from 'phaser';
import { TUNING } from '../config';

const J = TUNING.joystick;

/**
 * Floating touch joystick. Appears where a finger first touches the bottom
 * part of the screen and follows only that finger, so other fingers
 * (future action buttons) never interfere with it.
 */
export class Joystick {
  /** Normalized direction, zero when inactive or inside the dead zone. */
  public readonly direction = new Phaser.Math.Vector2();
  /** 0..1 based on how far the knob is pushed (0 inside the dead zone). */
  public strength = 0;

  private readonly scene: Phaser.Scene;
  private readonly base: Phaser.GameObjects.Graphics;
  private readonly knob: Phaser.GameObjects.Graphics;
  private readonly origin = new Phaser.Math.Vector2();
  private pointerId: number | null = null;
  private enabled = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.base = scene.add.graphics();
    this.base.fillStyle(J.baseColor, J.baseAlpha);
    this.base.fillCircle(0, 0, J.baseRadius);
    this.base.lineStyle(3, J.baseColor, J.baseStrokeAlpha);
    this.base.strokeCircle(0, 0, J.baseRadius);

    this.knob = scene.add.graphics();
    this.knob.fillStyle(J.knobColor, J.knobAlpha);
    this.knob.fillCircle(0, 0, J.knobRadius);

    for (const g of [this.base, this.knob]) {
      g.setScrollFactor(0).setVisible(false);
    }
    this.base.setDepth(J.depth);
    this.knob.setDepth(J.depth + 1);

    const input = scene.input;
    input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);

    // Release if the app loses focus mid-touch (notification shade, app switch).
    scene.game.events.on(Phaser.Core.Events.BLUR, this.release, this);
    scene.game.events.on(Phaser.Core.Events.HIDDEN, this.release, this);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  get isActive(): boolean {
    return this.pointerId !== null;
  }

  /** Disabling also releases the current touch (e.g. when a menu opens). */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.release();
  }

  /** Call every frame. Safety net for touches the browser cancelled without a pointerup. */
  update(): void {
    if (this.pointerId === null) return;
    const pointer = this.findPointer(this.pointerId);
    if (!pointer || !pointer.isDown) this.release();
  }

  private onPointerDown(pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void {
    if (!this.enabled) return;
    if (this.pointerId !== null) return; // already controlled by another finger
    if (over.length > 0) return; // touch landed on an interactive object (e.g. a button)
    if (pointer.y < this.scene.scale.height * J.activationZoneTop) return;

    this.pointerId = pointer.id;
    this.origin.set(pointer.x, pointer.y);
    this.base.setPosition(pointer.x, pointer.y).setVisible(true);
    this.knob.setPosition(pointer.x, pointer.y).setVisible(true);
    this.updateKnob(pointer.x, pointer.y);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.updateKnob(pointer.x, pointer.y);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.pointerId) return;
    this.release();
  }

  private updateKnob(x: number, y: number): void {
    const dx = x - this.origin.x;
    const dy = y - this.origin.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, J.maxDistance);

    if (dist > 0) {
      this.knob.setPosition(this.origin.x + (dx / dist) * clamped, this.origin.y + (dy / dist) * clamped);
    } else {
      this.knob.setPosition(this.origin.x, this.origin.y);
    }

    const raw = clamped / J.maxDistance;
    if (raw < J.deadZone || dist === 0) {
      this.strength = 0;
      this.direction.set(0, 0);
    } else {
      this.strength = raw;
      this.direction.set(dx / dist, dy / dist);
    }
  }

  private release(): void {
    this.pointerId = null;
    this.strength = 0;
    this.direction.set(0, 0);
    this.base.setVisible(false);
    this.knob.setVisible(false);
  }

  private findPointer(id: number): Phaser.Input.Pointer | undefined {
    return this.scene.input.manager.pointers.find((p) => p.id === id);
  }

  destroy(): void {
    const input = this.scene.input;
    input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    this.scene.game.events.off(Phaser.Core.Events.BLUR, this.release, this);
    this.scene.game.events.off(Phaser.Core.Events.HIDDEN, this.release, this);
    this.base.destroy();
    this.knob.destroy();
  }
}
