<script>
  /** Listen: what to play, play/stop, loop, metronome, count-in and a practice BPM. */
  import { onDestroy } from 'svelte';
  import { t } from '../app/prefs.svelte.js';
  import { performanceAll } from '../core/schedule.js';
  import { INSTRUMENTS, INSTRUMENTS_BY_FAMILY } from '../core/profile.js';
  import { createPlayer } from '../audio/player.js';
  import { createKit, METRONOME_VOICES } from '../audio/kit.js';
  import { createSampleKit } from '../audio/samples.js';

  let {
    full, parts = [], onBand = () => {}, onSwing = () => {}, currentBar, range = null, store = null,
    mode = $bindable('bar'),
    selecting = $bindable(false),
    onlyPart = $bindable(false),
    onMove = () => {},
    onPlayhead = () => {}, onPlaying = () => {}, onStatus = () => {},
  } = $props();

  let bpm = $state(full.defaultBpm);
  let loop = $state(false);
  let metronome = $state(false);
  let countIn = $state(false);
  let playing = $state(false);
  const SOUNDS = ['samples', 'synth', 'none'];
  let sound = $state(SOUNDS.includes(store?.loadSettings().sound) ? store.loadSettings().sound : 'samples');
  let kits = null;
  let voice = $state(METRONOME_VOICES.includes(store?.loadSettings().metronomeVoice) ? store.loadSettings().metronomeVoice : 'beep');
  let ctx = null;
  let player = null;

  const MODES = ['bar', 'all', 'fromHere', 'selection'];

  function bounds() {
    const last = full.bars.length - 1;
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
    // 'none': drums muted for practice; the playhead still moves and the metronome still clicks
    kits = { synth, samples, none: { play() {}, loaded: true } };
    player = createPlayer({
      clock: () => ctx.currentTime,
      play: (name, when, v, n) => kits[sound].play(name, when, v, n),
      click: (accent, when) => synth.click(accent, when, voice),
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
    player.start(performanceAll(full, from, to), { bpm, loop, metronome, countIn });
    playing = true;
    onPlaying(true);
    onStatus(t(loop ? 'play.looping' : 'play.playing', { from: from + 1, to: to + 1, bpm })
      + (sound === 'none' ? ` · ${t('play.none')}` : '')
      + (sound === 'samples' && !kits.samples.loaded ? ` · ${t('play.loading')}` : ''));
  }

  /** Choosing a metronome sound plays it once (accent, then a normal beat), so you hear it first. */
  function chooseVoice(v) {
    voice = v;
    store?.saveSettings({ ...store.loadSettings(), metronomeVoice: v });
    onStatus(t('play.voiceSet', { voice: t(`play.voice_${v}`) }));
    // a preview is a nicety: without Web Audio it stays quiet instead of replacing the status
    if (!playing && (globalThis.AudioContext ?? globalThis.webkitAudioContext) && ensureAudio()) {
      ctx.resume?.();
      const now = ctx.currentTime + 0.05;
      kits.synth.click(true, now, v);
      kits.synth.click(false, now + 0.35, v);
    }
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

  <span class="selbox">
    <button class="arrow" disabled={!selecting || playing} aria-label={t('play.moveLeft')} title={t('play.moveLeft')} onclick={() => onMove(-1)}>‹</button>
    <label class="check"><input type="checkbox" bind:checked={selecting} disabled={playing} onchange={() => { if (selecting) mode = 'selection'; if (selecting) onStatus(t('play.dragHint')); }} /> {t('play.selectBars')}</label>
    <button class="arrow" disabled={!selecting || playing} aria-label={t('play.moveRight')} title={t('play.moveRight')} onclick={() => onMove(1)}>›</button>
    <label class="check only" title={t('play.onlyPartHint')}><input type="checkbox" bind:checked={onlyPart} disabled={!selecting || playing} /> {t('play.onlyPart')}</label>
  </span>

  <div class="modes" role="radiogroup" aria-label={t('play.what')}>
    {#each MODES as m}
      <button role="radio" aria-checked={mode === m} class:on={mode === m} disabled={playing} onclick={() => { mode = m; if (m === 'selection') onStatus(range ? t('play.selected', { from: range[0] + 1, to: range[1] + 1 }) : t('play.selectHint')); }}>{t(`play.${m}`)}</button>
    {/each}
  </div>

  <div class="opts">
    <button class:on={loop} aria-pressed={loop} disabled={playing} onclick={() => (loop = !loop)}>⟲ {t('play.loop')}</button>
    <button class:on={metronome} aria-pressed={metronome} disabled={playing} onclick={() => (metronome = !metronome)}>{t('play.metronome')}</button>
    <label class="voice">{t('play.metronomeSound')}
      <select value={voice} onchange={(e) => chooseVoice(e.target.value)}>
        {#each METRONOME_VOICES as v}<option value={v}>{t(`play.voice_${v}`)}</option>{/each}
      </select>
    </label>
    <button class:on={full.swing} aria-pressed={!!full.swing} title={t('play.swingHint')} disabled={playing} onclick={() => onSwing(!full.swing)}>{t('play.swing')}</button>
    <button class:on={countIn} aria-pressed={countIn} disabled={playing} onclick={() => (countIn = !countIn)}>{t('play.countIn')}</button>
    <span class="sound" role="radiogroup" aria-label={t('play.sound')}>
      <span class="lbl">{t('play.sound')}</span>
      {#each SOUNDS as k}
        <button role="radio" aria-checked={sound === k} class:on={sound === k} onclick={() => { sound = k; store?.saveSettings({ ...store.loadSettings(), sound: k }); if (k === 'none') onStatus(t('play.noneHint')); }}>{t(`play.${k}`)}</button>
      {/each}
    </span>
    <span class="bpm">
      <span class="lbl">{t('play.bpm')}</span>
      <button aria-label={t('play.slower')} disabled={playing} onclick={() => setBpm(bpm - 5)}>−</button>
      <input type="number" min="20" max="300" value={bpm} disabled={playing} aria-label={t('play.bpm')} onchange={(e) => setBpm(e.target.value)} />
      <button aria-label={t('play.faster')} disabled={playing} onclick={() => setBpm(bpm + 5)}>+</button>
    </span>
  </div>
  <div class="band" aria-label={t('instrument.band')}>
    <span class="lbl">{t('instrument.band')}</span>
    {#each parts as p, i (p.id)}
      <div class="row" class:muted={p.muted}>
        <span class="n">{i + 1}</span>
        <select aria-label={`${t('instrument.label')} ${i + 1}`} value={p.instrument} disabled={playing} onchange={(e) => { const v = e.target.value; e.target.value = p.instrument; onBand({ type: 'setInstrument', part: p.id, instrument: v }); }}>
          {#each INSTRUMENTS_BY_FAMILY as [fam, ids]}
            <optgroup label={t(`family.${fam}`)}>
              {#each ids as id}<option value={id}>{t(`instrument.${id}`)}</option>{/each}
            </optgroup>
          {/each}
        </select>
        <button class:on={p.muted} aria-pressed={p.muted} aria-label={`${p.muted ? t('instrument.unmute') : t('instrument.mute')}: ${p.label}`} title={p.muted ? t('instrument.unmute') : t('instrument.mute')} onclick={() => onBand({ type: 'toggleMute', part: p.id })}>{p.muted ? '🔇' : '🔊'}</button>
        <button aria-label={`${t('instrument.remove')}: ${p.label}`} title={t('instrument.remove')} disabled={parts.length <= 1 || playing} onclick={() => onBand({ type: 'removePart', part: p.id })}>✕</button>
      </div>
    {/each}
    <button class="add" disabled={playing} onclick={() => onBand({ type: 'addPart', instrument: INSTRUMENTS.find((id) => !parts.some((p) => p.instrument === id)) ?? INSTRUMENTS[0] })}>{t('instrument.add')}</button>
  </div>

  {#if mode === 'selection'}
    <p class="hint">{range ? t('play.selected', { from: range[0] + 1, to: range[1] + 1 }) + ' · ' : ''}{selecting ? t('play.dragHint') : t('play.selectHint')}</p>
  {/if}
  <p class="hint">{t('play.soundHint')}</p>
</section>

<style>
  .transport { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--toolbar); }
  .play { display: inline-flex; align-items: center; gap: 6px; font-size: 16px; font-weight: 600; min-width: 110px; background: #1f8f4e; color: #fff; border-color: #1f8f4e; }
  .play.on { background: var(--danger); border-color: var(--danger); }
  .modes { background: var(--panel); display: flex; flex-wrap: wrap; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
  .modes button { border: none; border-radius: 0; font-size: 14px; }
  .modes button + button, .sound button + button { border-left: 1px solid var(--line); }
  .sound .lbl + button { border-left: 1px solid var(--line); }
  .opts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .opts > button { font-size: 14px; }
  .bpm { display: inline-flex; gap: 4px; align-items: center; }
  .bpm .lbl { font-size: 13px; color: var(--muted); }
  .bpm input { width: 64px; }
  .sound { background: var(--panel); display: inline-flex; align-items: center; gap: 0; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
  .sound .lbl { font-size: 12px; color: var(--muted); padding: 0 8px; }
  .sound button { border: none; border-radius: 0; font-size: 14px; }
  .selbox { display: inline-flex; align-items: stretch; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; background: var(--panel); }
  .selbox .arrow { border: none; border-radius: 0; font-size: 22px; min-width: 44px; }
  .selbox .check.only { border-right: none; }
  .selbox .check { display: inline-flex; align-items: center; gap: 6px; padding: 0 10px; font-size: 14px; border-left: 1px solid var(--line); border-right: 1px solid var(--line); cursor: pointer; }
  .selbox input { width: 20px; height: 20px; }
  .voice { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); }
  .voice select { font: inherit; font-size: 14px; color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); min-height: var(--tap); padding: 0 8px; }
  .band { width: 100%; display: flex; flex-direction: column; gap: 6px; padding: 8px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--toolbar-deep); }
  .band .lbl { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
  .band .row { display: flex; gap: 6px; align-items: center; }
  .band .row.muted select { opacity: 0.5; }
  .band .n { width: 1.5em; text-align: right; color: var(--muted); font-size: 13px; }
  .band select { flex: 1; min-width: 0; font: inherit; min-height: var(--tap); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 0 8px; }
  .band .add { align-self: flex-start; border-style: dashed; color: var(--accent); font-weight: 600; }
  .hint { width: 100%; margin: 0; font-size: 12px; color: var(--muted); }
</style>
