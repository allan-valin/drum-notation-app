import { describe, it, expect } from 'vitest';
import { createKit } from '../src/audio/kit.js';
import { soundFor } from '../src/core/schedule.js';
import { note, Mark } from '../src/core/score.js';
import { DRUM_PROFILE, NOTEHEADS } from '../src/core/profile.js';

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
    const slots = DRUM_PROFILE.staves[0].slots.map((s) => s.id);
    const wanted = new Set();
    for (const slot of slots) for (const head of [null, ...NOTEHEADS]) for (const marks of [[], [Mark.OPEN], [Mark.HALF_OPEN], [Mark.CHOKE]]) {
      wanted.add(soundFor(note(slot, { head, marks })));
    }
    for (const s of wanted) {
      expect(kit.sounds, s).toContain(s);
      expect(() => kit.play(s, 0.1, 0.8)).not.toThrow();
    }
    expect(ctx.made.osc).toBeGreaterThan(0);
    expect(() => kit.click(true, 0.2)).not.toThrow();
  });
});
