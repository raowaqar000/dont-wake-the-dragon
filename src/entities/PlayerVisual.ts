import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import { ART_ANCHORS, ART_SCALE, artKey, hasArt } from '../systems/ArtAssets';
import {
  RUN_FOOTFALL_FRAMES,
  SNEAK_FOOTFALL_FRAMES,
  heroAnimKey,
  heroFootOffset,
  heroFrameInfo,
  heroSackAnchor,
  type HeroDir,
  type HeroPose,
} from '../systems/HeroTextureFactory';
import type { Player } from './Player';

const V = TUNING.playerVisual;
const HA = TUNING.art.hero;
const M = TUNING.movement;
const TWO_PI = Math.PI * 2;

export type Facing = 'down' | 'up' | 'left' | 'right';

type ArtDir = 'down' | 'up' | 'right';

/** A foot planted. (x, y) = feet position in world px. */
export type FootstepListener = (pose: 'sneak' | 'run', x: number, y: number) => void;

/**
 * What the player looks like. Follows the (invisible) physics Player and
 * picks direction + animation from its real velocity. Knows nothing about input.
 *
 * Two looks:
 *  - painted (default): one still image per direction, animated in code (bob, tiptoe
 *    squash/stretch and sway, run bounce and lean) around a pivot at the feet. A step
 *    clock fires the footsteps. The sack is a cut-out laid exactly over the painted sack
 *    that only grows, so it always covers it.
 *  - code-drawn fallback (if the images failed to load): frame animations as before.
 */
export class PlayerVisual {
  public facing: Facing = 'down';
  public pose: HeroPose = 'idle';
  /** Called on every footfall while sneaking or running (NoiseSystem hooks in here). */
  public onFootstep: FootstepListener | null = null;

  private readonly art: boolean;
  private readonly root: Phaser.GameObjects.Container;
  /** Painted look: squash / tilt / bob happen on this container (origin at the feet). */
  private readonly pivot?: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Sprite;
  /** Separate part so it can grow with loot (growSack). */
  public readonly sack: Phaser.GameObjects.Image;
  /** Sack size from loot (1 = start) and a short bounce on top of it. */
  private readonly sackSize = { growth: 1, bounce: 1 };
  private readonly dust?: Phaser.GameObjects.Particles.ParticleEmitter;
  /** Effect offsets layered on top of the normal look (teleport, hit, fall). */
  private readonly fx = { scale: 1, alpha: 1, angle: 0, dx: 0, dy: 0 };
  /** Charred by fire: 0 = normal, 1 = fully dark. */
  private readonly charState = { t: 0 };
  private readonly scene: Phaser.Scene;

  // Painted-look motion state (no per-frame allocations).
  private artDir: ArtDir | null = null;
  /** Footsteps so far; a new whole number = a foot lands. */
  private stepPhase = 0.5;
  private idleClock = Math.random() * 1000;
  /** Blend weights of idle / sneak / run, eased toward the current pose. */
  private readonly weights = { idle: 1, sneak: 0, run: 0 };
  private frozen = false;
  /** Hop: t 0..1 through the air, plus a squash pulse (+ = wide and flat). */
  private readonly hopState = { t: 0, squash: 0 };
  private readonly shadow: Phaser.GameObjects.Ellipse;

  constructor(
    scene: Phaser.Scene,
    private readonly player: Player,
  ) {
    this.scene = scene;
    this.art = hasArt(scene, 'hero_down', 'hero_up', 'hero_right', 'hero_sack_down', 'hero_sack_up', 'hero_sack_right');
    const s = 1 / V.textureResolution;

    if (this.art) {
      this.body = scene.add.sprite(0, 0, artKey('hero_down')).setOrigin(0.5, 1).setScale(ART_SCALE);
      this.sack = scene.add.image(0, 0, artKey('hero_sack_down')).setScale(ART_SCALE);
      this.pivot = scene.add.container(0, HA.feetOffsetY, [this.body, this.sack]);
      this.root = scene.add.container(player.x, player.y + V.offsetY, [this.pivot]).setDepth(V.depth);
    } else {
      this.body = scene.add.sprite(0, 0, TEXTURE_KEYS.hero).setScale(s);
      this.sack = scene.add.image(0, 0, TEXTURE_KEYS.heroSack).setScale(s * V.sack.scale);
      this.root = scene.add.container(player.x, player.y + V.offsetY, [this.sack, this.body]).setDepth(V.depth);
    }

    // Ground shadow during a hop (stays on the floor while the hero rises).
    const JS = TUNING.jump.shadow;
    this.shadow = scene.add
      .ellipse(player.x, player.y, JS.width, JS.height, 0x000000, JS.alpha)
      .setDepth(V.depth - 0.5)
      .setVisible(false);

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

    if (!this.art) {
      this.body.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.onFrame, this);
      this.applyAnimation(1);
    }
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

