/**
 * Pitched instruments synthesized in Web Audio, one recipe per family. Recognisable, not
 * realistic; each plays `(when, freq, dur, velocity)`.
 * - plucked strings: Karplus–Strong, computed into a buffer (no AudioWorklet needed)
 * - keys: a few decaying partials, like an electric piano
 * - voice: a sawtooth through vowel formants with a late vibrato
 */
export const VOICES = ['guitar', 'bass', 'keys', 'voice', 'brass', 'sax', 'upright', 'vibes', 'piano', 'harp', 'strings', 'pizz', 'harmonic', 'flute', 'oboe', 'clarinet', 'bassoon', 'horn', 'tuba', 'timpani', 'glock', 'xylo', 'marimba'];

export function createVoices(ctx, out) {
  const plucks = new Map();

  /** Karplus–Strong: a noise burst circulating through a slightly damped delay line. */
  function pluckBuffer(freq, dur, damping) {
    const key = `${Math.round(freq * 4)}:${Math.round(dur * 10)}:${damping}`;
    if (plucks.has(key)) return plucks.get(key);
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * (dur + 0.4)));
    const buf = ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    const period = Math.max(2, Math.round(rate / freq));
    const line = new Float32Array(period);
    for (let i = 0; i < period; i++) line[i] = Math.random() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const next = (idx + 1) % period;
      const v = damping * 0.5 * (line[idx] + line[next]);
      d[i] = line[idx];
      line[idx] = v;
      idx = next;
    }
    if (plucks.size > 300) plucks.clear();
    plucks.set(key, buf);
    return buf;
  }

  function envelope(when, peak, attack, hold, release) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + attack);
    g.gain.setValueAtTime(Math.max(0.0002, peak), when + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, when + attack + hold + release);
    return g;
  }

  function pluck(when, freq, dur, v, { damping, cutoff, drive = 0 }) {
    const src = ctx.createBufferSource();
    src.buffer = pluckBuffer(freq, dur, damping);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    let node = src.connect(lp);
    if (drive > 0 && ctx.createWaveShaper) {
      const ws = ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = (i / 128) - 1; curve[i] = Math.tanh(x * (1 + drive)); }
      ws.curve = curve;
      node = node.connect(ws);
    }
    const g = envelope(when, v * 0.7, 0.002, Math.max(0.02, dur - 0.05), 0.12);
    node.connect(g).connect(out);
    src.start(when);
    src.stop(when + dur + 0.3);
  }

  /**
   * Horn effects as pitch bends on an oscillator's frequency: a fall drops off at the end, a
   * doit rises at the end, a scoop starts below, a plop drops in from above.
   */
  function bendOsc(o, t, f, d, bend) {
    if (!bend || !o.frequency.setValueAtTime) return;
    const semi = (n) => f * 2 ** (n / 12);
    const end = t + d;
    if (bend === 'fall') { o.frequency.setValueAtTime(f, Math.max(t, end - 0.18)); o.frequency.exponentialRampToValueAtTime(semi(-7), end + 0.12); }
    if (bend === 'doit') { o.frequency.setValueAtTime(f, Math.max(t, end - 0.18)); o.frequency.exponentialRampToValueAtTime(semi(5), end + 0.1); }
    if (bend === 'scoop') { o.frequency.setValueAtTime(semi(-3), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.1); }
    if (bend === 'plop') { o.frequency.setValueAtTime(semi(7), t); o.frequency.exponentialRampToValueAtTime(f, t + 0.08); }
  }

  /** A sawtooth (brass) or saw+square (sax) through a filter that opens with the attack. */
  function horn(t, f, d, v, { bright, breath, square, bend }) {
    const g = envelope(t, v * 0.22, 0.04, Math.max(0.02, d - 0.08), 0.1);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(f * 1.5, t);
    lp.frequency.exponentialRampToValueAtTime?.(Math.min(12000, f * bright), t + 0.06);
    lp.connect(g).connect(out);
    const types = square ? ['sawtooth', 'square'] : ['sawtooth'];
    for (const type of types) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      bendOsc(o, t, f, d, bend);
      o.connect(lp);
      o.start(t);
      o.stop(t + d + 0.3);
    }
    if (breath) {
      const n = ctx.createBufferSource();
      n.buffer = noiseBuffer();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = f * 3; bp.Q.value = 1;
      const ng = envelope(t, v * 0.03, 0.03, Math.max(0.02, d - 0.08), 0.1);
      n.connect(bp).connect(ng).connect(out);
      n.start(t); n.stop(t + d + 0.3);
    }
  }
  let noise = null;
  function noiseBuffer() {
    if (noise) return noise;
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noise;
  }

  /** A held tone: oscillator(s) through a low-pass, a soft attack, optional late vibrato and breath. */
  function sustain(t, f, d, v, { type = 'sawtooth', cutoff = 3000, attack = 0.05, level = 0.22, vibrato = 0, breath = 0, extra = [], bend = null }) {
    const g = envelope(t, v * level, attack, Math.max(0.02, d - attack - 0.05), 0.12);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(16000, cutoff);
    lp.connect(g).connect(out);
    const oscs = [[type, 1, 1], ...extra];
    let lfo = null;
    let depth = null;
    if (vibrato) {
      lfo = ctx.createOscillator();
      lfo.frequency.value = 5.5;
      depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime?.(f * vibrato, t + Math.min(0.35, d));
      lfo.connect(depth);
      lfo.start(t); lfo.stop(t + d + 0.3);
    }
    for (const [ty, mult, lev] of oscs) {
      const o = ctx.createOscillator();
      o.type = ty;
      o.frequency.value = f * mult;
      if (depth) depth.connect(o.frequency);
      bendOsc(o, t, f * mult, d, bend);
      const lg = ctx.createGain();
      lg.gain.value = lev;
      o.connect(lg).connect(lp);
      o.start(t); o.stop(t + d + 0.3);
    }
    if (breath) {
      const n = ctx.createBufferSource();
      n.buffer = noiseBuffer();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = Math.min(12000, f * 2); bp.Q.value = 1.5;
      const ng = envelope(t, v * breath, attack, Math.max(0.02, d - attack - 0.05), 0.1);
      n.connect(bp).connect(ng).connect(out);
      n.start(t); n.stop(t + d + 0.3);
    }
  }

  /** A struck or hammered tone: partials (frequency ratio, level) that ring and decay. */
  function struck(t, f, d, v, partials, ring, level = 0.3, drop = 0) {
    const g = envelope(t, v * level, 0.002, 0.01, Math.max(ring, Math.min(d, 3)));
    g.connect(out);
    for (const [ratio, lev] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * ratio * (1 + drop), t);
      if (drop) o.frequency.exponentialRampToValueAtTime(f * ratio, t + 0.08);
      const lg = ctx.createGain();
      lg.gain.value = lev;
      o.connect(lg).connect(g);
      o.start(t); o.stop(t + Math.max(ring, d) + 0.5);
    }
  }

  const RECIPES = {
    piano: (t, f, d, v) => struck(t, f, d, v, [[1, 1], [2, 0.45], [3, 0.2], [4, 0.12], [5.02, 0.05]], 1.6, 0.32),
    harp: (t, f, d, v) => pluck(t, f, Math.max(d, 0.8), v * 1.1, { damping: 0.998, cutoff: 5000 }),
    strings: (t, f, d, v, b) => sustain(t, f, d, v, { type: 'sawtooth', cutoff: Math.min(6000, f * 8), attack: 0.09, level: 0.16, vibrato: 0.005, bend: b }),
    pizz: (t, f, d, v) => pluck(t, f, Math.min(Math.max(d, 0.25), 0.6), v * 1.2, { damping: 0.985, cutoff: 2200 }),
    harmonic: (t, f, d, v) => sustain(t, f, d, v, { type: 'sine', cutoff: 8000, attack: 0.06, level: 0.18, vibrato: 0.002 }),
    flute: (t, f, d, v, b) => sustain(t, f, d, v, { type: 'sine', cutoff: 6000, attack: 0.05, level: 0.28, vibrato: 0.004, breath: 0.05, extra: [['sine', 2, 0.15]], bend: b }),
    oboe: (t, f, d, v, b) => sustain(t, f, d, v, { type: 'sawtooth', cutoff: Math.min(5000, f * 5), attack: 0.03, level: 0.16, vibrato: 0.003, extra: [['square', 1, 0.3]], bend: b }),
    clarinet: (t, f, d, v, b) => sustain(t, f, d, v, { type: 'square', cutoff: Math.min(3500, f * 6), attack: 0.04, level: 0.16, breath: 0.02, bend: b }),
    bassoon: (t, f, d, v, b) => sustain(t, f, d, v, { type: 'sawtooth', cutoff: Math.min(1400, f * 6), attack: 0.04, level: 0.22, bend: b }),
    horn: (t, f, d, v, b) => sustain(t, f, d, v, { type: 'sawtooth', cutoff: Math.min(1600, f * 4), attack: 0.07, level: 0.24, bend: b }),
    tuba: (t, f, d, v, b) => sustain(t, f, d, v, { type: 'sawtooth', cutoff: Math.min(700, f * 5), attack: 0.06, level: 0.3, bend: b }),
    timpani: (t, f, d, v) => struck(t, f, d, v, [[1, 1], [1.5, 0.3], [2, 0.15]], 1.4, 0.5, 0.04),
    glock: (t, f, d, v) => struck(t, f, d, v, [[1, 1], [2.76, 0.35], [5.4, 0.15]], 1.2, 0.2),
    xylo: (t, f, d, v) => struck(t, f, d, v, [[1, 1], [3, 0.4], [6, 0.12]], 0.3, 0.28),
    marimba: (t, f, d, v) => struck(t, f, d, v, [[1, 1], [4, 0.3], [10, 0.05]], 0.7, 0.32),
    brass: (t, f, d, v, b) => horn(t, f, d, v, { bright: 6, breath: false, square: false, bend: b }),
    sax: (t, f, d, v, b) => horn(t, f, d, v, { bright: 4, breath: true, square: true, bend: b }),
    upright: (t, f, d, v) => pluck(t, f, Math.max(d, 0.4), v * 1.4, { damping: 0.992, cutoff: 700 }),
    vibes: (t, f, d, v) => {
      // a struck bar with the motor's tremolo
      const g = envelope(t, v * 0.3, 0.003, 0.02, Math.max(0.8, d + 0.6));
      const trem = ctx.createGain();
      trem.gain.value = 0.8;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5;
      const depth = ctx.createGain();
      depth.gain.value = 0.2;
      lfo.connect(depth).connect(trem.gain);
      trem.connect(g).connect(out);
      for (const [mult, level] of [[1, 1], [4, 0.25], [10, 0.05]]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f * mult;
        const lg = ctx.createGain();
        lg.gain.value = level;
        o.connect(lg).connect(trem);
        o.start(t); o.stop(t + d + 1.5);
      }
      lfo.start(t); lfo.stop(t + d + 1.5);
    },
    guitar: (t, f, d, v) => pluck(t, f, d, v, { damping: 0.996, cutoff: 3500, drive: 1.5 }),
    bass: (t, f, d, v) => pluck(t, f, d, v * 1.3, { damping: 0.994, cutoff: 900 }),
    keys: (t, f, d, v) => {
      const g = envelope(t, v * 0.35, 0.004, 0.02, Math.max(0.25, d + 0.25));
      g.connect(out);
      for (const [mult, level, type] of [[1, 1, 'sine'], [2, 0.35, 'triangle'], [3, 0.12, 'sine'], [4, 0.05, 'sine']]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f * mult;
        const lg = ctx.createGain();
        lg.gain.value = level;
        o.connect(lg).connect(g);
        o.start(t);
        o.stop(t + d + 0.6);
      }
    },
    voice: (t, f, d, v) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      // vibrato that starts after the note settles
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.5;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime?.(f * 0.006, t + Math.min(0.4, d));
      lfo.connect(depth).connect(o.frequency);
      const g = envelope(t, v * 0.25, 0.06, Math.max(0.02, d - 0.12), 0.12);
      for (const [fc, q, level] of [[800, 6, 1], [1150, 7, 0.6], [2900, 9, 0.25]]) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = fc;
        bp.Q.value = q;
        const lg = ctx.createGain();
        lg.gain.value = level;
        o.connect(bp).connect(lg).connect(g);
      }
      g.connect(out);
      o.start(t); lfo.start(t);
      o.stop(t + d + 0.3); lfo.stop(t + d + 0.3);
    },
  };

  return {
    play(voice, when, freq, dur, velocity = 0.75, bend = null) {
      (RECIPES[voice] ?? RECIPES.keys)(Math.max(when, ctx.currentTime), freq, Math.max(0.05, dur), velocity, bend);
    },
  };
}
