import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TEXTURE_KEYS, TUNING } from '../config';
import { markUi } from '../systems/CameraRig';
import { LIVES_EVENTS, type LivesChange, type LivesSystem } from '../systems/LivesSystem';
import { UI_TEXTURE_SCALE } from '../systems/UiTextureFactory';

const L = TUNING.lives;
const H = TUNING.hud;
const S = UI_TEXTURE_SCALE;

interface HeartSlot {
  empty: Phaser.GameObjects.Image;
  full: Phaser.GameObjects.Image;
}

/**
 * Hearts under the HUD bar, right-aligned (the deaths counter sits on the left).
 * Losing a life: the heart shakes, cracks into two halves that fall apart, and the empty
 * heart fades in. Last life: the remaining heart pulses red and a red glow hugs the screen
 * edges (fades out at 0). Code-drawn hearts for now (UiTextureFactory).
 */
export class LivesHud {
  private readonly slots: HeartSlot[] = [];
  private readonly vignette: Phaser.GameObjects.Image;
  private shownSlots = 0;
  private pulse?: Phaser.Tweens.Tween;
  private pulseTint?: Phaser.Tweens.Tween;
  private vignettePulse?: Phaser.Tweens.Tween;
  private vignetteOn = false;

  constructor(
    private readonly scene: Phaser.Scene,
    lives: LivesSystem,
  ) {
    // Every possible slot is made once (max is small); only the needed ones are visible.
    for (let i = 0; i < L.max; i++) {
      const empty = scene.add.image(0, L.centerY, TEXTURE_KEYS.heartEmpty).setScale(S).setScrollFactor(0).setDepth(H.depth);
      const full = scene.add.image(0, L.centerY, TEXTURE_KEYS.heartFull).setScale(S).setScrollFactor(0).setDepth(H.depth + 1);
      markUi(scene, empty, full);
      this.slots.push({ empty, full });
    }

    // Red edge glow over the whole screen. Not interactive, so it never eats touches.
    this.vignette = scene.add
      .image(0, 0, TEXTURE_KEYS.dangerVignette)
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setScrollFactor(0)
      .setDepth(L.vignetteDepth)
      .setAlpha(0)
      .setVisible(false);
    markUi(scene, this.vignette);

    this.layout(lives.slots);
    this.showStatic(lives.lives);
    this.updateDanger(lives.lives);

    lives.on(LIVES_EVENTS.changed, this.onChange, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => lives.off(LIVES_EVENTS.changed, this.onChange, this));
  }

  private onChange(e: LivesChange): void {
    if (e.slots !== this.shownSlots) this.layout(e.slots);
    if (e.cause === 'death') {
      // Hearts fill left to right, so the one that just broke is at index `lives`.
      this.breakHeart(e.lives);
    } else if (e.cause === 'gain') {
      for (let i = e.lives - e.delta; i < e.lives; i++) this.popHeart(i);
    } else {
      this.showStatic(e.lives);
    }
    this.updateDanger(e.lives);
  }

  /** Right-aligned row of `n` slots. */
  private layout(n: number): void {
    this.shownSlots = n;
    const step = L.heartSize + L.heartGap;
    this.slots.forEach((s, i) => {
      const visible = i < n;
      const x = L.rightX - L.heartSize / 2 - (n - 1 - i) * step;
      s.empty.setVisible(visible).setX(x);
      s.full.setVisible(visible).setX(x);
    });
  }

  /** Full hearts for the first `lives` slots, empty for the rest (no animation). */
  private showStatic(lives: number): void {
    this.slots.forEach((s, i) => {
      this.scene.tweens.killTweensOf(s.full);
      s.full.setScale(S).setAngle(0).setY(L.centerY).clearTint();
      const has = i < lives;
      s.full.setAlpha(has ? 1 : 0);
      s.empty.setAlpha(has ? 0 : 1);
    });
  }

