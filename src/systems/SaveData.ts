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
