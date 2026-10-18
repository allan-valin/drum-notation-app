/**
 * A drum kit synthesized in Web Audio: no samples, nothing to download. Each sound is a few
 * oscillators and filtered noise with a short envelope, after the classic drum-machine recipes
 * (808/909 style). Recognisable, not realistic; samples can replace it behind the same
 * `play(sound, when, velocity)` interface.
 */
export function createKit(ctx) {
  const out = ctx.createDynamicsCompressor();
  out.threshold.value = -10;
  out.ratio.value = 4;
  const master = ctx.createGain();
  master.gain.value = 0.8;
  out.connect(master).connect(ctx.destination);

  const noise = (() => {
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  })();

  function env(when, peak, decay, attack = 0.001) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
    return g;
  }

  function noiseHit(when, peak, decay, filters) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    let node = src;
    for (const [type, freq, q = 0.8] of filters) {
      const f = ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      node.connect(f); node = f;
    }
    const g = env(when, peak, decay);
    node.connect(g).connect(out);
    src.start(when, Math.random() * 1.5);
    src.stop(when + decay + 0.05);
  }

  function tone(when, peak, decay, from, to = from, type = 'sine', sweep = decay) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, when);
    if (to !== from) o.frequency.exponentialRampToValueAtTime(to, when + sweep);
    const g = env(when, peak, decay);
    o.connect(g).connect(out);
    o.start(when);
    o.stop(when + decay + 0.05);
  }

  /** Six detuned squares through a band-pass: the 808 cymbal recipe. */
  function metal(when, peak, decay, centre = 8000, base = 1) {
    const g = env(when, peak, decay);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = centre; bp.Q.value = 0.6;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = centre * 0.7;
    bp.connect(hp).connect(g).connect(out);
    for (const f of [205.3, 304.4, 369.6, 522.7, 540, 800]) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f * base;
      o.connect(bp);
      o.start(when);
      o.stop(when + decay + 0.05);
    }
  }

  const SOUNDS = {
    kick: (t, v) => { tone(t, v * 1.2, 0.45, 140, 42, 'sine', 0.12); noiseHit(t, v * 0.25, 0.012, [['lowpass', 3000]]); },
    snare: (t, v) => { tone(t, v * 0.5, 0.11, 200, 160, 'triangle'); noiseHit(t, v * 0.75, 0.19, [['highpass', 1200], ['bandpass', 4000, 0.5]]); },
    rimshot: (t, v) => { tone(t, v * 0.6, 0.08, 900, 600, 'triangle'); tone(t, v * 0.5, 0.12, 200, 160, 'triangle'); noiseHit(t, v * 0.9, 0.16, [['highpass', 1500]]); },
    crossStick: (t, v) => { tone(t, v * 0.7, 0.04, 1700, 1100, 'square'); noiseHit(t, v * 0.4, 0.03, [['bandpass', 2500, 2]]); },
    hihatClosed: (t, v) => { metal(t, v * 0.35, 0.05, 9000); noiseHit(t, v * 0.25, 0.04, [['highpass', 7000]]); },
    hihatHalf: (t, v) => { metal(t, v * 0.35, 0.16, 9000); noiseHit(t, v * 0.25, 0.14, [['highpass', 6500]]); },
    hihatOpen: (t, v) => { metal(t, v * 0.35, 0.42, 8500); noiseHit(t, v * 0.25, 0.38, [['highpass', 6000]]); },
    hihatPedal: (t, v) => { metal(t, v * 0.25, 0.06, 7000); noiseHit(t, v * 0.18, 0.05, [['bandpass', 6000, 1]]); },
    ride: (t, v) => { metal(t, v * 0.22, 1.2, 9000, 1.05); tone(t, v * 0.08, 0.9, 3100); },
    rideBell: (t, v) => { tone(t, v * 0.3, 0.9, 1250); tone(t, v * 0.18, 0.7, 1870); tone(t, v * 0.1, 0.6, 2980); metal(t, v * 0.12, 0.5, 8000); },
    crash: (t, v) => { metal(t, v * 0.32, 1.7, 7000, 1.2); noiseHit(t, v * 0.35, 1.5, [['highpass', 4000]]); },
    crashChoke: (t, v) => { metal(t, v * 0.32, 0.12, 7000, 1.2); noiseHit(t, v * 0.35, 0.1, [['highpass', 4000]]); },
    china: (t, v) => { metal(t, v * 0.35, 1.1, 4500, 0.9); noiseHit(t, v * 0.35, 0.9, [['bandpass', 3500, 0.7]]); },
    cowbell: (t, v) => { tone(t, v * 0.35, 0.3, 545, 545, 'square'); tone(t, v * 0.35, 0.3, 815, 815, 'square'); },
    highTom: (t, v) => tone(t, v, 0.35, 260, 180, 'sine', 0.2),
    midTom: (t, v) => tone(t, v, 0.4, 190, 135, 'sine', 0.22),
    floorTom: (t, v) => tone(t, v, 0.5, 125, 85, 'sine', 0.25),
  };

  return {
    play(sound, when, velocity = 0.75) {
      (SOUNDS[sound] ?? SOUNDS.snare)(Math.max(when, ctx.currentTime), velocity);
    },
    click(accent, when) {
      tone(Math.max(when, ctx.currentTime), accent ? 0.5 : 0.3, 0.03, accent ? 2000 : 1400, accent ? 2000 : 1400, 'sine');
    },
    sounds: Object.keys(SOUNDS),
  };
}
