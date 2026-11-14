import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TUNING } from '../config';
import { markUi } from '../systems/CameraRig';

const O = TUNING.overlay;

/** A result line with its own style (e.g. "NEW BEST!"). */
export interface ResultLine {
  text: string;
  color?: string;
  fontSize?: number;
  bold?: boolean;
  /** Gentle scale pulse to draw the eye. */
  pulse?: boolean;
}

export interface ResultOverlayOptions {
  title: string;
  titleColor: string;
  /** Smaller lines under the title (time, loot, reason...). */
  lines?: (string | ResultLine)[];
  buttonLabel: string;
  onPress: () => void;
  /** Bigger button for important cards (e.g. "Restart level"); defaults from TUNING.overlay. */
  buttonWidth?: number;
  buttonHeight?: number;
  buttonFontSize?: number;
  /** Optional second button stacked under the main one (same size, same tap safety). */
  secondaryButton?: { label: string; onPress: () => void };
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

    const lines = opts.lines ?? [];
    const pulsing: Phaser.GameObjects.Text[] = [];
    lines.forEach((raw, i) => {
      const line: ResultLine = typeof raw === 'string' ? { text: raw } : raw;
      const t = scene.add
        .text(cx, cy - 90 + i * O.lineGap, line.text, {
          fontFamily: 'sans-serif',
          fontSize: `${line.fontSize ?? 48}px`,
          fontStyle: line.bold ? 'bold' : 'normal',
          color: line.color ?? '#ffffff',
          stroke: '#000000',
          strokeThickness: line.bold ? 6 : 0,
        })
        .setOrigin(0.5);
      if (t.width > maxW) t.setScale(maxW / t.width);
      if (line.pulse) pulsing.push(t);
      objects.push(t);
    });

    // Button sits below the last line (same spot as before for short cards).
    const bw = opts.buttonWidth ?? O.buttonWidth;
    const bh = opts.buttonHeight ?? O.buttonHeight;
    const lastLineY = cy - 90 + Math.max(0, lines.length - 1) * O.lineGap;
    const buttonY = Math.max(cy + 120, lastLineY + 40 + bh / 2);
    const makeButton = (y: number, text: string) => {
      const rect = scene.add.rectangle(cx, y, bw, bh, O.buttonColor).setStrokeStyle(4, 0xffffff, 0.8);
      const label = scene.add
        .text(cx, y, text, {
          fontFamily: 'sans-serif',
          fontSize: `${opts.buttonFontSize ?? 52}px`,
          fontStyle: 'bold',
          color: '#1a1406',
        })
        .setOrigin(0.5);
      if (label.width > bw - 20) label.setScale((bw - 20) / label.width);
      objects.push(rect, label);
      return { rect, label };
    };
    const buttons = [{ ...makeButton(buttonY, opts.buttonLabel), onPress: opts.onPress }];
    if (opts.secondaryButton) {
      const b = opts.secondaryButton;
      buttons.push({ ...makeButton(buttonY + bh + O.buttonGap, b.label), onPress: b.onPress });
    }

    for (const o of objects) {
      o.setScrollFactor(0).setDepth(O.depth);
    }
    for (const b of buttons) b.label.setDepth(O.depth + 1);
    markUi(scene, ...objects);

    for (const t of pulsing) {
      scene.tweens.add({
        targets: t,
        scale: t.scale * 1.12,
        duration: O.newBestPulseMs,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Only a tap that *starts* on a button counts, so a finger still held from the joystick
    // can't trigger it by lifting. Small delay avoids accidental taps. One shared `pressed`
    // flag: only one button action can ever fire per card.
    let pressed = false;
    scene.time.delayedCall(O.inputDelayMs, () => {
      for (const { rect, onPress } of buttons) {
        let armed = false;
        rect.setInteractive({ useHandCursor: false });
        rect.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
          armed = true;
          rect.setFillStyle(O.buttonPressedColor);
        });
        rect.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
          armed = false;
          rect.setFillStyle(O.buttonColor);
        });
        rect.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
          if (!armed || pressed) return;
          pressed = true;
          onPress();
        });
      }
    });
  }
}
