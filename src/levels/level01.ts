import type { LevelData } from './types';

// 15 x 34 tiles. "The Sleepy Hollow": the tutorial. Start at the bottom, exit top-left.
// Wide 3-tile paths, one lesson at a time, a breather between each (bottom to top):
//  - rows 25-28: hall 1, sneaking past a dragon: it lies on the left, the path to the
//                corridor runs 2-3 tiles to its right (sneak steps can't reach it);
//  - row 23:     one row of spikes on slow timing (spikeTiming 'slow'); a breather after;
//  - row 20:     one crumbling tile in the middle of the path (a coin on it as the lure;
//                the sides stay solid);
//  - row 18:     checkpoint (halfway);
//  - row 16:     a 1-tile gap across the corridor: jump it;
//  - rows 14-15: a closed room: the only way on is the portal (11,14) -> (10,11);
//                the chest sits in the far corner, far from any dragon;
//  - row 8:      one trap floor in the middle of the corridor, with a very clear hint
//                (cracked ring, warning sign, "!" danger sense): walk the sides;
//  - rows 1-6:   hall 2, a second dragon on the right; the exit is top-left, away from it.
//                Gem behind its tail and a coin under it for the brave (sneak only).
// Target: a new player escapes in 1-2 attempts. Symbols are documented in ./types.ts.
export const level01: LevelData = {
  id: 'level01',
  name: 'The Sleepy Hollow',
  hintLevel: 'strong',
  // Tutorial: every trap keeps its hints.
  noHintChance: 0,
  spikeTiming: 'slow',
  grid: [
    '##EEE##########', // 0  exit (top-left)
    '#.....#########', // 1
    '#..c....c######', // 2
    '#.c..........##', // 3
    '#.........DDDg#', // 4  hall 2 dragon (right), gem behind its tail
    '#..c......DDD.#', // 5
    '#.....c.....c.#', // 6  coin right under the dragon (sneak!)
    '#####...#######', // 7
    '#####.t.#######', // 8  trap floor (middle): walk the sides
    '#####...#######', // 9
    '#####...#######', // 10 warning sign goes here
    '###.c..g..1.###', // 11 portal arrival room
    '###..c...c..###', // 12
    '###############', // 13 solid: only the portal leads on
    '#cT...c....1..#', // 14 portal room; chest in the far corner
    '#.c.......c...#', // 15
    '######---######', // 16 1-tile gap: jump it
    '######...######', // 17
    '###..c..F...###', // 18 checkpoint (halfway)
    '###.......c.###', // 19
    '######.%.######', // 20 one crumbling tile (coin on it)
    '######...######', // 21
    '####..c.c..####', // 22 breather
    '######^^^######', // 23 one spike group, slow timing
    '######...######', // 24
    '#...........c.#', // 25 hall 1: sneak past the dragon on the left
    '#.DDD.......g.#', // 26
    '#.DDD....c..c.#', // 27
    '#.c...........#', // 28
    '#######...#####', // 29
    '##.c.........##', // 30 start room
    '##.....P.....##', // 31
    '##..c.....c..##', // 32
    '###############', // 33
  ],
  // The lure on the crumbling tile.
  treasureOnTiles: [{ x: 7, y: 20, kind: 'coin' }],
};
