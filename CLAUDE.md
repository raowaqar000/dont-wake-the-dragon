# Don't Wake The Dragon

A mobile-only, portrait (720x1280 logical, `Phaser.Scale.FIT`) top-down stealth game.
A tiny hooded treasure hunter sneaks through dark caves, steals treasure and avoids waking dragons.
Stack: Phaser 3.90, TypeScript 5.9, Vite, Capacitor 8 (Android, app id `com.alihamza.dontwakethedragon`).

Scripts: `npm run typecheck` (tsc --noEmit), `npm run dev`, `npm run build`, `npm run android:sync`.

## Folder structure

- `src/main.ts`: installs mobile guards, creates the Phaser game (BootScene then GameScene).
- `src/config.ts`: `GAME_WIDTH/HEIGHT`, `SCENE_KEYS`, `TEXTURE_KEYS`, `COLORS`, **`TUNING`** and `createGameConfig`.
- `src/scenes/`: `BootScene` (builds the procedural textures, then starts the game); `GameScene` (builds the level and wires all the systems).
- `src/entities/`:
  - Player: `Player` (invisible Arcade physics circle, move state); `PlayerVisual` (animated thief and a separate public `sack` image).
  - Level objects: `ExitZone`, `Portal`, `SpikeTrap`, `CrumbleTile`.
  - Treasure: `Pickup` (coin/gem; idle animation driven by LootSystem) and `Chest` (solid, glow, progress ring, lid open).
- `src/systems/`:
  - Level and camera: `LevelParser` (grid to `ParsedLevel`); `LevelValidator` (pure path search, no Phaser); `LevelLoader` (walls plus one baked RenderTexture); `CameraRig` (world and UI cameras, `markUi`).
  - Gameplay: `MovementSystem` (sneak/run hysteresis, acceleration); `PortalSystem`; `TrapSystem`; `FailSystem`.
  - Loot: `LootSystem` (pickups, chest opening, totals; emits `LOOT_EVENTS.changed`); `LootFx` (sparkles, coin burst, floating "+N"); `SaveData` (best loot in localStorage, guarded with try/catch).
  - Graphics: `Lighting` (one radial darkness image); `HeroTextureFactory`, `TrapTextureFactory` and `TreasureTextureFactory` (procedural art made at boot).
  - Browser: `MobileGuards` (blocks zoom, scroll and long-press).
- `src/ui/`: `Joystick` (floating, bottom 60% of the screen, follows one finger only); `Hud` (top bar: loot, timer, gems, chests); `ResultOverlay` (end-of-run card); `EscapeOverlay`; `DebugOverlay` (below the HUD).
- `src/levels/`: `types.ts` (level format and symbols, no imports); `level01.ts` ("The Deep Warren", 25x60 tiles).
- `android/`: Capacitor Android project. `dist/`: Vite output (Capacitor `webDir`).

## Architecture rules

- **All tunable numbers live in `TUNING` in `src/config.ts`** (speeds, timings, colors, sizes, depths). Don't add magic numbers in entities or systems. Read them through a local alias such as `const P = TUNING.portals`.
- **Systems stay decoupled.** Systems get what they need as injected deps and callbacks (for example `TrapSystem({ onCaught, isPaused, onFloorCollapsed })`). Cross-cutting systems emit events: `LootSystem` extends `Phaser.Events.EventEmitter`, and the HUD and the sack listen to `LOOT_EVENTS.changed`. New systems (noise, dragons) should follow the same pattern.
- **UI goes on the UI camera.** `new CameraRig(scene)` must be created first in `create()`:
  - The world camera is zoomed (`TUNING.camera.zoom`) and follows the player. The UI camera has zoom 1 and never scrolls.
  - Every HUD object must call `markUi(scene, ...objects)`. Use `setScrollFactor(0)` for HUD objects.
  - Shakes, flashes and pans on gameplay use `rig.world` only.
- **Run end goes through `FailSystem`.**
  - `fail(reason, effect)` handles traps, pits and, later, the dragon. Add new causes to `FAIL_REASONS`.
  - Escape calls `fail.lock()` first. The first outcome wins, and nothing can end the run twice.
  - Check `fail.isOver` (and `portals.isTeleporting`) before reacting to gameplay.
  - `TUNING.debug.godMode` turns fails into a flash.
- **Levels are grids of strings** (`LevelData.grid`, one char per tile, row 0 at the top, `TUNING.level.tileSize` = 48).
  - `LevelParser` turns the grid into a `ParsedLevel`.
  - `LevelValidator` checks in dev, at load:
    - the exit is reachable, both with crumbling floors intact and with all of them collapsed;
    - every floor tile is reachable (8-way movement, no corner cutting, portals act as jumps).
  - `LevelLoader.check` throws if any check fails.
- **Visual and physics are split:** `Player` is physics only, and `PlayerVisual` reads its velocity after the physics step (POST_UPDATE).
- **Depth layers:** floor 0, crumble 1, spikes 2, portals 3, treasure 4, player 10, chest ring 11, darkness 100. Glows and loot effects that should show through the dark go above 100. HUD is 1500, debug 2000, overlays 3000.
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
| `D` | dragon spawn | reserved (parsed as floor, with a warning) |
| `~` | hazard (water / lava) | reserved |
| `S` | special (unassigned) | reserved |
| `x` | noisy floor: broken glass | reserved |
| `h` | noisy floor: chains | reserved |
| `r` | noisy floor: loose rocks | reserved |
| `_` | boulder trap: pressure plate | reserved |
| `O` | boulder trap: boulder start | reserved |

Coins or gems on top of another tile (for example a gem on a crumbling floor) go in `LevelData.treasureOnTiles`. If that floor collapses first, the treasure is lost.

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

## Next planned features

1. Dragons and the noise system.
2. Noisy floor hazards (glass, chains, loose rocks).
3. Distract throw.
4. Dragon behaviours.
5. Greed mechanic (loot weight slows the player; hook: `LootSystem.speedMultiplier` sets `Player.speedMultiplier`, tuned by `TUNING.loot.greed`).
6. Juice: sound, haptics (`@capacitor/haptics` is installed), particles.
7. More levels.
8. Supabase leaderboard.
