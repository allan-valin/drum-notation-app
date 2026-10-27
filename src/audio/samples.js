/**
 * Recorded drums: Hydrogen's GMRockKit (Glen MacArthur / Sebastian Moors, GPL v3 or later),
 * one velocity layer per sound plus a harder one for accented kick and snare. Provenance and
 * licence in docs/SOUNDS.md. Same `play(sound, when, velocity)` interface as the synth kit,
 * which keeps playing until the files have arrived, and stays if they never do.
 */
export const SAMPLE_FILES = {
  kick: 'kick', snare: 'snare', rimshot: 'rimshot', crossStick: 'crossStick',
  hihatClosed: 'hihatClosed', hihatHalf: 'hihatHalf', hihatOpen: 'hihatOpen', hihatPedal: 'hihatPedal',
  ride: 'ride', rideBell: 'rideBell', crash: 'crash', china: 'china', cowbell: 'cowbell',
  highTom: 'highTom', midTom: 'midTom', floorTom: 'floorTom',
};
const ACCENT_FILES = { kick: 'kickAccent', snare: 'snareAccent' };
/** Pieces with no recording of their own: a neighbour's file, played faster or slower. */
export const BORROWED = { tom3: ['midTom', 0.9], tom4: ['floorTom', 1.12], splash: ['crash', 1.5], hihatSplash: ['hihatOpen', 1.0] };

export function createSampleKit(ctx, { base = '/', fetch: get = globalThis.fetch, fallback }) {
  const buffers = {};
  const out = ctx.createGain();
  out.gain.value = 0.9;
  out.connect(ctx.destination);
  let loaded = false;

  const names = [...new Set([...Object.values(SAMPLE_FILES), ...Object.values(ACCENT_FILES)])];
  const ready = Promise.all(names.map(async (name) => {
    const res = await get(`${base}sounds/${name}.wav`);
    if (!res.ok) throw new Error(`${name}.wav: HTTP ${res.status}`);
    buffers[name] = await ctx.decodeAudioData(await res.arrayBuffer());
  })).then(() => { loaded = true; });
  ready.catch(() => {});

  function play(sound, when, velocity = 0.75, note = {}) {
    if (sound.startsWith('voice:')) { fallback.play(sound, when, velocity, note); return; }
    const t = Math.max(when, ctx.currentTime);
    // cut short: a choked crash at once, a splash after its short ring
    const cut = { crashChoke: 0.1, splash: 0.5, hihatSplash: 0.3 }[sound] ?? null;
    const choke = cut !== null;
    const [key, rate] = BORROWED[sound] ?? [sound === 'crashChoke' ? 'crash' : sound, 1];
    const accentName = velocity >= 0.95 ? ACCENT_FILES[key] : null;
    const buffer = loaded ? buffers[accentName] ?? buffers[SAMPLE_FILES[key]] : null;
    if (!buffer) { fallback.play(sound, when, velocity, note); return; }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    const level = Math.min(1, Math.pow(velocity / 0.75, 1.3) * 0.75);
    g.gain.setValueAtTime(level, t);
    if (choke) {
      g.gain.setValueAtTime(level, t + cut);
      g.gain.linearRampToValueAtTime(0.0001, t + cut + 0.04);
    }
    src.connect(g).connect(out);
    src.start(t);
    if (choke) src.stop(t + cut + 0.06);
  }

  return {
    play,
    click: (...a) => fallback.click(...a),
    ready,
    get loaded() { return loaded; },
  };
}
