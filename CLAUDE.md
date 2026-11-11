# Don't Wake The Dragon

A mobile-only, portrait (720x1280 logical, `Phaser.Scale.FIT`) top-down stealth game.
A tiny hooded treasure hunter sneaks through dark caves, steals treasure and avoids waking dragons.
Stack: Phaser 3.90, TypeScript 5.9, Vite, Capacitor 8 (Android, app id `com.alihamza.dontwakethedragon`).

Scripts: `npm run typecheck` (tsc --noEmit), `npm run dev`, `npm run build`, `npm run android:sync`, `npm run assets` (rebuilds the painted art).

## Folder structure

- `art/raw/`: the hand-painted source PNGs (white backgrounds, sheets). Not shipped. `art/preview/` (gitignored): assembled previews written by `npm run assets`.
- `scripts/process-assets.mjs` (sharp): removes white backgrounds (border flood fill, soft un-mixed edges), cuts the treasure/trap sheets, trims and resizes to 2x, cuts the hero sack and the dragon tail tip, writes `public/assets/game/*.png` and `src/generated/artManifest.ts`. Raw-pixel anchor points (neck, eyes, mouth, sack seeds, tail cut) live in its `CONFIG`.
- `public/assets/game/`: game-ready PNGs (generated, committed).
- `src/generated/artManifest.ts`: generated file list, sizes and anchor points. Never edit by hand.
- `src/main.ts`: installs mobile guards, creates the Phaser game (BootScene then GameScene).
- `src/config.ts`: `GAME_WIDTH/HEIGHT`, `SCENE_KEYS`, `TEXTURE_KEYS`, `COLORS`, **`TUNING`** and `createGameConfig`.
- `src/scenes/`: `BootScene` (loads the painted art with a loading bar, builds the procedural textures, then starts the game); `GameScene` (builds the level and wires all the systems).
- `src/entities/`:
  - Player: `Player` (invisible Arcade physics circle, move state); `PlayerVisual` (painted thief: one still image per direction animated in code around a feet pivot, a step clock for footsteps, and a sack cut-out overlay that only grows; code-drawn frame animation as fallback).
  - Level objects: `ExitZone` (`slideBy` for the runaway exit), `Portal`, `SpikeTrap`, `CrumbleTile`.
  - `troll/`: `TrapFloor` (drops into a pit; also the moving pit; `addPitImage`), `PopupSpikes` (hidden spikes, also the fake-treasure ring), `FallingRock` (shadow, slam, rubble, grit tell), `ClosingWall` (two sliding slabs with moving immovable bodies; reopen after `holdMs`).
  - Treasure: `Pickup` (coin/gem; idle animation driven by LootSystem) and `Chest` (solid, glow, progress ring, lid open).
  - `Dragon`: one sleeping dragon (sleep meter, 3 stages, breathing, Zzz, tail twitch, eye glow, meter bar, wake pose). Implements `NoiseListener`. All parts are placed through `toWorld()` (art frame = head facing right; the asset script mirrors the left-facing art), so an upright dragon only needs a base rotation. Part positions come from a `DragonRig` (painted: from the art anchors; head image sleep/stir/roar by stage; fallback: `TUNING.dragon`).
- `src/systems/`:
  - Level and camera: `LevelParser` (grid to `ParsedLevel`); `LevelValidator` (pure path search, no Phaser); `LevelLoader` (walls plus one baked RenderTexture); `CameraRig` (world and UI cameras, `markUi`; hero offset, smoothed look-ahead via `update()`, padded bounds).
  - Gameplay: `MovementSystem` (sneak/run hysteresis, acceleration); `PortalSystem`; `TrapSystem` (spikes, crumble; collapsed crumbles become pits); `FailSystem` (`fail` = card, `quickFail` = trap death with auto-restart, `begin/finish` = dragon sequence; `onDeath` hook counts deaths).
  - Jump and troll traps: `PitMap` (which tiles are open pits; no physics bodies); `JumpSystem` (EventEmitter, `JUMP_EVENTS.takeoff/land/fell`; buffer, coyote time, cooldown, falls when the body center is over a pit); `TrollTrapSystem` (EventEmitter, `TROLL_EVENTS.triggered`; tile-based triggers checked only on tile change, trap links, tells, fake walls, rubble).
  - Noise and dragons: `NoiseSystem` (`emitNoise(x, y, loudness, source)`, distance falloff, grid-DDA wall dampening, pooled fading rings); `DragonSystem` (owns the dragons, shared smoke/fire emitters, stage haptics, the wake-up sequence, debug reach); `HapticsService` (Capacitor Haptics, `navigator.vibrate` fallback, never throws).
  - Loot: `LootSystem` (pickups, chest opening, totals; emits `LOOT_EVENTS.changed`); `LootFx` (sparkles, coin burst, floating "+N"); `SaveData` (best loot and lifetime deaths per level in localStorage, guarded with try/catch; session attempts in memory). Fake treasure emits `LOOT_EVENTS.fakeTaken`.
  - Graphics: `ArtAssets` (`queueArt`, `artKey(name)`, `hasArt(scene, ...names)`, `ART_SCALE`); `Lighting` (one radial darkness image); `HeroTextureFactory`, `TrapTextureFactory`, `TreasureTextureFactory`, `TrollTextureFactory` (placeholders: ceiling rock, rock shadow, rubble, jump icon) and `DragonTextureFactory` (procedural art made at boot; the dragon factory also makes the noise ring, smoke and flame).
  - Browser: `MobileGuards` (blocks zoom, scroll and long-press).
