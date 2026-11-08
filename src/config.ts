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
  darkness: 'darkness',
  hero: 'hero',
  heroSack: 'hero_sack',
  dust: 'dust',
} as const;

export const COLORS = {
  caveBackground: '#14121a',
} as const;

/** Every tunable gameplay/UI number lives here. */
export const TUNING = {
  player: {
    /** Size of the (invisible) physics sprite's placeholder circle texture. */
    radius: 14,
    /** Physics circle radius. Slightly smaller than the visual so corners feel rounded; lower it (e.g. 12) if the player snags. */
    bodyRadius: 13,
    fillColor: 0xffd23f,
    outlineColor: 0x8a6400,
    outlineWidth: 3,
  },

  /** Treasure hunter look + animation. Purely visual; physics lives in `player`. */
  playerVisual: {
    /** Logical frame size in px (character is ~43px tall inside it before displayScale). */
    frameSize: 48,
    /** Textures are drawn at this multiple and scaled down, so they stay crisp. */
    textureResolution: 2,
    /** On-screen scale of the character (0.88 -> ~38px tall). */
    displayScale: 0.88,
    /** Shift the visual relative to the physics body center (px). 0 = centered. */
    offsetY: 0,
    outlineWidth: 2.2,
    depth: 10,

    colors: {
      outline: 0x0b0a0d,
      cloak: 0x2f6b3a,
      cloakShade: 0x1f4a28,
      cloakLight: 0x4a9a58,
      skin: 0xf0c49a,
      eyes: 0x1a1208,
      gloves: 0x6b4a2e,
      boots: 0x4a3424,
      bootsShade: 0x33241a,
      clasp: 0xffd23f,
      sack: 0xa07a4a,
      sackShade: 0x7a5a35,
      sackLight: 0xc89a62,
      rope: 0xdcc080,
    },

    /** Base animation frame rates (fps) at reference speed. */
    idleFps: 2.5,
    sneakFps: 7,
    runFps: 12,
    /** Below this actual speed (px/s) the idle animation plays. */
    animMinSpeed: 12,
    /** Animation speed = actual speed / state speed, clamped to this range. */
    timeScaleMin: 0.5,
    timeScaleMax: 1.6,

    /** Sneak: body height multiplier (crouch) and foot travel (px). */
    sneakCrouch: 0.9,
    sneakStride: 2,
    /** Run: foot travel, forward lean and cloak hem flap (px). */
    runStride: 4.5,
    runLean: 3,
    runFlap: 2.5,
    /** How much more the other axis must dominate before facing switches (stops diagonal flicker). */
    facingHysteresis: 0.3,

    sack: {
      /** Grows with treasure later. */
      scale: 1,
      /** Attach point relative to the frame center, per direction (px, before displayScale). */
      offsets: {
        down: { x: 7, y: -10 },
        up: { x: 0, y: 4 },
        side: { x: -10, y: -2 },
      },
    },

    dust: {
      enabled: true,
      /** Puffs per footstep while running. */
      count: 2,
      lifespanMs: 450,
      speedMin: 8,
      speedMax: 26,
      scaleStart: 0.5,
      scaleEnd: 1.3,
      alpha: 0.45,
      color: 0xb8aea0,
    },
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

  level: {
    tileSize: 48,
    floorColor: 0x3a3540,
    /** Random per-tile brightness change (+/- fraction). */
    floorShadeVariation: 0.08,
    wallColor: 0x1b1720,
    wallShadeVariation: 0.06,
    /** Lighter top edge of a wall where floor is above it. */
    wallEdgeColor: 0x5a5262,
    wallEdgeHeight: 6,
    depth: 0,
  },

  camera: {
    /** Follow smoothing per frame (0..1, 1 = locked to the player). */
    lerp: 0.1,
  },

  lighting: {
    enabled: true,
    /** Distance from the player where the darkness reaches full strength (px). */
    lightRadius: 300,
    /** Fraction of lightRadius used for the fade (rest is fully lit). */
    softness: 0.6,
    /** Max darkness alpha far from the player (0 = none, 1 = pitch black). */
    darkness: 0.85,
    color: 0x05040a,
    depth: 100,
  },

  exit: {
    color: 0xffe7a3,
    glowAlpha: 0.9,
    pulseMs: 900,
    pulseMinAlpha: 0.55,
    pulseScale: 1.12,
    labelColor: '#ffe7a3',
    labelFontSize: 26,
    labelOffsetY: 6,
  },

  overlay: {
    backdropAlpha: 0.6,
    buttonWidth: 420,
    buttonHeight: 140,
    buttonColor: 0xffd23f,
    buttonPressedColor: 0xc9a22a,
    /** Button ignores taps for this long after the overlay appears. */
    inputDelayMs: 350,
    depth: 3000,
  },

  input: {
    /** Extra touch pointers on top of Phaser's default (total = 1 + this). */
    extraPointers: 2,
  },

  debug: {
    enabled: true,
    /** Draw Arcade physics bodies (walls, player, exit). */
    showBodies: false,
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
        debug: TUNING.debug.showBodies,
      },
    },
    input: {
      keyboard: false,
    },
    scene: scenes,
  };
}