  private get displayScale(): number {
    return this.art ? HA.displayScale : V.displayScale;
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

    // In the air: no walking animation or footsteps.
    if (this.player.airborne) this.pose = 'idle';

    const flip = this.facing === 'left' ? -1 : 1;
    const fx = this.fx;
    const ds = this.displayScale;
    const J = TUNING.jump;
    const arc = Math.sin(Math.PI * this.hopState.t);
    const lift = arc * J.heightPx;
    const hs = 1 + arc * J.airScale;
    const sq = this.hopState.squash;
    this.root.setPosition(this.player.x + fx.dx, this.player.y + V.offsetY + fx.dy - lift);
    this.root.setScale(ds * flip * fx.scale * hs * (1 + sq), ds * fx.scale * hs * (1 - sq));
    if (this.shadow.visible) {
      const s = 1 - arc * (1 - J.shadow.minScale);
      this.shadow.setPosition(this.player.x + fx.dx, this.player.y + TUNING.noise.feetOffsetY + fx.dy).setScale(s * fx.scale);
    }
    this.root.setAlpha(fx.alpha).setAngle(fx.angle);

    if (this.art) {
      this.syncArt(timeScale);
      return;
    }

    this.applyAnimation(timeScale);
    // Sack sits over his back when walking away from the camera, behind him otherwise.
    if (this.dir === 'up') this.root.bringToTop(this.sack);
    else this.root.sendToBack(this.sack);
    const info = heroFrameInfo(this.body.frame.name);
    const anchor = heroSackAnchor(this.dir, info?.pose ?? 'idle', info?.index ?? 0);
    this.sack.setPosition(anchor.x, anchor.y);
    this.sack.setScale((V.sack.scale * this.sackSize.growth * this.sackSize.bounce) / V.textureResolution);
  }

  /** Painted look: picks the direction image and animates bob / squash / sway / lean. */
  private syncArt(timeScale: number): void {
    const pivot = this.pivot!;
    const key: ArtDir = this.dir === 'side' ? 'right' : this.dir;
    if (key !== this.artDir) {
      this.artDir = key;
      const a = ART_ANCHORS.hero[key];
      this.body.setTexture(artKey(`hero_${key}`));
      // The sack cut-out has the same canvas as the hero; grow it from the strap point.
      this.sack
        .setTexture(artKey(`hero_sack_${key}`))
        .setOrigin(a.sackAnchor.x / a.width, a.sackAnchor.y / a.height)
        .setPosition((a.sackAnchor.x - a.width / 2) * ART_SCALE, (a.sackAnchor.y - a.height) * ART_SCALE);
    }
    this.sack.setScale(ART_SCALE * HA.sackScale * Math.max(1, this.sackSize.growth * this.sackSize.bounce));
    if (this.frozen) return;

    const dtMs = Math.min(this.scene.game.loop.delta, M.maxDeltaMs);
    const dt = dtMs / 1000;

    // Ease the pose weights so switching idle / sneak / run never snaps.
    const w = this.weights;
    const blend = 1 - Math.exp(-HA.blendPerSec * dt);
    w.idle += ((this.pose === 'idle' ? 1 : 0) - w.idle) * blend;
    w.sneak += ((this.pose === 'sneak' ? 1 : 0) - w.sneak) * blend;
    w.run += ((this.pose === 'run' ? 1 : 0) - w.run) * blend;

    // Step clock: a new whole step = a foot lands (same footstep events as the old frames).
    if (this.pose === 'idle') {
      this.stepPhase = 0.5;
    } else {
      const cfg = this.pose === 'run' ? HA.run : HA.sneak;
      const before = Math.floor(this.stepPhase);
      this.stepPhase += cfg.stepsPerSec * timeScale * dt;
      if (Math.floor(this.stepPhase) !== before) this.footstep(this.pose);
    }
    this.idleClock += dtMs;

    // Idle: slow bob and breathing.
    const I = HA.idle;
    const ib = Math.sin((this.idleClock / I.bobMs) * TWO_PI);
    let lift = w.idle * (ib * 0.5 + 0.5) * I.bobPx;
    let sy = w.idle * (1 + I.breathe * ib);
    let sx = w.idle * (1 - I.breathe * 0.5 * ib);
    let angle = 0;

    // Moving: k = 0 when a foot lands, 1 mid-step. Squash on landing, stretch in the air.
    const s = this.stepPhase % 1;
    const k = Math.sin(Math.PI * s);
    const land = (1 - k) * (1 - k);
    const side = Math.floor(this.stepPhase) % 2 === 0 ? 1 : -1;
    const sideways = this.dir === 'side';
    for (const pose of ['sneak', 'run'] as const) {
      const wt = w[pose];
      if (wt <= 0.001) continue;
      const c = HA[pose];
      lift += wt * k * c.liftPx;
      sy += wt * c.crouch * (1 - c.squash * land + c.stretch * k);
      sx += wt * (1 + c.squash * 0.6 * land - c.stretch * 0.5 * k);
      angle += wt * (c.swayDeg * k * side + (sideways ? c.leanDeg : 0));
    }

    pivot.setPosition(0, HA.feetOffsetY - lift).setScale(sx, sy).setAngle(angle);
  }

