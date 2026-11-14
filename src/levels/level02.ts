import type { LevelData } from './types';

// 25 x 60 tiles (1200 x 2880 px at 48px). Start at the bottom, exit at the top-left.
// Every band has a short risky route and a longer safe one (loops), and a sealed
// vault in the middle is only reachable through portal 1 (portal 2 leads on).
// Reachability and shortest path are checked at load by LevelValidator.
// Treasure follows risk vs reward: safe routes carry a few coins, risky routes
// (spike gauntlet, crumbling bridge, top squeeze, vault, dead ends) carry the gems and chests.
// Four sleeping dragons (3x2 'D') sit next to the best loot, never near the start:
//  - hoard pocket: open the chest right beside it (chest noise is the risk);
//  - upper hall: on the exit route; sneak the top row or keep the pillar between you;
//  - vault: every tile is close, so it can only be passed by sneaking;
//  - great hall north-east: the open hall tempts you to run; pillars dampen noise.
// (Softened from the old level01: the great-hall west dragon is gone, spikes are slow.)
// Three checkpoints 'F': entering the great hall (row 36), the climb out of it past the
// north-east dragon (21,27; both upper routes start next to it) and the upper hall (row 14).
// Strong trap hints.
// Symbols are documented in ./types.ts.
export const level02: LevelData = {
  id: 'level02',
  name: 'The Deep Warren',
  hintLevel: 'strong',
  spikeTiming: 'slow',
  grid: [
    '##EEE####################', // 0  exit (top-left)
    '#...c.###################', // 1  exit antechamber
    '#..#..###################', // 2
    '#.c...##########DDD..####', // 3  hoard dragon (pocket widened)
    '###.############DDD.T####', // 4  hidden chest pocket: chest next to a sleeping dragon
    '###.############.....####', // 5
    '#...#...#...#.g.#...#...#', // 6  top squeeze tunnel, zig-zags right to left
    '#g#...#.g.#...#...#...#.#', // 7
    '#######################.#', // 8  only the right corner leads up
    '#.......................#', // 9  upper hall (ring around a pillar)
    '#..##.....#####.....##.c#', // 10
    '#.........#####.DDD.....#', // 11 upper hall dragon (east of the pillar)
    '#..##.....#####.DDD.##c.#', // 12
    '#...............c.......#', // 13
    '#.F..c....c.............#', // 14 checkpoint 3: entering the upper hall
    '#.#2#####################', // 15 entrance (left), portal 2 alcove
    '#....c....-..c..-...c...#', // 16 north lane: safe but longer; two 1-tile gaps to hop (optional shortcuts)
    '#.#######...###...#####.#', // 17
    '#.#####################.#', // 18 west squeeze, right shaft
    '#.#######.c.T...#######.#', // 19 sealed vault (portals only)
    '#.#######..1...c#######c#', // 20
    '#.#######.DDD2..#######.#', // 21 vault dragon
    '#.#######cDDD..g#######.#', // 22
    '#.#####################.#', // 23
    '#...T..%%%%%.c.......##c#', // 24 south lane: crumbling bridge, short but risky
    '#.c....%%%%%....c....##.#', // 25
    '####################.##.#', // 26
    '#..............DDDc..Fc.#', // 27 great hall: NE dragon guards the climb; checkpoint 2 at the climb
    '#..###....#####DDD.###..#', // 28
    '#..###....#####....###..#', // 29
    '#..............c.......c#', // 30
    '#....##....###....##....#', // 31
    '#....##....###....##....#', // 32
    '#...........c...........#', // 33
    '#..###....#####....###..#', // 34
    '#..###...c.........###..#', // 35
    '#.F..c..................#', // 36 checkpoint 1: entering the great hall
    '##.###################.##', // 37 entrance (left), portal pocket (right)
    '##.#################.cc##', // 38
    '##.#################1####', // 39
    '#.........c.........#####', // 40 lower junction
    '#c###############.c.#####', // 41 west squeeze snake, east spike gauntlet
    '#.......#########^^^#####', // 42
    '#######.#########.g.#####', // 43
    '#...c...#########..c#####', // 44
    '#.###############^^^#####', // 45
    '#.......#########.g.#####', // 46
    '#######.#########c..#####', // 47
    '#...c...#########^^^#####', // 48
    '#.###############...#####', // 49
    '#.###############.c.#####', // 50
    '#..c..............c.....#', // 51 start chamber
    '#...##......#......##...#', // 52
    '#...##..c...c...c..##...#', // 53
    '#.......................#', // 54
    '#...........P...........#', // 55
    '#.......................#', // 56
    '##.....................##', // 57
    '####.................####', // 58
    '#########################', // 59
  ],
  // Gems on the crumbling bridge: grab them before the floor gives way.
  treasureOnTiles: [
    { x: 8, y: 24, kind: 'gem' },
    { x: 10, y: 25, kind: 'gem' },
  ],
  // The rest face right (auto: toward the more open side).
  dragonOverrides: [
    { x: 16, y: 11, facing: 'left' }, // upper hall: head toward the gap by the pillar
    { x: 15, y: 27, facing: 'left' }, // great hall north-east
  ],
};
