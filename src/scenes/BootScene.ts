import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS, TEXTURE_KEYS, TUNING } from '../config';
import { queueArt } from '../systems/ArtAssets';
import { createDragonTextures } from '../systems/DragonTextureFactory';
import { createHeroAssets } from '../systems/HeroTextureFactory';
import { createTrapTextures } from '../systems/TrapTextureFactory';
import { createTreasureTextures } from '../systems/TreasureTextureFactory';
import { createTrollTextures } from '../systems/TrollTextureFactory';

/**
 * Loads the painted art (with a loading bar), builds the code-drawn textures
 * (still used for effects, and as a fallback for any image that failed to load),
 * then starts the game.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload(): void {
    this.createLoadingBar();
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`[art] failed to load ${file.key} (${file.src}); using the code-drawn texture`);
    });
    queueArt(this);
  }

  create(): void {
    this.createPlaceholderTextures();
    createHeroAssets(this);
    createTrapTextures(this);
    createTreasureTextures(this);
    createDragonTextures(this);
    createTrollTextures(this);
    this.scene.start(SCENE_KEYS.game);
  }

  private createLoadingBar(): void {
    const L = TUNING.art.loading;
    const x = (GAME_WIDTH - L.barWidth) / 2;
    const y = GAME_HEIGHT / 2;
    const back = this.add.graphics();
    back.fillStyle(L.borderColor, 1);
    back.fillRoundedRect(x - 4, y - 4, L.barWidth + 8, L.barHeight + 8, (L.barHeight + 8) / 2);
    back.fillStyle(L.backColor, L.backAlpha);
    back.fillRoundedRect(x, y, L.barWidth, L.barHeight, L.barHeight / 2);
    const bar = this.add.graphics();
    this.add
      .text(GAME_WIDTH / 2, y - 28, 'Loading...', {
        fontFamily: 'sans-serif',
        fontSize: `${L.fontSize}px`,
        fontStyle: 'bold',
        color: L.textColor,
      })
      .setOrigin(0.5, 1);

    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      bar.clear();
      if (p <= 0) return;
      bar.fillStyle(L.color, 1);
      bar.fillRoundedRect(x, y, Math.max(L.barHeight, L.barWidth * p), L.barHeight, L.barHeight / 2);
    });
  }

  private createPlaceholderTextures(): void {
    const { radius, fillColor, outlineColor, outlineWidth } = TUNING.player;
    const size = radius * 2;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(outlineColor, 1);
    g.fillCircle(radius, radius, radius);
    g.fillStyle(fillColor, 1);
    g.fillCircle(radius, radius, radius - outlineWidth);
    g.generateTexture(TEXTURE_KEYS.player, size, size);
    g.destroy();
  }
}
