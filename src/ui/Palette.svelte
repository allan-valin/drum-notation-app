<script>
  import { NOTE_VALUES, NoteValue } from '../core/noteValue.js';
  import { Glyphs } from '../core/glyphs.js';
  import { Notehead } from '../core/profile.js';
  import { Sticking } from '../core/score.js';

  let { tool, onAction, canUndo = false } = $props();

  const NAMES = {
    whole: 'Semibreve', half: 'Mínima', quarter: 'Semínima',
    eighth: 'Colcheia', sixteenth: 'Semicolcheia', thirtySecond: 'Fusa',
  };
  const TUPLETS = [3, 5, 6, 7];
</script>

<div class="palette">
  <div class="group values">
    {#each NOTE_VALUES as v}
      <button class:on={tool.value === v} title={NAMES[v.id]} aria-label={NAMES[v.id]} onclick={() => onAction({ type: 'selectValue', value: v })}>
        <span class="smufl glyph">{Glyphs.metNote(v)}</span>
        <span class="small">1/{v.divisionsPerWhole}</span>
      </button>
    {/each}
  </div>
  <div class="group">
    {#each TUPLETS as n}
      <button class:on={tool.tuplet === n} aria-label="Quiáltera de {n}" onclick={() => onAction({ type: 'selectTuplet', n })}>
        <span class="smufl glyph small-glyph">{Glyphs.tupletDigit(n)}</span>
      </button>
    {/each}
  </div>
  <div class="group">
    <button aria-label="Pausa" title="Pausa: esvazia a célula" onclick={() => onAction({ type: 'rest' })}>
      <span class="smufl glyph">{Glyphs.rest(NoteValue.QUARTER)}</span>
    </button>
    <button class:on={tool.accent} aria-label="Acento" onclick={() => onAction({ type: 'toggleAccent' })}>
      <span class="smufl glyph small-glyph">{Glyphs.ACCENT}</span>
    </button>
    <button class:on={tool.ghost} aria-label="Nota fantasma" onclick={() => onAction({ type: 'toggleGhost' })}>
      <span class="smufl glyph">{Glyphs.PAREN_LEFT}{Glyphs.notehead(Notehead.NORMAL, NoteValue.QUARTER)}{Glyphs.PAREN_RIGHT}</span>
    </button>
    <button class:on={tool.sticking === Sticking.R} aria-label="Mão direita" onclick={() => onAction({ type: 'setSticking', sticking: Sticking.R })}>R</button>
    <button class:on={tool.sticking === Sticking.L} aria-label="Mão esquerda" onclick={() => onAction({ type: 'setSticking', sticking: Sticking.L })}>L</button>
  </div>
  <div class="group">
    <button class="danger" class:on={tool.delete} aria-label="Apagar" title="Apagar: tocar numa nota remove" onclick={() => onAction({ type: 'toggleDelete' })}>✕ apagar</button>
    <button aria-label="Desfazer" disabled={!canUndo} onclick={() => onAction({ type: 'undo' })}>↶ desfazer</button>
  </div>
</div>

<style>
  .palette { display: flex; flex-direction: column; gap: 10px; }
  .group { display: flex; flex-wrap: wrap; gap: 6px; }
  .values button { flex-direction: column; min-height: 60px; padding-top: 10px; }
  button { display: inline-flex; align-items: center; justify-content: center; gap: 2px; min-width: 52px; padding: 2px 6px; line-height: 1; }
  .glyph { font-size: 30px; line-height: 1; display: inline-block; height: 30px; transform: translateY(-4px); }
  .values .glyph { transform: translateY(4px); }
  .small-glyph { font-size: 24px; }
  .small { font-size: 10px; color: inherit; opacity: 0.8; }
  @media (orientation: landscape) and (min-width: 640px) {
    .palette { width: 150px; }
    .group { gap: 4px; }
    button { min-width: 44px; }
  }
</style>
