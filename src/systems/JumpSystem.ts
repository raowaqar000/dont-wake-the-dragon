import Phaser from 'phaser';
import { TUNING } from '../config';
import type { Player } from '../entities/Player';
import type { PlayerVisual } from '../entities/PlayerVisual';
import type { Joystick } from '../ui/Joystick';
import type { PitMap } from './PitMap';

const J = TUNING.jump;

export const JUMP_EVENTS = {
  /** Payload: JumpTakeoff. */
  takeoff: 'jump-takeoff',
  /** Payload: { x, y } feet position. */
  land: 'jump-land',
  /** Walked (or landed) into a pit. Payload: { x, y } pit center. */
  fell: 'jump-fell',
} as const;

export interface JumpTakeoff {
  x: number;
  y: number;
  /** Normalized jump direction (0, 0 = hop on the spot). */
  dirX: number;
  dirY: number;
}

export interface JumpSystemDeps {
  player: Player;
  visual: PlayerVisual;
  joystick: Joystick;
  pits: PitMap;
  /** While true no jump starts and no fall is checked (teleport, run over). */
  isPaused: () => boolean;
}

/**
 * Top-down hop. Owns "is the hero over a pit":
 *  - grounded with the body center over a pit: after coyoteMs (no jump) he falls;
 *  - landing on a pit: falls at once.
 * A press is buffered for bufferMs, so a press just before landing / before the
 * cooldown ends still jumps. No double jump.
 */
export class JumpSystem extends Phaser.Events.EventEmitter {
  private airUntil = 0;
  private cooldownUntil = 0;
  private bufferedAt = -Infinity;
  /** When the body center first went over a pit while grounded (-1 = not over a pit). */
  private overPitSince = -1;
  private readonly tmp = { x: 0, y: 0 };
  private fallen = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly deps: JumpSystemDeps,
  ) {
    super();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeAllListeners());
  }

  /** JumpButton press. */
  press(): void {
    this.bufferedAt = this.scene.time.now;
  }

  get debugLine(): string {
    const p = this.deps.player;
    return `jump: ${p.airborne ? 'air' : 'ground'}${this.overPitSince >= 0 ? ' over pit' : ''}`;
  }

  update(): void {
    const { player, pits } = this.deps;
    const now = this.scene.time.now;
    if (this.fallen || player.frozen || this.deps.isPaused()) {
      this.overPitSince = -1;
      return;
    }

    if (player.airborne) {
      if (now >= this.airUntil) this.landNow(now);
      return;
    }

    const buffered = now - this.bufferedAt <= J.bufferMs;
    if (buffered && now >= this.cooldownUntil) {
      this.bufferedAt = -Infinity;
      this.overPitSince = -1;
      this.takeOff(now);
      return;
    }

    // Grounded over a pit: coyote time, then fall.
    const pit = pits.pitAt(player.x, player.y, J.fallInset);
    if (pit < 0) {
      this.overPitSince = -1;
      return;
    }
    if (this.overPitSince < 0) this.overPitSince = now;
    if (now - this.overPitSince >= J.coyoteMs) this.fall(pit);
  }

  private takeOff(now: number): void {
    const { player, visual, joystick } = this.deps;
    const dir = joystick.strength > 0 ? joystick.direction : null;
    const dx = dir ? dir.x : 0;
    const dy = dir ? dir.y : 0;
    player.takeOff(dx, dy);
    visual.hop(J.airMs);
    this.airUntil = now + J.airMs;
    const e: JumpTakeoff = { x: player.x, y: player.y, dirX: dx, dirY: dy };
    this.emit(JUMP_EVENTS.takeoff, e);
  }

  private landNow(now: number): void {
    const { player, visual, pits } = this.deps;
    player.land();
    visual.land();
    this.cooldownUntil = now + J.cooldownMs;
    // Keep a little momentum so the landing doesn't feel like hitting glue.
    const body = player.body as Phaser.Physics.Arcade.Body;
    const keep = TUNING.movement.runSpeed / Math.max(1, body.velocity.length());
    if (keep < 1) body.velocity.scale(keep);
    this.emit(JUMP_EVENTS.land, { x: player.x, y: player.y + TUNING.noise.feetOffsetY });
    const pit = pits.pitAt(player.x, player.y, J.fallInset);
    if (pit >= 0) this.fall(pit);
  }

  private fall(pitIndex: number): void {
    this.fallen = true;
    this.deps.pits.centerOf(pitIndex, this.tmp);
    this.emit(JUMP_EVENTS.fell, { x: this.tmp.x, y: this.tmp.y });
  }

  /** godMode: the fail was ignored, so allow falling again. */
  resetFall(): void {
    this.fallen = false;
    this.overPitSince = -1;
  }
}
