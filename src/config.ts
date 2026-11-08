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
  portalSwirl: 'portal_swirl',
  softGlow: 'soft_glow',
  spikes: 'spikes',
  crumble: 'crumble',
  coin: 'coin',
  gem: 'gem',
  chest: 'chest',
  chestOpen: 'chest_open',
  sparkle: 'sparkle',
  noiseRing: 'noise_ring',
  dragonBody: 'dragon_body',
  dragonHead: 'dragon_head',
  dragonTailTip: 'dragon_tail_tip',
  dragonEyeHalf: 'dragon_eye_half',
  dragonEyeOpen: 'dragon_eye_open',
  dragonZ: 'dragon_z',
  smokePuff: 'smoke_puff',
  flame: 'flame',
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
      /** Base scale. It grows with loot on top of this (TUNING.loot.sack). */
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
    /** World camera zoom (< 1 shows more cave). HUD uses its own unzoomed camera. */
    zoom: 0.85,
    /** Fast pan to the destination after a teleport. */
    portalPanMs: 380,
    portalPanEase: 'Cubic.easeInOut',
  },

  portals: {
    /** Pair colors, indexed by portal digit - 1. */
    colors: [0x4fc3ff, 0xc77dff, 0x5cff9d, 0xff9f43, 0xff5c8a, 0xfff35c, 0x5cffe8, 0xa0a0ff, 0xffffff],
    /** Teleport when the player's center is this close to the portal center (px). */
    triggerRadius: 16,
    /** After arriving, the player must get this far away before the portal works again (px)... */
    rearmRadius: 34,
    /** ...and at least this much time must have passed (ms). */
    cooldownMs: 500,
    /** Swirl display size (px) and time per full turn (ms). */
    swirlSize: 46,
    swirlSpinMs: 1800,
    /** Swirl alpha while the portal is cooling down. */
    disarmedAlpha: 0.4,
    /** Soft glow above the darkness so portals show from afar. */
    glowRadius: 72,
    glowAlpha: 0.32,
    glowPulseMs: 1100,
    /** Teleport timings (ms): shrink at the entry, pop in at the exit. */
    shrinkMs: 150,
    /** Pop-in starts this long after the camera pan begins. */
    popDelayMs: 160,
    popMs: 200,
    /** Expanding ring flash on both portals. */
    burstMs: 380,
    depth: 3,
  },

  traps: {
    /** Trap hit boxes shrink by this much per side, so grazes don't count (px). */
    hitInset: 6,

    spikes: {
      downMs: 1500,
      upMs: 1000,
      /** Warning shake at the end of the down phase (ms, part of downMs). */
      warnMs: 350,
      warnShakePx: 2,
      /** How far the tips peek out while warning (0..1 of full height). */
      warnPeek: 0.18,
      /** Rise / lower animation (ms, part of upMs). Spikes only hurt between them. */
      riseMs: 90,
      lowerMs: 140,
      /** Default phase offset between spike groups (ms * group index). */
      groupOffsetMs: 700,
      plateColor: 0x4a4652,
      plateEdgeColor: 0x6a6574,
      holeColor: 0x15121a,
      steelColor: 0xc8ccd4,
      steelShadeColor: 0x7a7f8a,
      outlineColor: 0x0b0a0d,
      depth: 2,
    },

    crumble: {
      /** Shake time after being stepped on, before it collapses (ms). */
      shakeMs: 800,
      shakePx: 2.5,
      collapseMs: 280,
      /** Player falls in only if his center is this far inside the tile (px). */
      fallInset: 6,
      crackColor: 0x1e1a22,
      crackLightColor: 0x55505c,
      pitColor: 0x050407,
      pitRimColor: 0x231f28,
      dustColor: 0x9a9088,
      /** Dust puffs per burst while shaking, and on collapse. */
      shakeDust: 1,
      shakeDustEveryMs: 120,
      collapseDust: 10,
      depth: 1,
    },
  },

  fail: {
    /** Red camera flash + shake when caught. */
    flashMs: 260,
    flashColor: { r: 255, g: 50, b: 40 },
    shakeMs: 320,
    shakeIntensity: 0.012,
    /** Player blinks this color a few times. */
    hitTintColor: 0xff4a3a,
    hitBlinkMs: 80,
    hitBlinks: 3,
    /** Falling into a pit: shrink + spin toward its center (ms). */
    fallMs: 500,
    /** Time between being caught and the overlay appearing (ms). */
    overlayDelayMs: 750,
    titleColor: '#ff6b5c',
    /** Charred by dragon fire: the hero darkens to this color over charMs. */
    charColor: 0x2a2224,
    charMs: 260,
  },

  /**
   * Noise. Every noise has a loudness. It carries loudness * rangePerLoudness px
   * (the ring shows exactly that, times ring.scale) and adds to a listener's sleep meter:
   *   loudness * meterPerLoudness * (1 - d / range) ^ falloffExponent * walls * hearing
   * where d is the distance to the nearest edge of the listener's body.
   */
  noise: {
    /** Loudness of one footstep per move state. Standing still makes no steps. */
    footstep: { sneak: 0.22, run: 1 },
    /** While a chest's ring fills: one tick every chestTickMs, then a louder pop when it opens. */
    chestTick: 0.5,
    chestTickMs: 350,
    chestOpen: 0.8,
    /** Teleport: a small noise at both portals. */
    portal: 0.4,
    /** Carry range (px) of loudness 1. A run step reaches ~7 tiles. */
    rangePerLoudness: 336,
    /** Meter points at the source for loudness 1, before falloff. */
    meterPerLoudness: 16,
    /** Higher = quieter toward the edge of the range. */
    falloffExponent: 1.5,
    /** Multiplier when any wall tile blocks the straight line (pits don't block). */
    wallDampening: 0.2,
    /** Footstep position below the player's center (px): the feet. */
    feetOffsetY: 14,

    ring: {
      /** Ring radius = carry range * scale (1 = honest: a dragon inside the ring heard it). */
      scale: 1,
      /** Rings start this small (px) and expand to their radius while fading out. */
      startRadius: 6,
      /** Expand time: baseMs + radius * msPerPx. */
      baseMs: 300,
      msPerPx: 1.2,
      /** Alpha at the start; fades to 0 as the ring expands. */
      alpha: 0.6,
      /** Rings smaller than this (px) are not shown. */
      minRadius: 8,
      /** Pool size. When all are busy, the oldest is reused. */
      pool: 10,
      colors: {
        footstep: 0xffffff,
        chest: 0xffd23f,
        portal: 0x9fd8ff,
        floor: 0xffffff,
        throw: 0xffffff,
        roar: 0xff6a3a,
      },
      /** Above the darkness so the whole reach shows. */
      depth: 101,
    },
  },

  /** Sleeping dragons: footprint, sleep meter, look and the wake-up sequence. */
  dragon: {
    /** Physics body shrinks by this much per side (px), so the round body doesn't feel boxy. */
    bodyInset: 6,
    /** Default hearing multiplier (LevelData.dragonOverrides can change it per dragon). */
    hearing: 1,
    textureResolution: 2,
    /** Texture sizes (logical px). The body overhangs the 144x96 footprint a little. */
    bodyTexture: { w: 168, h: 116 },
    headTexture: { w: 64, h: 52 },
    /** Neck = head pivot, in the body frame (px from the footprint center, head facing right). */
    neck: { x: 26, y: -4 },
    /** Points on the head, relative to the neck (before head turn / lift). */
    mouth: { x: 46, y: 0 },
    nostril: { x: 42, y: 0 },
    /** Eye 0 is the one that half opens in stage 3. */
    eyes: [
      { x: 20, y: -8 },
      { x: 20, y: 8 },
    ],
    /** Tail tip pivot in the body frame, and its resting angle (deg). */
    tailTip: { x: 43, y: 30, angleDeg: -37 },
    depth: 5,
    /** Eyes, Zzz, smoke and the meter bar draw above the darkness, so you can spot a dragon in the dark. */
    overlayDepth: 105,

    meter: {
      max: 100,
      /** Stage 2 (stirring) and stage 3 (about to wake) start at these values. */
      stage2: 40,
      stage3: 75,
      /** Dropping back a stage needs the meter this far below the threshold (stops flicker). */
      hysteresis: 5,
      /** Quiet time before the meter drains (ms), then the drain speed (points/s). */
      drainDelayMs: 1000,
      drainPerSec: 10,
      /** In godMode the meter stops here, so dragons never wake. */
      godModeCap: 99,
    },

    /** Breathing: the body swells and shrinks. Period per stage 1/2/3 (ms) and swell amount. */
    breath: { periodMs: [2800, 1500, 950], amount: 0.035, headBobPx: 1 },

    zzz: {
      /** A new "z" every everyMs (stage 1 only), at most `max` per dragon. */
      everyMs: 1100,
      max: 3,
      riseMs: 2000,
      risePx: 52,
      driftPx: 16,
      scaleStart: 0.6,
      scaleEnd: 1.3,
      alpha: 0.85,
    },

    snore: {
      /** Random gap between snore puffs (ms), stage 1. */
      minMs: 3500,
      maxMs: 6500,
      puffs: 3,
    },

    stir: {
      /** Stage 2: tail twitch every min..max ms. */
      twitchMinMs: 700,
      twitchMaxMs: 1500,
      twitchDeg: 22,
      twitchMs: 220,
      /** Low growl: the body shakes for growlMs every min..max ms. */
      growlMinMs: 1600,
      growlMaxMs: 2600,
      growlMs: 420,
      growlShakePx: 1.6,
    },

    alert: {
      /** Stage 3: the head lifts (px forward) and grows a little; small smoke puffs. */
      headLiftPx: 4,
      headLiftScale: 1.06,
      /** How fast the head lifts / settles (fraction per second). */
      liftPerSec: 3,
      puffEveryMs: 750,
      /** The half-open eye's glow pulses with this period (ms). */
      glowPulseMs: 700,
    },

    phew: {
      /** Stage 3 back to stage 1: the eye closes slowly, then a relieved puff. */
      eyeCloseMs: 700,
      puffs: 4,
    },

    eyeGlow: { color: 0xffb02e, radius: 18, alpha: 0.55 },

    meterBar: {
      width: 74,
      height: 10,
      /** Gap above the footprint top (px). */
      gapPx: 10,
      backColor: 0x000000,
      backAlpha: 0.55,
      borderColor: 0x0b0a0d,
      /** Fill color per stage 1/2/3. */
      colors: [0x5cb8ff, 0xffb02e, 0xff4a3a],
      /** Fades in when the meter rises above 0, out when it is back at 0 (ms). */
      fadeMs: 250,
    },

    smoke: { lifespanMs: 900, speedMin: 10, speedMax: 28, scaleStart: 0.35, scaleEnd: 1.1, alpha: 0.5, color: 0x9a9090 },

    wake: {
      /** Both eyes open, the head lifts and turns toward the hero (ms). */
      eyesOpenMs: 160,
      turnMs: 300,
      /** Max head turn away from its facing (deg). */
      maxTurnDeg: 75,
      liftScale: 1.15,
      liftPx: 8,
      /** Roar: world camera shake, heavy vibration, a red ring and smoke. */
      roarAtMs: 300,
      roarShakeMs: 450,
      roarShakeIntensity: 0.018,
      roarRingRadius: 260,
      roarPuffs: 10,
      /** Fire cone from the mouth to the hero. */
      fireAtMs: 750,
      fireMs: 650,
      /** Cone half-angle (deg). */
      fireConeDeg: 12,
      fireEveryMs: 16,
      firePerTick: 3,
      fireLifespanMs: 380,
      fireScaleStart: 0.45,
      fireScaleEnd: 1.6,
      fireColors: [0xfff6b0, 0xffc040, 0xff5a1a, 0x5a1a10],
      /** The hero is charred at charAtMs; the result card opens at resultAtMs. */
      charAtMs: 1100,
      resultAtMs: 1850,
      charSmoke: 12,
      /** Short orange flash when the fire hits. */
      flashMs: 180,
      flashColor: { r: 255, g: 140, b: 40 },
      /** Camera pans toward the dragon: 0 = stay on the hero, 1 = on the dragon. */
      panShare: 0.4,
      panMs: 450,
      panEase: 'Sine.easeInOut',
    },

    colors: {
      outline: 0x14080a,
      body: 0xb8323a,
      bodyShade: 0x7d1f2a,
      bodyLight: 0xe0574f,
      belly: 0xf0b45a,
      wing: 0x6a1c2e,
      wingShade: 0x4a1222,
      wingRib: 0x2a0810,
      spine: 0xf2d8a8,
      horn: 0xf2e2c0,
      hornShade: 0xb8a07a,
      claw: 0xf2e2c0,
      nostril: 0x3a0c10,
      lid: 0x4a0e18,
      eyeIris: 0xffc23a,
      eyeLight: 0xfff4c0,
      pupil: 0x1a0606,
      z: 0xcfe6ff,
    },
  },

  haptics: {
    enabled: true,
    /** Light tick when a dragon starts stirring (stage 2 or 3). */
    lightMs: 30,
    /** Strong buzz when a dragon wakes (ms). */
    heavyMs: 400,
    /** Light ticks closer together than this are skipped (ms). */
    cooldownMs: 400,
  },

  lighting: {
    enabled: true,
    /** On-screen distance from the player where the darkness reaches full strength (px).
     *  Divided by camera zoom, so zooming out shows more cave in the same-size light. */
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

  /** Pickups and chests: values, look and feel. */
  treasure: {
    /** Logical size the textures are drawn at; they are drawn at 2x and scaled down. */
    textureResolution: 2,
    /** Items sit on the floor, under the player and the darkness. */
    depth: 4,
    /** Effects (sparkles, +N text, coin burst) draw above the darkness so they always read. */
    fxDepth: 104,
    /** Off-screen items skip their idle animation; margin around the camera view (px). */
    cullMargin: 64,

    coin: {
      value: 10,
      size: 20,
      /** Collected when the player's center is this close to the coin's center (px). */
      pickupRadius: 24,
      /** One full spin (ms) and bob height (px) / period (ms). */
      spinMs: 1100,
      bobPx: 2.5,
      bobMs: 1400,
      color: 0xffcf3a,
      shadeColor: 0xc8901a,
      lightColor: 0xfff2a8,
      outlineColor: 0x5a3a08,
      sparkles: 6,
      sparkleTint: 0xffe27a,
      textColor: '#ffd23f',
    },

    gem: {
      value: 50,
      size: 24,
      pickupRadius: 24,
      bobPx: 2,
      bobMs: 1800,
      /** A star twinkles on the gem every so often (random in this range, ms). */
      twinkleMinMs: 700,
      twinkleMaxMs: 1800,
      twinkleMs: 260,
      color: 0x5ce1ff,
      shadeColor: 0x2a8fd0,
      lightColor: 0xd8fbff,
      outlineColor: 0x0c2a4a,
      sparkles: 14,
      sparkleTint: 0x9ff0ff,
      textColor: '#7fe9ff',
    },

    chest: {
      value: 200,
      /** Texture size (logical px). */
      width: 40,
      height: 34,
      /** Standing still this long next to the chest opens it (ms). */
      openMs: 1500,
      /** Player center must be this close to the chest center to open it (px). */
      openRadius: 60,
      /** Player counts as standing still below this speed (px/s). Moving resets progress. */
      idleSpeed: 12,
      /** Progress ring around the chest. */
      ringRadius: 32,
      ringWidth: 6,
      ringColor: 0xffd23f,
      ringBackColor: 0x000000,
      ringBackAlpha: 0.45,
      ringFadeMs: 180,
      ringDepth: 11,
      /** Faint glow above the darkness (dimmer than portals and the exit). */
      glowRadius: 46,
      glowAlpha: 0.13,
      glowColor: 0xffc860,
      glowPulseMs: 1600,
      /** Opening: lid squash, coin burst, sparkles and a small shake (world camera only). */
      openSquashMs: 260,
      burstCoins: 14,
      burstSparkles: 18,
      shakeMs: 200,
      shakeIntensity: 0.006,
      woodColor: 0x8a5a2b,
      woodShadeColor: 0x5e3b1a,
      woodLightColor: 0xb07a3e,
      bandColor: 0xc9a24a,
      outlineColor: 0x1a0f06,
      insideColor: 0x2a1708,
      goldColor: 0xffd23f,
      sparkleTint: 0xffe27a,
      textColor: '#ffe27a',
    },

    /** Pickup pop: scale up and fade out. */
    popScale: 1.8,
    popMs: 200,
    /** Pickup on a collapsing floor: it shrinks into the pit and is lost. */
    lostMs: 320,

    sparkle: {
      size: 12,
      lifespanMs: 420,
      speedMin: 30,
      speedMax: 110,
    },

    coinBurst: {
      lifespanMs: 650,
      speedMin: 90,
      speedMax: 190,
      gravityY: 380,
    },

    floatText: {
      fontSize: 24,
      chestFontSize: 34,
      risePx: 44,
      ms: 850,
      strokeColor: '#000000',
      strokeThickness: 5,
    },
  },

  loot: {
    sack: {
      /** Sack reaches max size at this much loot. */
      fullLoot: 1000,
      /** Sack scale at full loot (1 = starting size). */
      maxScale: 1.6,
      /** Little bounce each time it grows. */
      bounceScale: 1.25,
      bounceMs: 240,
    },
    /** Hook for the greed mechanic (later). 0 = no slowdown. */
    greed: {
      speedPenaltyPerLoot: 0,
      minSpeedMultiplier: 1,
    },
  },

  hud: {
    /** Top of the HUD bar (logical px). Leaves room for phone notches. */
    top: 18,
    height: 76,
    sideMargin: 12,
    backColor: 0x000000,
    backAlpha: 0.45,
    cornerRadius: 18,
    fontSize: 40,
    smallFontSize: 34,
    color: '#ffffff',
    lootColor: '#ffd23f',
    iconSize: 38,
    /** x positions (logical px). */
    lootIconX: 46,
    timerX: 340,
    gemIconX: 452,
    chestIconX: 590,
    /** Gap between an icon and its number. */
    iconGap: 26,
    /** Loot number counts up over this long; numbers punch on change. */
    countUpMs: 450,
    punchScale: 1.25,
    punchMs: 140,
    depth: 1500,
  },

  save: {
    /** localStorage key prefix; the level id is appended. */
    bestLootKey: 'dwtd.bestLoot.',
  },

  overlay: {
    backdropAlpha: 0.6,
    buttonWidth: 420,
    buttonHeight: 140,
    buttonColor: 0xffd23f,
    buttonPressedColor: 0xc9a22a,
    /** Button ignores taps for this long after the overlay appears. */
    inputDelayMs: 350,
    /** Vertical gap between result lines (px). */
    lineGap: 60,
    newBestColor: '#ffd23f',
    newBestPulseMs: 520,
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
    /** Traps and other fails only flash instead of ending the run (for testing layouts). */
    godMode: false,
    /** Draw each dragon's hearing reach (run step outer, sneak step inner) and its meter value. */
    showDragons: true,
    fontSize: 22,
    color: '#9fe870',
    /** How often the debug text refreshes (ms). */
    refreshMs: 200,
    /** Top of the debug text, below the HUD bar. */
    top: 106,
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
