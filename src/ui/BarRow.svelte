<script>
  /** Everything that acts on the current bar, labelled, between the big editor and the full score. */
  import { t } from '../app/prefs.svelte.js';
  import { barTimeSig, barKey } from '../core/score.js';
  import { prefs } from '../app/prefs.svelte.js';
  import { keyNames } from '../app/noteName.js';
  import { MAQAMAT } from '../core/pitch.js';
  import { STRINGS } from '../app/strings.js';
  import { Glyphs } from '../core/glyphs.js';
  import { leafSpans } from '../core/tree.js';

  let { score, barIndex, onAction, pitched = false } = $props();
  const key = $derived(barKey(score, barIndex));
  const KEYS = Array.from({ length: 15 }, (_, i) => i - 7);
  function keyLabel(f) {
    const [maj, min] = keyNames(f, prefs.lang, STRINGS[prefs.lang].noteNames);
    const count = f === 0 ? t('bars.keyNone') : f > 0 ? t('bars.keySharps', { n: f }) : t('bars.keyFlats', { n: -f });
    return `${count} · ${maj} ${t('bars.major')} / ${min} ${t('bars.minor')}`;
  }

  const bar = $derived(score.bars[barIndex]);
  const sig = $derived(barTimeSig(score, barIndex));
  let picking = $state(false);
  let num = $state(4);
  let den = $state(4);
  const NUMS = Array.from({ length: 12 }, (_, i) => i + 1);
  const DENS = [2, 4, 8, 16];

  function openPicker() {
    [num, den] = sig;
    picking = true;
  }
  function apply(next) {
    picking = false;
    const losing = next && next[0] < bar.beats.length
      && bar.beats.slice(next[0]).some((b) => leafSpans(b).some((l) => l.leaf.notes.length));
    if (losing && !confirm(t('bars.confirmShrink'))) return;
    onAction({ type: 'setTimeSig', sig: next });
  }
</script>

<div class="barrow no-print">
  <span class="which">{t('bars.heading', { n: barIndex + 1 })}</span>
  <button onclick={() => onAction({ type: 'removeBar' })} disabled={score.bars.length <= 1} aria-label={t('bars.removeLong')} title={t('bars.removeLong')}><b>−</b> {t('bars.remove')}</button>
  <button onclick={() => onAction({ type: 'addBar' })} aria-label={t('bars.addLong')} title={t('bars.addLong')}><b>+</b> {t('bars.add')}</button>
  <button class:on={picking} onclick={openPicker} aria-label={t('bars.timeSigLong')} title={t('bars.timeSigLong')}>
    <span class="sig"><span>{sig[0]}</span><span>{sig[1]}</span></span>
    {t('bars.timeSig', { sig: sig.join('/') })}
  </button>
  <button class:on={bar.simile} disabled={barIndex === 0} aria-pressed={bar.simile} onclick={() => onAction({ type: 'toggleSimile' })} aria-label={t('bars.simileLong')} title={t('bars.simileLong')}>
    <span class="smufl mark">{Glyphs.SIMILE}</span> {t('bars.simile')}
  </button>
  <button class:on={bar.repeatStart} aria-pressed={bar.repeatStart} onclick={() => onAction({ type: 'toggleRepeatStart' })} aria-label={t('bars.repeatStartLong')} title={t('bars.repeatStartLong')}>
    <span class="smufl mark">{Glyphs.REPEAT_LEFT}</span> {t('bars.repeatStart')}
  </button>
  <button class:on={bar.repeatEnd} aria-pressed={bar.repeatEnd} onclick={() => onAction({ type: 'toggleRepeatEnd' })} aria-label={t('bars.repeatEndLong')} title={t('bars.repeatEndLong')}>
    <span class="smufl mark">{Glyphs.REPEAT_RIGHT}</span> {t('bars.repeatEnd')}
  </button>
  {#if pitched}
    <label class="keysel" title={t('bars.keyLong')}>{t('bars.key')}
      <select aria-label={t('bars.keyLong')} value={String(key)} onchange={(e) => { const v = e.target.value; onAction({ type: 'setKey', key: MAQAMAT[v] ? v : Number(v) }); }}>
        {#each KEYS as f}<option value={String(f)}>{keyLabel(f)}</option>{/each}
        <optgroup label={t('bars.maqam')}>
          {#each Object.keys(MAQAMAT) as m}<option value={m}>{t(`maqam.${m}`)}</option>{/each}
        </optgroup>
      </select>
    </label>
  {/if}
  <label class="text">{t('tech.barText')}
    <input type="text" maxlength="80" value={bar.text ?? ''} placeholder={t('tech.barTextHint')} onchange={(e) => onAction({ type: 'setBarText', text: e.target.value.trim() })} />
  </label>
</div>

{#if picking}
  <div class="picker no-print" role="dialog" aria-label={t('bars.timeSigTitle', { n: barIndex + 1 })}>
    <strong>{t('bars.timeSigTitle', { n: barIndex + 1 })}</strong>
    <label>{t('bars.beats')}
      <select bind:value={num}>{#each NUMS as n}<option value={n}>{n}</option>{/each}</select>
    </label>
    <span class="slash">/</span>
    <label>{t('bars.unit')}
      <select bind:value={den}>{#each DENS as d}<option value={d}>{d}</option>{/each}</select>
    </label>
    <button class="on" onclick={() => apply([num, den])}>{t('bars.apply')}</button>
    {#if bar.timeSig}<button onclick={() => apply(null)}>{t('bars.inherit')}</button>{/if}
    <button onclick={() => (picking = false)}>{t('bars.cancel')}</button>
  </div>
{/if}

<style>
  .barrow { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 6px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--toolbar); }
  .keysel { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); }
  .keysel select { font: inherit; font-size: 14px; min-height: var(--tap); color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 0 6px; }
  .text { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--muted); flex: 1; min-width: 200px; }
  .text input { flex: 1; min-width: 0; }
  .which { font-weight: 600; font-size: 14px; padding: 0 6px; }
  .barrow button { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; }
  b { font-size: 18px; }
  .sig { display: inline-flex; flex-direction: column; font-size: 12px; font-weight: 800; line-height: 1; justify-content: center; text-align: center; }
  .mark { font-size: 20px; line-height: 1; height: 22px; display: inline-flex; align-items: center; }
  .picker { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; padding: 10px; border: 2px solid var(--focus-ring); border-radius: var(--radius); background: var(--panel); }
  .picker strong { width: 100%; font-size: 14px; }
  .picker label { display: flex; flex-direction: column; font-size: 12px; color: var(--muted); gap: 2px; }
  select { font: inherit; min-height: var(--tap); min-width: 64px; color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 0 8px; }
  .slash { font-size: 24px; padding-bottom: 8px; }
</style>
