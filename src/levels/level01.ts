import type { LevelData } from './types';

// 25 x 60 tiles (1200 x 2880 px at 48px). Start at the bottom, exit at the top-left.
// Every band has a short risky route and a longer safe one (loops), and a sealed
// vault in the middle is only reachable through portal 1 (portal 2 leads on).
// Reachability and shortest path are checked at load by LevelValidator.
// Treasure follows risk vs reward: safe routes carry a few coins, risky routes
// (spike gauntlet, crumbling bridge, top squeeze, vault, dead ends) carry the gems and chests.
// Symbols are documented in ./types.ts.
export const level01: LevelData = {
  id: 'level01',
  name: 'The Deep Warren',
  grid: [
    '##EEE####################', // 0  exit (top-left)
    '#...c.###################', // 1  exit antechamber
    '#..#..###################', // 2
    '#.c...###################', // 3
    '###.###############.T####', // 4  hidden chest pocket (off the top squeeze)
    '###.###############..####', // 5
    '#...#...#...#.g.#...#...#', // 6  top squeeze tunnel, zig-zags right to left
    '#g#...#.g.#...#...#...#.#', // 7
    '#######################.#', // 8  only the right corner leads up
    '#.......................#', // 9  upper hall (ring around a pillar)
    '#..##.....#####.....##.c#', // 10
    '#.........#####.........#', // 11
    '#..##.....#####.....##c.#', // 12
    '#...............c.......#', // 13
    '#....c....c.............#', // 14
    '#.#2#####################', // 15 entrance (left), portal 2 alcove
    '#....c....#..c..#...c...#', // 16 north lane: safe but longer
    '#.#######...###...#####.#', // 17
    '#.#####################.#', // 18 west squeeze, right shaft
    '#.#######.c.T...#######.#', // 19 sealed vault (portals only)
    '#.#######..1...c#######c#', // 20
    '#.#######....2..#######.#', // 21
    '#.#######c.....g#######.#', // 22
    '#.#####################.#', // 23
    '#...T..%%%%%.c.......##c#', // 24 south lane: crumbling bridge, short but risky
    '#.c....%%%%%....c....##.#', // 25
    '####################.##.#', // 26
    '#.................c..c..#', // 27 great hall
    '#..###....#####....###..#', // 28
    '#..###....#####....###..#', // 29
    '#..............c.......c#', // 30
    '#....##....###....##....#', // 31
    '#....##....###....##....#', // 32
    '#...........c...........#', // 33
    '#..###....#####....###..#', // 34
    '#..###...c.........###..#', // 35
    '#....c..................#', // 36
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
};