  /** Painted look: a foot landed. */
  private footstep(pose: 'sneak' | 'run'): void {
    this.onFootstep?.(pose, this.player.x, this.player.y + TUNING.noise.feetOffsetY);
    if (!this.dust || pose !== 'run') return;
    this.dust.explode(V.dust.count, this.root.x, this.root.y + HA.feetOffsetY * HA.displayScale);
  }

  /** Sets the sack size (1 = starting size). Bounces when it gets bigger. */
  growSack(scale: number): void {
    const S = TUNING.loot.sack;
    const grew = scale > this.sackSize.growth;
    this.sackSize.growth = scale;
    if (!grew) return;
    this.scene.tweens.killTweensOf(this.sackSize);
    this.sackSize.bounce = 1;
    this.scene.tweens.add({
      targets: this.sackSize,
      bounce: S.bounceScale,
      duration: S.bounceMs / 2,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  /** Hop look: squash on takeoff, rise and fall over `airMs` with a ground shadow. */
  hop(airMs: number): void {
    const J = TUNING.jump;
    this.scene.tweens.killTweensOf(this.hopState);
    this.hopState.t = 0;
    this.shadow.setVisible(true);
    this.squashPulse(J.squash);
    this.scene.tweens.add({ targets: this.hopState, t: 1, duration: airMs, ease: 'Linear' });
  }

  /** Landing: squash, hide the shadow. */
  land(): void {
    this.scene.tweens.killTweensOf(this.hopState);
    this.hopState.t = 0;
    this.shadow.setVisible(false);
    this.squashPulse(TUNING.jump.squash);
  }

  private squashPulse(amount: number): void {
    this.hopState.squash = amount;
    this.scene.tweens.add({
      targets: this.hopState,
      squash: 0,
      duration: TUNING.jump.squashMs,
      ease: 'Quad.easeOut',
    });
  }

  /** Crushed flat (closing walls). */
  crush(amount: number, ms: number): void {
    this.scene.tweens.add({ targets: this.hopState, squash: -amount, duration: ms, ease: 'Quad.easeIn' });
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

  /** Burnt by dragon fire: darkens to `color` over `ms` and stays that way. */
  char(color: number, ms: number): void {
    const from = Phaser.Display.Color.IntegerToColor(0xffffff);
    const to = Phaser.Display.Color.IntegerToColor(color);
    this.body.anims.pause();
    this.frozen = true;
    this.scene.tweens.add({
      targets: this.charState,
      t: 1,
      duration: ms,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, this.charState.t * 100);
        const tint = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
        this.body.setTint(tint);
        this.sack.setTint(tint);
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

  /** Code-drawn look: footsteps come from the animation's footfall frames. */
  private onFrame(_anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame): void {
    const info = heroFrameInfo(frame.textureFrame);
    if (!info || info.pose === 'idle') return;
    const frames = info.pose === 'run' ? RUN_FOOTFALL_FRAMES : SNEAK_FOOTFALL_FRAMES;
    if (!frames.includes(info.index)) return;
    // Only real movement makes noise (the animation can trail the state by a frame).
    if (this.pose !== info.pose) return;

    this.onFootstep?.(info.pose, this.player.x, this.player.y + TUNING.noise.feetOffsetY);

    if (!this.dust || info.pose !== 'run') return;
    const foot = heroFootOffset(info.dir, info.index);
    const flip = this.facing === 'left' ? -1 : 1;
    this.dust.explode(
      V.dust.count,
      this.root.x + foot.x * V.displayScale * flip,
      this.root.y + foot.y * V.displayScale,
    );
  }
}
