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
  /** Feature 8 code-drawn textures: fallbacks for the painted rock, rubble and jump button; the shadow and pit overlay are always code-drawn. */
  ceilingRock: 'ceiling_rock',
  rockShadow: 'rock_shadow',
  rubble: 'rubble',
  jumpIcon: 'jump_icon',
  pitOverlay: 'pit_overlay',
  /** Lives HUD (code-drawn, painted-style placeholders until heart art exists). */
  heartFull: 'heart_full',
  heartEmpty: 'heart_empty',
  heartShardLeft: 'heart_shard_left',
  heartShardRight: 'heart_shard_right',
  /** Red screen-edge glow on the last life. */
  dangerVignette: 'danger_vignette',
  /** Trap hints (code-drawn, painted-style placeholders): clues near hidden troll traps and the "!" bubble. */
  hintBones: 'hint_bones',
  hintSkull: 'hint_skull',
  hintScratches: 'hint_scratches',
  hintCrackRing: 'hint_crack_ring',
  hintSign: 'hint_sign',
  dangerBubble: 'danger_bubble',
  /** HUD mute button icons. */
  iconSoundOn: 'icon_sound_on',
  iconSoundOff: 'icon_sound_off',
} as const;

export const COLORS = {
  caveBackground: '#14121a',
} as const;

/**
 * One voice of a code-generated sound effect (jsfxr-style). A sound is a list of voices
 * mixed together; each voice can start later (delayMs) for little jingles.
 */
