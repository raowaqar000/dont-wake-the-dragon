import { TUNING } from '../config';
import { renderSfx } from './SfxSynth';

const S = TUNING.sound;

/** Every sound name. The same keys work for synth recipes and real audio files. */
export type SfxKey = keyof typeof S.sfx;

/** What gameplay systems get injected: play a one-shot sound. */
export interface SfxSink {
  play(key: SfxKey, volume?: number): void;
}

/**
 * Sound effects for the whole game (one instance, survives scene restarts).
 *  - Nothing plays until the first touch (mobile browsers block audio before a gesture).
 *    The first pointerdown/touchend creates the AudioContext and renders every sound once.
 *  - Each sound comes from TUNING.sound.sfx (code synth) or, if TUNING.sound.files has an
 *    entry for its key, from that audio file (synth as fallback).
 *  - One looping voice for the dragon snore, its level set every frame (setSnore).
 *  - Mute is saved in localStorage (TUNING.save.muteKey).
 */
class SoundSystemImpl implements SfxSink {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buffers = new Map<SfxKey, AudioBuffer>();
  private readonly lastPlayed = new Map<SfxKey, number>();
  private mutedValue: boolean;
  private installed = false;
  private snoreGain: GainNode | null = null;
  private snoreSource: AudioBufferSourceNode | null = null;
  private snoreLevel = 0;
  private readonly listeners = new Set<(muted: boolean) => void>();

  constructor() {
    this.mutedValue = loadMuted();
  }

  get muted(): boolean {
    return this.mutedValue;
  }

  /** True once audio is unlocked and running. */
  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Call once at startup: unlocks audio on the first touch. Safe to call again. */
  install(): void {
    if (this.installed || typeof window === 'undefined') return;
    this.installed = true;
    const unlock = (): void => {
      this.unlock();
      if (this.ready) {
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('touchend', unlock, true);
      }
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('touchend', unlock, true);
    // Paused by the OS (app in background): resume on return.
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => undefined);
      else this.ctx.resume().catch(() => undefined);
    });
  }

  private unlock(): void {
    if (!S.enabled) return;
    try {
      if (!this.ctx) {
        const AC: typeof AudioContext | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.mutedValue ? 0 : S.masterVolume;
        this.master.connect(this.ctx.destination);
        this.buildAll(this.ctx);
      }
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => undefined);
    } catch (e) {
      console.warn('[sound] audio unavailable', e);
    }
  }

  /** Renders every synth recipe once, then swaps in real files where configured. */
  private buildAll(ctx: AudioContext): void {
    const rate = Math.min(ctx.sampleRate, S.sampleRate);
    for (const key of Object.keys(S.sfx) as SfxKey[]) {
      const data = renderSfx(S.sfx[key], rate);
      const buf = ctx.createBuffer(1, data.length, rate);
      buf.getChannelData(0).set(data);
      this.buffers.set(key, buf);
    }
    for (const [key, file] of Object.entries(S.files)) {
      if (!file || !(key in S.sfx)) continue;
      fetch(S.filePath + file)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((bytes) => ctx.decodeAudioData(bytes))
        .then((buf) => {
          this.buffers.set(key as SfxKey, buf);
          if (key === 'snore' && this.snoreSource) this.restartSnore();
        })
        .catch((e) => console.warn(`[sound] ${file} failed to load (${String(e)}); using the synth`));
    }
  }

  /** One-shot sound (volume 0..1 on top of the recipe). No-op before the first touch or when muted. */
  play(key: SfxKey, volume = 1): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.mutedValue || ctx.state !== 'running') return;
    const buf = this.buffers.get(key);
    if (!buf) return;
    const now = ctx.currentTime * 1000;
    if (now - (this.lastPlayed.get(key) ?? -Infinity) < S.minGapMs) return;
    this.lastPlayed.set(key, now);
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      if (volume >= 1) {
        src.connect(this.master);
      } else {
        const g = ctx.createGain();
        g.gain.value = Math.max(0, volume);
        src.connect(g).connect(this.master);
      }
      src.start();
    } catch {
      // Audio errors never break the game.
    }
  }

  /**
   * Dragon snore loop level, 0 (silent) .. 1 (right next to a sleeping dragon), scaled by
   * TUNING.sound.snoreVolume. Call every frame; it only touches the audio graph on change.
   */
  setSnore(level: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || ctx.state !== 'running') return;
    const target = Math.max(0, Math.min(1, level)) * S.snoreVolume;
    if (!this.snoreSource) {
      if (target <= 0.0005) return;
      this.restartSnore();
    }
    if (!this.snoreGain || Math.abs(target - this.snoreLevel) < 0.002) return;
    this.snoreLevel = target;
    this.snoreGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
  }

  private restartSnore(): void {
    const ctx = this.ctx;
    const buf = this.buffers.get('snore');
    if (!ctx || !this.master || !buf) return;
    try {
      this.snoreSource?.stop();
    } catch {
      // Already stopped.
    }
    if (!this.snoreGain) {
      this.snoreGain = ctx.createGain();
      this.snoreGain.gain.value = 0;
      this.snoreGain.connect(this.master);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(this.snoreGain);
    src.start();
    this.snoreSource = src;
  }

  setMuted(muted: boolean): void {
    this.mutedValue = muted;
    saveMuted(muted);
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : S.masterVolume, this.ctx.currentTime, 0.02);
    for (const l of this.listeners) l(muted);
  }

  toggleMuted(): boolean {
    this.setMuted(!this.mutedValue);
    return this.mutedValue;
  }

  /** Listen for mute changes; returns an unsubscribe function. */
  onMutedChange(fn: (muted: boolean) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
}

function loadMuted(): boolean {
  try {
    const raw = window.localStorage.getItem(TUNING.save.muteKey);
    return raw === null ? S.mutedByDefault : raw === '1';
  } catch {
    return S.mutedByDefault;
  }
}

function saveMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(TUNING.save.muteKey, muted ? '1' : '0');
  } catch {
    // Not saved; still muted for this session.
  }
}

/** The game's one sound system. */
export const SoundSystem = new SoundSystemImpl();

