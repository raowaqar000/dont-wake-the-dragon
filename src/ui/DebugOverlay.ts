import Phaser from 'phaser';
import { TUNING } from '../config';
import type { Player } from '../entities/Player';
import type { Joystick } from './Joystick';

const D = TUNING.debug;

/** Small top-left readout: move state, FPS, joystick strength, speed. */
export class DebugOverlay {
  private readonly scene: Phaser.Scene;
  private readonly text: Phaser.GameObjects.Text;
  private elapsed = Number.POSITIVE_INFINITY; // refresh on first update

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.text = scene.add
      .text(16, 16, '', {
        fontFamily: 'monospace',
        fontSize: `${D.fontSize}px`,
        color: D.color,
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: { x: 8, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(D.depth);
  }

  update(deltaMs: number, player: Player, joystick: Joystick): void {
    this.elapsed += deltaMs;
    if (this.elapsed < D.refreshMs) return;
    this.elapsed = 0;

    const fps = Math.round(this.scene.game.loop.actualFps);
    this.text.setText([
      `state: ${player.moveState}`,
      `fps:   ${fps}`,
      `str:   ${joystick.strength.toFixed(2)}`,
      `speed: ${Math.round(player.speed)}`,
    ]);
  }
}
