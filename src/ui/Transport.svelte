<script>
  /** Listen: what to play, play/stop, loop, metronome, count-in and a practice BPM. */
  import { onDestroy } from 'svelte';
  import { t } from '../app/prefs.svelte.js';
  import { performance } from '../core/schedule.js';
  import { createPlayer } from '../audio/player.js';
  import { createKit } from '../audio/kit.js';
  import { createSampleKit } from '../audio/samples.js';

  let {
    score, currentBar, range = null, store = null,
    mode = $bindable('bar'),
    onPlayhead = () => {}, onPlaying = () => {}, onStatus = () => {},
  } = $props();

  let bpm = $state(score.defaultBpm);
  let loop = $state(false);
  let metronome = $state(false);
  let countIn = $state(false);
  let playing = $state(false);
  let sound = $state(store?.loadSettings().sound === 'synth' ? 'synth' : 'samples');
  let kits = null;
  let ctx = null;
  let player = null;

  const MODES = ['bar', 'all', 'fromHere', 'selection'];

  function bounds() {
    const last = score.bars.length - 1;
    if (mode === 'all') return [0, last];
    if (mode === 'fromHere') return [currentBar, last];
    if (mode === 'selection' && range) return range;
    return [currentBar, currentBar];
  }

  function ensureAudio() {
    if (player) return true;
    const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AC) { onStatus(t('play.noAudio')); return false; }
    ctx = new AC();
    const synth = createKit(ctx);
    const samples = createSampleKit(ctx, { base: import.meta.env.BASE_URL, fallback: synth });
    samples.ready.catch(() => { if (sound === 'samples') onStatus(t('play.loadFailed')); });
    kits = { synth, samples };
    player = createPlayer({
      clock: () => ctx.currentTime,
      play: (name, when, v) => kits[sound].play(name, when, v),
      click: synth.click,
      onPlayhead,
      onStop: () => { playing = false; onPlaying(false); onStatus(t('play.stopped')); },
    });
    return true;
  }

  function toggle() {
    if (playing) { player.stop(); return; }
    if (!ensureAudio()) return;
    ctx.resume?.();
    const [from, to] = bounds();
    player.start(performance(score, from, to), { bpm, loop, metronome, countIn });
    playing = true;
    onPlaying(true);
    onStatus(t(loop ? 'play.looping' : 'play.playing', { from: from + 1, to: to + 1, bpm })
      + (sound === 'samples' && !kits.samples.loaded ? ` · ${t('play.loading')}` : ''));
  }

  function setBpm(v) {
    bpm = Math.max(20, Math.min(300, Math.round(Number(v) || bpm)));
  }

  onDestroy(() => { player?.stop(); ctx?.close?.(); });
</script>

<section class="transport no-print" aria-label={t('play.heading')}>
  <button class="play" class:on={playing} onclick={toggle} aria-label={playing ? t('play.stop') : t('play.play')}>
    {#if playing}<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><rect x="6" y="6" width="12" height="12" fill="currentColor" rx="1.5"/></svg>{:else}<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor"/></svg>{/if}
    <span>{playing ? t('play.stop') : t('play.play')}</span>
  </button>

  <div class="modes" role="radiogroup" aria-label={t('play.what')}>
    {#each MODES as m}
      <button role="radio" aria-checked={mode === m} class:on={mode === m} disabled={playing} onclick={() => { mode = m; if (m === 'selection') onStatus(range ? t('play.selected', { from: range[0] + 1, to: range[1] + 1 }) : t('play.selectHint')); }}>{t(`play.${m}`)}</button>
    {/each}
  </div>

  <div class="opts">
    <button class:on={loop} aria-pressed={loop} disabled={playing} onclick={() => (loop = !loop)}>⟲ {t('play.loop')}</button>
    <button class:on={metronome} aria-pressed={metronome} disabled={playing} onclick={() => (metronome = !metronome)}>{t('play.metronome')}</button>
    <button class:on={countIn} aria-pressed={countIn} disabled={playing} onclick={() => (countIn = !countIn)}>{t('play.countIn')}</button>
    <span class="sound" role="radiogroup" aria-label={t('play.sound')}>
      <span class="lbl">{t('play.sound')}</span>
      {#each ['samples', 'synth'] as k}
        <button role="radio" aria-checked={sound === k} class:on={sound === k} onclick={() => { sound = k; store?.saveSettings({ ...store.loadSettings(), sound: k }); }}>{t(`play.${k}`)}</button>
      {/each}
    </span>
    <span class="bpm">
      <button aria-label={t('play.slower')} disabled={playing} onclick={() => setBpm(bpm - 5)}>−</button>
      <label>{t('play.bpm')} <input type="number" min="20" max="300" value={bpm} disabled={playing} onchange={(e) => setBpm(e.target.value)} /></label>
      <button aria-label={t('play.faster')} disabled={playing} onclick={() => setBpm(bpm + 5)}>+</button>
    </span>
  </div>
  {#if mode === 'selection'}
    <p class="hint">{range ? t('play.selected', { from: range[0] + 1, to: range[1] + 1 }) : t('play.selectHint')}</p>
  {/if}
  <p class="hint">{t('play.soundHint')}</p>
</section>

<style>
  .transport { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); }
  .play { display: inline-flex; align-items: center; gap: 6px; font-size: 16px; font-weight: 600; min-width: 110px; background: #1f8f4e; color: #fff; border-color: #1f8f4e; }
  .play.on { background: var(--danger); border-color: var(--danger); }
  .modes { display: flex; flex-wrap: wrap; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
  .modes button { border: none; border-radius: 0; font-size: 14px; }
  .opts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .opts > button { font-size: 14px; }
  .bpm { display: inline-flex; gap: 4px; align-items: center; }
  .bpm label { display: inline-flex; gap: 4px; align-items: center; font-size: 13px; color: var(--muted); }
  .bpm input { width: 64px; }
  .sound { display: inline-flex; align-items: center; gap: 0; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
  .sound .lbl { font-size: 12px; color: var(--muted); padding: 0 8px; }
  .sound button { border: none; border-radius: 0; font-size: 14px; }
  .hint { width: 100%; margin: 0; font-size: 12px; color: var(--muted); }
</style>