- `src/ui/`: `Joystick` (floating, bottom 60% of the screen, follows one finger only; ignores touches that start on interactive objects); `JumpButton` (round, semi-transparent, bottom right; ignores presses for `ignoreAfterStartMs` after a restart); `Hud` (top bar: loot, timer, gems, chests; deaths and session attempts under it); `ResultOverlay` (end-of-run card); `EscapeOverlay`; `DebugOverlay` (below the HUD).
- `src/levels/`: `types.ts` (level format and symbols, no imports); `index.ts` (`LEVELS`, `getLevel(id)`; start level = `TUNING.debug.startLevel`); `level01.ts` ("The Deep Warren", 25x60 tiles); `level02.ts` ("The Trickster's Tunnel", 25x59, jumping + 18 troll traps, 2 dragons).
- `android/`: Capacitor Android project. `dist/`: Vite output (Capacitor `webDir`).

## Architecture rules

- **All tunable numbers live in `TUNING` in `src/config.ts`** (speeds, timings, colors, sizes, depths). Don't add magic numbers in entities or systems. Read them through a local alias such as `const P = TUNING.portals`.
- **Systems stay decoupled.** Systems get what they need as injected deps and callbacks (for example `TrapSystem({ onCaught, isPaused, onFloorCollapsed })`). Cross-cutting systems emit events: `LootSystem` extends `Phaser.Events.EventEmitter`, and the HUD and the sack listen to `LOOT_EVENTS.changed`. New systems should follow the same pattern.
- **All sound goes through `NoiseSystem.emitNoise(x, y, loudness, source)`.** GameScene wires it in: footsteps (`PlayerVisual.onFootstep`, fired on footfall frames), chest ticks and the open pop (`LootSystem` `onNoise`), portals (`PortalSystem` `onPortalNoise`). Noisy floors and thrown objects should call the same API with a new `NoiseSource`. Loudness 1 = a run step; carry range = loudness * `TUNING.noise.rangePerLoudness`, and the ring shows exactly that range. Anything that hears implements `NoiseListener` and is registered with `noise.addListener`.
- **UI goes on the UI camera.** `new CameraRig(scene)` must be created first in `create()`:
  - The world camera is zoomed (`TUNING.camera.zoom`) and follows the player. The UI camera has zoom 1 and never scrolls.
  - Every HUD object must call `markUi(scene, ...objects)`. Use `setScrollFactor(0)` for HUD objects.
  - Shakes, flashes and pans on gameplay use `rig.world` only.
- **Run end goes through `FailSystem`.**
  - `fail(reason, effect)` handles traps and pits. Add new causes to `FAIL_REASONS`.
  - A fail with a sequence (the dragon) calls `fail.begin()` first (locks the run, freezes input), plays its sequence, then calls `fail.finish(reason, effect, overlayDelayMs)`.
  - Escape calls `fail.lock()` first. The first outcome wins, and nothing can end the run twice.
  - Check `fail.isOver` (and `portals.isTeleporting`) before reacting to gameplay.
  - `TUNING.debug.godMode` turns fails into a flash, and caps dragon meters at 99 so they never wake.
- **Levels are grids of strings** (`LevelData.grid`, one char per tile, row 0 at the top, `TUNING.level.tileSize` = 48).
  - `LevelParser` turns the grid into a `ParsedLevel`.
  - `LevelValidator` checks in dev, at load:
    - the exit is reachable, both with crumbling floors intact and with all of them collapsed;
    - every floor tile is reachable (8-way movement, no corner cutting, portals act as jumps; chests and dragon footprints are solid).
  - `LevelLoader.check` throws if any check fails.
