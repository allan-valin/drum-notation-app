import { describe, it, expect } from 'vitest';
import { createKit } from '../src/audio/kit.js';
import { soundFor } from '../src/core/schedule.js';
import { note, Mark } from '../src/core/score.js';
import { DRUM_PROFILE, NOTEHEADS, PROFILES } from '../src/core/profile.js';

/** Just enough of an AudioContext to see that every sound builds a graph without throwing. */
function fakeContext() {
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  const node = (extra = {}) => ({ connect(n) { return n; }, start() {}, stop() {}, frequency: param(), Q: param(), gain: param(), playbackRate: param(), threshold: param(), ratio: param(), ...extra });
  const made = { osc: 0, noise: 0 };
  return {
    made, currentTime: 0, sampleRate: 8000, destination: node(),
    createGain: () => node(), createDynamicsCompressor: () => node(), createBiquadFilter: () => node(),
    createOscillator: () => { made.osc += 1; return node(); },
    createBufferSource: () => { made.noise += 1; return node(); },
    createBuffer: (c, len) => ({ getChannelData: () => new Float32Array(len) }),
  };
}

describe('synth kit', () => {
  it('every sound any note can ask for exists and builds', () => {
    const ctx = fakeContext();
    const kit = createKit(ctx);
    const wanted = new Set();
    for (const profile of Object.values(PROFILES).filter((p) => !p.staves[0].pitched)) {
      for (const slot of profile.staves[0].slots.map((s) => s.id)) for (const head of [null, ...NOTEHEADS]) for (const marks of [[], [Mark.OPEN], [Mark.CLOSED], [Mark.HALF_OPEN], [Mark.CHOKE]]) {
        wanted.add(soundFor(note(slot, { head, marks }), profile.id));
      }
    }
    for (const s of wanted) {
      expect(kit.sounds, s).toContain(s);
      expect(() => kit.play(s, 0.1, 0.8)).not.toThrow();
    }
    expect(ctx.made.osc).toBeGreaterThan(0);
    expect(() => kit.click(true, 0.2)).not.toThrow();
  });
});

import { METRONOME_VOICES } from '../src/audio/kit.js';

describe('metronome voices', () => {
  it('every voice builds for a normal and an accented beat', () => {
    expect(METRONOME_VOICES).toEqual(['beep', 'woodblock', 'click', 'cowbell', 'sidestick', 'hihat']);
    const kit = createKit(fakeContext());
    for (const v of METRONOME_VOICES) {
      expect(() => kit.click(true, 0.1, v)).not.toThrow();
      expect(() => kit.click(false, 0.2, v)).not.toThrow();
    }
  });
  it('an unknown voice falls back to the beep', () => {
    expect(() => createKit(fakeContext()).click(false, 0.1, 'gong')).not.toThrow();
  });
});

import { createVoices, VOICES } from '../src/audio/voices.js';

describe('pitched voices', () => {
  it('every pitched instrument has a voice that builds', () => {
    const ctx = fakeContext();
    ctx.createWaveShaper = () => ({ connect(n) { return n; }, curve: null });
    const voices = createVoices(ctx, { connect(n) { return n; } });
    for (const p of Object.values(PROFILES).filter((x) => x.staves[0].pitched)) {
      expect(VOICES, p.id).toContain(p.voice);
      expect(() => voices.play(p.voice, 0.1, 220, 0.5, 0.8)).not.toThrow();
    }
  });
  it('the kit routes "voice:" sounds to the voices with frequency and length', () => {
    const ctx = fakeContext();
    ctx.createWaveShaper = () => ({ connect(n) { return n; }, curve: null });
    const before = ctx.made.osc;
    createKit(ctx).play('voice:keys', 0.1, 0.8, { freq: 440, dur: 0.5 });
    expect(ctx.made.osc - before).toBe(4);
  });
});
