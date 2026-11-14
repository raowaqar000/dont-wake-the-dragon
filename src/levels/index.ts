import { level01 } from './level01';
import { level02 } from './level02';
import { level03 } from './level03';
import type { LevelData } from './types';

/** Every level, by id, easiest first. The level select (later) reads this list. */
export const LEVELS: readonly LevelData[] = [level01, level02, level03];

/** True if `id` is a level in the registry. */
export function hasLevel(id: string | null | undefined): id is string {
  return !!id && LEVELS.some((l) => l.id === id);
}

/** Id of the level after `id` in the registry, or null on the last (or an unknown) level. */
export function nextLevelId(id: string): string | null {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 && i + 1 < LEVELS.length ? LEVELS[i + 1].id : null;
}

/** Level by id, falling back to the first level (with a warning) for unknown ids. */
export function getLevel(id: string): LevelData {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) {
    console.warn(`[levels] unknown level '${id}', starting ${LEVELS[0].id}`);
    return LEVELS[0];
  }
  return level;
}
