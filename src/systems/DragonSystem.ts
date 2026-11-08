import Phaser from 'phaser';
import { TEXTURE_KEYS, TUNING } from '../config';
import { Dragon, type DragonFxSink, type DragonStage } from '../entities/Dragon';
import type { Player } from '../entities/Player';
import type { CameraRig } from './CameraRig';
import { FAIL_REASONS, type FailSystem } from './FailSystem';
import type { HapticsService } from './HapticsService';
import type { DragonSpawn } from './LevelParser';
import { NoiseSystem } from './NoiseSystem';

const D = TUNING.dragon;
const W = D.wake;
const N = TUNING.noise;

export interface DragonSystemDeps {
  noise: NoiseSystem;
  player: Player;
  fail: FailSystem;
  rig: CameraRig;
  haptics: HapticsService;
  /** While true a full meter waits (e.g. mid-teleport); the wake starts once it's false. */
  isPaused: () => boolean;
}

/** Shared smoke and fire emitters for every dragon (two emitters in total). */
class DragonFx implements DragonFxSink {
  private readonly smokeEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  readonly fire: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    const SM = D.smoke;
    const puffScale = 1 / 2; // smoke texture is 32px
    this.smokeEmitter = scene.add
      .particles(0, 0, TEXTURE_KEYS.smokePuff, {
        lifespan: SM.lifespanMs,
        speed: { min: SM.speedMin, max: SM.speedMax },
        angle: { min: 0, max: 360 },
        scale: { start: SM.scaleStart * puffScale, end: SM.scaleEnd * puffScale },
        alpha: { start: SM.alpha, end: 0 },
        tint: SM.color,
        gravityY: -18,
        emitting: false,
      })
      .setDepth(D.overlayDepth - 1);

    this.fire = scene.add
      .particles(0, 0, TEXTURE_KEYS.flame, {
        lifespan: W.fireLifespanMs,
        speed: { min: 200, max: 300 },
        angle: { min: -W.fireConeDeg, max: W.fireConeDeg },
        scale: { start: W.fireScaleStart, end: W.fireScaleEnd },
        alpha: { start: 1, end: 0 },
        color: [...W.fireColors],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false,
      })
      .setDepth(D.overlayDepth + 2);
  }

  smoke(x: number, y: number, count: number): void {
    this.smokeEmitter.explode(count, x, y);
  }
}

/**
 * Owns the level's dragons: feeds them to NoiseSystem, runs their idle animation,
 * vibrates when one stirs, and plays the wake-up sequence that ends the run:
 * eyes open, head turns to the hero, roar, fire cone, charred hero, result card.
 */
export class DragonSystem {
  private readonly dragons: Dragon[];
  private readonly fx: DragonFx;
  private readonly view = new Phaser.Geom.Rectangle();
  private readonly tmp = new Phaser.Math.Vector2();
  private readonly debugTexts: Phaser.GameObjects.Text[] = [];
  private debugElapsed = Infinity;
  private waking?: Dragon;

  constructor(
    private readonly scene: Phaser.Scene,
    spawns: DragonSpawn[],
    private readonly deps: DragonSystemDeps,
  ) {
    this.fx = new DragonFx(scene);
    this.dragons = spawns.map(
      (s) =>
        new Dragon(scene, s, this.fx, {
          onStageChange: (_d, from, to) => this.onStageChange(from, to),
          onPhew: (d) => console.info(`[dragon ${d.index}] phew`),
        }),
    );
    for (const d of this.dragons) deps.noise.addListener(d);
    if (TUNING.debug.enabled && TUNING.debug.showDragons) this.createDebug();
  }

  get debugLine(): string {
    if (this.dragons.length === 0) return 'dragon: none';
    const { x, y } = this.deps.player;
    let best = this.dragons[0];
    let bestD = Infinity;
    for (const d of this.dragons) {
      const dist = Phaser.Math.Distance.Squared(x, y, d.cx, d.cy);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    }
    return `dragon: #${best.index} meter ${Math.round(best.meter)} stage ${best.stage}${this.waking ? ' WAKING' : ''}`;
  }

