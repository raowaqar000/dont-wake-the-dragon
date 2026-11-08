import Phaser from 'phaser';
import { TUNING } from '../config';

export type MoveState = 'idle' | 'sneak' | 'run';

const M = TUNING.movement;

/**
 * Picks the move state from joystick strength, with hysteresis between
 * sneak and run so it doesn't flicker when the thumb sits on the edge.
 */
export function resolveMoveState(strength: number, previous: MoveState): MoveState {
  if (strength <= 0) return 'idle';
  if (previous === 'run') {
    return strength >= M.runExitThreshold ? 'run' : 'sneak';
  }
  return strength >= M.runEnterThreshold ? 'run' : 'sneak';
}

export function speedForState(state: MoveState): number {
  switch (state) {
    case 'run':
      return M.runSpeed;
    case 'sneak':
      return M.sneakSpeed;
    default:
      return 0;
  }
}

/**
 * Moves `current` toward `target` with constant acceleration (px/s²),
 * using deceleration when slowing down. Frame-rate independent. Mutates `current`.
 */
export function approachVelocity(
  current: Phaser.Math.Vector2,
  target: Phaser.Math.Vector2,
  deltaMs: number,
): Phaser.Math.Vector2 {
  const dt = Math.min(deltaMs, M.maxDeltaMs) / 1000;
  const slowingDown = target.lengthSq() < current.lengthSq();
  const rate = slowingDown ? M.deceleration : M.acceleration;
  const maxStep = rate * dt;

  const dx = target.x - current.x;
  const dy = target.y - current.y;
  const dist = Math.hypot(dx, dy);

  if (dist <= maxStep || dist === 0) {
    current.copy(target);
  } else {
    current.x += (dx / dist) * maxStep;
    current.y += (dy / dist) * maxStep;
  }
  return current;
}
