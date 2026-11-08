import Phaser from 'phaser';
import { SCENE_KEYS, TEXTURE_KEYS, TUNING } from '../config';

/** Prepares shared resources (placeholder textures for now) and starts the game. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  create(): void {
    this.createPlaceholderTextures();
    this.scene.start(SCENE_KEYS.game);
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
