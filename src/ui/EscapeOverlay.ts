import Phaser from 'phaser';
import { ResultOverlay } from './ResultOverlay';

/** "ESCAPED!" screen with the run time. */
export class EscapeOverlay {
  constructor(scene: Phaser.Scene, timeMs: number, onPlayAgain: () => void) {
    new ResultOverlay(scene, {
      title: 'ESCAPED!',
      titleColor: '#ffe7a3',
      lines: [`Time: ${(timeMs / 1000).toFixed(1)}s`],
      buttonLabel: 'Play again',
      onPress: onPlayAgain,
    });
  }
}
