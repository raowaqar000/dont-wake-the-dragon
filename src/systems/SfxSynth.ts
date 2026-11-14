import type { SfxVoice } from '../config';

/**
 * Tiny jsfxr-style synth: renders a list of voices into one mono Float32Array, once.
 * Pure (no Phaser, no Web Audio), so it can be tested anywhere. SoundSystem copies
 * the samples into an AudioBuffer after the first touch.
 */
export function renderSfx(voices: readonly SfxVoice[], sampleRate: number): Float32Array {
  let lengthSec = 0;
  for (const v of voices) {
    lengthSec = Math.max(lengthSec, ((v.delayMs ?? 0) + v.attackMs + v.sustainMs + v.decayMs) / 1000);
  }
  const out = new Float32Array(Math.max(1, Math.ceil(lengthSec * sampleRate)));
  for (const v of voices) renderVoice(v, sampleRate, out);

  // Soft clip so stacked voices never crackle.
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i]);
  return out;
}

function renderVoice(v: SfxVoice, rate: number, out: Float32Array): void {
  const start = Math.floor(((v.delayMs ?? 0) / 1000) * rate);
  const a = (v.attackMs / 1000) * rate;
  const s = (v.sustainMs / 1000) * rate;
  const d = (v.decayMs / 1000) * rate;
  const n = Math.ceil(a + s + d);
  const f0 = v.freq;
  const f1 = v.slide ?? v.freq;
  const arpAt = v.arpMul && v.arpAtMs !== undefined ? (v.arpAtMs / 1000) * rate : Infinity;
  // One-pole low-pass coefficient (1 = no filtering).
  const lp = v.lowpass ? 1 - Math.exp((-2 * Math.PI * v.lowpass) / rate) : 1;

  let phase = 0;
  let noiseVal = 0;
  let noisePhase = 1;
  let filtered = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / n;
    // Exponential slide from f0 to f1 over the voice.
    let f = f0 * Math.pow(f1 / f0, t);
    if (i >= arpAt) f *= v.arpMul ?? 1;
    if (v.vibratoHz && v.vibratoDepth) f *= 1 + Math.sin((2 * Math.PI * v.vibratoHz * i) / rate) * v.vibratoDepth;

    phase += f / rate;
    let sample: number;
    switch (v.wave) {
      case 'square':
        sample = phase % 1 < 0.5 ? 0.6 : -0.6;
        break;
      case 'saw':
        sample = ((phase % 1) * 2 - 1) * 0.7;
        break;
      case 'triangle':
        sample = (1 - 4 * Math.abs((phase % 1) - 0.5)) * 0.9;
        break;
      case 'sine':
        sample = Math.sin(phase * 2 * Math.PI);
        break;
      default:
        // Noise: a new random value every 1/f seconds (sample-and-hold).
        noisePhase += f / rate;
        if (noisePhase >= 1) {
          noisePhase %= 1;
          noiseVal = Math.random() * 2 - 1;
        }
        sample = noiseVal;
    }
    filtered += (sample - filtered) * lp;

    const env = i < a ? i / Math.max(1, a) : i < a + s ? 1 : Math.max(0, 1 - (i - a - s) / Math.max(1, d));
    out[start + i] += filtered * env * v.volume;
  }
}
