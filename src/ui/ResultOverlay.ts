import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TUNING } from '../config';
import { markUi } from '../systems/CameraRig';

const O = TUNING.overlay;

export interface ResultOverlayOptions {
  title: string;
  titleColor: string;
  /** Smaller lines under the title (time, reason...). */
  lines?: string[];
  buttonLabel: string;
  onPress: () => void;
}

/**
 * Full-screen end-of-run card (ESCAPED, CAUGHT, ...). A full-screen interactive
 * blocker sits under it, so no touch can reach the joystick while it's open.
 */
export class ResultOverlay {
  constructor(scene: Phaser.Scene, opts: ResultOverlayOptions) {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const objects: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text)[] = [];

    const blocker = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, O.backdropAlpha)
      .setOrigin(0, 0)
      .setInteractive();
    objects.push(blocker);

    const title = scene.add
      .text(cx, cy - 220, opts.title, {
        fontFamily: 'sans-serif',
        fontSize: '96px',
        fontStyle: 'bold',
        color: opts.titleColor,
        stroke: '#000000',
        strokeThickness: 8,
        align: 'center',
      })
      .setOrigin(0.5);
    // Long titles (e.g. later fail reasons) shrink to fit the screen.
    const maxW = GAME_WIDTH - 60;
    if (title.width > maxW) title.setScale(maxW / title.width);
    objects.push(title);

    (opts.lines ?? []).forEach((line, i) => {
      objects.push(
        scene.add
          .text(cx, cy - 90 + i * 60, line, { fontFamily: 'sans-serif', fontSize: '48px', color: '#ffffff' })
          .setOrigin(0.5),
      );
    });

    const button = scene.add
      .rectangle(cx, cy + 120, O.buttonWidth, O.buttonHeight, O.buttonColor)
      .setStrokeStyle(4, 0xffffff, 0.8);
    const label = scene.add
      .text(cx, cy + 120, opts.buttonLabel, {
        fontFamily: 'sans-serif',
        fontSize: '52px',
        fontStyle: 'bold',
        color: '#1a1406',
      })
      .setOrigin(0.5);
    objects.push(button, label);

    for (const o of objects) {
      o.setScrollFactor(0).setDepth(O.depth);
    }
    label.setDepth(O.depth + 1);
    markUi(scene, ...objects);

    // Only a tap that *starts* on the button counts, so a finger still held from
    // the joystick can't trigger it by lifting. Small delay avoids accidental taps.
    let armed = false;
    let pressed = false;
    scene.time.delayedCall(O.inputDelayMs, () => {
      button.setInteractive({ useHandCursor: false });
      button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        armed = true;
        button.setFillStyle(O.buttonPressedColor);
      });
      button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
        armed = false;
        button.setFillStyle(O.buttonColor);
      });
      button.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        if (!armed || pressed) return;
        pressed = true;
        opts.onPress();
      });
    });
  }
}
