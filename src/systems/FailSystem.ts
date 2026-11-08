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
  | { kind: 'fall'; x: number; y: number };

export const FAIL_REASONS = {
  trap: { id: 'trap', title: 'CAUGHT!', titleColor: F.titleColor, subtitle: 'The cave got you.' },
  pit: { id: 'pit', title: 'CAUGHT!', titleColor: F.titleColor, subtitle: 'The floor gave way.' },
  /** Reserved for the dragon feature. */
  dragon: { id: 'dragon', title: 'THE DRAGON WOKE UP!', titleColor: F.titleColor },
} as const satisfies Record<string, FailReason>;

export interface FailSystemDeps {
  player: Player;
  visual: PlayerVisual;
  joystick: Joystick;
  camera: Phaser.Cameras.Scene2D.Camera;
  onRetry: () => void;
  /** Extra lines for the CAUGHT card (e.g. "Loot lost: 120"), read when the card opens. */
  resultLines?: () => ResultLine[];
}

/**
 * Single owner of "the run is over". Escape and every fail (traps now, the dragon
 * later) go through lock(), so only the first outcome wins.
 */
export class FailSystem {
  private over = false;
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
    if (this.over) return;
    const { player, visual, joystick, camera } = this.deps;

    if (TUNING.debug.godMode) {
      const now = this.scene.time.now;
      if (now - this.lastGodFlash > 500) {
        this.lastGodFlash = now;
        camera.flash(120, F.flashColor.r, F.flashColor.g, F.flashColor.b);
        console.info(`[godMode] ignored fail: ${reason.id}`);
      }
      return;
    }

    this.lock();
    player.freeze();
    joystick.setEnabled(false);

    camera.flash(F.flashMs, F.flashColor.r, F.flashColor.g, F.flashColor.b);
    camera.shake(F.shakeMs, F.shakeIntensity);
    if (effect.kind === 'fall') {
      // Stop the new pit wall from shoving the body around mid-fall.
      (player.body as Phaser.Physics.Arcade.Body).enable = false;
      visual.fallInto(effect.x, effect.y, F.fallMs);
    } else {
      visual.blink(F.hitTintColor, F.hitBlinkMs, F.hitBlinks);
    }

    this.scene.time.delayedCall(F.overlayDelayMs, () => {
      new ResultOverlay(this.scene, {
        title: reason.title,
        titleColor: reason.titleColor,
        lines: [...(reason.subtitle ? [reason.subtitle] : []), ...(this.deps.resultLines?.() ?? [])],
        buttonLabel: 'Try again',
        onPress: this.deps.onRetry,
      });
    });
  }
}
