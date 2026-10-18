<script>
  /** Every bar, no focus, same layout function as the editor, so paper and screen agree. */
  import ScoreSvg from './ScoreSvg.svelte';
  import { profileById } from '../core/profile.js';
  import { paginate } from '../core/pagination.js';
  import { DEFAULT_COLOURS } from '../core/colours.js';

  let { store, id, onBack } = $props();
  const score = store.load(id);
  const colours = { ...DEFAULT_COLOURS, ...(store.loadSettings().colours ?? {}) };
  const staff = score ? profileById(score.profileId).staves[0] : null;
  let barsPerLine = $state(4);
  const pages = $derived(score ? paginate(score.bars.length, { barsPerLine, linesPerPage: 8 }) : [[]]);
  const LINE = 1000;
</script>

{#if !score}
  <div class="missing"><p>Partitura não encontrada.</p><button onclick={onBack}>‹ Voltar</button></div>
{:else}
  <div class="toolbar no-print">
    <button onclick={onBack}>‹ Editor</button>
    <label>Compassos por linha <input type="number" min="1" max="8" bind:value={barsPerLine} /></label>
    <button class="on" onclick={() => window.print()}>Imprimir / salvar PDF</button>
    <span class="tip">No diálogo de impressão, escolha "Salvar como PDF".</span>
  </div>
  {#each pages as page, pi}
    <section class="page">
      {#if pi === 0}
        <h1>{score.title || 'Sem título'}</h1>
        <p class="meta">{score.timeSigNum}/{score.timeSigDen} · ♩ = {score.defaultBpm}</p>
      {/if}
      {#each page as line}
        <div class="line">
          {#each line as bi, k}
            <div class="bar" style="flex: {k === 0 ? 1.25 : 1}">
              <ScoreSvg bar={score.bars[bi]} {staff} width={k === 0 ? LINE * 1.25 / line.length : LINE / line.length} staffSpacing={9} showClef={k === 0} timeSig={bi === 0 ? [score.timeSigNum, score.timeSigDen] : null} {colours} fixedRange={[8, 10]} />
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
  .missing { padding: 24px; }
  @media print {
    .page { box-shadow: none; margin: 0; padding: 0; max-width: none; }
    @page { margin: 12mm; }
  }
</style>
