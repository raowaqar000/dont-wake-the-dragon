import { TUNING } from '../config';

/**
 * Tiny local save (localStorage). Storage can be missing or throw
 * (private mode, WebView settings), so every access is guarded and falls back to 0.
 */

export function loadBestLoot(levelId: string): number {
  try {
    const raw = window.localStorage.getItem(TUNING.save.bestLootKey + levelId);
    const n = raw === null ? 0 : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveBestLoot(levelId: string, loot: number): void {
  try {
    window.localStorage.setItem(TUNING.save.bestLootKey + levelId, String(loot));
  } catch {
    // Not saved; the game keeps working.
  }
}

/** Lifetime deaths on a level. */
export function loadDeaths(levelId: string): number {
  try {
    const n = Number(window.localStorage.getItem(TUNING.save.deathsKey + levelId) ?? 0);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** Adds one death and returns the new lifetime total. */
export function addDeath(levelId: string): number {
  const n = loadDeaths(levelId) + 1;
  try {
    window.localStorage.setItem(TUNING.save.deathsKey + levelId, String(n));
  } catch {
    // Not saved.
  }
  return n;
}

/** The last checkpoint reached on a level (memory only, like attempts). */
export interface CheckpointSave {
  /** Checkpoint tile the player respawns on. */
  x: number;
  y: number;
  /** Every checkpoint touched so far ("x,y"); these don't save again. */
  reached: string[];
  /** Pickups ("kind:x,y") and chests ("x,y") taken before the checkpoint: kept. */
  pickups: string[];
  chests: string[];
  /** Loot total at the checkpoint (kept on respawn). */
  loot: number;
  /** Run time when it was reached (ms); the timer resumes from here. */
  timeMs: number;
}

const checkpoints = new Map<string, CheckpointSave>();

export function loadCheckpoint(levelId: string): CheckpointSave | undefined {
  return checkpoints.get(levelId);
}

export function saveCheckpoint(levelId: string, save: CheckpointSave): void {
  checkpoints.set(levelId, save);
}

/** After an escape the next run starts from the level start again. */
export function clearCheckpoint(levelId: string): void {
  checkpoints.delete(levelId);
}

/**
 * Lives left in the current level attempt (memory only, like checkpoints). Missing = full
 * (TUNING.lives.start). Survives scene restarts (respawns), reset by an escape or a game over.
 */
const lives = new Map<string, number>();

export function loadLives(levelId: string): number {
  return lives.get(levelId) ?? TUNING.lives.start;
}

export function saveLives(levelId: string, n: number): void {
  lives.set(levelId, Math.max(0, Math.floor(n)));
}

/** Back to TUNING.lives.start for the next attempt. */
export function resetLives(levelId: string): void {
  lives.delete(levelId);
}

/**
 * Adds lives from outside a running level (future shop / rewarded ad), capped at
 * TUNING.lives.max. Returns the new count. In-level code should use LivesSystem.addLives.
 */
export function grantLives(levelId: string, n: number): number {
  const next = Math.min(TUNING.lives.max, loadLives(levelId) + Math.max(0, Math.floor(n)));
  saveLives(levelId, next);
  return next;
}

/**
 * The level being played (memory only). Set once at startup (?level= or TUNING.debug.startLevel)
 * and by "Next level"; retries and respawns keep it.
 */
let currentLevel: string | null = null;

export function getCurrentLevel(): string | null {
  return currentLevel;
}

export function setCurrentLevel(levelId: string): void {
  currentLevel = levelId;
}

/** Attempts this session (memory only, reset when the app restarts). */
const sessionAttempts = new Map<string, number>();

/** Counts a new attempt (every scene start) and returns the session total. */
export function startAttempt(levelId: string): number {
  const n = (sessionAttempts.get(levelId) ?? 0) + 1;
  sessionAttempts.set(levelId, n);
  return n;
}