- **Painted art with a code-drawn fallback.** Every entity checks `hasArt(scene, ...)` and uses `artKey(name)` textures, otherwise the procedural texture (still built at boot). Display sizes are `TUNING.art.<asset>.displayScale` times `ART_SCALE` (0.5, the art is 2x). Never hard-code art anchor points: add them to the script's `CONFIG` so they land in `artManifest.ts`. After replacing an image, run `npm run assets` and check `art/preview/`.
- **Visual and physics are split:** `Player` is physics only, and `PlayerVisual` reads its velocity after the physics step (POST_UPDATE).
- **Depth layers:** floor 0, crumble 1, spikes 2, portals 3, treasure 4, dragon 5, player 10, chest ring 11, darkness 100. Glows and loot effects that should show through the dark go above 100: noise rings 101, loot effects 104, dragon eyes/Zzz/smoke/meter bar/fire 104-108. HUD is 1500, debug 2000, overlays 3000.
- **Clean up on scene restart:** retry calls `scene.restart()`. Remove scene and game event listeners on `SHUTDOWN`.

## Level symbols (from `src/levels/types.ts`)

| Symbol | Meaning | Status |
|---|---|---|
| `#` | cave wall (solid) | implemented |
| `.` | floor | implemented |
| `P` | player start (exactly one) | implemented |
| `E` | exit zone (at least one; tiles that touch merge into one exit) | implemented |
| `1`-`9` | teleport portal; each digit appears exactly twice (one pair); color is `TUNING.portals.colors[d-1]` | implemented |
| `^` | spike trap; spike tiles that touch form one group; groups are offset by `groupOffsetMs`; override with `LevelData.spikeOverrides` | implemented |
| `%` | crumbling floor: shakes when stepped on, then becomes a pit (wall); the level must be finishable with every `%` collapsed | implemented |
| `c` | treasure: coin (instant pickup) | implemented |
| `g` | treasure: gem / diamond (instant pickup) | implemented |
| `T` | treasure: chest (solid; stand still next to it to open it); every treasure must be reachable | implemented |
| `D` | sleeping dragon; touching `D` tiles form one dragon, exactly 3 wide x 2 tall (`DRAGON_FOOTPRINTS`); solid; facing auto (more open side) or `LevelData.dragonOverrides` (facing, hearing) | implemented |
| `~` | hazard (water / lava) | reserved |
| `S` | special (unassigned) | reserved |
| `-` | gap: open pit from the start, jumpable (up to `TUNING.jump.maxJumpTiles` wide) | done |
| `t` | troll: trap floor, drops into a pit when the player is ~1 tile away (tell: thin crack) | done |
| `i` | troll: pop-up spikes, hidden, pop when the player is next to them (tell: pinholes) | done |
| `R` | troll: falling ceiling rock, shadow then slam; leaves passable, noisy rubble (tell: grit) | done |
| `[` `]` | troll: closing walls, `[` left and `]` right of the corridor rows; solid tiles (tell: dark seam) | done |
| `$` `*` | troll: fake coin / fake gem, spike ring + noise, can fire links (tell: duller color) | done |
| `e` | troll: runaway exit, real exit position; the `E` door slides here when you get close (tell: scuffs) | done |
| `w` | troll: fake wall, walkable, drawn as wall above the hero (tell: lighter shade, glint) | done |
| `M` | troll: moving pit, drops when you jump toward its gap, widening it by 1 (once per level; tell: pebble) | done |
| `x` | noisy floor: broken glass | reserved |
| `h` | noisy floor: chains | reserved |
| `r` | noisy floor: loose rocks | reserved |
| `_` | boulder trap: pressure plate | reserved |
| `O` | boulder trap: boulder start | reserved |

Coins or gems on top of another tile (for example a gem on a crumbling floor) go in `LevelData.treasureOnTiles`. If that floor collapses first, the treasure is lost.

Optional level data: `trapLinks` (`{ from, to[] }`: firing the trap at `from` fires the traps at `to`); `varyTraps` + `trapVariants` (`{ x, y, alt[] }`: attempt n moves the trap to one of its alternative `.` tiles; off by default).
The validator understands jumps (straight 4-way over 1..`maxJumpTiles` pit tiles), checks the worst case (crumble, trap floors and moving pits all dropped), targets the real exit `e` when there is one, and checks that every moving pit's widened gap is still jumpable.

## Git rules

- Always work on `main`. Never create branches.
- Run no git commands at all (no commits, no pushes, nothing during or after a feature) until the user says **"kill"**.
- **"kill"** means: `git add .`, then `git commit` with a short feature message (for example "Feature 5: treasure pickups, chests, loot sack and HUD"), then `git push origin main`.
- Remote: `origin` = github.com/raowaqar000/dont-wake-the-dragon.

## Working rules for Claude

