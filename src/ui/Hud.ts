import Phaser from 'phaser';
import { GAME_WIDTH, TEXTURE_KEYS, TUNING } from '../config';
import { markUi } from '../systems/CameraRig';
import { LOOT_EVENTS, type LootChange, type LootSystem } from '../systems/LootSystem';
import { artKey, hasArt, type ArtName } from '../systems/ArtAssets';
import { TREASURE_TEXTURE_SCALE } from '../systems/TreasureTextureFactory';

const H = TUNING.hud;
const T = TUNING.treasure;

/**
 * Top bar on the UI camera: [coin] loot   timer   [gem] x/total  [chest] x/total.
 * Listens to LootSystem events; GameScene feeds it the run time.
 */
export class Hud {
  private readonly lootText: Phaser.GameObjects.Text;
  private readonly timerText: Phaser.GameObjects.Text;
  private readonly gemText: Phaser.GameObjects.Text;
  private readonly chestText: Phaser.GameObjects.Text;
  private readonly deathsText: Phaser.GameObjects.Text;
  private shownLoot = 0;
  private counter?: Phaser.Tweens.Tween;
  private shownSeconds = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    loot: LootSystem,
    counts: { deaths: number; attempts: number },
  ) {
    const cy = H.top + H.height / 2;
    const objects: Phaser.GameObjects.GameObject[] = [];

    const back = scene.add.graphics();
    back.fillStyle(H.backColor, H.backAlpha);
    back.fillRoundedRect(H.sideMargin, H.top, GAME_WIDTH - H.sideMargin * 2, H.height, H.cornerRadius);
    objects.push(back);

    // Painted icon if it loaded (fit to iconSize by its larger side), else the code-drawn one.
    const icon = (x: number, art: ArtName, key: string, size: number) => {
      if (hasArt(scene, art)) {
        const img = scene.add.image(x, cy, artKey(art));
        img.setScale(H.iconSize / Math.max(img.width, img.height));
        objects.push(img);
        return;
      }
      const img = scene.add.image(x, cy, key).setScale((H.iconSize / size) * TREASURE_TEXTURE_SCALE);
      objects.push(img);
    };
    const text = (x: number, value: string, color: string, size: number, originX: number) => {
      const t = scene.add
        .text(x, cy, value, {
          fontFamily: 'sans-serif',
          fontSize: `${size}px`,
          fontStyle: 'bold',
          color,
          stroke: '#000000',
          strokeThickness: 5,
        })
        .setOrigin(originX, 0.5);
      objects.push(t);
      return t;
    };

    icon(H.lootIconX, 'coin', TEXTURE_KEYS.coin, T.coin.size);
    this.lootText = text(H.lootIconX + H.iconGap, '0', H.lootColor, H.fontSize, 0);
    this.timerText = text(H.timerX, '00:00', H.color, H.fontSize, 0.5);
    icon(H.gemIconX, 'gem', TEXTURE_KEYS.gem, T.gem.size);
    this.gemText = text(H.gemIconX + H.iconGap, `0/${loot.gemsTotal}`, H.color, H.smallFontSize, 0);
    icon(H.chestIconX, 'chest_closed', TEXTURE_KEYS.chest, T.chest.width);
    this.chestText = text(H.chestIconX + H.iconGap, `0/${loot.chestsTotal}`, H.color, H.smallFontSize, 0);

    // Deaths (lifetime, this level) and attempts this session, small, under the bar.
    const small = (y: number, value: string, color: string, size: number) => {
      const t = scene.add
        .text(H.deathsX, y, value, {
          fontFamily: 'sans-serif',
          fontSize: `${size}px`,
          fontStyle: 'bold',
          color,
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0, 0);
      objects.push(t);
      return t;
    };
    this.deathsText = small(H.deathsY, `Deaths: ${counts.deaths}`, H.deathsColor, H.deathsFontSize);
    small(H.deathsY + H.deathsFontSize + 4, `Attempts this session: ${counts.attempts}`, H.attemptsColor, H.attemptsFontSize);

    for (const o of objects) {
      (o as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(0);
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(H.depth);
    }
    markUi(scene, ...objects);

    loot.on(LOOT_EVENTS.changed, this.onLoot, this);
  }

  /** Run time in ms; only redraws when the shown second changes. */
  setTime(ms: number): void {
    const secs = Math.floor(ms / 1000);
    if (secs === this.shownSeconds) return;
    this.shownSeconds = secs;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    this.timerText.setText(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
  }

  /** A death was just counted (shown during the short pause before the restart). */
  setDeaths(n: number): void {
    this.deathsText.setText(`Deaths: ${n}`);
    this.punch(this.deathsText);
  }

  private onLoot(e: LootChange): void {
    this.countUpTo(e.total);
    if (e.kind === 'gem') {
      this.gemText.setText(`${e.gems}/${e.gemsTotal}`);
      this.punch(this.gemText);
    } else if (e.kind === 'chest') {
      this.chestText.setText(`${e.chests}/${e.chestsTotal}`);
      this.punch(this.chestText);
    }
  }

  private countUpTo(target: number): void {
    this.counter?.stop();
    const from = this.shownLoot;
    this.counter = this.scene.tweens.addCounter({
      from,
      to: target,
      duration: H.countUpMs,
      ease: 'Cubic.easeOut',
      onUpdate: (tw) => {
        const v = Math.round(tw.getValue() ?? target);
        if (v === this.shownLoot) return;
        this.shownLoot = v;
        this.lootText.setText(String(v));
      },
      onComplete: () => {
        this.shownLoot = target;
        this.lootText.setText(String(target));
      },
    });
    this.punch(this.lootText);
  }

  private punch(t: Phaser.GameObjects.Text): void {
    this.scene.tweens.killTweensOf(t);
    t.setScale(1);
    this.scene.tweens.add({
      targets: t,
      scale: H.punchScale,
      duration: H.punchMs,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }
}
