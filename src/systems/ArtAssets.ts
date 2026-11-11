import Phaser from 'phaser';
import { TUNING } from '../config';
import { ART_FILES, type ArtName } from '../generated/artManifest';

export { ART_ANCHORS, type ArtName } from '../generated/artManifest';

const A = TUNING.art;

/** Texture key of a painted asset. */
export function artKey(name: ArtName): string {
  return `art_${name}`;
}

/** Queues every painted PNG on the scene's loader (BootScene.preload). */
export function queueArt(scene: Phaser.Scene): void {
  scene.load.setPath(A.path);
  for (const [name, f] of Object.entries(ART_FILES)) scene.load.image(artKey(name as ArtName), f.file);
  scene.load.setPath('');
}

/**
 * True if every named painted texture loaded. A failed load leaves no texture,
 * so callers fall back to the code-drawn one.
 */
export function hasArt(scene: Phaser.Scene, ...names: ArtName[]): boolean {
  for (const n of names) if (!scene.textures.exists(artKey(n))) return false;
  return true;
}

/** World scale of a painted texture at displayScale 1. */
export const ART_SCALE = A.textureScale;
