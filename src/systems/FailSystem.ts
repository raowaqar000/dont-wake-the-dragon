import Phaser from 'phaser';
import { TUNING } from '../config';
import type { Player } from '../entities/Player';
import type { PlayerVisual } from '../entities/PlayerVisual';
import type { Joystick } from '../ui/Joystick';
import { ResultOverlay, type ResultLine } from '../ui/ResultOverlay';

const F = TUNING.fail;

/** What ended the run. Shown on the overlay. */
export interface FailReason {
  id: string;
  title: string;
  titleColor: string;
  subtitle?: string;
}

/** How the player reacts on screen. */
export type FailEffect =
  | { kind: 'hit' }
  /** Falls into a pit centered at (x, y). */
  | { kind: 'fall'; x: number; y: number }
  /** Burnt by dragon fire: turns black (the dragon adds the smoke). */
  | { kind: 'charred' }
  /** Squashed flat (closing walls, falling rock). */
  | { kind: 'crush' };

export const FAIL_REASONS = {
  trap: { id: 'trap', title: 'CAUGHT!', titleColor: F.titleColor, subtitle: 'The cave got you.' },
  pit: { id: 'pit', title: 'CAUGHT!', titleColor: F.titleColor, subtitle: 'The floor gave way.' },
  dragon: { id: 'dragon', title: 'THE DRAGON WOKE UP!', titleColor: F.titleColor, subtitle: 'You made too much noise.' },
  crushed: { id: 'crushed', title: 'SQUASHED!', titleColor: F.titleColor, subtitle: 'The cave closed in.' },
} as const satisfies Record<string, FailReason>;

export interface FailSystemDeps {
  player: Player;
  visual: PlayerVisual;
  joystick: Joystick;
  camera: Phaser.Cameras.Scene2D.Camera;
  onRetry: () => void;
  /** Extra lines for the CAUGHT card (e.g. "Loot lost: 120"), read when the card opens. */
  resultLines?: () => ResultLine[];
  /** Called once when a real (non-godMode) fail starts: count the death, disable buttons. */
  onDeath?: () => void;
  /** godMode ignored a fail (systems that latched a fail can re-arm). */
  onGodModeIgnored?: () => void;
}

/**
 * Single owner of "the run is over". Escape and every fail go through lock(),
 * so only the first outcome wins.
 *  - fail(reason, effect): instant fail (traps, pits).
 *  - begin() ... finish(reason, effect): a fail with a sequence in between (the dragon
 *    wakes, roars and breathes fire). begin() locks the run and freezes input at once.
 */
export class FailSystem {
  private over = false;
  private finished = false;
  private lastGodFlash = -Infinity;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: FailSystemDeps,
  ) {}

  get isOver(): boolean {
    return this.over;
  }

  /** Claims the outcome. Returns false if the run already ended. */
  lock(): boolean {
    if (this.over) return false;
    this.over = true;
    return true;
  }

  fail(reason: FailReason, effect: FailEffect = { kind: 'hit' }): void {
    if (this.over || this.godModeIgnore(reason)) return;
    this.begin();
    this.finish(reason, effect);
  }

  /**
   * Trap death: quick hit effect, then the level restarts after quickRestartMs with no
   * overlay. Dragon wake-ups keep the full sequence + card (begin/finish).
   */
  quickFail(reason: FailReason, effect: FailEffect = { kind: 'hit' }): void {
    if (this.over || this.godModeIgnore(reason)) return;
    this.begin();
    this.finished = true;
    this.playEffect(effect);
    console.info(`[fail] ${reason.id} -> quick restart`);
    this.scene.time.delayedCall(F.quickRestartMs, this.deps.onRetry);
  }

  private godModeIgnore(reason: FailReason): boolean {
    if (!TUNING.debug.godMode) return false;
    const now = this.scene.time.now;
    if (now - this.lastGodFlash > 500) {
      this.lastGodFlash = now;
      const c = F.flashColor;
      this.deps.camera.flash(120, c.r, c.g, c.b);
      console.info(`[godMode] ignored fail: ${reason.id}`);
    }
    this.deps.onGodModeIgnored?.();
    return true;
  }

  /** Claims the outcome and freezes the player. Returns false if the run already ended. */
  begin(): boolean {
    if (!this.lock()) return false;
    this.deps.player.freeze();
    this.deps.joystick.setEnabled(false);
    this.deps.onDeath?.();
    return true;
  }

  /** Plays the effect, then opens the CAUGHT card after `overlayDelayMs`. Call after begin(). */
  finish(reason: FailReason, effect: FailEffect = { kind: 'hit' }, overlayDelayMs: number = F.overlayDelayMs): void {
    if (!this.over || this.finished) return;
    this.finished = true;
    this.playEffect(effect);

    this.scene.time.delayedCall(overlayDelayMs, () => {
      new ResultOverlay(this.scene, {
        title: reason.title,
        titleColor: reason.titleColor,
        lines: [...(reason.subtitle ? [reason.subtitle] : []), ...(this.deps.resultLines?.() ?? [])],
        buttonLabel: 'Try again',
        onPress: this.deps.onRetry,
      });
    });
  }

  private playEffect(effect: FailEffect): void {
    const { player, visual, camera } = this.deps;
    const c = F.flashColor;
    if (effect.kind === 'charred') {
      visual.char(F.charColor, F.charMs);
      return;
    }
    camera.flash(F.flashMs, c.r, c.g, c.b);
    camera.shake(F.shakeMs, F.shakeIntensity);
    if (effect.kind === 'fall') {
      // Stop walls from shoving the body around mid-fall.
      (player.body as Phaser.Physics.Arcade.Body).enable = false;
      visual.fallInto(effect.x, effect.y, F.fallMs);
    } else if (effect.kind === 'crush') {
      (player.body as Phaser.Physics.Arcade.Body).enable = false;
      visual.crush(F.crushSquash, F.crushMs);
      visual.blink(F.hitTintColor, F.hitBlinkMs, F.hitBlinks);
    } else {
      visual.blink(F.hitTintColor, F.hitBlinkMs, F.hitBlinks);
    }
  }
}