export interface SfxVoice {
  wave: 'square' | 'saw' | 'triangle' | 'sine' | 'noise';
  /** Start pitch (Hz). For noise: how often a new random value is picked (lower = rumblier). */
  freq: number;
  /** End pitch (Hz), reached exponentially over the voice's length. Default: freq. */
  slide?: number;
  /** Envelope (ms): rise, hold at full, fade out. */
  attackMs: number;
  sustainMs: number;
  decayMs: number;
  /** 0..1 */
  volume: number;
  /** Pitch wobble: rate (Hz) and depth (fraction of the pitch). */
  vibratoHz?: number;
  vibratoDepth?: number;
  /** One-pole low-pass cutoff (Hz). Softens harsh waves. */
  lowpass?: number;
  /** Pitch jumps by arpMul at arpAtMs (coin "ding-ding"). */
  arpMul?: number;
  arpAtMs?: number;
  /** Start this long after the sound starts (ms). */
  delayMs?: number;
}

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
    /** On-screen scale of the character (1.14 -> ~49px tall). */
    displayScale: 1.14,
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
    floorColor: 0x6a5a48,
    /** Random per-tile brightness change (+/- fraction). */
    floorShadeVariation: 0.08,
    wallColor: 0x2a1f17,
    wallShadeVariation: 0.06,
    /** Lighter lit edge on a wall tile wherever it borders floor (raised look). */
    wallEdgeColor: 0xb08a62,
    wallEdgeHeight: 9,
    depth: 0,
  },

  camera: {
    /** Follow smoothing per frame (0..1, 1 = locked to the player). */
    lerp: 0.1,
    /** World camera zoom (< 1 shows more cave). HUD uses its own unzoomed camera. */
    zoom: 0.85,
    /** Where the hero sits on screen vertically (0 = top, 0.5 = center, 1 = bottom). Below center shows more ahead. */
    heroScreenY: 0.58,
    /** The view leans this far (world px) toward the direction of movement. */
    lookAheadPx: 110,
    /** Look-ahead smoothing per frame at 60 fps (0..1). Lower = smoother. */
    lookAheadLerp: 0.04,
    /** The camera may scroll this far (world px) past the level edges, so the hero isn't stuck at the screen edge. */
    boundsPadding: 240,
    /** Fast pan to the destination after a teleport. */
    portalPanMs: 380,
    portalPanEase: 'Cubic.easeInOut',
  },

  portals: {
    /** Every portal looks the same (no pair colors): the player only learns where one leads by stepping in. */
    color: 0xa9b8ff,
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
      /** LevelData.spikeTiming 'slow' (easy levels): longer safe window, longer warning. */
      slow: { downMs: 2600, upMs: 900, warnMs: 700, groupOffsetMs: 900 },
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
    quickRestartMs: 700,
    /** Crushed by closing walls: squash amount and time. */
    crushSquash: 0.6,
    crushMs: 140,
  },

  /** Top-down hop. Distance is the same at sneak and run, so gap sizes can be learned. */
  jump: {
    /** Time in the air (ms). */
    airMs: 450,
    /** Ground distance of a full jump (tiles). Speed in the air = distance / airMs. */
    distanceTiles: 3.1,
    /** Widest gap the level validator treats as jumpable (tiles). Keep about 1 tile below
     *  distanceTiles, so jumps feel generous rather than exact. */
    maxJumpTiles: 2,
    /** How fast the air velocity turns toward the joystick (fraction per second). */
    airControlPerSec: 5,
    /** No new jump this long after landing (ms). No double jump. */
    cooldownMs: 150,
    /** Jump still works this long after the body's center moved over a gap (ms). */
    coyoteMs: 150,
    /** A press this long before the jump is allowed again still jumps (ms). */
    bufferMs: 150,
    /** Player falls in when his center is inside a pit tile shrunk by this (px). */
    fallInset: 6,
    /** Look: max lift (px), extra scale at the top, squash on takeoff / landing. */
    heightPx: 22,
    airScale: 0.12,
    squash: 0.18,
    squashMs: 90,
    shadow: { width: 36, height: 14, alpha: 0.4, minScale: 0.55 },

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
    /**
     * Trap floor 't': fires when the player's center is within triggerTiles of the tile's
     * edge (checked every frame, never from on top), shakes for dropDelayMs, then drops.
     */
    trapFloor: {
      triggerTiles: 0.8,
      dropDelayMs: 300,
      collapseMs: 260,
      dust: 10,
      /** Shake before the drop: a floor patch jitters this much (px), with a little dust. */
      shakePx: 2,
      shakeDust: 3,
      /** Tell: a thin crack. */
      crackColor: 0x1e1a22,
      crackAlpha: 0.8,
      crackWidth: 2,
    },
    /** Pop-up spikes 'i': hidden, shoot up when the player is next to them. */
    popSpikes: {
      triggerTiles: 1,
      /** First pop (still hidden): the tile rattles with a puff of dust for this long, then they rise. */
      popDelayMs: 250,
      warnDust: 4,
      warnShakePx: 1.5,
      /** Once revealed, later pops warn this long first. */
      revealedWarnMs: 450,
      upMs: 2500,
      /** After going down, they can't pop again for this long. */
      rearmMs: 400,
      /** Tell: tiny pinholes. */
      holeColor: 0x15121a,
      holeAlpha: 0.7,
      holeRadius: 1.8,
    },
    /** Falling ceiling rock 'R'. */
    rock: {
      triggerTiles: 1,
      /** Shadow grows for shadowMs; the rock drops during the last fallMs of it. */
      shadowMs: 900,
      fallMs: 170,
      dropHeightPx: 170,
      shadowMaxAlpha: 0.8,
      shakeMs: 180,
      shakeIntensity: 0.008,
      slamDust: 12,
      /** Tell: a grain of grit falls every min..max ms while on screen. */
      gritMinMs: 800,
      gritMaxMs: 1800,
      displayScale: 1,
    },
    /** Closing walls '[' + ']': slide together across the corridor between them. */
    closingWall: {
      /** Triggers when the player is in the corridor or this many rows before/after it. */
      triggerAheadTiles: 0,
      warnMs: 350,
      warnShakePx: 3,
      closeMs: 1600,
      /** Stay shut, then slide back open (no softlock). */
      holdMs: 2500,
      openMs: 1500,
      /** Crushed when the hero is in the corridor and the opening is narrower than this (px, body is 26). */
      crushGapPx: 24,
      tint: 0x5e4a3a,
      seamColor: 0x0b0a0d,
      seamAlpha: 0.9,
      seamPx: 3,
    },
    /** Fake coin '$' / fake gem '*': no loot, a ring of spikes pops around it, noise. */
    fakeTreasure: {
      ringDelayMs: 350,
      /** Tell: slightly duller tint, gems don't twinkle. */
      tint: 0xc0b49e,
      text: '?!',
      textColor: '#ff6b5c',
    },
    /** Runaway exit: near the 'E' door it slides to the 'e' tiles (once). */
    runawayExit: {
      triggerTiles: 2,
      slideMs: 650,
      /** Tell: scuff marks on the floor toward the real spot. */
      scuffColor: 0x0b0a0d,
      scuffAlpha: 0.38,
    },
    /** Fake wall 'w': looks like wall, walkable. Fades while the player is inside. */
    fakeWall: {
      /** Tell: a slightly different tint than TUNING.art.level.wallTint, and a hairline glint. */
      tint: 0x6a5442,
      insideAlpha: 0.35,
      fadePerSec: 6,
      /** The glint stays clearly visible so fake walls remain discoverable. */
      glintAlpha: 0.55,
    },
    /** Moving pit 'M': drops when the player jumps toward its gap (once per level). */
    movingPit: {
      /** Ray length from the takeoff point along the jump (tiles). */
      lookAheadTiles: 3,
      /** Tell: one loose pebble (shadow + stone). */
      pebbleShadowAlpha: 0.6,
      pebbleColor: 0x8a8296,
      pebbleAlpha: 0.95,
    },
  },

  /**
   * Trap hints so the player can sense danger. Per level: LevelData.hintLevel
   *   'strong' = clues + warning sign + "!" danger sense, 'subtle' = clues only, 'none' = nothing.
   * Clues are code-drawn painted-style placeholders (TEXTURE_KEYS.hint*).
   */
  hints: {
    /** Default when a level doesn't set hintLevel. */
    defaultLevel: 'subtle' as 'strong' | 'subtle' | 'none',
    /** Clue textures are drawn at this multiple, shown at 1 / it. */
    textureResolution: 2,
    /** Clue size (world px, before scale) and how strongly it shows. */
    clueSize: 30,
    clueAlpha: 0.95,
    /** Clue sits this far (fraction of a tile) toward a corner of its tile, so it doesn't cover the middle. */
    clueOffset: 0.18,
    /** Cracked floor ring drawn on the trap tile itself (trap floor / moving pit). */
    crackRingSize: 44,
    crackRingAlpha: 0.75,
    /** Tiny wooden warning sign on the approach side ('strong' only). */
    signSize: 30,
    signAlpha: 1,
    depth: 1.5,
    /** Colors: bone, outline, wood, scratch, crack. */
    boneColor: 0xe8dcc0,
    boneShadeColor: 0xa8987a,
    outlineColor: 0x1a120c,
    woodColor: 0x8a5a2b,
    woodShadeColor: 0x5e3b1a,
    signMarkColor: 0xd23a2a,
    scratchColor: 0x1a120c,
    crackColor: 0x15101a,

    /** Danger sense ('strong'): within senseTiles of an untriggered hidden trap -> "!" + haptic tick, once per trap. */
    senseTiles: 2,
    bubbleSize: 34,
    bubbleColor: 0xfff3d6,
    bubbleOutlineColor: 0x1a0a0c,
    bubbleMarkColor: 0xd23a2a,
    /** Bubble tail tip this far above the hero's body center (px); pop in, hold, fade. */
    bubbleOffsetY: 34,
    bubblePopMs: 140,
    bubbleHoldMs: 700,
    bubbleFadeMs: 260,
    bubblePopScale: 1.3,
    /** Above the darkness so it always reads. */
    bubbleDepth: 106,
  },

  /**
   * Noise. Every noise has a loudness. It carries loudness * rangePerLoudness px
   * (the ring shows exactly that, times ring.scale) and adds to a listener's sleep meter:
   *   loudness * meterPerLoudness * (1 - d / range) ^ falloffExponent * walls * hearing
   * where d is the distance to the nearest edge of the listener's body.
   */
  noise: {
    /** Loudness of one footstep per move state. Standing still makes no steps. */
    footstep: { sneak: 0.2, run: 0.75 },
    /** While a chest's ring fills: one tick every chestTickMs, then a louder pop when it opens. */
    chestTick: 0.5,
    chestTickMs: 350,
    chestOpen: 0.8,
    /** Teleport: a small noise at both portals. */
    portal: 0.4,
    /** Jump landing: louder than a sneak step, quieter than a run step. */
    land: 0.45,
    /** A step on rubble (from a fallen ceiling rock): louder than a sneak step. */
    rubbleStep: 0.5,
    /** Troll traps: rock slam, closing walls, fake treasure, floor drop. */
    rockSlam: 0.9,
    wallsClose: 0.7,
    fakeTreasure: 0.6,
    floorDrop: 0.45,
    /** Carry range (px) of loudness 1. A run step (0.75) reaches ~5 tiles. */
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
      drainDelayMs: 800,
      drainPerSec: 15,
      /** Noises worth less than this (meter points) still add up but don't stop the drain,
       *  so sneaking (max ~3.2 per step) can never wake a dragon. */
      quietBelow: 3.5,
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
    /** Danger-sense tick: very short, own cooldown (ms). */
    tickMs: 15,
    tickCooldownMs: 600,
  },

  lighting: {
    enabled: true,
    /** On-screen distance from the player where the darkness reaches full strength (px).
     *  Divided by camera zoom, so zooming out shows more cave in the same-size light. */
    lightRadius: 440,
    /** Fraction of lightRadius used for the fade (rest is fully lit). */
    softness: 0.55,
    /** Fully clear circle around the hero (on-screen px); the fade starts outside it. */
    brightCoreRadius: 150,
    /** Max darkness alpha far from the player (0 = none, 1 = pitch black). */
    darkness: 0.6,
    /** The light center leans this far (world px) toward the direction of movement... */
    aheadPx: 60,
    /** ...and this far up when standing still (levels mostly go north). */
    idleUpPx: 30,
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

  /** Checkpoint 'F': a small flag with a glow. Touching it saves the spot (memory only, per level). */
  checkpoint: {
    /** Reached when the player's center is this close to the flag's tile center (px).
     *  76 > 1.5 tiles, so walking anywhere through a 3-wide corridor past the flag counts. */
    triggerRadius: 76,
    /** Flag: pole height, cloth size (px) and colors before / after it is reached. */
    poleHeight: 30,
    poleColor: 0x3a2a1c,
    clothW: 16,
    clothH: 11,
    idleColor: 0x7fb8ff,
    activeColor: 0xffc23a,
    /** Small stone base under the pole. */
    baseColor: 0x5a5060,
    /** Soft glow above the darkness so it is visible from afar. */
    glowRadius: 40,
    glowIdleAlpha: 0.14,
    glowActiveAlpha: 0.32,
    glowPulseMs: 1400,
    /** Cloth waves this much (deg) with this period (ms). */
    waveDeg: 8,
    waveMs: 900,
    /** Reached: "Checkpoint!" pop and sparkles. */
    text: 'Checkpoint!',
    textColor: '#ffe27a',
    fontSize: 30,
    sparkles: 16,
    sparkleTint: 0xffe27a,
    popScale: 1.35,
    popMs: 220,
    depth: 3,
  },

  /**
   * Lives per level attempt (memory only, like checkpoints). Every death costs one; at 0 the
   * "OUT OF LIVES" card restarts the level from the very beginning. An escape refills them.
   */
  lives: {
    /** Lives at the start of each level attempt. */
    start: 5,
    /** Cap for lives added from code (future extra-life pickup 'L', shop, rewarded ad). */
    max: 5,

    /** Hearts row under the HUD bar, right-aligned (the deaths counter is on the left). */
    heartSize: 44,
    heartGap: 8,
    rightX: 696,
    centerY: 128,
    /** Heart texture is drawn at this multiple and shown scaled down (crisp). */
    textureResolution: 2,
    /** Painted-style colors (outline, fill, shade, highlight; empty heart). */
    outlineColor: 0x1a0a0c,
    fillColor: 0xe0313a,
    shadeColor: 0x9c1a24,
    highlightColor: 0xffb0a8,
    emptyFillColor: 0x2a2026,
    emptyAlpha: 0.75,

    /** Losing a life: the heart shakes, cracks into two halves that fall apart, then the empty heart fades in. */
    /** shakeMs + breakMs should stay under fail.quickRestartMs so trap deaths show the whole break. */
    shakeMs: 200,
    shakePx: 5,
    breakMs: 440,
    breakFallPx: 26,
    breakSpreadPx: 12,
    breakSpinDeg: 28,
    emptyFadeMs: 260,
    /** Gaining a life: the heart pops in. */
    gainPopScale: 1.4,
    gainPopMs: 260,

    /** Last life: the remaining heart pulses red. */
    lastPulseScale: 1.18,
    lastPulseMs: 420,
    lastPulseTint: 0xff5a5a,
    /** Last life: red glow on the screen edges (fades out at 0 lives). */
    vignetteColor: { r: 200, g: 20, b: 24 },
    vignetteMinAlpha: 0.22,
    vignetteMaxAlpha: 0.42,
    vignettePulseMs: 900,
    vignetteFadeMs: 400,
    /** Glow texture size (stretched to the screen); the clear center is this fraction of it. */
    vignetteTextureW: 180,
    vignetteTextureH: 320,
    vignetteInner: 0.55,
    /** Under the HUD (1500) and the overlays, above the darkness. */
    vignetteDepth: 1400,

    /** Quick trap death: "-1 heart" pops over the hero (world space). */
    lostText: '-1 heart',
    lostTextColor: '#ff6b6b',
    lostFontSize: 28,
    lostOffsetY: 34,

    /** Dragon card line. */
    leftColor: '#ff9a9a',
    leftFontSize: 40,

    /** Game over card. */
    gameOverTitle: 'OUT OF LIVES',
    gameOverColor: '#ff4a4a',
    gameOverSubtitle: 'The level starts over.',
    restartLabel: 'Restart level',
    restartButtonWidth: 520,
    restartButtonHeight: 170,
    restartFontSize: 58,
  },

  /**
   * Sound effects (SoundSystem). Every sound is generated in code from the voices in `sfx`
   * (no audio files needed). To use a real file instead, put it in public/assets/sfx/ and
   * add `key: 'file.mp3'` to `files` (same keys); the synth is the fallback if it fails to load.
   * Audio starts only after the first touch (mobile browser rule).
   */
  sound: {
    enabled: true,
    /** Overall volume of everything (0..1). */
    masterVolume: 0.7,
    /** Muted on the very first launch? The HUD button toggles it (saved in localStorage). */
    mutedByDefault: false,
    /** Synth render rate (Hz). Lower = cheaper, a bit lo-fi (fits the style). */
    sampleRate: 22050,
    /** The same sound can't restart faster than this (ms), so bursts don't stack up. */
    minGapMs: 40,
    /** Folder (relative to the page) for real audio files. */
    filePath: 'assets/sfx/',
    /** Optional real audio files per sound key, e.g. { coin: 'coin.mp3' }. */
    files: {} as Partial<Record<string, string>>,

    /** Dragon snore loop (plays a lot, so it has its own volume). 0..1, times masterVolume. */
    snoreVolume: 0.12,
    /** Heard from this far from a sleeping (stage 1) dragon's body (tiles); louder closer in. */
    snoreRangeTiles: 5,
    /** Volume follows the distance smoothly (fraction per second). */
    snoreFadePerSec: 2.5,

    /** Timed spikes cycle all the time: only heard within this many tiles of the hero. */
    spikesHearTiles: 5,

    /** Mute button (UI camera), under the hearts on the right. */
    button: {
      x: 672,
      y: 192,
      radius: 26,
      backColor: 0x000000,
      backAlpha: 0.45,
      iconSize: 30,
      iconColor: 0xffffff,
      offColor: 0xff6b5c,
      pressScale: 0.88,
      pressMs: 70,
      depth: 1500,
    },

    /** Sound recipes. Keys are the sound names used in code (and in `files`). */
    sfx: {
      // Hero and pickups.
      stepSneak: [{ wave: 'noise', freq: 1800, attackMs: 2, sustainMs: 6, decayMs: 35, volume: 0.06, lowpass: 1100 }],
      stepRun: [{ wave: 'noise', freq: 1300, attackMs: 2, sustainMs: 14, decayMs: 70, volume: 0.2, lowpass: 1800 }],
      jump: [{ wave: 'square', freq: 260, slide: 560, attackMs: 4, sustainMs: 40, decayMs: 90, volume: 0.24, lowpass: 2600 }],
      land: [
        { wave: 'noise', freq: 600, attackMs: 2, sustainMs: 20, decayMs: 110, volume: 0.28, lowpass: 900 },
        { wave: 'sine', freq: 120, slide: 55, attackMs: 2, sustainMs: 20, decayMs: 120, volume: 0.28 },
      ],
      coin: [{ wave: 'square', freq: 988, arpMul: 1.5, arpAtMs: 60, attackMs: 2, sustainMs: 50, decayMs: 160, volume: 0.3, lowpass: 5000 }],
      gem: [
        { wave: 'triangle', freq: 1319, arpMul: 1.5, arpAtMs: 70, attackMs: 2, sustainMs: 80, decayMs: 300, volume: 0.24 },
        { wave: 'sine', freq: 2637, attackMs: 2, sustainMs: 40, decayMs: 260, volume: 0.08, vibratoHz: 9, vibratoDepth: 0.01, delayMs: 70 },
      ],
      chestTick: [{ wave: 'square', freq: 1700, slide: 1300, attackMs: 1, sustainMs: 6, decayMs: 25, volume: 0.18, lowpass: 3500 }],
      chestOpen: [
        { wave: 'noise', freq: 900, attackMs: 5, sustainMs: 60, decayMs: 180, volume: 0.2, lowpass: 1400 },
        { wave: 'square', freq: 523, arpMul: 1.335, arpAtMs: 90, attackMs: 2, sustainMs: 90, decayMs: 300, volume: 0.13, lowpass: 4000, delayMs: 110 },
      ],
      checkpoint: [
        { wave: 'triangle', freq: 523, arpMul: 1.26, arpAtMs: 90, attackMs: 3, sustainMs: 120, decayMs: 120, volume: 0.24 },
        { wave: 'triangle', freq: 784, attackMs: 3, sustainMs: 80, decayMs: 320, volume: 0.24, delayMs: 200 },
      ],
      portal: [
        { wave: 'sine', freq: 300, slide: 1100, attackMs: 40, sustainMs: 140, decayMs: 260, volume: 0.2, vibratoHz: 12, vibratoDepth: 0.08 },
        { wave: 'noise', freq: 3000, attackMs: 60, sustainMs: 120, decayMs: 260, volume: 0.09, lowpass: 2500 },
      ],
      // Traps.
      spikesUp: [
        { wave: 'noise', freq: 4000, attackMs: 1, sustainMs: 20, decayMs: 60, volume: 0.16, lowpass: 5000 },
        { wave: 'square', freq: 900, slide: 420, attackMs: 1, sustainMs: 10, decayMs: 70, volume: 0.06, lowpass: 3000 },
      ],
      crumble: [{ wave: 'noise', freq: 450, attackMs: 10, sustainMs: 260, decayMs: 260, volume: 0.24, lowpass: 800, vibratoHz: 28, vibratoDepth: 0.5 }],
      floorDrop: [
        { wave: 'noise', freq: 300, attackMs: 4, sustainMs: 80, decayMs: 350, volume: 0.32, lowpass: 650 },
        { wave: 'sine', freq: 90, slide: 40, attackMs: 4, sustainMs: 60, decayMs: 300, volume: 0.28 },
      ],
      rockFall: [
        { wave: 'sine', freq: 950, slide: 320, attackMs: 30, sustainMs: 450, decayMs: 120, volume: 0.08 },
        { wave: 'noise', freq: 2500, attackMs: 30, sustainMs: 450, decayMs: 120, volume: 0.06, lowpass: 2000 },
      ],
      rockSlam: [
        { wave: 'noise', freq: 220, attackMs: 2, sustainMs: 60, decayMs: 450, volume: 0.45, lowpass: 550 },
        { wave: 'sine', freq: 70, slide: 35, attackMs: 2, sustainMs: 60, decayMs: 380, volume: 0.42 },
      ],
      wallsClose: [
        { wave: 'noise', freq: 260, attackMs: 80, sustainMs: 1100, decayMs: 300, volume: 0.24, lowpass: 420 },
        { wave: 'saw', freq: 55, attackMs: 80, sustainMs: 1100, decayMs: 300, volume: 0.1, lowpass: 300, vibratoHz: 6, vibratoDepth: 0.05 },
      ],
      fakeTreasure: [{ wave: 'square', freq: 660, slide: 200, attackMs: 4, sustainMs: 120, decayMs: 160, volume: 0.3, lowpass: 2500, vibratoHz: 18, vibratoDepth: 0.12 }],
      // Dragon. The snore is a soft, low breathing loop (inhale, exhale); its level is snoreVolume.
      snore: [
        { wave: 'noise', freq: 140, attackMs: 900, sustainMs: 200, decayMs: 500, volume: 0.5, lowpass: 260 },
        { wave: 'sine', freq: 58, attackMs: 900, sustainMs: 200, decayMs: 500, volume: 0.22, vibratoHz: 18, vibratoDepth: 0.12 },
        { wave: 'noise', freq: 380, attackMs: 250, sustainMs: 200, decayMs: 1000, volume: 0.3, lowpass: 500, delayMs: 1800 },
      ],
      growl: [
        { wave: 'saw', freq: 82, slide: 68, attackMs: 80, sustainMs: 350, decayMs: 260, volume: 0.32, lowpass: 480, vibratoHz: 22, vibratoDepth: 0.22 },
        { wave: 'noise', freq: 200, attackMs: 80, sustainMs: 350, decayMs: 260, volume: 0.16, lowpass: 380 },
      ],
      eyeSting: [
        { wave: 'square', freq: 1397, attackMs: 2, sustainMs: 90, decayMs: 320, volume: 0.09, lowpass: 3500, vibratoHz: 7, vibratoDepth: 0.02 },
        { wave: 'triangle', freq: 1480, attackMs: 2, sustainMs: 90, decayMs: 320, volume: 0.15, delayMs: 30 },
      ],
      phew: [
        { wave: 'noise', freq: 1500, attackMs: 60, sustainMs: 100, decayMs: 420, volume: 0.15, lowpass: 1500 },
        { wave: 'sine', freq: 620, slide: 300, attackMs: 60, sustainMs: 100, decayMs: 400, volume: 0.07 },
      ],
      roar: [
        { wave: 'saw', freq: 140, slide: 60, attackMs: 40, sustainMs: 700, decayMs: 500, volume: 0.42, lowpass: 900, vibratoHz: 30, vibratoDepth: 0.25 },
        { wave: 'noise', freq: 420, attackMs: 40, sustainMs: 700, decayMs: 500, volume: 0.32, lowpass: 900 },
      ],
      fire: [{ wave: 'noise', freq: 1200, attackMs: 60, sustainMs: 520, decayMs: 300, volume: 0.38, lowpass: 2200, vibratoHz: 8, vibratoDepth: 0.4 }],
      // Fail, lives, escape.
      heroHit: [
        { wave: 'square', freq: 420, slide: 120, attackMs: 1, sustainMs: 40, decayMs: 130, volume: 0.2, lowpass: 3000 },
        { wave: 'noise', freq: 1500, attackMs: 1, sustainMs: 10, decayMs: 80, volume: 0.16, lowpass: 3000 },
      ],
      heroFall: [{ wave: 'sine', freq: 900, slide: 120, attackMs: 5, sustainMs: 380, decayMs: 200, volume: 0.2, vibratoHz: 10, vibratoDepth: 0.03 }],
      heartBreak: [
        { wave: 'square', freq: 700, arpMul: 0.75, arpAtMs: 70, attackMs: 1, sustainMs: 60, decayMs: 160, volume: 0.12, lowpass: 3500 },
        { wave: 'noise', freq: 3000, attackMs: 1, sustainMs: 10, decayMs: 80, volume: 0.12, lowpass: 4000, delayMs: 60 },
      ],
      gameOver: [
        { wave: 'triangle', freq: 392, attackMs: 4, sustainMs: 160, decayMs: 120, volume: 0.24 },
        { wave: 'triangle', freq: 330, attackMs: 4, sustainMs: 160, decayMs: 120, volume: 0.24, delayMs: 260 },
        { wave: 'triangle', freq: 262, slide: 247, attackMs: 4, sustainMs: 300, decayMs: 500, volume: 0.26, delayMs: 520 },
      ],
      escape: [
        { wave: 'square', freq: 523, attackMs: 3, sustainMs: 80, decayMs: 60, volume: 0.11, lowpass: 4000 },
        { wave: 'square', freq: 659, attackMs: 3, sustainMs: 80, decayMs: 60, volume: 0.11, lowpass: 4000, delayMs: 120 },
        { wave: 'square', freq: 784, attackMs: 3, sustainMs: 80, decayMs: 60, volume: 0.11, lowpass: 4000, delayMs: 240 },
        { wave: 'triangle', freq: 1047, attackMs: 3, sustainMs: 260, decayMs: 500, volume: 0.24, vibratoHz: 6, vibratoDepth: 0.01, delayMs: 360 },
      ],
    } satisfies Record<string, readonly SfxVoice[]>,
  },

  save: {
    /** localStorage key prefix; the level id is appended. */
    bestLootKey: 'dwtd.bestLoot.',
    /** Lifetime deaths per level. */
    deathsKey: 'dwtd.deaths.',
    /** Sound mute toggle ('1' = muted). */
    muteKey: 'dwtd.muted',
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
      /** 96 px texture -> 48 world px; 1.12 -> ~54 px tall (physics body unchanged). */
      displayScale: 1.12,
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
      /** Airborne image (hero_jump, sack painted in) size relative to displayScale. */
      jumpScale: 1,
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
    /** Falling ceiling rock (96 px texture -> 48 px, one tile) and the rubble it leaves. */
    ceilingRock: { displayScale: 1 },
    rubble: { displayScale: 1 },
    /**
     * Closing-wall slab: the panel is repeated down the slab. displayScale 1 = one panel as wide
     * as the slab; panel height is stretched slightly so a whole number of panels fills the slab.
     * backColor fills behind the panels (shows in the rounded corners between them).
     */
    closingWall: { displayScale: 1, tint: 0xffffff, backColor: 0x0b0a0d },
    /** Painted jump button (328 px texture -> 164 px = the hit circle's diameter at displayScale 1). */
    jumpButton: { displayScale: 1, alpha: 0.85, pressedAlpha: 1 },
    pit: {
      displayScale: 1,
      /** Hole overlay on every pit: darker center, shadow under the near (top) edge, light rim on the far (bottom) edge. */
      overlayAlpha: 0.85,
      centerColor: 0x000000,
      shadowAlpha: 0.6,
      rimColor: 0xc8a878,
      rimAlpha: 0.55,
      rimPx: 4,
    },
    portal: {
      displayScale: 0.9,
      /** Swirl inside the stone ring (TUNING.portals.color, same on every portal; size relative to the portal, flattened to match its oval). */
      swirlScale: 0.5,
      swirlFlatten: 0.72,
      swirlAlpha: 0.55,
    },
    /** The door is centered on the exit zone, bottom edge on the zone's bottom edge. */
    exitDoor: { displayScale: 1.3, offsetY: 0 },

    level: {
      /** Tile texture repeat scale (1 = 384 px texture covers 4 tiles). */
      floorScale: 1,
      wallScale: 1,
      /** Multiply tint: walls a bit darker so they read apart from the floor. */
      floorTint: 0xfff0d6,
      wallTint: 0x5e4a3a,
      /** Raised walls: a lit edge on the wall face along floor (thicker on the face toward the viewer). */
      wallEdge: true,
      wallEdgeAlpha: 0.8,
      /** Lit edge on the wall's side and top faces (thinner, px). */
      wallSideEdgePx: 4,
      wallSideEdgeAlpha: 0.45,
      /** Drop shadow on the floor along every wall edge: the wall above casts the darkest one. */
      floorShadow: true,
      floorShadowPx: 10,
      floorShadowAlpha: 0.5,
      floorShadowSideAlpha: 0.35,
      /** Dark line where wall meets floor (px, 0 = off). */
      outlineWidth: 3,
      outlineColor: 0x0b0a0d,
      outlineAlpha: 0.85,
      /** Wall tiles at least voidDistance tiles from any floor get this dark fill (solid rock). 0 alpha = off. */
      voidDistance: 2,
      voidColor: 0x0a0806,
      voidAlpha: 0.55,
      /** Rock drawn around the level (camera boundsPadding shows it), in tiles. */
      outsideTiles: 6,
    },
  },

  debug: {
    enabled: false,
    /** Level to start (temporary, until the level select exists): 'level01' | 'level02' | 'level03'. */
    startLevel: 'level01' as string,
    /** Draw Arcade physics bodies (walls, player, exit). */
    showBodies: false,
    /** Traps and other fails only flash instead of ending the run (for testing layouts). */
    godMode: false,
    /** Draw each dragon's hearing reach (run step outer, sneak step inner) and its meter value. */
    showDragons: false,
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
    // SoundSystem owns the only AudioContext (created after the first touch).
    audio: {
      noAudio: true,
    },
    scene: scenes,
  };
}
