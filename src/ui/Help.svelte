<script>
  /** How to use the app, with small drawn examples. Text per language; examples are data. */
  import Modal from './Modal.svelte';
  import ScoreSvg from './ScoreSvg.svelte';
  import { t } from '../app/prefs.svelte.js';
  import { decode } from '../core/json.js';
  import { DRUM_PROFILE } from '../core/profile.js';
  import { normaliseColours } from '../core/colours.js';

  let { onClose, colours = normaliseColours({}) } = $props();
  const staff = DRUM_PROFILE.staves[0];
  const hh = (...x) => [...x, 'hihat'];
  const example = (beats) => decode({ schema_version: 2, timeSigNum: beats.length, bars: [{ beats }] }).bars[0];
  const EXAMPLES = {
    s1e: example([
      { division: 'eighth', cells: [hh('kick'), hh()] }, { division: 'eighth', cells: [hh('snare'), hh()] },
      { division: 'eighth', cells: [hh('kick'), hh()] }, { division: 'eighth', cells: [hh('snare'), hh()] },
    ]),
    s2e: example([
      { division: 'eighth', cells: [['snare'], { division: 'sixteenth', cells: [['snare'], ['snare']] }] },
      { division: 'eighth', tuplet: 3, cells: [['snare'], ['snare'], ['snare']] },
    ]),
    s3e: example([
      { division: 'eighth', cells: [[{ slot: 'hihat', marks: ['open'] }], [{ slot: 'hihat', marks: ['closed'] }]] },
      { division: 'quarter', cells: [[{ slot: 'ride', head: 'diamond' }]] },
      { division: 'quarter', cells: [[{ slot: 'snare', grace: 'flam' }]] },
      { division: 'quarter', cells: [[{ slot: 'snare', roll: 'buzz' }]] },
    ]),
  };
  const SECTIONS = [['s1t', 's1', 's1e'], ['s2t', 's2', 's2e'], ['s3t', 's3', 's3e'], ['s4t', 's4'], ['s5t', 's5'], ['s6t', 's6']];
  let width = $state(600);
</script>

<Modal title={t('help.title')} closeLabel={t('help.close')} {onClose}>
  <div bind:clientWidth={width}>
    {#each SECTIONS as [title, body, ex]}
      <section>
        <h3>{t(`help.${title}`)}</h3>
        <p>{t(`help.${body}`)}</p>
        {#if ex}
          <figure>
            <ScoreSvg bar={EXAMPLES[ex]} {staff} width={Math.min(width, 520)} staffSpacing={10} timeSig={[EXAMPLES[ex].beats.length, 4]} {colours} fixedRange={[7, 6]} />
            <figcaption>{t(`help.${ex}`)}</figcaption>
          </figure>
        {/if}
      </section>
    {/each}
  </div>
</Modal>

<style>
  section { margin-bottom: 14px; }
  h3 { font-size: 16px; margin: 0 0 4px; }
  p { margin: 0 0 6px; line-height: 1.5; font-size: 15px; }
  figure { margin: 0; padding: 6px; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); }
  figure :global(svg) { max-width: 100%; height: auto; }
  figcaption { font-size: 13px; color: var(--muted); }
</style>
