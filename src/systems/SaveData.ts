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

/** Attempts this session (memory only, reset when the app restarts). */
const sessionAttempts = new Map<string, number>();

/** Counts a new attempt (every scene start) and returns the session total. */
export function startAttempt(levelId: string): number {
  const n = (sessionAttempts.get(levelId) ?? 0) + 1;
  sessionAttempts.set(levelId, n);
  return n;
}
