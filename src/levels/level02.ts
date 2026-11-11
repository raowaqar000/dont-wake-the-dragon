import type { LevelData } from './types';

// 25 x 59 tiles. "The Trickster's Tunnel": jumping and hidden troll traps.
// Start at the bottom, climb north. Every section teaches one trick:
//  - rows 48-54: gap lessons (1 tile, then 2 tiles);
//  - rows 40-44: trap floors drop right in front of you (jump at the last moment);
//  - rows 33-36: hidden pop-up spikes (a full row blocks: jump it; a single one: step around);
//  - rows 26-31: a gap band with a dragon right where you land, a gem by its head, a fake coin;
//  - rows 19-24: two lanes, each with a falling ceiling rock (rubble stays, noisy);
//  - rows 14-18: closing walls, sprint or jump through;
//  - rows 10-12: fake gem (spike ring + drops the floor in front of the real exit),
//                fake wall 'w' hides a secret gem pocket;
//  - rows 6-9:   1-wide gap with a moving pit: it widens to 2 when you jump;
//  - rows 1-5:   the exit runs away to the far side, past a sleeping dragon and a gap.
// Symbols are documented in ./types.ts. Reachability (with jumps) is checked at load.
export const level02: LevelData = {
  id: 'level02',
  name: "The Trickster's Tunnel",
  grid: [
    '#########################', // 0
    '##EEE#############eee####', // 1  decoy exit (left), real exit 'e' (right)
    '##...#############...####', // 2
    '#..............-...t....#', // 3  top hall: gap next to the dragon, trap floor before the real exit
    '#..c.......DDD.-.....c..#', // 4  hall dragon
    '#..........DDD.-........#', // 5
    '#####.###################', // 6
    '#####.###################', // 7
    '#####M###################', // 8  moving pit: drops when you jump the gap below
    '#####-###################', // 9  1-wide gap
    '#...........*....#....g.#', // 10 fake gem; secret pocket (right)
    '#.......c........w......#', // 11 fake wall door into the pocket
    '#................########', // 12
    '##############.##########', // 13
    '############[...]########', // 14 closing walls
    '############[...]########', // 15
    '############[...]########', // 16
    '############[...]########', // 17
    '############[...]########', // 18
    '#####...............#####', // 19
    '#####.c...........c.#####', // 20
    '#####...#########...#####', // 21 two lanes
    '#####.R.#########.R.#####', // 22 falling rocks
    '#####...#########...#####', // 23
    '#####...............#####', // 24
    '##########.....##########', // 25
    '#.......DDDg............#', // 26 gap-band dragon, gem by its head
    '#..c....DDD..$..........#', // 27 fake coin
    '#-----------------------#', // 28 gap band: jump it
    '#.......................#', // 29
    '#..c................c...#', // 30
    '#.......................#', // 31
    '##########...############', // 32
    '##########.i.############', // 33 single pop-up spike
    '##########...############', // 34
    '##########...############', // 35
    '##########iii############', // 36 full row of pop-up spikes
    '##########...############', // 37
    '##########...############', // 38
    '##########...############', // 39
    '##########.t.############', // 40 single trap floor
    '##########...############', // 41
    '##########...############', // 42
    '##########...############', // 43
    '##########ttt############', // 44 full row of trap floor
    '##########...############', // 45
    '##########...############', // 46
    '##########...############', // 47
    '##########---############', // 48 2-tile gap
    '##########---############', // 49
    '##########...############', // 50
    '##########...############', // 51
    '##########...############', // 52
    '##########---############', // 53 1-tile gap (first lesson)
    '##########...############', // 54
    '#.......................#', // 55 start chamber
    '#...c.......P.......c...#', // 56
    '#.......................#', // 57
    '#########################', // 58
  ],
  // Grabbing the fake gem also drops the floor in front of the real exit.
  trapLinks: [{ from: { x: 12, y: 10 }, to: [{ x: 19, y: 3 }] }],
  // Off by default; flip to true to shuffle these traps between attempts.
  varyTraps: false,
  trapVariants: [
    { x: 11, y: 40, alt: [{ x: 10, y: 41 }, { x: 12, y: 39 }] },
    { x: 11, y: 33, alt: [{ x: 10, y: 34 }] },
  ],
};
