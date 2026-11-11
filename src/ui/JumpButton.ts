import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import { markUi } from '../systems/CameraRig';

const B = TUNING.jump.button;

/**
 * Big round semi-transparent JUMP button, bottom right, on the UI camera.
 * Fires on touch-down. It is an interactive object, so the Joystick never starts
 * from a touch on it; joystick and button work with two fingers at once.
 * Presses during the first ignoreAfterStartMs after a (re)start are ignored,
 * and a finger already down at start never counts (it must be a new press).
 */
export class JumpButton {
  /** Called on a valid press (JumpSystem buffers it). */
  public onPress: (() => void) | null = null;

  private readonly scene: Phaser.Scene;
  private readonly circle: Phaser.GameObjects.Arc;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly createdAt: number;
  private enabled = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createdAt = scene.time.now;

    this.circle = scene.add
      .circle(B.x, B.y, B.radius, B.color, B.alpha)
      .setStrokeStyle(B.strokeWidth, B.color, B.strokeAlpha)
      .setScrollFactor(0)
      .setDepth(B.depth)
      .setInteractive(new Phaser.Geom.Circle(B.radius, B.radius, B.radius), Phaser.Geom.Circle.Contains);

    this.icon = scene.add
      .image(B.x, B.y, TEXTURE_KEYS.jumpIcon)
      .setScale(B.iconScale)
      .setAlpha(B.iconAlpha)
      .setScrollFactor(0)
      .setDepth(B.depth + 1);

    markUi(scene, this.circle, this.icon);

    this.circle.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.onDown, this);
    this.circle.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, this.onUp, this);
    this.circle.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, this.onUp, this);
  }

  /** Disabled during fails, quick restarts and result cards. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.onUp();
  }

  private onDown(): void {
    if (!this.enabled) return;
    if (this.scene.time.now - this.createdAt < B.ignoreAfterStartMs) return;
    this.circle.setFillStyle(B.color, B.pressedAlpha);
    this.scene.tweens.killTweensOf([this.circle, this.icon]);
    this.scene.tweens.add({ targets: [this.circle, this.icon], scale: B.pressScale, duration: B.pressMs, ease: 'Quad.easeOut' });
    this.onPress?.();
  }

  private onUp(): void {
    this.circle.setFillStyle(B.color, B.alpha);
    this.scene.tweens.killTweensOf([this.circle, this.icon]);
    this.scene.tweens.add({ targets: this.circle, scale: 1, duration: B.pressMs, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: this.icon, scale: B.iconScale, duration: B.pressMs, ease: 'Quad.easeOut' });
  }
}
