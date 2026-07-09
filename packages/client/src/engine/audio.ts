/**
 * Procedural audio (ART_DIRECTION §7) — Web Audio synthesis, zero binary assets. One
 * AudioEngine per fight: short synthesized SFX driven off the Playback listeners, plus
 * a slow generative pad seeded by the biome accent. Everything is oscillators, gain
 * envelopes, and white-noise buffers, so it satisfies the no-binary-assets rule. The
 * context must be resumed from a user gesture (browsers block autoplay) — call resume()
 * on the first click. Volumes come from the settings store; 0 = silent (no nodes made).
 */

type Ctx = AudioContext;

function makeContext(): Ctx | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    return new AC();
  } catch {
    return null;
  }
}

/** A short white-noise buffer, cached per context (for whooshes + impacts). */
function noiseBuffer(ctx: Ctx): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 0.4);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  // A fixed LCG so the noise is stable run-to-run (never Math.random in the sim; this is
  // presentation, but a deterministic hiss is nicer than a jittery one anyway).
  let s = 0x9e3779b9;
  for (let i = 0; i < len; i++) {
    s = (s * 1664525 + 1013904223) >>> 0;
    data[i] = (s / 0xffffffff) * 2 - 1;
  }
  return buf;
}

const PENTATONIC = [0, 3, 5, 7, 10]; // a minor pentatonic, in semitones

export class AudioEngine {
  private ctx: Ctx | null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private root: number; // music root frequency (Hz), derived from the biome accent
  private step = 0;
  sfxVolume: number;
  musicVolume: number;

  constructor(opts: { accent: number; sfxVolume: number; musicVolume: number }) {
    this.ctx = makeContext();
    this.sfxVolume = opts.sfxVolume;
    this.musicVolume = opts.musicVolume;
    // Map the biome accent's hue to a root in the low register (110–180 Hz).
    this.root = 110 + (opts.accent % 360) * (70 / 360);
    if (this.ctx) {
      this.noise = noiseBuffer(this.ctx);
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.master);
    }
  }

  /** Resume the context (call from a click). Safe to call repeatedly. */
  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** A tone with an exponential decay envelope. */
  private tone(freq: number, dur: number, type: OscillatorType, gain: number, glideTo?: number): void {
    if (!this.ctx || !this.master || this.sfxVolume <= 0) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain * this.sfxVolume, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** A filtered noise burst (whooshes, impacts). */
  private burst(dur: number, hp: number, gain: number): void {
    if (!this.ctx || !this.master || !this.noise || this.sfxVolume <= 0) return;
    const t = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain * this.sfxVolume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ── The SFX vocabulary (driven by the Playback listeners) ──
  swing(): void {
    this.burst(0.09, 900, 0.12);
  }
  hit(crit: boolean): void {
    this.tone(crit ? 180 : 130, crit ? 0.18 : 0.12, 'triangle', crit ? 0.35 : 0.25, crit ? 70 : 60);
    this.burst(crit ? 0.1 : 0.06, crit ? 500 : 700, crit ? 0.18 : 0.1);
  }
  dot(): void {
    this.tone(320, 0.05, 'sine', 0.08);
  }
  heal(): void {
    this.tone(440, 0.22, 'sine', 0.14, 660);
  }
  death(): void {
    this.tone(160, 0.5, 'sawtooth', 0.3, 50);
    this.burst(0.25, 300, 0.2);
  }
  doomfall(): void {
    // A low sustained drone that swells in — the clock has started.
    if (!this.ctx || !this.master || this.sfxVolume <= 0) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12 * this.sfxVolume, t + 1.5);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 3.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5);
  }
  end(win: boolean): void {
    const scale = win ? [0, 4, 7, 12] : [0, -1, -3, -5];
    scale.forEach((semi, i) => {
      const f = this.root * 4 * Math.pow(2, semi / 12);
      setTimeout(() => this.tone(f, 0.4, win ? 'triangle' : 'sine', 0.22, win ? undefined : f * 0.6), i * 110);
    });
  }

  // ── Generative pad: one slow note every ~1.4s from a pentatonic on the biome root ──
  startMusic(): void {
    if (!this.ctx || !this.musicGain || this.musicVolume <= 0 || this.musicTimer) return;
    this.musicGain.gain.setValueAtTime(0.0001, this.now());
    this.musicGain.gain.exponentialRampToValueAtTime(0.18 * this.musicVolume, this.now() + 2);
    const play = (): void => {
      if (!this.ctx || !this.musicGain) return;
      const semi = PENTATONIC[this.step % PENTATONIC.length]! + (this.step % 10 === 9 ? 12 : 0);
      const freq = this.root * Math.pow(2, semi / 12);
      const t = this.now();
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
      osc.connect(g).connect(this.musicGain);
      osc.start(t);
      osc.stop(t + 2.6);
      this.step++;
    };
    play();
    this.musicTimer = setInterval(play, 1400);
  }

  dispose(): void {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
  }
}
