import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TUNING } from '../config';

const O = TUNING.overlay;

/**
 * "ESCAPED!" screen. A full-screen interactive blocker sits under it, so no
 * touch can reach the joystick while it's open.
 */
export class EscapeOverlay {
  constructor(scene: Phaser.Scene, timeMs: number, onPlayAgain: () => void) {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const objects: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text)[] = [];

    const blocker = scene.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, O.backdropAlpha)
      .setOrigin(0, 0)
      .setInteractive();
    objects.push(blocker);

    objects.push(
      scene.add
        .text(cx, cy - 220, 'ESCAPED!', {
          fontFamily: 'sans-serif',
          fontSize: '96px',
          fontStyle: 'bold',
          color: '#ffe7a3',
          stroke: '#000000',
          strokeThickness: 8,
        })
        .setOrigin(0.5),
      scene.add
        .text(cx, cy - 90, `Time: ${(timeMs / 1000).toFixed(1)}s`, {
          fontFamily: 'sans-serif',
          fontSize: '48px',
          color: '#ffffff',
        })
        .setOrigin(0.5),
    );

    const button = scene.add
      .rectangle(cx, cy + 120, O.buttonWidth, O.buttonHeight, O.buttonColor)
      .setStrokeStyle(4, 0xffffff, 0.8);
    const label = scene.add
      .text(cx, cy + 120, 'Play again', { fontFamily: 'sans-serif', fontSize: '52px', fontStyle: 'bold', color: '#1a1406' })
      .setOrigin(0.5);
    objects.push(button, label);

    for (const o of objects) {
      o.setScrollFactor(0).setDepth(O.depth);
    }
    label.setDepth(O.depth + 1);

    // Only a tap that *starts* on the button counts, so a finger still held from
    // the joystick can't trigger it by lifting. Small delay avoids accidental taps.
    let armed = false;
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
        if (armed) onPlayAgain();
      });
    });
  }
}
