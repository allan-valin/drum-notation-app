<script>
  import { NOTE_VALUES, NoteValue } from '../core/noteValue.js';
  import { Glyphs } from '../core/glyphs.js';
  import { Notehead } from '../core/profile.js';
  import { Sticking, Mark, Roll, Grace } from '../core/score.js';
  import { t } from '../app/prefs.svelte.js';

  import { DRUM_PROFILE, INSTRUMENTS_BY_FAMILY } from '../core/profile.js';
  import { patternsFor } from '../core/autofill.js';

  let {
    tool, onAction, canUndo = false, canMerge = false, onLegend = () => {}, onHelp = () => {},
    profile = DRUM_PROFILE, parts = [], part = null, lyric = '', chord = '', lyricsInfo = '',
    /** drums: voices split, the voice edited; beats in the bar (for the autofill patterns) */
    split = false, voice = 0, beatsInBar = 4,
    /** selection for moving notes: null, 'cells' or 'beats'; how many are marked */
    selectMode = null, selectedCount = 0, onSelectMode = () => {},
  } = $props();
  const staff0 = $derived(profile.staves[0]);
  const splitMode = $derived(tool.splitMode ?? 'beat');
  /** Autofill: any unpitched staff (drums, congas, frame drums, taiko); its pieces by height, top first. */
  const fillPieces = $derived(staff0.pitched ? [] : [...staff0.slots].reverse());
  const patterns = $derived(patternsFor(beatsInBar));
  let fillPiece = $state('hihat');
  let fillPattern = $state('cells');
  const patternLabel = (p) => (p.startsWith('g:') ? t('autofill.group', { g: p.slice(2) }) : t(`autofill.${p}`));
  const q = NoteValue.QUARTER;
  const HEADS = [Notehead.CROSS, Notehead.DIAMOND, Notehead.DIAMOND_OPEN, Notehead.TRIANGLE, Notehead.CIRCLE_X, Notehead.SLASHED, Notehead.SLASH];
  /** Every technique the app knows; a profile shows the ones its instrument uses. */
  const TECHS = [
    { id: Mark.OPEN, glyph: Glyphs.OPEN, cls: 'mark' },
    { id: Mark.CLOSED, glyph: Glyphs.CLOSED, cls: 'mark' },
    { id: Mark.HALF_OPEN, glyph: Glyphs.HALF_OPEN, cls: 'mark' },
    { id: Mark.CHOKE, glyph: Glyphs.STACCATO, cls: 'mark' },
    { id: Roll.BUZZ, glyph: Glyphs.BUZZ, cls: 'mark' },
    { id: Roll.TREMOLO, glyph: Glyphs.TREMOLO3, cls: 'small' },
    { id: Grace.FLAM, glyph: Glyphs.GRACE_SLASH + Glyphs.notehead(Notehead.NORMAL, q), cls: 'small' },
    { id: Grace.DRAG, glyph: Glyphs.GRACE + Glyphs.GRACE + Glyphs.notehead(Notehead.NORMAL, q), cls: 'small' },
    { id: Mark.FALL, glyph: Glyphs.notehead(Notehead.NORMAL, q) + Glyphs.FALL, cls: 'small' },
    { id: Mark.DOIT, glyph: Glyphs.notehead(Notehead.NORMAL, q) + Glyphs.DOIT, cls: 'small' },
    { id: Mark.SCOOP, glyph: Glyphs.SCOOP + Glyphs.notehead(Notehead.NORMAL, q), cls: 'small' },
    { id: Mark.PLOP, glyph: Glyphs.PLOP + Glyphs.notehead(Notehead.NORMAL, q), cls: 'small' },
    { id: Mark.PIZZ, text: 'pizz.', cls: 'word' },
    { id: Mark.ARCO, text: 'arco', cls: 'word' },
    { id: Mark.DOWN_BOW, glyph: Glyphs.DOWN_BOW, cls: 'mark' },
    { id: Mark.UP_BOW, glyph: Glyphs.UP_BOW, cls: 'mark' },
    { id: Mark.HARMONIC, glyph: Glyphs.HARMONIC, cls: 'mark' },
    { id: Mark.TRILL, glyph: Glyphs.TRILL, cls: 'small' },
    { id: Mark.LV, text: 'l.v.', cls: 'word' },
  ];
  const has = (group) => profile.palette.includes(group);
  const heads = $derived(HEADS.filter((h) => profile.heads.includes(h)));
  const techs = $derived(TECHS.filter((x) => profile.techniques.includes(x.id)));
  /** An instrument may name a symbol its own way: an X head on congas is a slap. */
  const label = (id) => t(`tech.${profile.labels?.[id] ?? id}`);
  const tech = (x) => onAction({ type: 'setTech', tech: x });
  /** Accidentals as alterations in semitones; null follows the key signature. */
  const ACCIDENTALS = [
    { alter: 1, glyph: Glyphs.SHARP, key: 'sharp' },
    { alter: -1, glyph: Glyphs.FLAT, key: 'flat' },
    { alter: 0, glyph: Glyphs.NATURAL, key: 'natural' },
    { alter: 2, glyph: Glyphs.DOUBLE_SHARP, key: 'doubleSharp' },
    { alter: -2, glyph: Glyphs.DOUBLE_FLAT, key: 'doubleFlat' },
  ];
  /** Quarter tones, for instruments that play them (Arabic music). */
  const QUARTERS = [
    { alter: -0.5, glyph: Glyphs.QUARTER_FLAT, key: 'quarterFlat' },
    { alter: 0.5, glyph: Glyphs.QUARTER_SHARP, key: 'quarterSharp' },
    { alter: -1.5, glyph: Glyphs.THREE_QUARTER_FLAT, key: 'threeQuarterFlat' },
    { alter: 1.5, glyph: Glyphs.THREE_QUARTER_SHARP, key: 'threeQuarterSharp' },
  ];
  const accidentals = $derived(profile.quarterTones ? [...ACCIDENTALS, ...QUARTERS] : ACCIDENTALS);
  const EXTRA_ARTS = [
    { id: 'staccato', glyph: Glyphs.STACCATO }, { id: 'tenuto', glyph: Glyphs.TENUTO },
    { id: 'marcato', glyph: Glyphs.MARCATO }, { id: 'fermata', glyph: Glyphs.FERMATA },
  ];
  const extraArts = $derived(EXTRA_ARTS.filter((a) => profile.articulations.includes(a.id)));
  const TUPLETS = [3, 5, 6, 7];
