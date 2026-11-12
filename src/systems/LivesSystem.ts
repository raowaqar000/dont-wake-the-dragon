import Phaser from 'phaser';
import { TUNING } from '../config';
import { loadLives, resetLives, saveLives } from './SaveData';

const L = TUNING.lives;

export const LIVES_EVENTS = {
  /** Payload: LivesChange. */
  changed: 'lives-changed',
} as const;

/** Where extra lives come from (only 'debug' is used today; the rest are hooks). */
export type LifeSource = 'pickup' | 'shop' | 'ad' | 'debug';

export interface LivesChange {
  lives: number;
  /** Hearts slots shown (max of start and current lives). */
  slots: number;
  /** -1 = a life lost, +n = lives gained, 0 = reset. */
  delta: number;
  cause: 'death' | 'gain' | 'reset';
}

/**
 * Lives for the current level attempt. The count lives in SaveData (memory only) so it
 * survives the scene restart of a checkpoint respawn. FailSystem spends a life on every
 * real death (consumeLife dep); GameScene refills them on escape and on game over.
 * Hook for later: addLives() for the extra-life pickup 'L', a shop or a rewarded ad.
 */
export class LivesSystem extends Phaser.Events.EventEmitter {
  private count: number;

  constructor(private readonly levelId: string) {
    super();
    const saved = Math.min(L.max, loadLives(levelId));
    // A run never starts with 0 lives (the game over card refills them; this is a safety net).
    this.count = saved > 0 ? saved : L.start;
    if (saved <= 0) resetLives(levelId);
  }

  get lives(): number {
    return this.count;
  }

  /** Number of heart slots to show: at least TUNING.lives.start. */
  get slots(): number {
    return Math.max(L.start, this.count);
  }

  get isLastLife(): boolean {
    return this.count === 1;
  }

  get isOut(): boolean {
    return this.count <= 0;
  }

  get debugLine(): string {
    return `lives: ${this.count}/${this.slots}`;
  }

  /** Spends one life (a death). Returns the lives left. */
  loseLife(): number {
    if (this.count <= 0) return 0;
    this.count--;
    saveLives(this.levelId, this.count);
    this.emitChange(-1, 'death');
    return this.count;
  }

  /**
   * Adds lives (capped at TUNING.lives.max). Hook for the future extra-life pickup,
   * shop and rewarded ads. Returns how many were actually added.
   */
  addLives(n: number, source: LifeSource): number {
    const add = Math.max(0, Math.min(Math.floor(n), L.max - this.count));
    if (add === 0) return 0;
    this.count += add;
    saveLives(this.levelId, this.count);
    console.info(`[lives] +${add} (${source}) -> ${this.count}`);
    this.emitChange(add, 'gain');
    return add;
  }

  /** Full lives for the next attempt (escape, game over). */
  resetToFull(): void {
    resetLives(this.levelId);
    this.count = L.start;
    this.emitChange(0, 'reset');
  }

  private emitChange(delta: number, cause: LivesChange['cause']): void {
    const e: LivesChange = { lives: this.count, slots: this.slots, delta, cause };
    this.emit(LIVES_EVENTS.changed, e);
  }
}
