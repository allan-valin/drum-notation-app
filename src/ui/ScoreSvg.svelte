<script>
  /**
   * Paints what layoutBar returned, nothing more. Converts a tap back into
   * (beat, cell, staffPosition) and hands it up; no editing logic lives here.
   */
  import { layoutBar, yOf, staffPositionAt, legerLines } from '../core/layout.js';
  import { Glyphs, Metrics } from '../core/glyphs.js';
  import { colourFor } from '../core/colours.js';

  let {
    bar,
    staff,
    width = 800,
    staffSpacing = 20,
    focusedBeat = null,
    focusedCell = null,
    colours = undefined,
    showClef = true,
    timeSig = null,
    showGuides = false,
    onTap = null,
    deleteMode = false,
    /** fixed vertical range in staff spaces (above the top line, below it), so bars in a row share a baseline */
    fixedRange = null,
  } = $props();

  const sp = $derived(staffSpacing);
  const lead = $derived(showClef ? (timeSig ? 5.5 : 3) * sp : 0.5 * sp);
  const barWidth = $derived(Math.max(width - lead - 0.5 * sp, 10 * sp));
  const layout = $derived(layoutBar(bar, staff, { width: barWidth, staffSpacing: sp, focusedBeat }));
  const guideTop = $derived(yOf(staff.slots[staff.slots.length - 1].staffPosition, sp) - 1.5 * sp);
  const guideBottom = $derived(yOf(staff.slots[0].staffPosition, sp) + 2.5 * sp);
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
    const beatIndex = layout.beatBounds.findIndex(([a, b]) => x >= a && x < b);
    if (beatIndex < 0) return;
    const [a, b] = layout.beatBounds[beatIndex];
    const cells = bar.beats[beatIndex].cells.length;
    const cellIndex = Math.min(cells - 1, Math.max(0, Math.floor(((x - a) / (b - a)) * cells)));
    onTap({ beat: beatIndex, cell: cellIndex, staffPosition: staffPositionAt(p.y, sp) });
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
  aria-label="Compasso"
>
  {#if focusedBeat !== null && layout.beatBounds[focusedBeat]}
    {@const [a, b] = layout.beatBounds[focusedBeat]}
    <rect class="focus" x={lead + a} y={top} width={b - a} height={height} />
    {#if focusedCell !== null}
      {@const cells = bar.beats[focusedBeat].cells.length}
      {@const cw = (b - a) / cells}
      <rect class="cell" x={lead + a + cw * focusedCell} y={top} width={cw} height={height} />
    {/if}
  {/if}

  {#if showGuides && focusedBeat !== null && layout.beatBounds[focusedBeat]}
    {@const [a, b] = layout.beatBounds[focusedBeat]}
    {#each staff.slots as slot, i}
      {@const y = yOf(slot.staffPosition, sp)}
      <line class="guide" x1={lead + a} x2={lead + b} y1={y} y2={y} />
      <!-- two staggered columns so names one half-step apart do not collide -->
      <text class="guide-label" x={lead + a + 0.2 * sp + (i % 2) * 3.4 * sp} y={y + 0.25 * sp} font-size={0.7 * sp}>{slot.name}</text>
    {/each}
  {/if}

  {#each [0, 1, 2, 3, 4] as i}
    <line class="staffline" x1="0" x2={width} y1={i * sp} y2={i * sp} stroke-width={Metrics.staffLineThickness * sp} />
  {/each}

  {#if showClef}
    <text class="smufl ink" x={0.6 * sp} y={2 * sp} font-size={fontSize}>{Glyphs.PERCUSSION_CLEF}</text>
    {#if timeSig}
      <text class="smufl ink" x={3.2 * sp} y={sp} font-size={fontSize}>{Glyphs.timeSigDigit(timeSig[0])}</text>
      <text class="smufl ink" x={3.2 * sp} y={3 * sp} font-size={fontSize}>{Glyphs.timeSigDigit(timeSig[1])}</text>
    {/if}
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
    {#each layout.texts as t}
      <text class="sticking" x={t.x} y={t.y} font-size={1.1 * sp} text-anchor="middle" opacity={dim(t.beat)}>{t.text}</text>
    {/each}
  </g>
</svg>

<style>
  .score { display: block; touch-action: manipulation; user-select: none; -webkit-user-select: none; color: var(--ink); }
  .score.delete { cursor: not-allowed; }
  .staffline, .leger { stroke: var(--ink); }
  .focus { fill: var(--focus); }
  .cell { fill: var(--focus-ring); fill-opacity: 0.22; }
  .guide { stroke: var(--focus-ring); stroke-opacity: 0.35; stroke-dasharray: 2 3; }
  .guide-label { fill: var(--muted); font-family: system-ui, sans-serif; pointer-events: none; }
  .ink { fill: var(--ink); }
  .sticking { fill: var(--ink); font-family: system-ui, sans-serif; font-weight: 600; }
  text { pointer-events: none; }
</style>
