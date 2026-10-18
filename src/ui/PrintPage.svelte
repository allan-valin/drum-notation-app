<script>
  /** Every bar, no focus, same layout function as the editor, so paper and screen agree. */
  import ScoreSvg from './ScoreSvg.svelte';
  import { profileById } from '../core/profile.js';
  import { paginate } from '../core/pagination.js';
  import { barTimeSig, showsTimeSig, barKey, showsKey } from '../core/score.js';
  import { normaliseColours } from '../core/colours.js';
  import { t } from '../app/prefs.svelte.js';

  let { store, id, onBack } = $props();
  import { partView } from '../core/parts.js';
  import { carryInto, tiesOut, slurOpenAt } from '../core/edit.js';
  import { partKey } from '../core/pitch.js';
  const full = store.load(id);
  /** Every part, one staff each per bar; `score` (the first part) carries signatures and title. */
  const views = full ? full.parts.map((p) => ({ id: p.id, instrument: p.instrument, view: partView(full, p.id), staff: profileById(p.instrument).staves[0] })) : [];
  const score = views[0]?.view ?? null;
  const many = views.length > 1;
  const blocks = views.reduce((acc, v) => {
    const g = full.parts.find((p) => p.id === v.id)?.group ?? null;
    const last = acc[acc.length - 1];
    if (g && last && last.group === g) last.views.push(v);
    else acc.push({ group: g, views: [v] });
    return acc;
  }, []);
  const colours = normaliseColours(store.loadSettings().colours);
  let barsPerLine = $state(2);
  const pages = $derived(score ? paginate(score.bars.length, { barsPerLine, linesPerPage: 8 }) : [[]]);
  const LINE = 1000;
</script>

{#if !score}
  <div class="missing"><p>{t('print.notFound')}</p><button onclick={onBack}>‹ {t('print.backShort')}</button></div>
{:else}
  <div class="toolbar no-print">
    <button onclick={onBack}>‹ {t('print.back')}</button>
    <label>{t('print.barsPerLine')} <input type="number" min="1" max="8" bind:value={barsPerLine} /></label>
    <button class="on" onclick={() => window.print()}>{t('print.print')}</button>
    <span class="tip">{t('print.tip')}</span>
  </div>
  {#each pages as page, pi}
    <section class="page">
      {#if pi === 0}
        <h1>{score.title || t('app.untitled')}</h1>
        <p class="meta">{barTimeSig(score, 0).join('/')} · ♩ = {score.defaultBpm}</p>
      {/if}
      {#each page as line}
        <div class="line">
          {#each line as bi, k}
            <div class="bar" style="flex: {k === 0 ? 1.25 : 1}">
              {#each blocks as blk}
              <div class="block">
                {#if blk.group && k === 0}<svg class="brace" viewBox="0 0 10 100" preserveAspectRatio="none" aria-hidden="true" style="position: absolute; left: 0; top: 8%; height: 84%; width: 9px; max-width: 9px; pointer-events: none; z-index: 2"><path d="M9 1 C3 3 6 30 4 46 C3 49 1 50 1 50 C1 50 3 51 4 54 C6 70 3 97 9 99" fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke" /></svg>{/if}
              {#each blk.views as v (v.id)}
                <div class="pstaff">
                  {#if many && k === 0}<span class="plabel">{t(`instrument.${v.instrument}`)}</span>{/if}
                  <ScoreSvg bar={v.view.bars[bi]} staff={v.staff} width={k === 0 ? LINE * 1.25 / line.length : LINE / line.length} staffSpacing={9} showClef={k === 0} timeSig={showsTimeSig(score, bi) ? barTimeSig(score, bi) : null} keyFifths={partKey(barKey(score, bi), profileById(v.view.profileId))} showKey={k === 0 || showsKey(score, bi)} den={barTimeSig(score, bi)[1]} carry={carryInto(v.view, bi)} tieOut={tiesOut(v.view, bi)} dynamicsAbove={!!profileById(v.view.profileId).dynamicsAbove} slurIn={slurOpenAt(v.view, bi)} {colours} fixedRange={[many ? 7 : 8, profileById(v.view.profileId).palette.includes('pedal') ? 11 : many ? 8.5 : 10]} />
                </div>
              {/each}
              </div>
              {/each}
            </div>
          {/each}
        </div>
      {/each}
    </section>
  {/each}
{/if}

<style>
  .toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 8px 16px; border-bottom: 1px solid var(--line); }
  .toolbar label { font-size: 14px; display: flex; gap: 6px; align-items: center; }
  .toolbar input { width: 64px; }
  .tip { font-size: 13px; color: var(--muted); }
  .page { background: #fff; color: #000; max-width: 1000px; margin: 12px auto; padding: 24px; box-shadow: 0 1px 6px rgba(0,0,0,0.15); page-break-after: always; --ink: #000; --muted: #555; }
  .page:last-child { page-break-after: auto; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .meta { margin: 0 0 12px; color: #555; font-size: 14px; }
  .line { display: flex; gap: 0; margin: 8px 0 18px; }
  .bar :global(svg) { width: 100%; height: auto; }
  .pstaff { position: relative; }
  .block { position: relative; }
  .brace { position: absolute; left: 0; top: 8%; height: 84%; width: 9px; color: #000; pointer-events: none; }
  .plabel { position: absolute; top: 0; left: 0; font-size: 11px; font-weight: 600; color: #555; }
  .missing { padding: 24px; }
  @media print {
    .page { box-shadow: none; margin: 0; padding: 0; max-width: none; }
    @page { margin: 12mm; }
  }
</style>
