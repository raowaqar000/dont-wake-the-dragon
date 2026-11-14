import { TUNING } from '../config';
import { hasLevel } from '../levels';
import { clearCheckpoint, getCurrentLevel, resetLives, setCurrentLevel } from './SaveData';

/**
 * Which level to play (until a real level select exists).
 *  - First start: ?level=<id> in the page URL if it is a known level, else
 *    TUNING.debug.startLevel (the registry falls back to the first level after that).
 *  - Afterwards the current level is kept in memory (SaveData), so retries and respawns stay on it.
 *  - goToLevel() switches level (the ESCAPED card's "Next level") and mirrors it in the URL.
 */
export function currentLevelId(): string {
  const current = getCurrentLevel();
  if (current) return current;
  const fromUrl = readUrlLevel();
  const id = hasLevel(fromUrl) ? fromUrl : TUNING.debug.startLevel;
  if (fromUrl && !hasLevel(fromUrl)) console.warn(`[levels] ?${TUNING.debug.levelParam}=${fromUrl} is unknown, using ${id}`);
  setCurrentLevel(id);
  return id;
}

/** Switches to `id` for the next scene start: fresh attempt (no checkpoint, full lives), URL updated. */
export function goToLevel(id: string): void {
  clearCheckpoint(id);
  resetLives(id);
  setCurrentLevel(id);
  writeUrlLevel(id);
}

function readUrlLevel(): string | null {
  try {
    return new URLSearchParams(window.location.search).get(TUNING.debug.levelParam);
  } catch {
    return null;
  }
}

/** Browser only: keeps ?level= in sync so a reload stays on this level (no-op where it fails). */
function writeUrlLevel(id: string): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(TUNING.debug.levelParam, id);
    window.history.replaceState(window.history.state, '', url.toString());
  } catch {
    // No history API (or a WebView that blocks it): the level still switches.
  }
}
