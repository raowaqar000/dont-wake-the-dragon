import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { TUNING } from '../config';

const H = TUNING.haptics;

/**
 * Vibration that never crashes: Capacitor Haptics in the native app,
 * navigator.vibrate in the browser, nothing if neither works.
 * Toggle with TUNING.haptics.enabled.
 */
export class HapticsService {
  private lastLightAt = -Infinity;
  private lastTickAt = -Infinity;
  private readonly native: boolean;

  constructor() {
    let native = false;
    try {
      native = Capacitor.isNativePlatform();
    } catch {
      native = false;
    }
    this.native = native;
  }

  /** Short tick (a dragon stirs). Skipped if another came within cooldownMs. */
  light(): void {
    const now = performance.now();
    if (now - this.lastLightAt < H.cooldownMs) return;
    this.lastLightAt = now;
    this.fire('light');
  }

  /** Long strong buzz (a dragon wakes). */
  heavy(): void {
    this.fire('heavy');
  }

  /** Very light tick (danger sense near a hidden trap). Own cooldown: tickCooldownMs. */
  tick(): void {
    const now = performance.now();
    if (now - this.lastTickAt < H.tickCooldownMs) return;
    this.lastTickAt = now;
    this.fire('tick');
  }

  private fire(kind: 'light' | 'heavy' | 'tick'): void {
    if (!H.enabled) return;
    try {
      if (this.native) {
        const p =
          kind === 'heavy'
            ? Haptics.vibrate({ duration: H.heavyMs })
            : kind === 'tick'
              ? Haptics.selectionChanged()
              : Haptics.impact({ style: ImpactStyle.Light });
        p.catch(() => undefined);
        return;
      }
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(kind === 'heavy' ? H.heavyMs : kind === 'tick' ? H.tickMs : H.lightMs);
      }
    } catch {
      // Unsupported device or blocked by the browser: no vibration.
    }
  }
}
