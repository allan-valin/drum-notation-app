import { describe, it, expect } from 'vitest';
import { createSampleKit, SAMPLE_FILES } from '../src/audio/samples.js';
import { createKit } from '../src/audio/kit.js';

function fakeContext() {
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} });
  const started = [];
  const node = (extra = {}) => ({ connect(n) { return n; }, start(...a) { started.push({ kind: extra.kind, a, buffer: this.buffer }); }, stop() {}, frequency: param(), Q: param(), gain: param(), playbackRate: param(), threshold: param(), ratio: param(), ...extra });
  return {
    started, currentTime: 0, sampleRate: 8000, destination: node(),
    createGain: () => node(), createDynamicsCompressor: () => node(), createBiquadFilter: () => node(),
    createOscillator: () => node({ kind: 'osc' }),
    createBufferSource: () => node({ kind: 'src' }),
    createBuffer: (c, len) => ({ getChannelData: () => new Float32Array(len) }),
    decodeAudioData: async (ab) => ({ decoded: new TextDecoder().decode(ab) }),
  };
}
const fetchOk = async (url) => ({ ok: true, arrayBuffer: async () => new TextEncoder().encode(url).buffer });

describe('sample kit', () => {
  it('has a file for every sound the synth kit knows', () => {
    const synthSounds = createKit(fakeContext()).sounds;
    // the recorded kit has no congas: those stay synthesized (the fallback)
    for (const s of synthSounds) if (s !== 'crashChoke' && !s.startsWith('conga')) expect(Object.keys(SAMPLE_FILES), s).toContain(s);
  });
  it('plays the synth until the samples arrive, then the samples', async () => {
    const ctx = fakeContext();
    const kit = createSampleKit(ctx, { base: '/x/', fetch: fetchOk, fallback: createKit(ctx) });
    kit.play('snare', 1, 0.75);
    expect(ctx.started.some((s) => s.kind === 'osc')).toBe(true);
    await kit.ready;
    ctx.started.length = 0;
    kit.play('snare', 2, 0.75);
    const src = ctx.started.find((s) => s.kind === 'src');
    expect(src.buffer.decoded).toBe('/x/sounds/snare.wav');
    expect(src.a[0]).toBe(2);
  });
  it('an accent uses the harder recording when there is one', async () => {
    const ctx = fakeContext();
    const kit = createSampleKit(ctx, { base: '/', fetch: fetchOk, fallback: createKit(ctx) });
    await kit.ready;
    kit.play('kick', 1, 1);
    expect(ctx.started.find((s) => s.kind === 'src').buffer.decoded).toBe('/sounds/kickAccent.wav');
  });
  it('a choke plays the crash cut short', async () => {
    const ctx = fakeContext();
    const kit = createSampleKit(ctx, { base: '/', fetch: fetchOk, fallback: createKit(ctx) });
    await kit.ready;
    kit.play('crashChoke', 1, 0.75);
    expect(ctx.started.find((s) => s.kind === 'src').buffer.decoded).toBe('/sounds/crash.wav');
  });
  it('a failed download keeps the synth and reports it', async () => {
    const ctx = fakeContext();
    const kit = createSampleKit(ctx, { base: '/', fetch: async () => ({ ok: false, status: 404 }), fallback: createKit(ctx) });
    await kit.ready.catch(() => {});
    expect(kit.loaded).toBe(false);
    ctx.started.length = 0;
    kit.play('snare', 1, 0.75);
    expect(ctx.started.some((s) => s.kind === 'osc')).toBe(true);
  });
});
