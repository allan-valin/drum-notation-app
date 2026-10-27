<script>
  /**
   * Paints what layoutBar returned, nothing more. Converts a tap back into
   * (beat, cell, staffPosition) and hands it up; no editing logic lives here.
   */
  import { layoutBar, yOf, staffPositionAt, legerLines } from '../core/layout.js';
  import { Glyphs, Metrics } from '../core/glyphs.js';
  import { colourFor } from '../core/colours.js';
  import { t, prefs } from '../app/prefs.svelte.js';
  import { noteName } from '../app/noteName.js';
  import { STRINGS } from '../app/strings.js';
  const slotLabel = (id) => noteName(id, 0, prefs.lang, STRINGS[prefs.lang].noteNames);
  import { samePath } from '../core/tree.js';
  import { prettyChord } from '../core/chords.js';
  import { getAt } from '../core/tree.js';
  const leafOf = (l) => getAt(bar.beats[l.beat], l.path);
  import { CLEFS, keyAccidentals, staffPositionOf } from '../core/pitch.js';

  let {
    bar,
    staff,
    width = 800,
    staffSpacing = 20,
    focusedBeat = null,
    focusedPath = null,
    colours = undefined,
    showClef = true,
    timeSig = null,
    showGuides = false,
    onTap = null,
    deleteMode = false,
    /** fixed vertical range in staff spaces (above the top line, below it), so bars in a row share a baseline */
    fixedRange = null,
    /** editor mode: every beat drawn as a card you can tap, the focused one highlighted */
    cards = false,
    /** key signature in force (fifths): drives accidentals; drawn after the clef when `showKey` */
    keyFifths = 0,
    /** the bar's beat unit, and the notes a tie brings in from the previous bar */
    den = 4,
    carry = [],
    tieOut = false,
    /** voices: dynamics above the staff; a slur may come in from the previous bar */
    dynamicsAbove = false,
    slurIn = false,
    /** voices: a text box under each note for its syllable; called with { beat, path, text } */
    onLyric = null,
    showKey = true,
    /** highlight for a whole bar, e.g. the bar being played */
    playingPath = null,
  } = $props();

  const sp = $derived(staffSpacing);
  const clef = $derived(CLEFS[staff.clef ?? 'percussion']);
  const keySigns = $derived(staff.pitched && showKey ? keyAccidentals(keyFifths, staff.clef) : []);
  const keyWidth = $derived(keySigns.length ? keySigns.length * 1.0 + 0.6 : 0);
  const lead = $derived((showClef ? 3 : 0.5) * sp + keyWidth * sp + (timeSig ? 2.5 * sp : 0));
  const barWidth = $derived(Math.max(width - lead - 0.5 * sp, 10 * sp));
  const layout = $derived(layoutBar(bar, staff, { width: barWidth, staffSpacing: sp, focusedBeat, key: keyFifths, den, carry, tieOut, dynamicsAbove, slurIn }));
  // pitched ranges can be wide: guides cover the staff and three ledger lines each side
  const guideSlots = $derived(staff.pitched ? staff.slots.filter((x) => x.staffPosition >= -6 && x.staffPosition <= 14) : staff.slots);
  /** Drum guides: one row per height, naming every instrument written there ("China / Splash / Cowbell"). */
  const guideRows = $derived([...new Set(guideSlots.map((x) => x.staffPosition))].map((p) => ({ p, ids: guideSlots.filter((x) => x.staffPosition === p).map((x) => x.id) })));
  const guideTop = $derived(yOf(guideSlots[guideSlots.length - 1].staffPosition, sp) - 1.5 * sp);
  const guideBottom = $derived(yOf(guideSlots[0].staffPosition, sp) + 2.5 * sp);
  const top = $derived(fixedRange ? -fixedRange[0] * sp : Math.min(layout.top, showGuides ? guideTop : layout.top) - 0.5 * sp);
  const bottom = $derived(fixedRange ? fixedRange[1] * sp : Math.max(layout.bottom, showGuides ? guideBottom : layout.bottom) + 0.5 * sp);
  const height = $derived(bottom - top);
  const fontSize = $derived(4 * sp);
  const colourOf = (value) => colourFor(value, colours);
  const dim = (beatIndex) => (focusedBeat === null || beatIndex === focusedBeat ? 1 : 0.38);

  let svg;
  function tap(e) {
    if (!onTap || !svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const x = p.x - lead;
    const hit = layout.leaves.find((l) => x >= l.x0 && x < l.x1)
      ?? (x < 0 ? layout.leaves[0] : layout.leaves[layout.leaves.length - 1]);
    if (!hit) return;
    onTap({ beat: hit.beat, path: hit.path, staffPosition: staffPositionAt(p.y, sp) });
  }
</script>

<svg
  bind:this={svg}
  class="score"
  class:delete={deleteMode}
  viewBox="0 {top} {width} {height}"
  {width}
  {height}
  onpointerdown={tap}
  role={onTap ? 'button' : 'img'}
  aria-label={t('editor.barAria')}
>
  {#if cards}
    {#each layout.beatBounds as [a, b], bi}
      <rect class="card" class:alt={bi % 2 === 1} class:focused={bi === focusedBeat} x={lead + a + 0.12 * sp} y={top + 0.12 * sp} width={b - a - 0.24 * sp} height={height - 0.24 * sp} rx={0.35 * sp} />
    {/each}
    {#if focusedBeat !== null}
      {#each layout.leaves.filter((l) => l.beat === focusedBeat).slice(1) as l}
        <line class="divider" x1={lead + l.x0} x2={lead + l.x0} y1={top + 0.6 * sp} y2={bottom - 0.6 * sp} />
      {/each}
    {/if}
  {/if}
  {#if focusedBeat !== null && layout.beatBounds[focusedBeat]}
    {@const [a, b] = layout.beatBounds[focusedBeat]}
    {#if !cards}<rect class="focus" x={lead + a} y={top} width={b - a} height={height} />{/if}
    {#if focusedPath}
      {#each layout.leaves.filter((l) => l.beat === focusedBeat && samePath(l.path, focusedPath)) as l}
        <rect class="cell" x={lead + l.x0} y={top} width={l.x1 - l.x0} height={height} />
      {/each}
    {/if}
  {/if}

  {#if showGuides && focusedBeat !== null && layout.beatBounds[focusedBeat]}
    {@const [a, b] = layout.beatBounds[focusedBeat]}
    {#each guideSlots as slot, i}
      {@const y = yOf(slot.staffPosition, sp)}
      {#if staff.pitched}
        <!-- pitched: a name on each line (and middle C), the spaces between are the other notes -->
        {#if slot.staffPosition % 2 === 0}
          <line class="guide" x1={lead + a} x2={lead + b} y1={y} y2={y} />
          <text class="guide-label" x={lead + a + 0.2 * sp} y={y - 0.2 * sp} font-size={0.7 * sp}>{slotLabel(slot.id)}</text>
        {/if}
      {/if}
    {/each}
    {#if !staff.pitched}
      {#each guideRows as row, i}
        {@const y = yOf(row.p, sp)}
        <line class="guide" x1={lead + a} x2={lead + b} y1={y} y2={y} />
        <!-- two staggered columns so names one half-step apart do not collide -->
        <text class="guide-label" x={lead + a + 0.2 * sp + (i % 2) * 3.4 * sp} y={y + 0.25 * sp} font-size={0.7 * sp}>{row.ids.map((id) => t(`slot.${id}`)).join(' / ')}</text>
      {/each}
    {/if}
  {/if}

  {#each [0, 1, 2, 3, 4] as i}
    <line class="staffline" x1="0" x2={width} y1={i * sp} y2={i * sp} stroke-width={Metrics.staffLineThickness * sp} />
  {/each}

  {#if showClef}
    <text class="smufl ink" x={0.6 * sp} y={yOf(clef.glyphPosition, sp)} font-size={fontSize}>{clef.glyph}</text>
  {/if}
  {#each keySigns as k, j}
    <text class="smufl ink" x={(showClef ? 3.2 : 0.4) * sp + j * 1.0 * sp} y={yOf(staffPositionOf(k.slot, staff.clef), sp)} font-size={fontSize}>{Glyphs.accidental(k.alter)}</text>
  {/each}
  {#if timeSig}
    {@const tx = (showClef ? 3.2 : 0.4) * sp + keyWidth * sp}
    {#each String(timeSig[0]).split('') as d, j}<text class="smufl ink" x={tx + j * 1.6 * sp} y={sp} font-size={fontSize}>{Glyphs.timeSigDigit(Number(d))}</text>{/each}
    {#each String(timeSig[1]).split('') as d, j}<text class="smufl ink" x={tx + j * 1.6 * sp} y={3 * sp} font-size={fontSize}>{Glyphs.timeSigDigit(Number(d))}</text>{/each}
  {/if}

  <g transform="translate({lead} 0)">
    {#each layout.glyphs as g}
      {#if g.kind === 'note'}
        {#each legerLines(g.staffPosition) as p}
          <line class="leger" x1={g.x - Metrics.legerLineExtension * sp} x2={g.x + (Metrics.noteheadWidth + Metrics.legerLineExtension) * sp} y1={yOf(p, sp)} y2={yOf(p, sp)} stroke-width={Metrics.staffLineThickness * sp} opacity={dim(g.beat)} />
        {/each}
      {/if}
    {/each}

    {#each layout.stems as s}
      <line x1={s.x} x2={s.x} y1={s.y1} y2={s.y2} stroke={colourOf(bar.beats[s.beat].division)} stroke-width={Metrics.stemThickness * sp} opacity={dim(s.beat)} />
    {/each}
    {#each layout.beams as b}
      <rect x={b.x1} y={b.y1} width={b.x2 - b.x1} height={Metrics.beamThickness * sp} fill={colourOf(bar.beats[b.beat].division)} opacity={dim(b.beat)} />
    {/each}
    {#each layout.glyphs as g}
      <text
        class="smufl"
        class:rest={g.kind === 'rest'}
        class:ink={g.kind === 'barline' || g.kind === 'tuplet'}
        x={g.x}
        y={g.y}
        font-size={fontSize}
        fill={g.kind === 'rest' ? 'var(--muted)' : g.value ? colourOf(g.value) : 'currentColor'}
        opacity={g.beat === undefined ? 1 : dim(g.beat)}
      >{g.glyph}</text>
    {/each}
    {#each layout.ties as tie}
      {@const off = (tie.below ? 0.55 : -0.55) * sp}
      {@const bow = (tie.below ? 1 : -1) * Math.min(1.2 * sp, Math.max(0.5 * sp, (tie.x2 - tie.x1) * 0.15))}
      <path class="tie" d="M {tie.x1} {tie.y + off} Q {(tie.x1 + tie.x2) / 2} {tie.y + off + bow} {tie.x2} {tie.y + off}" stroke-width={0.16 * sp} />
    {/each}
    {#each layout.slurs as sl}
      {@const bow = (sl.below ? 1 : -1) * Math.min(2.2 * sp, Math.max(0.8 * sp, (sl.x2 - sl.x1) * 0.12))}
      {@const mx = (sl.x1 + sl.x2) / 2}
      {@const my = (sl.y1 + sl.y2) / 2 + bow}
      <!-- a slur is thicker in the middle: two curves, filled between -->
      <path class="slur" d="M {sl.x1} {sl.y1} Q {mx} {my} {sl.x2} {sl.y2} Q {mx} {my - (sl.below ? 0.22 : -0.22) * sp} {sl.x1} {sl.y1} Z" />
    {/each}
    {#each layout.texts as tx}
      {#if tx.kind === 'chord'}
        <text class="chord" x={tx.x} y={tx.y} font-size={1.5 * sp}>{prettyChord(tx.text)}</text>
      {:else if tx.kind === 'lyric' || tx.kind === 'hyphen'}
        <text class="lyric" x={tx.x} y={tx.y} font-size={1.25 * sp} text-anchor="middle">{tx.text}</text>
      {:else if tx.kind === 'wedge'}
        <text class="wedge" x={tx.x} y={tx.y} font-size={1.1 * sp}>{tx.text}</text>
      {:else if tx.kind === 'barText'}
        <text class="bartext" x={tx.x} y={tx.y} font-size={1.2 * sp}>{tx.text}</text>
      {:else}
        <text class="sticking" x={tx.x} y={tx.y} font-size={1.1 * sp} text-anchor="middle" opacity={dim(tx.beat)}>{tx.text}</text>
      {/if}
    {/each}
  </g>
</svg>
{#if onLyric}
  <!-- one box per note (held cells take no syllable), aligned under its cell -->
  <div class="lyricrow" style="width: {width}px">
    {#each layout.leaves as l (l.beat + ':' + l.path.join('.'))}
      {@const cell = leafOf(l)}
      {#if cell && cell.notes.length && !cell.cont}
        <input type="text" class="lyricbox" maxlength="24" value={cell.lyric ?? ''} aria-label={t('palette.lyrics') + ` ${l.beat + 1}.${l.path.map((x) => x + 1).join('.')}`}
          style="left: {lead + l.x0 + 1}px; width: {Math.max(28, l.x1 - l.x0 - 2)}px"
          onchange={(e) => onLyric({ beat: l.beat, path: l.path, text: e.target.value })} />
      {/if}
    {/each}
  </div>
{/if}

<style>
  .score { display: block; touch-action: manipulation; user-select: none; -webkit-user-select: none; color: var(--ink); }
  .score.delete { cursor: not-allowed; }
  .staffline, .leger { stroke: var(--ink); }
  .tie { fill: none; stroke: var(--ink); stroke-linecap: round; }
  .focus { fill: var(--focus); }
  .card { fill: var(--card-a); stroke: var(--card-line); stroke-width: 1; }
  .card.alt { fill: var(--card-b); }
  .card.focused { fill: var(--focus); stroke: var(--focus-ring); stroke-width: 2.5; }
  .divider { stroke: var(--focus-ring); stroke-opacity: 0.45; stroke-dasharray: 3 3; }
  .cell { fill: var(--focus-ring); fill-opacity: 0.28; }
  .guide { stroke: var(--focus-ring); stroke-opacity: 0.35; stroke-dasharray: 2 3; }
  .guide-label { fill: var(--muted); font-family: system-ui, sans-serif; pointer-events: none; }
  .ink { fill: var(--ink); }
  .lyricrow { position: relative; height: 34px; }
  .lyricbox { position: absolute; top: 2px; height: 28px; font: inherit; font-size: 14px; text-align: center; padding: 0 2px; color: var(--ink); background: var(--panel); border: 1px solid var(--line); border-radius: 6px; }
  .chord { fill: var(--ink); font-family: system-ui, sans-serif; font-weight: 700; }
  .slur { fill: var(--ink); stroke: var(--ink); stroke-width: 0.6; }
  .lyric { fill: var(--ink); font-family: system-ui, sans-serif; }
  .wedge { fill: var(--ink); font-family: Georgia, 'Times New Roman', serif; font-style: italic; }
  .bartext { fill: var(--ink); font-family: system-ui, sans-serif; font-style: italic; }
  .sticking { fill: var(--ink); font-family: system-ui, sans-serif; font-weight: 600; }
  text { pointer-events: none; }
</style>
