/**
 * Pitched instruments synthesized in Web Audio, one recipe per family. Recognisable, not
 * realistic; each plays `(when, freq, dur, velocity)`.
 * - plucked strings: Karplus–Strong, computed into a buffer (no AudioWorklet needed)
 * - keys: a few decaying partials, like an electric piano
 * - voice: a sawtooth through vowel formants with a late vibrato
 */
export const VOICES = ['guitar', 'bass', 'keys', 'voice'];

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

  const RECIPES = {
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
    play(voice, when, freq, dur, velocity = 0.75) {
      (RECIPES[voice] ?? RECIPES.keys)(Math.max(when, ctx.currentTime), freq, Math.max(0.05, dur), velocity);
    },
  };
}
