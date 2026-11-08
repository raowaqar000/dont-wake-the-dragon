import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import {
  RUN_FOOTFALL_FRAMES,
  heroAnimKey,
  heroFootOffset,
  heroFrameInfo,
  heroSackAnchor,
  type HeroDir,
  type HeroPose,
} from '../systems/HeroTextureFactory';
import type { Player } from './Player';

const V = TUNING.playerVisual;
const M = TUNING.movement;

export type Facing = 'down' | 'up' | 'left' | 'right';

/**
 * What the player looks like. Follows the (invisible) physics Player and
 * picks direction + animation from its real velocity. Knows nothing about input.
 */
export class PlayerVisual {
  public facing: Facing = 'down';
  public pose: HeroPose = 'idle';

  private readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Sprite;
  /** Separate part so it can grow with treasure later. */
  public readonly sack: Phaser.GameObjects.Image;
  private readonly dust?: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Effect offsets layered on top of the normal look (teleport, hit, fall). */
  private readonly fx = { scale: 1, alpha: 1, angle: 0, dx: 0, dy: 0 };
  private readonly scene: Phaser.Scene;

  constructor(
    scene: Phaser.Scene,
    private readonly player: Player,
  ) {
    this.scene = scene;
    const s = 1 / V.textureResolution;
    this.body = scene.add.sprite(0, 0, TEXTURE_KEYS.hero).setScale(s);
    this.sack = scene.add.image(0, 0, TEXTURE_KEYS.heroSack).setScale(s * V.sack.scale);
    this.root = scene.add.container(player.x, player.y + V.offsetY, [this.sack, this.body]).setDepth(V.depth);

    const D = V.dust;
    if (D.enabled) {
      this.dust = scene.add
        .particles(0, 0, TEXTURE_KEYS.dust, {
          lifespan: D.lifespanMs,
          speed: { min: D.speedMin, max: D.speedMax },
          angle: { min: 0, max: 360 },
          scale: { start: D.scaleStart * s, end: D.scaleEnd * s },
          alpha: { start: D.alpha, end: 0 },
          tint: D.color,
          emitting: false,
        })
        .setDepth(V.depth - 1);
    }

    this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.onFrame, this);
    this.applyAnimation(1);
    this.sync();

    // Sync after physics has moved the body, so the visual never lags a frame.
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.sync, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.sync, this);
    });
  }

  private get dir(): HeroDir {
    return this.facing === 'left' || this.facing === 'right' ? 'side' : this.facing;
  }

  private sync(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    const speed = Math.hypot(vx, vy);

    this.updateFacing(vx, vy, speed);

    this.pose = speed < V.animMinSpeed ? 'idle' : this.player.moveState === 'run' ? 'run' : 'sneak';
    const ref = this.pose === 'run' ? M.runSpeed : M.sneakSpeed;
    const timeScale = this.pose === 'idle' ? 1 : Phaser.Math.Clamp(speed / ref, V.timeScaleMin, V.timeScaleMax);
    this.applyAnimation(timeScale);

    const flip = this.facing === 'left' ? -1 : 1;
    const fx = this.fx;
    this.root.setPosition(this.player.x + fx.dx, this.player.y + V.offsetY + fx.dy);
    this.root.setScale(V.displayScale * flip * fx.scale, V.displayScale * fx.scale);
    this.root.setAlpha(fx.alpha).setAngle(fx.angle);

    // Sack sits over his back when walking away from the camera, behind him otherwise.
    if (this.dir === 'up') this.root.bringToTop(this.sack);
    else this.root.sendToBack(this.sack);
    const info = heroFrameInfo(this.body.frame.name);
    const anchor = heroSackAnchor(this.dir, info?.pose ?? 'idle', info?.index ?? 0);
    this.sack.setPosition(anchor.x, anchor.y);
  }

  /** Teleport entry: flash white, spin and shrink away. */
  shrinkOut(ms: number, onDone: () => void): void {
    this.setTintFill(0xffffff);
    this.scene.tweens.add({
      targets: this.fx,
      scale: 0.1,
      alpha: 0,
      angle: 180,
      duration: ms,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.clearTint();
        onDone();
      },
    });
  }

  /** Teleport exit: pop back to full size with a little overshoot. */
  popIn(ms: number, onDone: () => void): void {
    Object.assign(this.fx, { scale: 0.1, alpha: 0, angle: -90 });
    this.scene.tweens.add({
      targets: this.fx,
      scale: 1,
      alpha: 1,
      angle: 0,
      duration: ms,
      ease: 'Back.easeOut',
      onComplete: onDone,
    });
  }

  /** Blink in a color a few times (caught). */
  blink(color: number, blinkMs: number, times: number): void {
    let on = false;
    this.scene.time.addEvent({
      delay: blinkMs,
      repeat: times * 2 - 1,
      callback: () => {
        on = !on;
        if (on) this.setTintFill(color);
        else this.clearTint();
      },
    });
  }

  /** Fall into a pit at (x, y): slide to its center while spinning and shrinking. */
  fallInto(x: number, y: number, ms: number): void {
    this.scene.tweens.add({
      targets: this.fx,
      dx: x - this.player.x,
      dy: y - this.player.y,
      scale: 0,
      alpha: 0.2,
      angle: 300,
      duration: ms,
      ease: 'Quad.easeIn',
    });
  }

  private setTintFill(color: number): void {
    this.body.setTintFill(color);
    this.sack.setTintFill(color);
  }

  private clearTint(): void {
    this.body.clearTint();
    this.sack.clearTint();
  }

  private updateFacing(vx: number, vy: number, speed: number): void {
    if (speed < V.animMinSpeed) return; // keep the last facing while standing still
    const ax = Math.abs(vx);
    const ay = Math.abs(vy);
    const h = 1 + V.facingHysteresis;
    const wasHorizontal = this.facing === 'left' || this.facing === 'right';
    const horizontal = wasHorizontal ? ax * h >= ay : ax > ay * h;
    this.facing = horizontal ? (vx < 0 ? 'left' : 'right') : vy < 0 ? 'up' : 'down';
  }

  private applyAnimation(timeScale: number): void {
    this.body.anims.play(heroAnimKey(this.dir, this.pose), true);
    this.body.anims.timeScale = timeScale;
  }

  private onFrame(_anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame): void {
    if (!this.dust) return;
    const info = heroFrameInfo(frame.textureFrame);
    if (!info || info.pose !== 'run' || !RUN_FOOTFALL_FRAMES.includes(info.index)) return;

    const foot = heroFootOffset(info.dir, info.index);
    const flip = this.facing === 'left' ? -1 : 1;
    this.dust.explode(
      V.dust.count,
      this.root.x + foot.x * V.displayScale * flip,
      this.root.y + foot.y * V.displayScale,
    );
  }
}
