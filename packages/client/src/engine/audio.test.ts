import { describe, expect, it } from 'vitest';
import { AudioEngine } from './audio.js';

// The Node test environment has no `window`/`AudioContext`, so the engine falls back to
// a null context. Every method must then no-op safely — proving the guards hold on any
// platform without Web Audio (SSR, headless, unsupported browsers).
describe('AudioEngine (headless — no AudioContext)', () => {
  it('constructs and every SFX/music method is a safe no-op', () => {
    const a = new AudioEngine({ accent: 0xff7a33, sfxVolume: 0.7, musicVolume: 0.4 });
    expect(() => {
      a.resume();
      a.swing();
      a.hit(true);
      a.hit(false);
      a.dot();
      a.heal();
      a.death();
      a.doomfall();
      a.end(true);
      a.end(false);
      a.startMusic();
      a.dispose();
    }).not.toThrow();
  });

  it('respects zero volumes without constructing nodes', () => {
    const silent = new AudioEngine({ accent: 0x4bbf94, sfxVolume: 0, musicVolume: 0 });
    expect(silent.sfxVolume).toBe(0);
    expect(() => {
      silent.hit(true);
      silent.startMusic();
      silent.dispose();
    }).not.toThrow();
  });
});
