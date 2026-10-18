<script>
  /** The whole score, laid out like the printed page; the current bar framed, a tap opens a bar. */
  import ScoreSvg from './ScoreSvg.svelte';
  import { t } from '../app/prefs.svelte.js';
  import { barTimeSig, showsTimeSig, barKey, showsKey } from '../core/score.js';
  import { createDrag } from '../app/lib/drag.js';

  import { partView } from '../core/parts.js';
  import { profileById } from '../core/profile.js';

  let { full, parts = [], part = null, colours, current, onOpen, range = null, playingBar = null, selecting = false, onDrop = () => {} } = $props();
  /** One view per part, drawn as one staff each inside every bar frame, in band order. */
  const views = $derived(full.parts.map((p) => ({ id: p.id, muted: p.muted, view: partView(full, p.id), staff: profileById(p.instrument).staves[0], label: parts.find((x) => x.id === p.id)?.label ?? p.instrument })));
  const score = $derived(views[0].view);
  const many = $derived(views.length > 1);

  // ---- drag (casus caret-preview): nothing moves while aiming; a caret marks the gap ----
  let pool;
  let frames = [];
  const drag = createDrag({ threshold: 6, holdMs: 220, rects: () => frames.filter(Boolean).map((el) => el.getBoundingClientRect()) });
  let caret = $state(null);
  let ghost = $state(null);
  let lifting = $state(null);
  let pointerId = null;
  let holdTimer = null;
  let swallowClick = false;
  const block = (i) => (range && i >= range[0] && i <= range[1] ? range : [i, i]);

  function sync(r) {
    if (!r.dragging) { lifting = null; caret = null; ghost = null; return; }
    if (lifting === null) { try { pool.setPointerCapture(pointerId); } catch { /* jsdom */ } }
    lifting = r.item;
    const p = pool.getBoundingClientRect();
    caret = r.caret ? { x: r.caret.x - p.left, y: r.caret.y - p.top, height: r.caret.height } : null;
    const [a, b] = block(r.item);
    ghost = { x: drag.state.x, y: drag.state.y, label: a === b ? `${a + 1}` : `${a + 1}–${b + 1}` };
  }
  function down(e, i) {
    if (!selecting) return;
    drag.down({ item: i, x: e.clientX, y: e.clientY, pointerType: e.pointerType, at: e.timeStamp });
    pointerId = e.pointerId;
    clearTimeout(holdTimer);
    if (e.pointerType === 'touch') holdTimer = setTimeout(() => sync(drag.hold({ at: globalThis.performance.now() })), 230);
  }
  function move(e) {
    if (drag.state.item === null) return;
    sync(drag.move({ x: e.clientX, y: e.clientY, at: e.timeStamp }));
  }
  function up(e) {
    clearTimeout(holdTimer);
    if (drag.state.item === null) return;
    const r = drag.up({ x: e.clientX, y: e.clientY });
    sync({ dragging: false });
    if (r) {
      swallowClick = true;
      const [a, b] = block(r.item);
      onDrop(a, b, r.gap);
    }
  }
  function cancel() { clearTimeout(holdTimer); drag.cancel(); sync({ dragging: false }); }
  function click(i) {
    if (swallowClick) { swallowClick = false; return; }
    onOpen(i);
  }
  $effect(() => {
    const stopScroll = (e) => { if (drag.state.dragging) e.preventDefault(); };
    const esc = (e) => { if (e.key === 'Escape' && drag.state.item !== null) cancel(); };
    window.addEventListener('touchmove', stopScroll, { passive: false });
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('touchmove', stopScroll); window.removeEventListener('keydown', esc); };
  });
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

<section class="full no-print" class:selecting class:dragging={lifting !== null} bind:clientWidth={width} bind:this={pool} aria-label={t('editor.wholeScore')}
  onpointermove={move} onpointerup={up} onpointercancel={cancel}>
  <h2>{t('editor.wholeScore')}</h2>
  {#each rows as row}
    <div class="row" style="grid-template-columns: repeat({perRow}, 1fr)">
      {#each row as i}
        <button bind:this={frames[i]} class="frame" class:current={i === current} class:flash={i === flash} class:inrange={range && i >= range[0] && i <= range[1]} class:playing={i === playingBar} class:lifted={lifting !== null && i >= block(lifting)[0] && i <= block(lifting)[1]} onpointerdown={(e) => down(e, i)} onclick={() => click(i)} aria-label={t('editor.goToBar', { n: i + 1 })} aria-current={i === current}>
          <span class="n">{i + 1}</span>
          {#each views as v (v.id)}
            <div class="staff" class:active={many && v.id === part} class:mutedpart={v.muted}>
              {#if many && i % perRow === 0}<span class="plabel">{v.label}</span>{/if}
              <ScoreSvg bar={v.view.bars[i]} staff={v.staff} width={barW - 4} staffSpacing={sp} showClef={i % perRow === 0} timeSig={showsTimeSig(score, i) ? barTimeSig(score, i) : null} keyFifths={barKey(score, i)} showKey={i % perRow === 0 || showsKey(score, i)} {colours} fixedRange={many ? [6.5, 6.5] : [8.5, 6]} />
            </div>
          {/each}
        </button>
      {/each}
    </div>
  {/each}
  {#if caret}<div class="caret" style:left="{caret.x}px" style:top="{caret.y}px" style:height="{caret.height}px" aria-hidden="true"></div>{/if}
  {#if ghost}<div class="ghost" style:left="{ghost.x}px" style:top="{ghost.y}px" aria-hidden="true">{ghost.label}</div>{/if}
</section>

<style>
  .full { display: flex; flex-direction: column; gap: 6px; position: relative; }
  .full.selecting .frame { cursor: grab; touch-action: pan-y; }
  .full.dragging, .full.dragging .frame { cursor: grabbing; }
  .frame.lifted { opacity: 0.4; }
  .caret { position: absolute; width: 4px; margin-left: -2px; background: var(--accent); border-radius: 2px; box-shadow: 0 0 0 2px var(--panel); pointer-events: none; z-index: 5; }
  .ghost { position: fixed; z-index: 60; transform: translate(-50%, -50%) rotate(-2deg); pointer-events: none; padding: 8px 14px; border-radius: var(--radius); background: var(--accent); color: var(--accent-ink); font-weight: 700; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.3); }
  h2 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin: 4px 0 0; }
  .row { display: grid; gap: 8px; }
  .frame { position: relative; display: block; padding: 0; min-height: 0; background: var(--panel); border: 1px solid var(--line); overflow: hidden; }
  .frame.current { border: 2.5px solid var(--focus-ring); background: var(--focus); }
  .frame.inrange { outline: 3px dashed #1f8f4e; outline-offset: -3px; }
  .frame.playing { border: 2.5px solid #1f8f4e; box-shadow: 0 0 0 3px color-mix(in srgb, #1f8f4e 35%, transparent); }
  .frame.flash { animation: flash 0.9s ease-out; }
  @keyframes flash { 0% { box-shadow: 0 0 0 6px var(--focus-ring); } 100% { box-shadow: 0 0 0 0 transparent; } }
  .staff { position: relative; }
  .staff + .staff { border-top: 1px dashed var(--line); }
  .staff.active { background: color-mix(in srgb, var(--accent) 7%, transparent); }
  .staff.mutedpart { opacity: 0.45; }
  .plabel { position: absolute; top: 2px; left: 22px; font-size: 11px; color: var(--muted); font-weight: 600; z-index: 1; }
  .n { position: absolute; top: 4px; left: 6px; font-size: 12px; color: var(--muted); }
  .frame :global(svg) { width: 100%; height: auto; }
</style>
