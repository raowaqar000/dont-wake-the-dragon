import type { LevelData } from './types';

// 25 x 59 tiles. "The Trickster's Tunnel": jumping and hidden troll traps.
// Start at the bottom, climb north. Teach before punish: every troll trap type first
// fires once where it can't hurt you (a side pocket or the open start room), then
// shows up for real. At most 2 troll traps in a row, then a breather / checkpoint 'F'.
//  - row 54:     fake coin '$' in a dead-end nook off the start room (lesson: the spike
//                ring pops at the nook mouth; wait inside until it sinks);
//  - rows 48-53: gap lessons (1 tile, then 2 tiles);
//  - row 44:     trap floor in a side nook, lured by a coin (lesson);
//  - row 40:     full row of trap floor: it shakes, then drops; jump it (danger);
//  - rows 36-39: breather room, checkpoint 1; pop-up spikes in a nook by a coin (lesson);
//  - row 33:     full row of pop-up spikes: they rattle first; jump them or wait (danger);
//  - row 32:     falling rock on a corner tile beside the path (lesson: the shadow grows
//                next to you, the rock lands where you are not);
//  - row 32:     checkpoint 2 at the corridor exit;
//  - rows 26-31: a gap band with a dragon where you land, a gem by its
//                head and a fake coin (surprise);
//  - rows 21-23: two lanes, each with a falling ceiling rock (danger: walk the lane edge;
//                rubble stays, noisy);
//  - row 19:     checkpoint 3;
//  - row 18:     one-row closing wall (lesson: it slams shut behind you);
//  - rows 14-16: three-row closing wall: keep moving (danger);
//  - row 13:     checkpoint 4 (the one-tile climb out of the walls);
//  - rows 10-12: fake gem (surprise: spike ring + drops the floor in front
//                of the real exit); fake wall 'w' hides a secret gem pocket;
//  - rows 6-9:   1-wide gap with a moving pit: it widens to 2 when you jump (surprise);
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
    '##############F##########', // 13 checkpoint 4 (the only way up)
    '############[...]########', // 14 closing walls, 3 rows (danger)
    '############[...]########', // 15
    '############[...]########', // 16
    '#############...#########', // 17 plain corridor
    '############[...]########', // 18 closing walls, 1 row (lesson)
    '#####.........F.....#####', // 19 checkpoint 3 (below the closing walls)
    '#####.c...........c.#####', // 20
    '#####...#########...#####', // 21 two lanes
    '#####.R.#########.R.#####', // 22 falling rocks (danger)
    '#####...#########...#####', // 23
    '#####...............#####', // 24
    '##########.....##########', // 25
    '#.......DDDg............#', // 26 gap-band dragon, gem by its head
    '#..c....DDD..$..........#', // 27 fake coin (surprise)
    '#-----------------------#', // 28 gap band: jump it
    '#.......................#', // 29
    '#..c................c...#', // 30
    '#.......................#', // 31
    '##########.F.R###########', // 32 checkpoint 2 (corridor exit); falling rock on a corner tile beside it (lesson)
    '##########iii############', // 33 full row of pop-up spikes (danger)
    '##########...############', // 34
    '##########...############', // 35
    '########....ci###########', // 36 breather room; pop-up spikes in a nook (lesson)
    '########.....############', // 37
    '########.c.F.############', // 38 checkpoint 1
    '########.....############', // 39
    '##########ttt############', // 40 full row of trap floor (danger)
    '##########...############', // 41
    '##########...############', // 42
    '##########...############', // 43
    '##########..ct###########', // 44 trap floor in a side pocket (lesson)
    '##########...############', // 45
    '##########...############', // 46
    '##########...############', // 47
    '##########---############', // 48 2-tile gap
    '##########---############', // 49
    '##########...############', // 50
    '##########...############', // 51
    '##########...############', // 52
    '##########---############', // 53 1-tile gap (first lesson)
    '####$#####...############', // 54 fake coin in a dead-end nook (lesson: wait in the nook until the ring sinks)
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
    { x: 6, y: 22, alt: [{ x: 6, y: 21 }] },
    { x: 18, y: 22, alt: [{ x: 18, y: 23 }] },
  ],
};