  private popHeart(index: number): void {
    const s = this.slots[index];
    if (!s) return;
    this.scene.tweens.killTweensOf(s.full);
    s.empty.setAlpha(0);
    s.full.setAlpha(1).setScale(S * L.gainPopScale);
    this.scene.tweens.add({ targets: s.full, scale: S, duration: L.gainPopMs, ease: 'Back.easeOut' });
  }

  /** Shake, crack into two halves that fall apart and fade, then the empty heart fades in. */
  private breakHeart(index: number): void {
    const s = this.slots[index];
    if (!s) return;
    const sc = this.scene;
    const x = s.full.x;
    if (index === 0) this.stopPulse();
    sc.tweens.killTweensOf(s.full);
    s.full.setScale(S).setAlpha(1).clearTint();

    sc.tweens.add({
      targets: s.full,
      x: { from: x - L.shakePx, to: x + L.shakePx },
      duration: L.shakeMs / 6,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        s.full.setX(x).setAlpha(0);
        for (const side of [-1, 1] as const) {
          const shard = sc.add
            .image(x, L.centerY, side < 0 ? TEXTURE_KEYS.heartShardLeft : TEXTURE_KEYS.heartShardRight)
            .setScale(S)
            .setScrollFactor(0)
            .setDepth(H.depth + 2);
          markUi(sc, shard);
          sc.tweens.add({
            targets: shard,
            x: x + side * L.breakSpreadPx,
            y: L.centerY + L.breakFallPx,
            angle: side * L.breakSpinDeg,
            alpha: 0,
            duration: L.breakMs,
            ease: 'Quad.easeIn',
            onComplete: () => shard.destroy(),
          });
        }
        sc.tweens.add({ targets: s.empty, alpha: 1, duration: L.emptyFadeMs, ease: 'Quad.easeOut' });
      },
    });
  }

  /** Last life: pulse the remaining heart + red edge glow. Otherwise both off. */
  private updateDanger(lives: number): void {
    const last = lives === 1;
    if (last) this.startPulse(this.slots[0]);
    else this.stopPulse();
    this.setVignette(last);
  }

  private startPulse(s: HeartSlot | undefined): void {
    if (!s || this.pulse) return;
    const sc = this.scene;
    sc.tweens.killTweensOf(s.full);
    s.full.setScale(S).setAlpha(1);
    this.pulse = sc.tweens.add({
      targets: s.full,
      scale: S * L.lastPulseScale,
      duration: L.lastPulseMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    const white = Phaser.Display.Color.IntegerToColor(0xffffff);
    const red = Phaser.Display.Color.IntegerToColor(L.lastPulseTint);
    this.pulseTint = sc.tweens.addCounter({
      from: 0,
      to: 100,
      duration: L.lastPulseMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(white, red, 100, tw.getValue() ?? 0);
        s.full.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      },
    });
  }

  private stopPulse(): void {
    if (!this.pulse) return;
    this.pulse.stop();
    this.pulseTint?.stop();
    this.pulse = undefined;
    this.pulseTint = undefined;
    this.slots[0]?.full.setScale(S).clearTint();
  }

  private setVignette(on: boolean): void {
    if (on === this.vignetteOn) return;
    this.vignetteOn = on;
    const v = this.vignette;
    const sc = this.scene;
    this.vignettePulse?.stop();
    this.vignettePulse = undefined;
    sc.tweens.killTweensOf(v);
    if (on) {
      v.setVisible(true);
      sc.tweens.add({
        targets: v,
        alpha: L.vignetteMinAlpha,
        duration: L.vignetteFadeMs,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.vignettePulse = sc.tweens.add({
            targets: v,
            alpha: { from: L.vignetteMinAlpha, to: L.vignetteMaxAlpha },
            duration: L.vignettePulseMs,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        },
      });
    } else {
      sc.tweens.add({
        targets: v,
        alpha: 0,
        duration: L.vignetteFadeMs,
        ease: 'Quad.easeIn',
        onComplete: () => v.setVisible(false),
      });
    }
  }
}
