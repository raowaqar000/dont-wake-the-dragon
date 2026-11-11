import { level01 } from './level01';
import { level02 } from './level02';
import type { LevelData } from './types';

/** Every level, by id. The level select (later) reads this list. */
export const LEVELS: readonly LevelData[] = [level01, level02];

/** Level by id, falling back to the first level (with a warning) for unknown ids. */
export function getLevel(id: string): LevelData {
  const level = LEVELS.find((l) => l.id === id);
  if (!level) {
    console.warn(`[levels] unknown level '${id}', starting ${LEVELS[0].id}`);
    return LEVELS[0];
  }
  return level;
}
