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
// Portals (all look the same; the player only learns where one leads by stepping in):
//  - pair 1: (1,10) in the fake-gem room -> (1,3) in the top hall, beside the decoy exit
//            (skips only the moving-pit gap; the exit still runs away);
//  - pair 2: (23,31) below the gap band -> (23,26) above it, far east of the dragon.
// Subtle trap hints (clues only, no warning signs or "!"). Surprise traps: each dangerous
// trap has a 30% (seeded, fixed) chance to have no clue at all; the harmless lesson traps
// in the side nooks always keep theirs (alwaysHintTraps). `npm run validate` lists them.
// Symbols are documented in ./types.ts. Reachability (with jumps) is checked at load.
export const level03: LevelData = {
  id: 'level03',
  name: "The Trickster's Tunnel",
  hintLevel: 'subtle',
  noHintChance: 0.3,
  // Teach-before-punish lessons: never surprises.
  alwaysHintTraps: [
    { x: 4, y: 54 }, // fake coin in the dead-end nook off the start room
    { x: 13, y: 44 }, // trap floor in the side pocket
    { x: 13, y: 36 }, // pop-up spikes in the breather-room nook
    { x: 13, y: 32 }, // falling rock on the corner tile beside the path
    { x: 14, y: 18 }, // one-row closing wall
  ],
  grid: [
    '#########################', // 0
    '##EEE#############eee####', // 1  decoy exit (left), real exit 'e' (right)
    '##...#############...####', // 2
    '#1.............-...t....#', // 3  top hall: gap next to the dragon, trap floor before the real exit; portal 1 (west)
    '#..c.......DDD.-.....c..#', // 4  hall dragon
    '#..........DDD.-........#', // 5
    '#####.###################', // 6
    '#####.###################', // 7
    '#####M###################', // 8  moving pit: drops when you jump the gap below
    '#####-###################', // 9  1-wide gap
    '#1..........*....#....g.#', // 10 fake gem; secret pocket (right); portal 1 (west)
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
    '#.......DDDg...........2#', // 26 gap-band dragon, gem by its head; portal 2 (east)
    '#..c....DDD..$..........#', // 27 fake coin (surprise)
    '#-----------------------#', // 28 gap band: jump it
    '#.......................#', // 29
    '#..c................c...#', // 30
    '#......................2#', // 31 portal 2 (east)
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
