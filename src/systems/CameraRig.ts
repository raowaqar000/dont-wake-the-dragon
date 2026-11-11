import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, TUNING } from '../config';

const C = TUNING.camera;
const rigs = new WeakMap<Phaser.Scene, CameraRig>();

/**
 * Puts HUD objects (joystick, debug text, overlays) on the unzoomed UI camera.
 * Safe to call before or without a rig (then it does nothing).
 */
export function markUi(scene: Phaser.Scene, ...objects: Phaser.GameObjects.GameObject[]): void {
  rigs.get(scene)?.addUi(objects);
}

/**
 * Two cameras:
 *  - world: zoomed (TUNING.camera.zoom), follows the player, clamped to the level.
 *  - ui: zoom 1, never scrolls. Renders only objects passed to markUi().
 * Zoom also scales scrollFactor(0) objects, which is why the HUD needs its own camera.
 * Every object added to the scene is hidden from the UI camera automatically.
 */
export class CameraRig {
  public readonly world: Phaser.Cameras.Scene2D.Camera;
  public readonly ui: Phaser.Cameras.Scene2D.Camera;
  private readonly uiObjects = new Set<Phaser.GameObjects.GameObject>();
  private target?: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;
  /** Smoothed look direction (length 0..1): the view and the light lean this way. */
  public readonly look = new Phaser.Math.Vector2();
  /** World px the camera center sits above the hero (TUNING.camera.heroScreenY). */
  private readonly baseOffsetY = ((C.heroScreenY - 0.5) * GAME_HEIGHT) / C.zoom;

  /** Create this first in a scene, before any other game object. */
  constructor(scene: Phaser.Scene) {
    this.world = scene.cameras.main;
    this.world.setZoom(C.zoom);
    this.ui = scene.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT, false, 'ui');
    this.ui.ignore(scene.children.list);

    rigs.set(scene, this);
    scene.events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAdded, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, this.onAdded, this);
      rigs.delete(scene);
    });
  }

  follow(target: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform, worldW: number, worldH: number): void {
    this.target = target;
    // Padded bounds: the view may show solid rock past the edges, so the hero isn't pinned to the screen edge.
    const pad = C.boundsPadding;
    this.world.setBounds(-pad, -pad, worldW + pad * 2, worldH + pad * 2);
    this.world.startFollow(target, true, C.lerp, C.lerp);
    this.applyOffset();
    this.world.centerOn(target.x, target.y - this.baseOffsetY);
  }

  /**
   * Per frame: eases the look direction toward the hero's movement direction
   * (vx, vy = velocity; below minSpeed = no lean) and applies the follow offset.
   */
  update(vx: number, vy: number, deltaMs: number, minSpeed: number): void {
    const speed = Math.hypot(vx, vy);
    const tx = speed > minSpeed ? vx / speed : 0;
    const ty = speed > minSpeed ? vy / speed : 0;
    const k = 1 - Math.pow(1 - C.lookAheadLerp, Math.min(deltaMs, 50) / (1000 / 60));
    this.look.x += (tx - this.look.x) * k;
    this.look.y += (ty - this.look.y) * k;
    this.applyOffset();
  }

  /** Phaser follow: camera center = target - offset. */
  private applyOffset(): void {
    this.world.setFollowOffset(-this.look.x * C.lookAheadPx, this.baseOffsetY - this.look.y * C.lookAheadPx);
  }

  /** Fast eased pan to the follow target (after it jumped), then resumes following. */
  panToTarget(onDone?: () => void): void {
    const target = this.target;
    if (!target) return;
    const cam = this.world;
    cam.stopFollow();
    cam.once(Phaser.Cameras.Scene2D.Events.PAN_COMPLETE, () => {
      cam.startFollow(target, true, C.lerp, C.lerp);
      onDone?.();
    });
    // Pan to where following will put the camera (hero offset + look-ahead), so there's no jump after.
    cam.pan(target.x - cam.followOffset.x, target.y - cam.followOffset.y, C.portalPanMs, C.portalPanEase, true);
  }

  addUi(objects: Phaser.GameObjects.GameObject[]): void {
    const uiBit = this.ui.id;
    for (const o of objects) {
      this.uiObjects.add(o);
      o.cameraFilter &= ~uiBit;
      this.world.ignore(o);
    }
  }

  private onAdded(go: Phaser.GameObjects.GameObject): void {
    if (!this.uiObjects.has(go)) this.ui.ignore(go);
  }
}
