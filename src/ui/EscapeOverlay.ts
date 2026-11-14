import Phaser from 'phaser';
import { TUNING } from '../config';
import { ResultOverlay, type ResultLine } from './ResultOverlay';

export interface EscapeStats {
  timeMs: number;
  loot: number;
  gems: number;
  gemsTotal: number;
  chests: number;
  chestsTotal: number;
  /** Best loot before this run. */
  previousBest: number;
  newBest: boolean;
  /** Lifetime deaths on this level. */
  deaths: number;
}

/**
 * "ESCAPED!" screen with loot, time, gems/chests found and best loot.
 * With onNextLevel: "Next level" on top, "Play again" under it. Without (last level): only "Play again".
 */
export class EscapeOverlay {
  constructor(scene: Phaser.Scene, stats: EscapeStats, onPlayAgain: () => void, onNextLevel?: () => void) {
    const lines: (string | ResultLine)[] = [
      { text: `Loot: ${stats.loot}`, color: TUNING.hud.lootColor, bold: true, fontSize: 56 },
      `Time: ${(stats.timeMs / 1000).toFixed(1)}s`,
      `Gems ${stats.gems}/${stats.gemsTotal}   Chests ${stats.chests}/${stats.chestsTotal}`,
      { text: `Deaths: ${stats.deaths}`, color: TUNING.hud.deathsColor, fontSize: 40 },
      stats.newBest
        ? { text: 'NEW BEST!', color: TUNING.overlay.newBestColor, bold: true, fontSize: 56, pulse: true }
        : { text: `Best: ${stats.previousBest}`, color: '#bbbbbb', fontSize: 40 },
    ];
    const O = TUNING.overlay;
    new ResultOverlay(scene, {
      title: 'ESCAPED!',
      titleColor: '#ffe7a3',
      lines,
      ...(onNextLevel
        ? {
            buttonLabel: O.nextLevelLabel,
            onPress: onNextLevel,
            secondaryButton: { label: O.playAgainLabel, onPress: onPlayAgain },
          }
        : { buttonLabel: O.playAgainLabel, onPress: onPlayAgain }),
    });
  }
}
