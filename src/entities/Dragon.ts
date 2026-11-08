import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import { DRAGON_HEAD_ORIGIN, DRAGON_TAIL_TIP_ORIGIN, DRAGON_TEXTURE_SCALE } from '../systems/DragonTextureFactory';
import type { DragonSpawn } from '../systems/LevelParser';
import type { NoiseListener, NoiseSource } from '../systems/NoiseSystem';

const D = TUNING.dragon;
const M = D.meter;
const S = DRAGON_TEXTURE_SCALE;

/** 1 = deep sleep, 2 = stirring, 3 = about to wake. */
export type DragonStage = 1 | 2 | 3;
type DragonState = 'asleep' | 'waking';

/** Shared effects the dragon asks for (owned by DragonSystem, one emitter for all dragons). */
export interface DragonFxSink {
  smoke(x: number, y: number, count: number): void;
}

export interface DragonCallbacks {
  onStageChange(dragon: Dragon, from: DragonStage, to: DragonStage): void;
  /** Dropped from stage 3 back to deep sleep: a near miss. */
  onPhew(dragon: Dragon): void;
}

/**
 * A sleeping dragon: solid footprint (the body lives in LevelLoader's walls), a sleep
 * meter fed by NoiseSystem, three stages with their own idle animation, and the
 * wake-up pose. Every part is placed through toWorld(), which maps the "head facing
 * right" art frame onto the level (flip for 'left'; an upright dragon would add a
 * base rotation of +-90 deg here).
 */
export class Dragon implements NoiseListener {
  public readonly index: number;
  public readonly hearing: number;
  /** Footprint center and bounds (world px). */
  public readonly cx: number;
  public readonly cy: number;
  public readonly bounds: Phaser.Geom.Rectangle;

  private meterValue = 0;
  private stageValue: DragonStage = 1;
  private state: DragonState = 'asleep';
  private quietMs = 0;
  private reachedStage3 = false;

  // Art frame -> world.
  private readonly flip: 1 | -1;
  private readonly baseAngle: number;
  private readonly cos: number;
  private readonly sin: number;

  private readonly body: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;
  private readonly tail: Phaser.GameObjects.Image;
  private readonly eyes: Phaser.GameObjects.Image[];
  private readonly glows: Phaser.GameObjects.Image[];
  private readonly zs: Phaser.GameObjects.Image[];
  private readonly zAge: number[];
  private readonly bar: Phaser.GameObjects.Graphics;

  // Animation state (no per-frame allocations).
  private breathPhase = Math.random() * Math.PI * 2;
  private lift = 0;
  /** Eye openness 0 (closed) .. 0.5 (half) .. 1 (open). */
  private readonly eyeOpen = [0, 0];
  private zTimer = 0;
  private snoreTimer = 0;
  private puffTimer = 0;
  private twitchTimer = 0;
  private twitchLeft = 0;
  private twitchSign = 1;
  private growlTimer = 0;
  private growlLeft = 0;
  private barAlpha = 0;
  private barDrawn = -1;
  /** Wake pose, tweened by wake(). */
  private readonly wakePose = { open: 0, lift: 0, turn: 0 };
  private readonly pose = { forward: 0, scale: 1, turn: 0 };
  private readonly tmp = new Phaser.Math.Vector2();

