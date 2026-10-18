<script>
  import { NOTE_VALUES, NoteValue } from '../core/noteValue.js';
  import { Glyphs } from '../core/glyphs.js';
  import { Notehead } from '../core/profile.js';
  import { Sticking, Mark, Roll, Grace } from '../core/score.js';
  import { t } from '../app/prefs.svelte.js';

  let { tool, onAction, canUndo = false, canMerge = false, onLegend = () => {}, onHelp = () => {} } = $props();
  const HEADS = [Notehead.CROSS, Notehead.DIAMOND, Notehead.TRIANGLE, Notehead.CIRCLE_X, Notehead.SLASHED];
  const MARKS = [[Mark.OPEN, Glyphs.OPEN], [Mark.CLOSED, Glyphs.CLOSED], [Mark.HALF_OPEN, Glyphs.HALF_OPEN], [Mark.CHOKE, Glyphs.CHOKE]];
  const TUPLETS = [3, 5, 6, 7];
</script>

<div class="palette">
  <div class="top">
    <button class="aux" onclick={onLegend} aria-label={t('legend.title')}><span class="glyph text small-text">☰</span><span class="label">{t('legend.open')}</span></button>
    <button class="aux" onclick={onHelp} aria-label={t('help.title')}><span class="glyph text small-text">?</span><span class="label">{t('help.open')}</span></button>
  </div>
  <section>
    <h3>{t('palette.edit')}</h3>
    <div class="grid">
      <button class="danger" class:on={tool.delete} aria-label={t('palette.delete')} title={t('palette.deleteHint')} onclick={() => onAction({ type: 'toggleDelete' })}>
        <span class="glyph text">✕</span><span class="label">{t('palette.delete')}</span>
      </button>
      <button aria-label={t('palette.undo')} disabled={!canUndo} onclick={() => onAction({ type: 'undo' })}>
        <span class="glyph text">↶</span><span class="label">{t('palette.undo')}</span>
      </button>
      <button aria-label={t('split.merge')} title={t('split.mergeHint')} disabled={!canMerge} onclick={() => onAction({ type: 'merge' })}>
        <span class="glyph text">⊐⊏</span><span class="label">{t('split.merge')}</span>
      </button>
    </div>
  </section>
  <section>
    <h3>{t('palette.figure')}</h3>
    <div class="mode" role="radiogroup" aria-label={t('palette.figure')}>
      <button role="radio" aria-checked={tool.splitMode !== 'cell'} class:on={tool.splitMode !== 'cell'} onclick={() => onAction({ type: 'setSplitMode', mode: 'beat' })}>{t('split.beat')}</button>
      <button role="radio" aria-checked={tool.splitMode === 'cell'} class:on={tool.splitMode === 'cell'} onclick={() => onAction({ type: 'setSplitMode', mode: 'cell' })}>{t('split.cell')}</button>
    </div>
    <p class="hint">{tool.splitMode === 'cell' ? t('split.hintCell') : t('split.hintBeat')}</p>
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
    <h3>{t('tech.head')}</h3>
    <div class="grid">
      <button class:on={!tool.head} aria-label={t('tech.headDefault')} title={t('tech.headDefaultHint')} onclick={() => tool.head && onAction({ type: 'setHead', head: tool.head })}>
        <span class="smufl glyph head">{Glyphs.notehead(Notehead.NORMAL, NoteValue.QUARTER)}</span><span class="label">{t('tech.headDefault')}</span>
      </button>
      {#each HEADS as h}
        <button class:on={tool.head === h} aria-label={t(`tech.${h}`)} onclick={() => onAction({ type: 'setHead', head: h })}>
          <span class="smufl glyph head">{Glyphs.notehead(h, NoteValue.QUARTER)}</span><span class="label">{t(`tech.${h}`)}</span>
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h3>{t('tech.technique')}</h3>
    <div class="grid">
      {#each MARKS as [m, g]}
        <button class:on={tool.mark === m} aria-label={t(`tech.${m}`)} onclick={() => onAction({ type: 'setMark', mark: m })}>
          <span class="smufl glyph mark">{g}</span><span class="label">{t(`tech.${m}`)}</span>
        </button>
      {/each}
      <button class:on={tool.roll === Roll.BUZZ} aria-label={t('tech.buzz')} onclick={() => onAction({ type: 'setRoll', roll: Roll.BUZZ })}>
        <span class="smufl glyph mark">{Glyphs.BUZZ}</span><span class="label">{t('tech.buzz')}</span>
      </button>
      <button class:on={tool.roll === Roll.TREMOLO} aria-label={t('tech.tremolo')} onclick={() => onAction({ type: 'setRoll', roll: Roll.TREMOLO })}>
        <span class="smufl glyph small">{Glyphs.TREMOLO3}</span><span class="label">{t('tech.tremolo')}</span>
      </button>
      <button class:on={tool.grace === Grace.FLAM} aria-label={t('tech.flam')} onclick={() => onAction({ type: 'setGrace', grace: Grace.FLAM })}>
        <span class="smufl glyph small">{Glyphs.GRACE_SLASH}{Glyphs.notehead(Notehead.NORMAL, NoteValue.QUARTER)}</span><span class="label">{t('tech.flam')}</span>
      </button>
      <button class:on={tool.grace === Grace.DRAG} aria-label={t('tech.drag')} onclick={() => onAction({ type: 'setGrace', grace: Grace.DRAG })}>
        <span class="smufl glyph small">{Glyphs.GRACE}{Glyphs.GRACE}{Glyphs.notehead(Notehead.NORMAL, NoteValue.QUARTER)}</span><span class="label">{t('tech.drag')}</span>
      </button>
    </div>
  </section>

</div>

<style>
  .palette { display: flex; flex-direction: column; gap: 8px; }
  .top { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
  .aux { min-height: 44px; flex-direction: row; gap: 6px; justify-content: center; }
  .aux .label { font-size: 13px; font-weight: 600; }
  .small-text { font-size: 18px; height: auto; }
  .glyph.mark { font-size: 36px; align-items: center; padding-top: 14px; }
  .glyph.head { font-size: 44px; align-items: center; height: 30px; }
  .mode { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; margin-bottom: 3px; }
  .mode button { min-height: 36px; border: none; border-radius: 0; flex-direction: row; justify-content: center; font-size: 14px; font-weight: 600; }
  .hint { margin: 0 0 5px; font-size: 11px; color: var(--muted); line-height: 1.25; }
  h3 { margin: 0 0 3px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
  .grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; }
  .grid.four { grid-template-columns: repeat(4, 1fr); }
  .grid.two { grid-template-columns: repeat(2, 1fr); }
  /* overflow: hidden keeps tall glyphs (stems, big heads) inside their own button; without it
     they covered the button above and took its clicks (Half selected 16th, X circled X) */
  button {
    display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
    gap: 2px; min-width: 0; min-height: 56px; padding: 4px 2px 4px; line-height: 1;
    position: relative; overflow: hidden;
  }
  button > span { pointer-events: none; }
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
