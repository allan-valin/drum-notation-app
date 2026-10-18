<script>
  import { NOTE_VALUES, NoteValue } from '../core/noteValue.js';
  import { Glyphs } from '../core/glyphs.js';
  import { Notehead } from '../core/profile.js';
  import { Sticking } from '../core/score.js';
  import { t } from '../app/prefs.svelte.js';

  let { tool, onAction, canUndo = false } = $props();
  const TUPLETS = [3, 5, 6, 7];
</script>

<div class="palette">
  <section>
    <h3>{t('palette.figure')}</h3>
    <div class="grid">
      {#each NOTE_VALUES as v}
        <button class:on={tool.value === v} aria-label={t(`value.${v.id}`)} title="1/{v.divisionsPerWhole}" onclick={() => onAction({ type: 'selectValue', value: v })}>
          <span class="smufl glyph note">{Glyphs.metNote(v)}</span>
          <span class="label">{t(`value.${v.id}`)}</span>
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h3>{t('palette.tuplet')}</h3>
    <div class="grid four">
      {#each TUPLETS as n}
        <button class:on={tool.tuplet === n} aria-label={t('palette.tupletN', { n })} title={t('palette.tupletN', { n })} onclick={() => onAction({ type: 'selectTuplet', n })}>
          <span class="smufl glyph small">{Glyphs.tupletDigit(n)}</span>
          <span class="label">{t('palette.tupletShort', { n })}</span>
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h3>{t('palette.articulation')}</h3>
    <div class="grid">
      <button aria-label={t('palette.rest')} title={t('palette.restHint')} onclick={() => onAction({ type: 'rest' })}>
        <span class="smufl glyph">{Glyphs.rest(NoteValue.QUARTER)}</span>
        <span class="label">{t('palette.rest')}</span>
      </button>
      <button class:on={tool.accent} aria-label={t('palette.accent')} onclick={() => onAction({ type: 'toggleAccent' })}>
        <span class="smufl glyph small accent">{Glyphs.ACCENT}</span>
        <span class="label">{t('palette.accent')}</span>
      </button>
      <button class:on={tool.ghost} aria-label={t('palette.ghostLong')} onclick={() => onAction({ type: 'toggleGhost' })}>
        <span class="smufl glyph">{Glyphs.PAREN_LEFT}{Glyphs.notehead(Notehead.NORMAL, NoteValue.QUARTER)}{Glyphs.PAREN_RIGHT}</span>
        <span class="label">{t('palette.ghost')}</span>
      </button>
    </div>
  </section>

  <section>
    <h3>{t('palette.hand')}</h3>
    <div class="grid two">
      <button class:on={tool.sticking === Sticking.R} aria-label={t('palette.rightLong')} onclick={() => onAction({ type: 'setSticking', sticking: Sticking.R })}>
        <span class="glyph text">R</span><span class="label">{t('palette.right')}</span>
      </button>
      <button class:on={tool.sticking === Sticking.L} aria-label={t('palette.leftLong')} onclick={() => onAction({ type: 'setSticking', sticking: Sticking.L })}>
        <span class="glyph text">L</span><span class="label">{t('palette.left')}</span>
      </button>
    </div>
  </section>

  <section>
    <h3>{t('palette.edit')}</h3>
    <div class="grid two">
      <button class="danger" class:on={tool.delete} aria-label={t('palette.delete')} title={t('palette.deleteHint')} onclick={() => onAction({ type: 'toggleDelete' })}>
        <span class="glyph text">✕</span><span class="label">{t('palette.delete')}</span>
      </button>
      <button aria-label={t('palette.undo')} disabled={!canUndo} onclick={() => onAction({ type: 'undo' })}>
        <span class="glyph text">↶</span><span class="label">{t('palette.undo')}</span>
      </button>
    </div>
  </section>
</div>

<style>
  .palette { display: flex; flex-direction: column; gap: 8px; }
  h3 { margin: 0 0 3px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
  .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; }
  .grid.four { grid-template-columns: repeat(4, 1fr); }
  .grid.two { grid-template-columns: repeat(2, 1fr); }
  button {
    display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
    gap: 2px; min-width: 0; min-height: 56px; padding: 4px 2px 4px; line-height: 1;
  }
  .glyph { font-size: 28px; line-height: 1; height: 30px; display: flex; align-items: flex-end; }
  .glyph.note { align-items: center; }
  .glyph.small { font-size: 22px; align-items: center; }
  .glyph.accent { align-items: center; padding-top: 10px; }
  .glyph.text { font-family: system-ui, sans-serif; font-size: 20px; font-weight: 600; align-items: center; }
  .label { font-size: 10px; line-height: 1.1; text-align: center; overflow-wrap: anywhere; hyphens: auto; }
  @media (orientation: landscape) and (min-width: 640px) {
    .grid { grid-template-columns: repeat(3, 1fr); }
    .grid.four { grid-template-columns: repeat(4, 1fr); }
  }
  @media (max-width: 420px) {
    .grid { grid-template-columns: repeat(3, 1fr); }
  }
</style>
