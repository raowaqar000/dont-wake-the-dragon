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
  /** Feature 8 placeholders (code-drawn until painted versions exist). */
  ceilingRock: 'ceiling_rock',
  rockShadow: 'rock_shadow',
  rubble: 'rubble',
  jumpIcon: 'jump_icon',
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
    /** Trap deaths: quick hit effect, then auto-restart after this long with no overlay (ms). */
    quickRestartMs: 800,
    /** Crushed by closing walls: squash amount and time. */
    crushSquash: 0.6,
    crushMs: 140,
  },

  /** Top-down hop. Distance is the same at sneak and run, so gap sizes can be learned. */
  jump: {
    /** Time in the air (ms). */
    airMs: 450,
    /** Ground distance of a full jump (tiles). Speed in the air = distance / airMs. */
    distanceTiles: 2.75,
    /** Widest gap the level validator treats as jumpable (tiles). Keep below distanceTiles - 0.5. */
    maxJumpTiles: 2,
    /** How fast the air velocity turns toward the joystick (fraction per second). */
    airControlPerSec: 5,
    /** No new jump this long after landing (ms). No double jump. */
    cooldownMs: 150,
    /** Jump still works this long after the body's center moved over a gap (ms). */
    coyoteMs: 100,
    /** A press this long before the jump is allowed again still jumps (ms). */
    bufferMs: 120,
    /** Player falls in when his center is inside a pit tile shrunk by this (px). */
    fallInset: 6,
    /** Look: max lift (px), extra scale at the top, squash on takeoff / landing. */
    heightPx: 22,
    airScale: 0.12,
    squash: 0.18,
    squashMs: 90,
    shadow: { width: 28, height: 11, alpha: 0.4, minScale: 0.55 },

    button: {
      /** Center (logical px, UI camera) and radius. Bottom right, easy thumb reach. */
      x: 612,
      y: 1128,
      radius: 82,
      /** Semi-transparent so it doesn't hide the cave in clips. */
      color: 0xffffff,
      alpha: 0.16,
      pressedAlpha: 0.38,
      strokeAlpha: 0.45,
      strokeWidth: 4,
      iconAlpha: 0.75,
      iconScale: 1,
      pressScale: 0.9,
      pressMs: 70,
      /** Presses are ignored this long after a (re)start, so a held finger doesn't jump at once (ms). */
      ignoreAfterStartMs: 300,
      depth: 1001,
    },
  },

  /** Hidden "troll" traps (feature 8). Distances in tiles, times in ms. */
  troll: {
    depth: 1,
    /** Effects above the player (falling rock, rubble). */
    fxDepth: 12,
    /** Trap floor 't': drops into a pit when the player is this close (Chebyshev tiles). */
    trapFloor: {
      triggerTiles: 1,
      dropDelayMs: 150,
      collapseMs: 260,
      dust: 10,
      /** Tell: a thin crack. */
      crackColor: 0x1e1a22,
      crackAlpha: 0.4,
    },
    /** Pop-up spikes 'i': hidden, shoot up when the player is next to them. */
    popSpikes: {
      triggerTiles: 1,
      /** First pop (still hidden): delay before they are up. */
      popDelayMs: 100,
      /** Once revealed, later pops warn this long first. */
      revealedWarnMs: 450,
      upMs: 2500,
      /** After going down, they can't pop again for this long. */
      rearmMs: 400,
      /** Tell: tiny pinholes. */
      holeColor: 0x15121a,
      holeAlpha: 0.32,
    },
    /** Falling ceiling rock 'R'. */
    rock: {
      triggerTiles: 1,
      /** Shadow grows for shadowMs; the rock drops during the last fallMs of it. */
      shadowMs: 750,
      fallMs: 170,
      dropHeightPx: 170,
      shadowMaxAlpha: 0.55,
      shakeMs: 180,
      shakeIntensity: 0.008,
      slamDust: 12,
      /** Tell: a grain of grit falls every min..max ms while on screen. */
      gritMinMs: 1600,
      gritMaxMs: 3600,
      displayScale: 1,
    },
    /** Closing walls '[' + ']': slide together across the corridor between them. */
    closingWall: {
      /** Triggers when the player is in the corridor or this many rows before/after it. */
      triggerAheadTiles: 0,
      warnMs: 250,
      warnShakePx: 2,
      closeMs: 1200,
      /** Stay shut, then slide back open (no softlock). */
      holdMs: 2500,
      openMs: 1500,
      /** Crushed when the hero is in the corridor and the opening is narrower than this (px, body is 26). */
      crushGapPx: 24,
      tint: 0x7a6a88,
      seamColor: 0x0b0a0d,
      seamAlpha: 0.55,
    },
    /** Fake coin '$' / fake gem '*': no loot, a ring of spikes pops around it, noise. */
    fakeTreasure: {
      ringDelayMs: 250,
      /** Tell: slightly duller tint, gems don't twinkle. */
      tint: 0xd0c4b0,
      text: '?!',
      textColor: '#ff6b5c',
    },
    /** Runaway exit: near the 'E' door it slides to the 'e' tiles (once). */
    runawayExit: {
      triggerTiles: 2,
      slideMs: 650,
      /** Tell: scuff marks on the floor toward the real spot. */
      scuffColor: 0x0b0a0d,
      scuffAlpha: 0.28,
    },
    /** Fake wall 'w': looks like wall, walkable. Fades while the player is inside. */
    fakeWall: {
      /** Tell: a slightly different tint than TUNING.art.level.wallTint, and a hairline glint. */
      tint: 0x9282a2,
      insideAlpha: 0.35,
      fadePerSec: 6,
      glintAlpha: 0.3,
    },
    /** Moving pit 'M': drops when the player jumps toward its gap (once per level). */
    movingPit: {
      /** Ray length from the takeoff point along the jump (tiles). */
      lookAheadTiles: 3,
    },
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
    /** Jump landing: louder than a sneak step, quieter than a run step. */
    land: 0.6,
    /** A step on rubble (from a fallen ceiling rock): louder than a sneak step. */
    rubbleStep: 0.5,
    /** Troll traps: rock slam, closing walls, fake treasure, floor drop. */
    rockSlam: 0.9,
    wallsClose: 0.7,
    fakeTreasure: 0.6,
    floorDrop: 0.45,
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
        land: 0xffffff,
        trap: 0xffa070,
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
    /** Deaths counter under the bar (left), with "attempts this session" below it. */
    deathsX: 24,
    deathsY: 104,
    deathsFontSize: 28,
    deathsColor: '#ff8a7a',
    attemptsFontSize: 20,
    attemptsColor: '#d8d0c8',
  },

  save: {
    /** localStorage key prefix; the level id is appended. */
    bestLootKey: 'dwtd.bestLoot.',
    /** Lifetime deaths per level. */
    deathsKey: 'dwtd.deaths.',
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

  /**
   * Hand-painted art (public/assets/game/, made by `npm run assets`). If an image fails to load,
   * that object falls back to its code-drawn texture. Every displayScale multiplies the
   * natural size (texture px * textureScale); 1 = the size the asset script made it for.
   */
  art: {
    /** Painted textures are made at 2x, so 1 texture px = 0.5 world px. */
    textureScale: 0.5,
    /** Folder (relative to the page) the painted PNGs load from. */
    path: 'assets/game/',

    loading: {
      barWidth: 420,
      barHeight: 22,
      color: 0xffd23f,
      backColor: 0x000000,
      backAlpha: 0.55,
      borderColor: 0x5a5262,
      textColor: '#ffe7a3',
      fontSize: 30,
    },

    /** Hero: still images per direction, animated in code. */
    hero: {
      /** 96 px texture -> 48 world px; 0.86 -> ~41 px tall. */
      displayScale: 0.86,
      /** Feet position below the physics body center (world px, before displayScale). */
      feetOffsetY: 19,
      /** How fast the pose blends to the current motion (per second). Higher = snappier. */
      blendPerSec: 14,
      idle: {
        bobPx: 1.2,
        bobMs: 1700,
        /** Breathing squash (fraction of height). */
        breathe: 0.025,
      },
      /** Tiptoe: small hops with squash/stretch and a side-to-side sway. */
      sneak: {
        /** Footsteps per second at sneak speed (matches the old 7 fps, 2 steps per 4 frames). */
        stepsPerSec: 3.5,
        liftPx: 2.2,
        squash: 0.07,
        stretch: 0.06,
        swayDeg: 5,
        /** Forward lean when moving sideways (deg). */
        leanDeg: 2,
        /** Crouch: overall height while sneaking. */
        crouch: 0.95,
      },
      /** Run: faster, bigger bounce and a forward lean. */
      run: {
        /** Footsteps per second at run speed (matches the old 12 fps). */
        stepsPerSec: 6,
        liftPx: 4.5,
        squash: 0.13,
        stretch: 0.08,
        swayDeg: 3,
        leanDeg: 10,
        crouch: 1,
      },
      /** Sack overlay base scale; it grows with loot (TUNING.loot.sack), never below the painted sack. */
      sackScale: 1,
    },

    dragon: {
      /** Whole dragon (body, head, tail). 0.58 -> body ~104 x 74 px, head ~58 px wide. */
      displayScale: 0.58,
      /** Head size relative to the body. */
      headScale: 1,
      /** Shift of the whole dragon from the footprint center (art frame: +x = toward the head). */
      offsetX: 0,
      offsetY: -4,
      /** true = the cut tail tip twitches; false = the whole body wiggles instead. */
      tailTwitch: true,
      tailTwitchDeg: 9,
      wiggleDeg: 1.5,
      /** Eye glow size relative to TUNING.dragon.eyeGlow.radius. */
      eyeGlowScale: 0.75,
    },

    coin: { displayScale: 0.85 },
    gem: { displayScale: 1 },
    /** The chest stands on its tile: bottom edge at tile bottom + offsetY. */
    chest: { displayScale: 0.95, offsetY: 2 },
    spikes: {
      displayScale: 1,
      /** The raised spikes slide up this far while rising (px). */
      riseSlidePx: 3,
    },
    crumble: { displayScale: 1 },
    pit: { displayScale: 1 },
    portal: {
      displayScale: 0.9,
      /** Pair-colored swirl inside the stone ring (size relative to the portal, flattened to match its oval). */
      swirlScale: 0.5,
      swirlFlatten: 0.72,
      swirlAlpha: 0.55,
      /** Thin glow ring in the pair's color (size relative to the portal, px width). */
      ringScale: 0.47,
      ringWidth: 2.5,
      ringAlpha: 0.85,
    },
    /** The door is centered on the exit zone, bottom edge on the zone's bottom edge. */
    exitDoor: { displayScale: 1.3, offsetY: 0 },

    level: {
      /** Tile texture repeat scale (1 = 384 px texture covers 4 tiles). */
      floorScale: 1,
      wallScale: 1,
      /** Multiply tint: walls a bit darker so they read apart from the floor. */
      floorTint: 0xffffff,
      wallTint: 0x8a7a98,
      /** Lighter top edge of a wall below open floor, and the floor shadow under a wall. */
      wallEdge: true,
      wallEdgeAlpha: 0.4,
      floorShadow: true,
      floorShadowAlpha: 0.35,
      /** Dark line where wall meets floor (px, 0 = off). */
      outlineWidth: 2,
      outlineColor: 0x0b0a0d,
      outlineAlpha: 0.6,
    },
  },

  debug: {
    enabled: true,
    /** Level to start (temporary, until the level select exists): 'level01' | 'level02'. */
    startLevel: 'level02' as string,
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
    top: 170,
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
