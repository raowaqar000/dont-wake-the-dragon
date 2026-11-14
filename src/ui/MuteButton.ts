import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import { markUi } from '../systems/CameraRig';
import { HINT_TEXTURE_SCALE } from '../systems/HintTextureFactory';
import { SoundSystem } from '../systems/SoundSystem';

const B = TUNING.sound.button;

/**
 * Small round sound on/off button on the UI camera (under the hearts, right side).
 * Toggles SoundSystem mute, which is saved in localStorage. It is interactive, so the
 * joystick never starts from a touch on it.
 */
export class MuteButton {
  private readonly back: Phaser.GameObjects.Arc;
  private readonly icon: Phaser.GameObjects.Image;

  constructor(private readonly scene: Phaser.Scene) {
    this.back = scene.add
      .circle(B.x, B.y, B.radius, B.backColor, B.backAlpha)
      .setScrollFactor(0)
      .setDepth(B.depth)
      .setInteractive(new Phaser.Geom.Circle(B.radius, B.radius, B.radius), Phaser.Geom.Circle.Contains);
    this.icon = scene.add
      .image(B.x, B.y, this.textureFor(SoundSystem.muted))
      .setScale(HINT_TEXTURE_SCALE)
      .setScrollFactor(0)
      .setDepth(B.depth + 1);
    markUi(scene, this.back, this.icon);

    this.back.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, this.onPress, this);
    const off = SoundSystem.onMutedChange((m) => this.icon.setTexture(this.textureFor(m)));
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  private textureFor(muted: boolean): string {
    return muted ? TEXTURE_KEYS.iconSoundOff : TEXTURE_KEYS.iconSoundOn;
  }

  private onPress(): void {
    SoundSystem.toggleMuted();
    const targets = [this.back, this.icon];
    this.scene.tweens.killTweensOf(targets);
    this.back.setScale(1);
    this.icon.setScale(HINT_TEXTURE_SCALE);
    this.scene.tweens.add({ targets: this.back, scale: B.pressScale, duration: B.pressMs, yoyo: true });
    this.scene.tweens.add({ targets: this.icon, scale: HINT_TEXTURE_SCALE * B.pressScale, duration: B.pressMs, yoyo: true });
  }
}