- **Mobile-only, touch-only.** No keyboard or mouse controls (keyboard is disabled in the game config). Use multi-touch pointers (`TUNING.input.extraPointers`).
- **Plan first.** For every feature, give a short plan (files, approach, questions), then STOP and wait for the user's "approved" before writing code.
- **Never run** the dev server, `vite build` for testing, or Gradle/APK builds. The user runs those.
- **Always run the type-check** after changes: `npx tsc --noEmit`. Report the result.
- **Target cheap Android phones:**
  - Use few draw calls (baked textures, pooled or reused objects). Avoid per-frame allocations.
  - Use simple distance checks instead of heavy physics. Keep particle counts small.
  - Make textures procedurally once at boot.
- Keep everything that already works working (portals, traps, fail and escape, camera, validator).
- After a feature: say what changed and what to test on the phone.

## Features done

1. Setup: Phaser, TypeScript, Vite and Capacitor project, portrait scaling, mobile guards, floating touch joystick with sneak/run.
2. Cave level from grid strings, wall collision, zoomed camera follow, glowing exit zone with an ESCAPED overlay and run time.
3. Hooded thief character (procedural animated sprite: idle, sneak and run in 3 directions, footstep dust, separate sack sprite).
4. Bigger 25x60 cave "The Deep Warren" with:
   - portals (with the vault reachable only by portal), spike traps and crumbling floor;
   - FailSystem with CAUGHT/ESCAPED via ResultOverlay;
   - darkness lighting, a separate UI camera, and LevelValidator.
5. Treasure and loot: coins, gems and chests (hold still to open); LootSystem with events; HUD; growing sack; ESCAPED/CAUGHT loot stats; best loot saved locally.
6. Sleeping dragons and noise:
   - NoiseSystem with footstep, chest and portal noise, wall dampening and visible noise rings;
   - 5 dragons in level01 with a sleep meter, 3 wake stages, a "phew" on near misses, and a ~1.8 s wake-up (roar, fire, charred hero, "THE DRAGON WOKE UP!");
   - haptics on stirring and on wake-up.
7. Hand-painted art: asset pipeline (`npm run assets`), loading bar, painted hero (code-animated, growing sack overlay), dragon (body + swappable head + cut tail tip), treasure, traps, portals (pair-colored ring), exit door, tiled floor and wall textures, with code-drawn fallbacks.

8. Jump and troll traps:
   - JUMP button (UI camera, multi-touch with the joystick), 0.45 s hop with a fixed distance (same at sneak and run), air control, coyote time, jump buffer, cooldown, landing noise; the hero clears gaps, spikes and crumbling floors in the air;
   - pits are `PitMap` tiles (no bodies): walking in with the body center over one = fall;
   - 8 hidden troll traps with subtle tells, trap links, optional trap variation;
   - trap deaths auto-restart after 0.8 s (dragon wake keeps its full sequence and card); lifetime deaths per level and session attempts in the HUD, deaths on the ESCAPED and CAUGHT cards;
   - level02 "The Trickster's Tunnel"; level01 got two optional 1-tile hops; `TUNING.debug.startLevel` picks the level.
   - Code-drawn placeholders still needing painted art: ceiling rock, rock shadow, rubble, jump button icon, closing-wall slab face (uses the wall tile now), optional hero jump pose.
9. Readability pass:
   - darker brown walls and a lighter warm floor; baked raised-wall look in `LevelLoader.drawEdges` (lit edges, drop shadows on all sides, outline, dark "void" fill deep in thick rock); solid rock drawn around the level (`drawOutside`);
   - pits get a hole overlay (`TEXTURE_KEYS.pitOverlay`: dark center, shadow under the near edge, light far rim), also on trap floors and moving pits;
   - lighting: bigger radius, darkness 0.6, a fully clear core (`brightCoreRadius`), light leans toward movement (`aheadPx`) or up when idle (`idleUpPx`);
   - camera: hero at `heroScreenY` 0.58, smoothed look-ahead (`CameraRig.update`, `CameraRig.look`), `boundsPadding` lets the view go past the level edges;
   - hero shown ~1.3x bigger (physics unchanged); debug text and dragon debug off by default;
   - fake walls match the new wall color and edges but keep a visible glint tell.

## Next planned features

1. Main menu, level select map with stars, proper game UI (second batch of UI art).
2. Dragon wake = alarm + chase instead of instant death, hiding spots, alarm traps.
3. Items picked up during runs (smoke bomb, lullaby flute, silent boots, decoy coin bag, grappling rope, fire shield, torch).
4. More traps (alarm bells, swinging axes, arrow walls, fire jets, stalactites, boulders, mimic chests, bats, noisy floors `x` `h` `r`, webs, ice).
5. Heist escape (main prize collapses the cave, sprint out).
6. Worlds, 3 stars per level, shop, boss dragons, endless mode, daily challenge.
7. Sound, music, haptics polish, Supabase leaderboard.
