<script>
  /** The whole score, laid out like the printed page; the current bar framed, a tap opens a bar. */
  import ScoreSvg from './ScoreSvg.svelte';
  import { t } from '../app/prefs.svelte.js';
  import { barTimeSig, showsTimeSig } from '../core/score.js';

  let { score, staff, colours, current, onOpen } = $props();
  let width = $state(600);
  const perRow = $derived(width >= 700 ? 2 : 1);
  const barW = $derived(Math.max(240, (width - 8 * (perRow - 1)) / perRow));
  const sp = $derived(Math.max(8, Math.min(14, barW / 34)));
  const rows = $derived(Array.from({ length: Math.ceil(score.bars.length / perRow) }, (_, r) =>
    score.bars.map((b, i) => i).slice(r * perRow, r * perRow + perRow)));

  // a bar that just became current (opened, or just added) flashes once; the page does not scroll
  let flash = $state(-1);
  let seen = -1;
  $effect(() => {
    if (current === seen) return;
    seen = current;
    flash = current;
    const timer = setTimeout(() => (flash = -1), 900);
    return () => clearTimeout(timer);
  });
</script>

<section class="full no-print" bind:clientWidth={width} aria-label={t('editor.wholeScore')}>
  <h2>{t('editor.wholeScore')}</h2>
  {#each rows as row}
    <div class="row" style="grid-template-columns: repeat({perRow}, 1fr)">
      {#each row as i}
        <button class="frame" class:current={i === current} class:flash={i === flash} onclick={() => onOpen(i)} aria-label={t('editor.goToBar', { n: i + 1 })} aria-current={i === current}>
          <span class="n">{i + 1}</span>
          <ScoreSvg bar={score.bars[i]} {staff} width={barW - 4} staffSpacing={sp} showClef={i % perRow === 0} timeSig={showsTimeSig(score, i) ? barTimeSig(score, i) : null} {colours} fixedRange={[8.5, 6]} />
        </button>
      {/each}
    </div>
  {/each}
</section>

<style>
  .full { display: flex; flex-direction: column; gap: 6px; }
  h2 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 4px 0 0; }
  .row { display: grid; gap: 8px; }
  .frame { position: relative; display: block; padding: 0; min-height: 0; background: var(--panel); border: 1px solid var(--line); overflow: hidden; }
  .frame.current { border: 2.5px solid var(--focus-ring); background: var(--focus); }
  .frame.flash { animation: flash 0.9s ease-out; }
  @keyframes flash { 0% { box-shadow: 0 0 0 6px var(--focus-ring); } 100% { box-shadow: 0 0 0 0 transparent; } }
  .n { position: absolute; top: 4px; left: 6px; font-size: 12px; color: var(--muted); }
  .frame :global(svg) { width: 100%; height: auto; }
</style>