</script>

<div class="palette">
  <div class="top">
    <button class="aux" onclick={onLegend} aria-label={t('legend.title')}><span class="glyph text small-text">☰</span><span class="label">{t('legend.open')}</span></button>
    <button class="aux" onclick={onHelp} aria-label={t('help.title')}><span class="glyph text small-text">?</span><span class="label">{t('help.open')}</span></button>
  </div>
  <section class="instrument">
    <h3>{t('instrument.editing')}</h3>
    <select aria-label={t('instrument.label')} value={part} onchange={(e) => {
      const v = e.target.value;
      // "add:violin": a new instrument from here, added to the band and opened for writing
      if (v.startsWith('add:')) { e.target.value = part; onAction({ type: 'addPart', instrument: v.slice(4) }); }
      else onAction({ type: 'setPart', part: v });
    }}>
      <optgroup label={t('instrument.inScore')}>
        {#each parts as p}<option value={p.id}>{p.label}</option>{/each}
      </optgroup>
      <!-- section headers (optgroup labels) cannot be chosen -->
      {#each INSTRUMENTS_BY_FAMILY as [fam, ids]}
        <optgroup label={`${t('instrument.add')} · ${t(`family.${fam}`)}`}>
          {#each ids as id}<option value={`add:${id}`}>+ {t(`instrument.${id}`)}</option>{/each}
        </optgroup>
      {/each}
    </select>
  </section>
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
    <div class="mode three" role="radiogroup" aria-label={t('palette.figure')}>
      {#each ['beat', 'cell', 'bar'] as m}
        <button role="radio" aria-checked={splitMode === m} class:on={splitMode === m} onclick={() => onAction({ type: 'setSplitMode', mode: m })}>{t(`split.${m}`)}</button>
      {/each}
    </div>
    <p class="hint">{t({ beat: 'split.hintBeat', cell: 'split.hintCell', bar: 'split.hintBar' }[splitMode])}</p>
    <div class="grid">
      {#each NOTE_VALUES as v}
        <button class:on={tool.value === v} aria-label={t(`value.${v.id}`)} title="1/{v.divisionsPerWhole}" onclick={() => onAction({ type: 'selectValue', value: v })}>
          <span class="smufl glyph note">{Glyphs.metNote(v)}</span>
          <span class="label">{t(`value.${v.id}`)}</span>
        </button>
      {/each}
    </div>
  </section>

  {#if has('length')}
  <section>
    <div class="grid two">
      <button class:on={tool.dot} aria-label={t('palette.dot')} title={t('palette.dotHint')} onclick={() => onAction({ type: 'toggleDot' })}>
        <span class="smufl glyph note">{Glyphs.metNote(NoteValue.QUARTER)}{Glyphs.DOT}</span><span class="label">{t('palette.dot')}</span>
      </button>
      <button aria-label={t('palette.tie')} title={t('palette.tieHint')} onclick={() => onAction({ type: 'toggleTie' })}>
        <span class="glyph text small-text">⌒</span><span class="label">{t('palette.tie')}</span>
      </button>
    </div>
  </section>
  {/if}

  {#if has('tuplet')}
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
  {/if}

  {#if staff0.voices}
  <section>
    <h3>{t('voices.title')}</h3>
    <div class="mode three" role="radiogroup" aria-label={t('voices.title')} title={t('voices.stemHint')}>
      <button role="radio" aria-checked={!tool.stem} class:on={!tool.stem} onclick={() => tool.stem && onAction({ type: 'setStem', stem: tool.stem })}>{t('voices.auto')}</button>
      <button role="radio" aria-checked={tool.stem === 'up'} class:on={tool.stem === 'up'} aria-label={t('voices.up')} onclick={() => onAction({ type: 'setStem', stem: 'up' })}>↑ {t('voices.up')}</button>
      <button role="radio" aria-checked={tool.stem === 'down'} class:on={tool.stem === 'down'} aria-label={t('voices.down')} onclick={() => onAction({ type: 'setStem', stem: 'down' })}>↓ {t('voices.down')}</button>
    </div>
    <p class="hint">{t('voices.stemHint')}</p>
    <label class="switch"><input type="checkbox" checked={split} onchange={(e) => onAction({ type: 'setSplit', on: e.target.checked })} /> {t('voices.split')}</label>
    {#if split}
      <div class="mode" role="radiogroup" aria-label={t('voices.split')}>
        <button role="radio" aria-checked={voice === 0} class:on={voice === 0} onclick={() => onAction({ type: 'setVoice', voice: 0 })}>{t('voices.upper')}</button>
        <button role="radio" aria-checked={voice === 1} class:on={voice === 1} onclick={() => onAction({ type: 'setVoice', voice: 1 })}>{t('voices.lower')}</button>
      </div>
    {/if}
    <p class="hint">{t('voices.splitHint')}</p>
  </section>
  {/if}

  {#if fillPieces.length}
  <section class="fill">
    <h3>{t('autofill.title')}</h3>
    <label class="field">{t('autofill.piece')}
      <select bind:value={fillPiece} aria-label={t('autofill.piece')}>
        {#each fillPieces as x}<option value={x.id}>{t(`slot.${x.id}`)}</option>{/each}
      </select>
    </label>
    <label class="field">{t('autofill.pattern')}
      <select bind:value={fillPattern} aria-label={t('autofill.pattern')}>
        {#each patterns as p}<option value={p}>{patternLabel(p)}</option>{/each}
      </select>
    </label>
    <button class="apply" onclick={() => onAction({ type: 'autofill', slotId: fillPieces.some((x) => x.id === fillPiece) ? fillPiece : fillPieces[0].id, pattern: patterns.includes(fillPattern) ? fillPattern : patterns[0], label: patternLabel(patterns.includes(fillPattern) ? fillPattern : patterns[0]) })}>{t('autofill.apply')}</button>
    <p class="hint">{t('autofill.hint')}</p>
  </section>
  {/if}

  <section>
    <h3>{t('drag.select')}</h3>
    <div class="mode three" role="radiogroup" aria-label={t('drag.select')}>
      <button role="radio" aria-checked={!selectMode} class:on={!selectMode} onclick={() => onSelectMode(null)}>{t('drag.off')}</button>
      <button role="radio" aria-checked={selectMode === 'cells'} class:on={selectMode === 'cells'} onclick={() => onSelectMode('cells')}>{t('drag.cells')}</button>
      <button role="radio" aria-checked={selectMode === 'beats'} class:on={selectMode === 'beats'} onclick={() => onSelectMode('beats')}>{t('drag.beats')}</button>
    </div>
    {#if selectMode}
      <p class="hint">{t('drag.selected', { n: selectedCount })} · <button class="link" onclick={() => onSelectMode(selectMode, true)}>{t('drag.clear')}</button></p>
    {/if}
    <p class="hint">{t('drag.hint')} {t('drag.rightClick')}.</p>
  </section>

  {#if has('accidental')}
  <section>
    <h3>{t('palette.accidental')}</h3>
    <div class="grid">
      <button class:on={tool.accidental === null} aria-label={t('palette.byKey')} title={t('palette.byKeyHint')} onclick={() => tool.accidental !== null && onAction({ type: 'setAccidental', alter: tool.accidental })}>
        <span class="glyph text small-text">♮?</span><span class="label">{t('palette.byKey')}</span>
      </button>
      {#each accidentals as a}
        <button class:on={tool.accidental === a.alter} aria-label={t(`palette.${a.key}`)} onclick={() => onAction({ type: 'setAccidental', alter: a.alter })}>
          <span class="smufl glyph acc">{a.glyph}</span><span class="label">{t(`palette.${a.key}`)}</span>
        </button>
      {/each}
    </div>
  </section>
  {/if}

  <div class="symbols">
  <section>
    <h3>{t('tech.tapDoes')}</h3>
    <div class="mode" role="radiogroup" aria-label={t('tech.tapDoes')}>
      <button role="radio" aria-checked={tool.withNote} class:on={tool.withNote} onclick={() => onAction({ type: 'setWithNote', on: true })}>{t('tech.withNote')}</button>
      <button role="radio" aria-checked={!tool.withNote} class:on={!tool.withNote} onclick={() => onAction({ type: 'setWithNote', on: false })}>{t('tech.symbolOnly')}</button>
    </div>
    <p class="hint">{tool.withNote ? t('tech.withNoteHint') : t('tech.symbolOnlyHint')}</p>
  </section>

  <section>
    <h3>{t('palette.articulation')}</h3>
    <div class="grid">
      <button aria-label={t('palette.rest')} title={t('palette.restHint')} onclick={() => onAction({ type: 'rest' })}>
        <span class="smufl glyph">{Glyphs.rest(NoteValue.QUARTER)}</span>
        <span class="label">{t('palette.rest')}</span>
      </button>
      {#if profile.articulations.includes('accent')}
      <button class:on={tool.accent} aria-label={t('palette.accent')} onclick={() => onAction({ type: 'toggleAccent' })}>
        <span class="smufl glyph small accent">{Glyphs.ACCENT}</span>
        <span class="label">{t('palette.accent')}</span>
      </button>
      {/if}
      {#each extraArts as a}
      <button class:on={tool.arts.includes(a.id)} aria-label={t(`palette.${a.id}`)} onclick={() => onAction({ type: 'toggleArt', art: a.id })}>
        <span class="smufl glyph art">{a.glyph}</span>
        <span class="label">{t(`palette.${a.id}`)}</span>
      </button>
      {/each}
      {#if profile.articulations.includes('ghost')}
      <button class:on={tool.ghost} aria-label={t('palette.ghostLong')} onclick={() => onAction({ type: 'toggleGhost' })}>
        <span class="smufl glyph">{Glyphs.PAREN_LEFT}{Glyphs.notehead(Notehead.NORMAL, NoteValue.QUARTER)}{Glyphs.PAREN_RIGHT}</span>
        <span class="label">{t('palette.ghost')}</span>
      </button>
      {/if}
    </div>
  </section>

  {#if has('phrasing')}
  <section>
    <h3>{t('palette.phrasing')}</h3>
    <div class="grid">
      <button aria-label={t('palette.slurStart')} title={t('palette.slurHint')} onclick={() => onAction({ type: 'setSlur', kind: 'start' })}>
        <span class="glyph text small-text">⌒(</span><span class="label">{t('palette.slurStart')}</span>
      </button>
      <button aria-label={t('palette.slurEnd')} title={t('palette.slurHint')} onclick={() => onAction({ type: 'setSlur', kind: 'end' })}>
        <span class="glyph text small-text">)⌒</span><span class="label">{t('palette.slurEnd')}</span>
      </button>
      <button class:on={tool.arts.includes('breath')} aria-label={t('palette.breath')} onclick={() => onAction({ type: 'toggleArt', art: 'breath' })}>
        <span class="smufl glyph art">{Glyphs.BREATH}</span><span class="label">{t('palette.breath')}</span>
      </button>
    </div>
  </section>
  {/if}

  {#if has('chords')}
  <section class="lyrics">
    <h3>{t('palette.chords')}</h3>
    <form onsubmit={(e) => { e.preventDefault(); const f = e.currentTarget.elements.chord; onAction({ type: 'setChord', text: f.value, advance: true }); f.value = ''; f.focus(); }}>
      <input name="chord" type="text" maxlength="16" value={chord} placeholder={t('palette.chordHint')} aria-label={t('palette.chords')} autocomplete="off" autocapitalize="characters" />
      <button type="submit" aria-label={t('palette.chordApply')}>↵</button>
    </form>
    <p class="hint">{t('palette.chordHelp')}</p>
  </section>
  {/if}

  {#if has('lyrics')}
  <section class="lyrics">
    <h3>{t('palette.lyrics')}</h3>
    <form onsubmit={(e) => { e.preventDefault(); const f = e.currentTarget.elements.lyric; onAction({ type: 'setLyric', text: f.value, advance: true }); f.value = ''; f.focus(); }}>
      <input name="lyric" type="text" maxlength="24" value={lyric} placeholder={t('palette.lyricHint')} aria-label={t('palette.lyrics')} autocomplete="off" />
      <button type="submit" aria-label={t('palette.lyricApply')}>↵</button>
    </form>
    <p class="hint">{t('palette.lyricHelp')}</p>
    <form class="paste" onsubmit={(e) => { e.preventDefault(); const f = e.currentTarget.elements.verse; onAction({ type: 'pasteLyrics', text: f.value }); }}>
      <textarea name="verse" rows="3" placeholder={t('palette.pasteHint')} aria-label={t('palette.paste')}></textarea>
      <button type="submit">{t('palette.paste')}</button>
    </form>
    {#if lyricsInfo}<p class="hint">{lyricsInfo}</p>{/if}
  </section>
  {/if}

  {#if has('pedal')}
  <section>
    <h3>{t('palette.pedal')}</h3>
    <div class="grid two">
      <button aria-label={t('palette.pedDown')} title={t('palette.pedHint')} onclick={() => onAction({ type: 'setPedal', kind: 'down' })}>
        <span class="smufl glyph dyn">{Glyphs.PED}</span><span class="label">{t('palette.pedDown')}</span>
      </button>
      <button aria-label={t('palette.pedUp')} title={t('palette.pedHint')} onclick={() => onAction({ type: 'setPedal', kind: 'up' })}>
        <span class="smufl glyph dyn">{Glyphs.PED_UP}</span><span class="label">{t('palette.pedUp')}</span>
      </button>
    </div>
  </section>
  {/if}

  {#if has('dynamics')}
  <section>
    <h3>{t('palette.dynamics')}</h3>
    <div class="grid four">
      {#each ['pp', 'p', 'mp', 'mf', 'f', 'ff', 'fp', 'sfz'] as d}
        <button class:on={tool.dyn === d} aria-label={t(`palette.${d}`)} title={t('palette.dynHint')} onclick={() => onAction({ type: 'setDyn', dyn: d })}>
          <span class="smufl glyph dyn">{Glyphs.dynamic(d)}</span><span class="label">{t(`palette.${d}`)}</span>
        </button>
      {/each}
    </div>
    <div class="grid two">
      {#each ['cresc', 'dim'] as w}
        <button class:on={tool.wedge === w} aria-label={t(`palette.${w}`)} onclick={() => onAction({ type: 'setWedge', wedge: w })}>
          <span class="glyph text small-text wedge">{w === 'cresc' ? 'cresc.' : 'dim.'}</span><span class="label">{t(`palette.${w}`)}</span>
        </button>
      {/each}
    </div>
  </section>
  {/if}

  {#if profile.hands}
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
  {/if}

  {#if heads.length}
  <section>
    <h3>{t('tech.head')}</h3>
    <div class="grid">
      <button class:on={!tool.head} aria-label={t('tech.headDefault')} title={t('tech.headDefaultHint')} onclick={() => tool.head && onAction({ type: 'setHead', head: tool.head })}>
        <span class="smufl glyph head">{Glyphs.notehead(Notehead.NORMAL, q)}</span><span class="label">{t('tech.headDefault')}</span>
      </button>
      {#each heads as h}
        <button class:on={tool.head === h} aria-label={label(h)} onclick={() => onAction({ type: 'setHead', head: h })}>
          <span class="smufl glyph head">{Glyphs.notehead(h, q)}</span><span class="label">{label(h)}</span>
        </button>
      {/each}
    </div>
  </section>
  {/if}

  {#if techs.length}
  <section>
    <h3>{t('tech.technique')}</h3>
    <div class="grid">
      {#each techs as x}
        <button class:on={tool.tech === x.id} aria-label={label(x.id)} onclick={() => tech(x.id)}>
          {#if x.text}<span class="glyph text small-text wedge">{x.text}</span>{:else}<span class="smufl glyph {x.cls}">{x.glyph}</span>{/if}<span class="label">{label(x.id)}</span>
        </button>
      {/each}
    </div>
  </section>
  {/if}
  </div>
</div>

<style>
  .palette { display: flex; flex-direction: column; gap: 8px; }
  .instrument select { width: 100%; font: inherit; font-weight: 600; min-height: var(--tap); color: var(--ink); background: var(--panel); border: 2px solid var(--accent); border-radius: var(--radius); padding: 0 8px; }
  .top { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; }
  .aux { min-height: 44px; flex-direction: row; gap: 6px; justify-content: center; }
  .aux .label { font-size: 13px; font-weight: 600; }
  .small-text { font-size: 18px; height: auto; }
  .glyph.mark { font-size: 36px; align-items: center; padding-top: 14px; }
  .glyph.acc { font-size: 34px; align-items: center; height: 34px; }
  .glyph.art { font-size: 34px; align-items: center; padding-top: 6px; }
  .lyrics form { display: flex; gap: 5px; }
  .lyrics form.paste { flex-direction: column; margin-top: 6px; }
  .lyrics textarea { min-height: 70px; font: inherit; font-size: 14px; padding: 6px 8px; color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); }
  .lyrics form.paste button { flex-direction: row; font-size: 14px; }
  .lyrics input { flex: 1; min-width: 0; font: inherit; min-height: var(--tap); padding: 0 8px; color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); }
  .lyrics button { min-height: var(--tap); min-width: var(--tap); flex-direction: row; justify-content: center; }
  .glyph.dyn { font-size: 30px; align-items: center; height: 32px; }
  .wedge { font-style: italic; font-size: 15px; }
  .grid + .grid { margin-top: 5px; }
  .glyph.head { font-size: 44px; align-items: center; height: 30px; }
  .symbols { display: flex; flex-direction: column; gap: 8px; border-left: 3px solid var(--accent); padding-left: 6px; margin-left: -2px; }
  .mode button + button { border-left: 1px solid var(--line); }
  .mode { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; margin-bottom: 3px; }
  .mode.three { grid-template-columns: 1fr 1fr 1fr; }
  .switch { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; min-height: 36px; margin: 2px 0; }
  .switch input { width: 20px; height: 20px; }
  .fill .field { display: flex; flex-direction: column; gap: 2px; font-size: 11px; font-weight: 600; color: var(--muted); margin-bottom: 5px; }
  .fill select { font: inherit; font-size: 14px; font-weight: 400; min-height: 36px; color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 0 6px; }
  .fill .apply { min-height: 40px; flex-direction: row; justify-content: center; font-size: 14px; font-weight: 600; width: 100%; }
  .link { display: inline; min-height: 0; padding: 0; border: none; background: none; color: var(--accent); text-decoration: underline; font-size: 11px; }
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
