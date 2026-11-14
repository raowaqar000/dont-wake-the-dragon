import type { LevelData, TileRef } from '../levels/types';
import { floodGroups, type ParsedLevel, type TilePos } from './LevelParser';

/**
 * Surprise traps: hidden troll traps that get no hint (no clue, no sign, no "!").
 * Pure (no Phaser, no config), so the game and `npm run validate` agree exactly.
 *
 * Every hidden trap group rolls once, seeded by (salt, level id, kind, first tile): the same
 * traps are surprises on every attempt, so players can learn them, and editing one trap
 * doesn't reshuffle the others. LevelData.noHintTraps forces a surprise, and
 * LevelData.alwaysHintTraps forbids one (it wins when a trap is in both lists).
 */

/** Clue kind of a hidden trap group (same as TrapHints' ClueKind). */
export type HiddenTrapKind = 'floor' | 'spikes' | 'rock' | 'walls' | 'fake';

export interface HiddenTrapGroup {
  kind: HiddenTrapKind;
  /** Tiles the clue sits next to and danger sense measures from. */
  tiles: TilePos[];
  /** Tiles a noHintTraps / alwaysHintTraps entry can name (every trap tile; a wall's whole corridor). */
  match: TilePos[];
}

/**
 * Hidden troll traps as hint groups: touching tiles of one kind form one group; each closing
 * wall is one group (hint tiles = the corridor's bottom row, the usual approach); each fake
 * coin / gem is one group. Order is stable (grid order per kind).
 */
export function hiddenTrapGroups(p: ParsedLevel): HiddenTrapGroup[] {
  const groups: HiddenTrapGroup[] = [];
  const flood = (tiles: TilePos[], kind: HiddenTrapKind) => {
    for (const g of floodGroups(tiles)) groups.push({ kind, tiles: g, match: g });
  };
  flood(p.trapFloors, 'floor');
  flood(p.movingPits, 'floor');
  flood(p.popSpikes, 'spikes');
  flood(p.rocks, 'rock');
  for (const w of p.closingWalls) {
    const c = w.corridor;
    const tiles: TilePos[] = [];
    const match: TilePos[] = [];
    for (let x = c.x; x < c.x + c.w; x++) {
      tiles.push({ x, y: c.y + c.h - 1 });
      for (let y = c.y; y < c.y + c.h; y++) match.push({ x, y });
    }
    groups.push({ kind: 'walls', tiles, match });
  }
  for (const f of [...p.fakeCoins, ...p.fakeGems]) groups.push({ kind: 'fake', tiles: [f], match: [f] });
  return groups;
}

export interface SurpriseResult {
  /** Every hidden trap group, in hiddenTrapGroups order. */
  groups: HiddenTrapGroup[];
  /** surprise[i]: group i gets no hints. */
  surprise: boolean[];
  /** Groups forced by noHintTraps / protected by alwaysHintTraps. */
  forced: number;
  protectedCount: number;
  /** List entries that are not on any hidden trap (level data mistakes). */
  unmatchedNoHint: TileRef[];
  unmatchedAlwaysHint: TileRef[];
  /** Groups named in both lists (alwaysHintTraps won). */
  conflicts: HiddenTrapGroup[];
}

/** Rolls which hidden trap groups are surprises for a level. `salt` comes from TUNING.hints.surpriseSalt. */
export function rollSurprises(data: LevelData, p: ParsedLevel, salt: string, defaultChance: number): SurpriseResult {
  const groups = hiddenTrapGroups(p);
  const chance = clamp01(data.noHintChance ?? defaultChance);
  const noHint = data.noHintTraps ?? [];
  const alwaysHint = data.alwaysHintTraps ?? [];
  const named = (g: HiddenTrapGroup, list: readonly TileRef[]) => list.some((r) => g.match.some((t) => t.x === r.x && t.y === r.y));
  const onAnyGroup = (r: TileRef) => groups.some((g) => g.match.some((t) => t.x === r.x && t.y === r.y));

  let forced = 0;
  let protectedCount = 0;
  const conflicts: HiddenTrapGroup[] = [];
  const surprise = groups.map((g) => {
    const always = named(g, alwaysHint);
    const never = named(g, noHint);
    if (always && never) conflicts.push(g);
    if (always) {
      protectedCount++;
      return false;
    }
    if (never) {
      forced++;
      return true;
    }
    if (chance <= 0) return false;
    const t = g.tiles[0];
    return hash01(`${salt}|${data.id}|${g.kind}|${t.x},${t.y}`) < chance;
  });

  return {
    groups,
    surprise,
    forced,
    protectedCount,
    unmatchedNoHint: noHint.filter((r) => !onAnyGroup(r)),
    unmatchedAlwaysHint: alwaysHint.filter((r) => !onAnyGroup(r)),
    conflicts,
  };
}

/**
 * Rolls on the base level (as authored) and applies the result to the level actually played.
 * With LevelData.varyTraps a trap can move between attempts; rolling on the base layout keeps
 * the same traps surprises on every attempt, and noHintTraps / alwaysHintTraps keep naming
 * the authored tiles. Groups are matched by index (variants move single tiles, so the group
 * list keeps its shape); if it doesn't, the played layout is rolled directly instead.
 */
export function rollSurprisesFor(
  base: LevelData,
  baseParsed: ParsedLevel,
  played: ParsedLevel,
  salt: string,
  defaultChance: number,
): SurpriseResult {
  const r = rollSurprises(base, baseParsed, salt, defaultChance);
  if (played === baseParsed) return r;
  const groups = hiddenTrapGroups(played);
  const sameShape = groups.length === r.groups.length && groups.every((g, i) => g.kind === r.groups[i].kind);
  if (!sameShape) return rollSurprises(base, played, salt, defaultChance);
  return { ...r, groups };
}

/**
 * Level data checks for the surprise lists. Errors: a list entry that is not on any hidden
 * trap, or noHintChance outside 0..1. Warnings: a trap named in both lists (alwaysHintTraps wins).
 */
export function checkSurprises(data: LevelData, r: SurpriseResult): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const at = (t: TileRef) => `${t.x},${t.y}`;
  const c = data.noHintChance;
  if (c !== undefined && (!Number.isFinite(c) || c < 0 || c > 1)) errors.push(`noHintChance ${c} must be between 0 and 1`);
  for (const t of r.unmatchedNoHint) errors.push(`noHintTraps ${at(t)} is not on a hidden troll trap`);
  for (const t of r.unmatchedAlwaysHint) errors.push(`alwaysHintTraps ${at(t)} is not on a hidden troll trap`);
  for (const g of r.conflicts) {
    warnings.push(`${g.kind} trap at ${at(g.tiles[0])} is in both noHintTraps and alwaysHintTraps; alwaysHintTraps wins (hints stay)`);
  }
  return { errors, warnings };
}

/** Short "kind x,y" list of the surprise traps, for logs. */
export function describeSurprises(r: SurpriseResult): string {
  const list = r.groups.filter((_, i) => r.surprise[i]).map((g) => `${g.kind} ${g.tiles[0].x},${g.tiles[0].y}`);
  return list.length > 0 ? list.join(', ') : 'none';
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

/** FNV-1a string hash mapped to [0, 1). Deterministic on every platform. */
function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Final avalanche so nearby strings spread out.
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 0x100000000;
}