  update(deltaMs: number): void {
    const dt = Math.min(deltaMs, TUNING.movement.maxDeltaMs);
    const m = TUNING.treasure.cullMargin + 96;
    const wv = this.deps.rig.world.worldView;
    this.view.setTo(wv.x - m, wv.y - m, wv.width + m * 2, wv.height + m * 2);

    const canWake = !this.deps.fail.isOver && !this.deps.isPaused();
    for (const d of this.dragons) {
      d.update(dt, Phaser.Geom.Rectangle.Overlaps(this.view, d.bounds));
      if (canWake && !this.waking && d.wantsToWake) this.startWake(d);
    }
    this.updateDebug(deltaMs);
  }

  private onStageChange(from: DragonStage, to: DragonStage): void {
    if (to > from && to >= 2) this.deps.haptics.light();
  }

  // Wake-up sequence ------------------------------------------------------

  private startWake(dragon: Dragon): void {
    const { player, fail, rig, haptics, noise } = this.deps;
    if (!fail.begin()) return;
    this.waking = dragon;
    const px = player.x;
    const py = player.y;
    dragon.wake(px, py);

    // Slight pan so both the dragon and the hero are in the shot.
    const cam = rig.world;
    cam.stopFollow();
    cam.pan(
      Phaser.Math.Linear(px, dragon.cx, W.panShare),
      Phaser.Math.Linear(py, dragon.cy, W.panShare),
      W.panMs,
      W.panEase,
    );

    const at = (ms: number, fn: () => void) => this.scene.time.delayedCall(ms, fn);

    at(W.roarAtMs, () => {
      haptics.heavy();
      cam.shake(W.roarShakeMs, W.roarShakeIntensity);
      dragon.nostrilPosition(this.tmp);
      noise.showRing(this.tmp.x, this.tmp.y, W.roarRingRadius, N.ring.colors.roar);
      this.fx.smoke(this.tmp.x, this.tmp.y, W.roarPuffs);
    });

    at(W.fireAtMs, () => {
      dragon.mouthPosition(this.tmp);
      const dist = Math.max(24, Phaser.Math.Distance.Between(this.tmp.x, this.tmp.y, px, py));
      const angle = Phaser.Math.RadToDeg(Math.atan2(py - this.tmp.y, px - this.tmp.x));
      const speed = (dist / W.fireLifespanMs) * 1000;
      const fire = this.fx.fire;
      fire.setPosition(this.tmp.x, this.tmp.y);
      fire.setEmitterAngle({ min: angle - W.fireConeDeg, max: angle + W.fireConeDeg });
      fire.setParticleSpeed(speed * 0.8, speed * 1.1);
      fire.flow(W.fireEveryMs, W.firePerTick);
      at(W.fireMs, () => fire.stop());
    });

    at(W.charAtMs, () => {
      cam.flash(W.flashMs, W.flashColor.r, W.flashColor.g, W.flashColor.b);
      this.fx.smoke(px, py, W.charSmoke);
      fail.finish(FAIL_REASONS.dragon, { kind: 'charred' }, W.resultAtMs - W.charAtMs);
    });
  }

  // Debug -----------------------------------------------------------------

  private createDebug(): void {
    const g = this.scene.add.graphics().setDepth(D.overlayDepth + 3);
    const run = NoiseSystem.rangeFor(N.footstep.run);
    const sneak = NoiseSystem.rangeFor(N.footstep.sneak);
    for (const d of this.dragons) {
      const b = d.bounds;
      // Distance is measured from the body's edge, so the reach is a rounded rectangle.
      for (const [range, color] of [
        [run * d.hearing, 0xff5c5c],
        [sneak * d.hearing, 0x5cff9d],
      ] as const) {
        g.lineStyle(2, color, 0.6);
        g.strokeRoundedRect(b.x - range, b.y - range, b.width + range * 2, b.height + range * 2, range);
      }
      this.debugTexts.push(
        this.scene.add
          .text(d.cx, d.bounds.bottom + 4, '', {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: TUNING.debug.color,
            backgroundColor: 'rgba(0,0,0,0.5)',
          })
          .setOrigin(0.5, 0)
          .setDepth(D.overlayDepth + 3),
      );
    }
  }

  private updateDebug(deltaMs: number): void {
    if (this.debugTexts.length === 0) return;
    this.debugElapsed += deltaMs;
    if (this.debugElapsed < TUNING.debug.refreshMs) return;
    this.debugElapsed = 0;
    this.dragons.forEach((d, i) => this.debugTexts[i].setText(`#${d.index} ${d.meter.toFixed(0)} s${d.stage}`));
  }
}