  constructor(
    private readonly scene: Phaser.Scene,
    spawn: DragonSpawn,
    private readonly fx: DragonFxSink,
    private readonly cb: DragonCallbacks,
  ) {
    const ts = TUNING.level.tileSize;
    const r = spawn.rect;
    this.index = spawn.index;
    this.hearing = spawn.hearing ?? D.hearing;
    this.bounds = new Phaser.Geom.Rectangle(r.x * ts, r.y * ts, r.w * ts, r.h * ts);
    this.cx = this.bounds.centerX;
    this.cy = this.bounds.centerY;

    this.flip = spawn.facing === 'left' ? -1 : 1;
    // Only 'sideways' exists for now. Upright would be +-Math.PI / 2 (and swapped bounds).
    this.baseAngle = 0;
    this.cos = Math.cos(this.baseAngle);
    this.sin = Math.sin(this.baseAngle);
    const flipX = this.flip < 0;

    this.body = scene.add.image(this.cx, this.cy, TEXTURE_KEYS.dragonBody).setScale(S).setDepth(D.depth);
    this.tail = scene.add
      .image(0, 0, TEXTURE_KEYS.dragonTailTip)
      .setOrigin(flipX ? 1 - DRAGON_TAIL_TIP_ORIGIN.x : DRAGON_TAIL_TIP_ORIGIN.x, DRAGON_TAIL_TIP_ORIGIN.y)
      .setScale(S)
      .setDepth(D.depth);
    this.head = scene.add
      .image(0, 0, TEXTURE_KEYS.dragonHead)
      .setOrigin(flipX ? 1 - DRAGON_HEAD_ORIGIN.x : DRAGON_HEAD_ORIGIN.x, DRAGON_HEAD_ORIGIN.y)
      .setScale(S)
      .setDepth(D.depth);
    for (const img of [this.body, this.tail, this.head]) img.setFlipX(flipX);

    const G = D.eyeGlow;
    this.glows = D.eyes.map(() =>
      scene.add
        .image(0, 0, TEXTURE_KEYS.softGlow)
        .setTint(G.color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(G.radius * 2, G.radius * 2)
        .setDepth(D.overlayDepth)
        .setVisible(false),
    );
    this.eyes = D.eyes.map(() =>
      scene.add.image(0, 0, TEXTURE_KEYS.dragonEyeHalf).setScale(S).setFlipX(flipX).setDepth(D.overlayDepth + 1).setVisible(false),
    );

    this.zs = [];
    this.zAge = [];
    for (let i = 0; i < D.zzz.max; i++) {
      this.zs.push(scene.add.image(0, 0, TEXTURE_KEYS.dragonZ).setTint(D.colors.z).setDepth(D.overlayDepth).setVisible(false));
      this.zAge.push(-1);
    }
    this.zTimer = Math.random() * D.zzz.everyMs;
    this.snoreTimer = Phaser.Math.Between(D.snore.minMs, D.snore.maxMs);

    this.bar = scene.add.graphics().setDepth(D.overlayDepth).setAlpha(0);
    this.layout(0);
  }

  get meter(): number {
    return this.meterValue;
  }

  get stage(): DragonStage {
    return this.stageValue;
  }

  get isAsleep(): boolean {
    return this.state === 'asleep';
  }

  /** Meter is full: DragonSystem should start the wake-up. */
  get wantsToWake(): boolean {
    return this.state === 'asleep' && this.meterValue >= M.max;
  }

  // NoiseListener ---------------------------------------------------------

  canHear(): boolean {
    return this.state === 'asleep';
  }

  nearestPoint(x: number, y: number, out: Phaser.Math.Vector2): void {
    const b = this.bounds;
    // 1px inside, so the point's tile is the dragon's own tile, not the wall next to it.
    out.set(Phaser.Math.Clamp(x, b.left + 1, b.right - 1), Phaser.Math.Clamp(y, b.top + 1, b.bottom - 1));
  }

  hear(amount: number, _source: NoiseSource): void {
    if (this.state !== 'asleep' || amount <= 0) return;
    const cap = TUNING.debug.godMode ? M.godModeCap : M.max;
    this.meterValue = Math.min(cap, this.meterValue + amount);
    this.quietMs = 0;
    this.updateStage();
  }

  // Positions ------------------------------------------------------------

  /** Mouth tip in world px (fire starts here). */
  mouthPosition(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    return this.headPoint(D.mouth.x, D.mouth.y, out);
  }

  nostrilPosition(out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    return this.headPoint(D.nostril.x, D.nostril.y, out);
  }

  // Update ---------------------------------------------------------------

  /** @param visible false when off screen: logic runs, animation is skipped. */
  update(deltaMs: number, visible: boolean): void {
    if (this.state === 'asleep') {
      this.quietMs += deltaMs;
      if (this.quietMs >= M.drainDelayMs && this.meterValue > 0) {
        this.meterValue = Math.max(0, this.meterValue - (M.drainPerSec * deltaMs) / 1000);
        this.updateStage();
      }
    }
    if (!visible) return;
    this.animate(deltaMs);
    this.layout(deltaMs);
  }

  /** Starts the wake-up pose: eyes open, head lifts and turns toward (tx, ty). */
  wake(tx: number, ty: number): void {
    if (this.state !== 'asleep') return;
    this.state = 'waking';
    this.meterValue = M.max;
    this.stageValue = 3;
    for (const z of this.zs) z.setVisible(false);
    this.zAge.fill(-1);

    const W = D.wake;
    // Target direction in the art frame, measured from the neck.
    const dx = tx - this.cx;
    const dy = ty - this.cy;
    const lx = (dx * this.cos + dy * this.sin) * this.flip;
    const ly = -dx * this.sin + dy * this.cos;
    const max = Phaser.Math.DegToRad(W.maxTurnDeg);
    const turn = Phaser.Math.Clamp(Math.atan2(ly - D.neck.y, lx - D.neck.x), -max, max);

    Object.assign(this.wakePose, { open: this.eyeOpen[0], lift: this.lift, turn: 0 });
    this.scene.tweens.add({ targets: this.wakePose, open: 1, duration: W.eyesOpenMs, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: this.wakePose, lift: 1, turn, duration: W.turnMs, ease: 'Back.easeOut' });
  }

  // Internals ------------------------------------------------------------

  private updateStage(): void {
    const from = this.stageValue;
    let to: DragonStage = from;
    const m = this.meterValue;
    if (m >= M.stage3) to = 3;
    else if (m >= M.stage2 && to < 2) to = 2;
    if (to === 3 && m < M.stage3 - M.hysteresis) to = 2;
    if (to === 2 && m < M.stage2 - M.hysteresis) to = 1;
    if (to === from) return;

    this.stageValue = to;
    if (to === 3) this.reachedStage3 = true;
    this.cb.onStageChange(this, from, to);
    if (to === 1) {
      if (this.reachedStage3) {
        this.reachedStage3 = false;
        this.puff(D.phew.puffs);
        this.cb.onPhew(this);
      }
      this.zTimer = D.zzz.everyMs * 0.6; // Zzz come back right away
    }
  }

  /** Smoke from the nostrils. */
  private puff(count: number): void {
    this.nostrilPosition(this.tmp);
    this.fx.smoke(this.tmp.x, this.tmp.y, count);
  }

  /** Timers for Zzz, snores, puffs, twitches and growls. */
  private animate(deltaMs: number): void {
    const stage = this.stageValue;
    const waking = this.state === 'waking';
    const B = D.breath;
    this.breathPhase = (this.breathPhase + (deltaMs / B.periodMs[stage - 1]) * Math.PI * 2) % (Math.PI * 2);

    // Head lift and eye 0 ease toward the stage's pose (slow close = the "phew").
    const dt = deltaMs / 1000;
    const liftTarget = stage === 3 ? 1 : 0;
    this.lift = approach(this.lift, liftTarget, D.alert.liftPerSec * dt);
    const eyeTarget = stage === 3 ? 0.5 : 0;
    const eyeRate = eyeTarget > this.eyeOpen[0] ? 4 : 0.5 / (D.phew.eyeCloseMs / 1000);
    this.eyeOpen[0] = approach(this.eyeOpen[0], eyeTarget, eyeRate * dt);
    if (waking) {
      this.eyeOpen[0] = this.wakePose.open;
      this.eyeOpen[1] = this.wakePose.open;
    }

    // Zzz (deep sleep only).
    const Z = D.zzz;
    if (stage === 1 && !waking) {
      this.zTimer += deltaMs;
      if (this.zTimer >= Z.everyMs) {
        this.zTimer = 0;
        const free = this.zAge.indexOf(-1);
        if (free >= 0) this.zAge[free] = 0;
      }
      this.snoreTimer -= deltaMs;
      if (this.snoreTimer <= 0) {
        this.snoreTimer = Phaser.Math.Between(D.snore.minMs, D.snore.maxMs);
        this.puff(D.snore.puffs);
      }
    }
    for (let i = 0; i < this.zAge.length; i++) {
      if (this.zAge[i] < 0) continue;
      this.zAge[i] += deltaMs;
      if (this.zAge[i] >= Z.riseMs) this.zAge[i] = -1;
    }

    // Stirring: tail twitches and low growls (stages 2 and 3).
    const ST = D.stir;
    if (stage >= 2 && !waking) {
      this.twitchTimer -= deltaMs;
      if (this.twitchTimer <= 0) {
        this.twitchTimer = Phaser.Math.Between(ST.twitchMinMs, ST.twitchMaxMs);
        this.twitchLeft = ST.twitchMs;
        this.twitchSign = Math.random() < 0.5 ? -1 : 1;
      }
      this.growlTimer -= deltaMs;
      if (this.growlTimer <= 0) {
        this.growlTimer = Phaser.Math.Between(ST.growlMinMs, ST.growlMaxMs);
        this.growlLeft = ST.growlMs;
      }
    }
    this.twitchLeft = Math.max(0, this.twitchLeft - deltaMs);
    this.growlLeft = Math.max(0, this.growlLeft - deltaMs);

    // About to wake: small smoke puffs.
    if (stage === 3 && !waking) {
      this.puffTimer -= deltaMs;
      if (this.puffTimer <= 0) {
        this.puffTimer = D.alert.puffEveryMs;
        this.puff(1);
      }
    }
  }

  /** Places every part from the current animation state. */
  private layout(deltaMs: number): void {
    const now = this.scene.time.now;
    const B = D.breath;
    const breathe = Math.sin(this.breathPhase);
    const shake = this.growlLeft > 0 ? Math.sin(now * 0.11) * D.stir.growlShakePx * (this.growlLeft / D.stir.growlMs) : 0;

    // Body breathes (swells more across than along).
    this.body
      .setPosition(this.cx + shake * this.cos, this.cy + shake * this.sin)
      .setScale(S * (1 + B.amount * 0.5 * breathe), S * (1 + B.amount * breathe))
      .setRotation(this.baseAngle);

    // Tail tip: resting angle + twitch.
    const tw = this.twitchLeft > 0 ? Math.sin((1 - this.twitchLeft / D.stir.twitchMs) * Math.PI) * D.stir.twitchDeg * this.twitchSign : 0;
    this.toWorld(D.tailTip.x, D.tailTip.y + breathe * B.amount * 20, this.tmp);
    this.tail
      .setPosition(this.tmp.x + shake, this.tmp.y)
      .setRotation(this.baseAngle + this.flip * Phaser.Math.DegToRad(D.tailTip.angleDeg + tw));

    // Head: breath bob, stage-3 lift, wake lift + turn.
    const pose = this.headPose();
    this.toWorld(D.neck.x + pose.forward, D.neck.y + breathe * B.headBobPx, this.tmp);
    this.head
      .setPosition(this.tmp.x + shake, this.tmp.y)
      .setScale(S * pose.scale)
      .setRotation(this.baseAngle + this.flip * pose.turn);

    // Eyes and their glow follow the head.
    const G = D.eyeGlow;
    const pulse = 0.75 + 0.25 * Math.sin((now / D.alert.glowPulseMs) * Math.PI * 2);
    for (let i = 0; i < this.eyes.length; i++) {
      const open = this.eyeOpen[i];
      const eye = this.eyes[i];
      const glow = this.glows[i];
      if (open <= 0.01) {
        eye.setVisible(false);
        glow.setVisible(false);
        continue;
      }
      this.headPoint(D.eyes[i].x, D.eyes[i].y, this.tmp);
      const full = open > 0.75;
      eye
        .setTexture(full ? TEXTURE_KEYS.dragonEyeOpen : TEXTURE_KEYS.dragonEyeHalf)
        .setPosition(this.tmp.x + shake, this.tmp.y)
        .setRotation(this.head.rotation)
        .setScale(S * pose.scale, S * pose.scale * (full ? 1 : Math.min(1, open * 2)))
        .setVisible(true);
      glow
        .setPosition(this.tmp.x + shake, this.tmp.y)
        .setAlpha(G.alpha * Math.min(1, open * 2) * (this.state === 'waking' ? 1 : pulse))
        .setVisible(true);
    }

    this.layoutZs();
    this.layoutBar(deltaMs);
  }

  /** Current head offset / scale / turn, written into a reused object. */
  private headPose(): { forward: number; scale: number; turn: number } {
    const p = this.pose;
    if (this.state === 'waking') {
      const W = D.wake;
      const l = this.wakePose.lift;
      p.forward = l * W.liftPx;
      p.scale = 1 + l * (W.liftScale - 1);
      p.turn = this.wakePose.turn;
    } else {
      const A = D.alert;
      p.forward = this.lift * A.headLiftPx;
      p.scale = 1 + this.lift * (A.headLiftScale - 1);
      p.turn = 0;
    }
    return p;
  }

  private layoutZs(): void {
    const Z = D.zzz;
    this.headPoint(D.eyes[0].x, D.eyes[0].y - 6, this.tmp);
    const baseX = this.tmp.x;
    const baseY = this.tmp.y;
    for (let i = 0; i < this.zs.length; i++) {
      const z = this.zs[i];
      const age = this.zAge[i];
      if (age < 0) {
        z.setVisible(false);
        continue;
      }
      const t = age / Z.riseMs;
      z.setPosition(baseX + Math.sin(t * Math.PI * 2) * Z.driftPx * 0.5 + t * Z.driftPx * this.flip, baseY - t * Z.risePx)
        .setScale(Phaser.Math.Linear(Z.scaleStart, Z.scaleEnd, t) * S)
        .setAlpha(Z.alpha * Math.min(1, t * 5) * (1 - t))
        .setVisible(true);
    }
  }

  private layoutBar(deltaMs: number): void {
    const B = D.meterBar;
    const target = this.meterValue > 0.5 ? 1 : 0;
    this.barAlpha = approach(this.barAlpha, target, deltaMs / B.fadeMs);
    this.bar.setAlpha(this.barAlpha);
    if (this.barAlpha <= 0) return;

    // Redraw only when the shown value or stage changes.
    const shown = Math.round(this.meterValue) * 4 + this.stageValue;
    if (shown === this.barDrawn) return;
    this.barDrawn = shown;

    const w = B.width;
    const h = B.height;
    const x = this.cx - w / 2;
    const y = this.bounds.top - B.gapPx - h;
    const fill = Phaser.Math.Clamp(this.meterValue / M.max, 0, 1);
    const g = this.bar;
    g.clear();
    g.fillStyle(B.borderColor, 1);
    g.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, (h + 4) / 2);
    g.fillStyle(B.backColor, B.backAlpha);
    g.fillRoundedRect(x, y, w, h, h / 2);
    if (fill > 0) {
      g.fillStyle(B.colors[this.stageValue - 1], 1);
      g.fillRoundedRect(x, y, Math.max(h, w * fill), h, h / 2);
    }
    // Stage marks.
    g.fillStyle(B.borderColor, 0.8);
    for (const at of [M.stage2, M.stage3]) g.fillRect(x + (w * at) / M.max - 1, y, 2, h);
  }

  /** Art frame point (head facing right, origin = footprint center) to world px. */
  private toWorld(lx: number, ly: number, out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const x = lx * this.flip;
    return out.set(this.cx + x * this.cos - ly * this.sin, this.cy + x * this.sin + ly * this.cos);
  }

  /** Head-local point (relative to the neck) to world px, with the current lift and turn. */
  private headPoint(hx: number, hy: number, out: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const pose = this.headPose();
    const c = Math.cos(pose.turn);
    const s = Math.sin(pose.turn);
    const px = hx * pose.scale;
    const py = hy * pose.scale;
    return this.toWorld(D.neck.x + pose.forward + px * c - py * s, D.neck.y + px * s + py * c, out);
  }
}

function approach(value: number, target: number, step: number): number {
  return value < target ? Math.min(target, value + step) : Math.max(target, value - step);
}
