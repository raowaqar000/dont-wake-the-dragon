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
    this.fire(false);
  }

  /** Long strong buzz (a dragon wakes). */
  heavy(): void {
    this.fire(true);
  }

  private fire(heavy: boolean): void {
    if (!H.enabled) return;
    try {
      if (this.native) {
        const p = heavy ? Haptics.vibrate({ duration: H.heavyMs }) : Haptics.impact({ style: ImpactStyle.Light });
        p.catch(() => undefined);
        return;
      }
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(heavy ? H.heavyMs : H.lightMs);
      }
    } catch {
      // Unsupported device or blocked by the browser: no vibration.
    }
  }
}
