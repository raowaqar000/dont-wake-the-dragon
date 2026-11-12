import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import { ART_FILES } from '../generated/artManifest';
import { artKey, hasArt } from '../systems/ArtAssets';
import { markUi } from '../systems/CameraRig';

const B = TUNING.jump.button;
const JA = TUNING.art.jumpButton;

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
  /** Painted button image, or the code-drawn chevrons over the translucent circle. */
  private readonly icon: Phaser.GameObjects.Image;
  private readonly art: boolean;
  /** Icon scale at rest (pressing multiplies it by pressScale). */
  private readonly iconScale: number;
  private readonly createdAt: number;
  private enabled = true;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createdAt = scene.time.now;
    this.art = hasArt(scene, 'jump_button');

    // The circle is always the hit area; with the painted button it is invisible.
    this.circle = scene.add
      .circle(B.x, B.y, B.radius, B.color, this.art ? 0 : B.alpha)
      .setScrollFactor(0)
      .setDepth(B.depth)
      .setInteractive(new Phaser.Geom.Circle(B.radius, B.radius, B.radius), Phaser.Geom.Circle.Contains);
    if (!this.art) this.circle.setStrokeStyle(B.strokeWidth, B.color, B.strokeAlpha);

    if (this.art) {
      // Texture is sized for the hit circle's diameter at displayScale 1.
      const tex = ART_FILES.jump_button;
      this.iconScale = ((B.radius * 2) / tex.width) * JA.displayScale;
      this.icon = scene.add.image(B.x, B.y, artKey('jump_button')).setAlpha(JA.alpha);
    } else {
      this.iconScale = B.iconScale;
      this.icon = scene.add.image(B.x, B.y, TEXTURE_KEYS.jumpIcon).setAlpha(B.iconAlpha);
    }
    this.icon
      .setScale(this.iconScale)
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
    if (this.art) this.icon.setAlpha(JA.pressedAlpha);
    else this.circle.setFillStyle(B.color, B.pressedAlpha);
    this.scene.tweens.killTweensOf([this.circle, this.icon]);
    this.scene.tweens.add({ targets: this.circle, scale: B.pressScale, duration: B.pressMs, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: this.icon, scale: this.iconScale * B.pressScale, duration: B.pressMs, ease: 'Quad.easeOut' });
    this.onPress?.();
  }

  private onUp(): void {
    if (this.art) this.icon.setAlpha(JA.alpha);
    else this.circle.setFillStyle(B.color, B.alpha);
    this.scene.tweens.killTweensOf([this.circle, this.icon]);
    this.scene.tweens.add({ targets: this.circle, scale: 1, duration: B.pressMs, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: this.icon, scale: this.iconScale, duration: B.pressMs, ease: 'Quad.easeOut' });
  }
}
