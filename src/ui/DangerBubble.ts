import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import { HINT_TEXTURE_SCALE } from '../systems/HintTextureFactory';

const H = TUNING.hints;

/**
 * Danger sense: a small "!" bubble that pops above the hero's head, follows him,
 * then fades. One reused image (no allocations per alert).
 */
export class DangerBubble {
  private readonly img: Phaser.GameObjects.Image;
  private tween?: Phaser.Tweens.TweenChain;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly target: Phaser.GameObjects.Components.Transform,
  ) {
    this.img = scene.add.image(0, 0, TEXTURE_KEYS.dangerBubble).setDepth(H.bubbleDepth).setVisible(false).setOrigin(0.5, 1);
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.follow, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.follow, this));
  }

  show(): void {
    this.tween?.stop();
    const s = HINT_TEXTURE_SCALE;
    this.img.setVisible(true).setAlpha(1).setScale(s * 0.3);
    this.follow();
    this.tween = this.scene.tweens.chain({
      targets: this.img,
      tweens: [
        { scale: s * H.bubblePopScale, duration: H.bubblePopMs, ease: 'Back.easeOut' },
        { scale: s, duration: H.bubblePopMs },
        { alpha: 0, delay: H.bubbleHoldMs, duration: H.bubbleFadeMs },
      ],
      onComplete: () => this.img.setVisible(false),
    });
  }

  private follow(): void {
    if (!this.img.visible) return;
    // Origin is the tail tip (bottom center), bubbleOffsetY above the body center.
    this.img.setPosition(this.target.x, this.target.y - H.bubbleOffsetY);
  }
}
