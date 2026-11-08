import Phaser from 'phaser';

/** Logical game resolution (portrait 9:16). Phaser scales this to fit the screen. */
export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1280;

export const SCENE_KEYS = {
  boot: 'BootScene',
  game: 'GameScene',
} as const;

export const TEXTURE_KEYS = {
  player: 'player',
} as const;

export const COLORS = {
  caveBackground: '#14121a',
} as const;

/** Every tunable gameplay/UI number lives here. */
export const TUNING = {
  player: {
    /** Visual + physics radius in px (28px diameter: tiny on screen). */
    radius: 14,
    fillColor: 0xffd23f,
    outlineColor: 0x8a6400,
    outlineWidth: 3,
  },

  movement: {
    sneakSpeed: 90, // px/s
    runSpeed: 220, // px/s
    /** How fast velocity rises toward the target speed (px/s²). */
    acceleration: 900,
    /** How fast velocity drops when slowing or stopping (px/s²). */
    deceleration: 1200,
    /** Strength at which sneak switches to run. */
    runEnterThreshold: 0.6,
    /** While running, strength must drop below this to go back to sneak (hysteresis). */
    runExitThreshold: 0.55,
    /** Clamp frame delta so a long pause (app resume) can't cause a huge jump. */
    maxDeltaMs: 50,
  },

  joystick: {
    /** Max distance the knob can travel from the base center (px). */
    maxDistance: 70,
    baseRadius: 80,
    knobRadius: 34,
    /** Strength below this counts as no input (0..1). */
    deadZone: 0.1,
    /** Joystick can only start below this fraction of screen height (0.4 = bottom 60%). */
    activationZoneTop: 0.4,
    baseColor: 0xffffff,
    baseAlpha: 0.18,
    baseStrokeAlpha: 0.35,
    knobColor: 0xffffff,
    knobAlpha: 0.45,
    depth: 1000,
  },

  input: {
    /** Extra touch pointers on top of Phaser's default (total = 1 + this). */
    extraPointers: 2,
  },

  debug: {
    enabled: true,
    fontSize: 22,
    color: '#9fe870',
    /** How often the debug text refreshes (ms). */
    refreshMs: 200,
    depth: 2000,
  },
} as const;

export function createGameConfig(scenes: Phaser.Types.Scenes.SceneType[]): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: COLORS.caveBackground,
    disableContextMenu: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    input: {
      keyboard: false,
    },
    scene: scenes,
  };
}
