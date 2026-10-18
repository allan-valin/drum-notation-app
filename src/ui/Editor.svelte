<script>
  import ScoreSvg from './ScoreSvg.svelte';
  import Palette from './Palette.svelte';
  import BarRow from './BarRow.svelte';
  import FullScore from './FullScore.svelte';
  import Prefs from './Prefs.svelte';
  import Legend from './Legend.svelte';
  import Help from './Help.svelte';
  import Transport from './Transport.svelte';
  import { initialState, reduce } from '../core/editorState.js';
  import { profileById } from '../core/profile.js';
  import { DEFAULT_COLOURS, INK, normaliseColours, overridesOnly } from '../core/colours.js';
  import { cursor as mkCursor, leafAt, posLabel } from '../core/cursor.js';
  import { NOTE_VALUES } from '../core/noteValue.js';
  import { newScore, barTimeSig } from '../core/score.js';
  import { t } from '../app/prefs.svelte.js';

  /** `background`: drawn behind the welcome overlay, inert, nothing saved. */
  let { store, id, onBack, onPrint, fallback = null, background = false } = $props();

  const loaded = store.load(id) ?? fallback;
  let st = $state.raw(initialState(loaded ?? newScore({ id, title: t('app.untitled') })));
  let status = $state(loaded ? t('status.opened', { title: loaded.title || t('app.untitled') }) : t('status.newScore'));
  let savedAt = $state('');
  let width = $state(360);
  let height = $state(640);
  const landscape = $derived(width >= 640 && width > height);
  let colours = $state(normaliseColours(store.loadSettings().colours));
  let overlay = $state(null);
  // play mode: while playing, editing is locked and the big editor follows the playhead
  let playing = $state(false);
  let playhead = $state(null);
  let playMode = $state('bar');
  let range = $state(null);
  if (!background && loaded) store.saveSettings({ ...store.loadSettings(), lastId: id });

  const staff = $derived(profileById(st.score.profileId).staves[0]);
  const shownBar = $derived(playing && playhead ? playhead.bar : st.cursor.bar);
  const bar = $derived(st.score.bars[shownBar]);
  const slotName = (sid) => t(`slot.${sid}`);
  const pos = () => `${st.cursor.bar + 1}.${posLabel(st.cursor)}`;

  function dispatch(action) {
    if (background) return;
    if (playing) { status = t('play.editLocked'); return; }
    const before = st;
    st = reduce(st, action);
    status = st.refused ? t(`refused.${st.refused}`) : describe(action, before, st);
    if (st.score !== before.score) {
      store.save(st.score);
      store.saveSettings({ ...store.loadSettings(), lastId: st.score.id });
      savedAt = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }

  function describe(a, before, after) {
    const notes = leafAt(after.score, after.cursor).notes.map((n) => slotName(n.slotId)).join(' + ') || t('status.empty');
    const p = pos();
    const n = after.cursor.bar + 1;
    const b = after.score.bars[after.cursor.bar];
    switch (a.type) {
      case 'tap': case 'tapAt':
        if (after.score === before.score) return t('status.nothingToDelete', { pos: p });
        return before.tool.delete ? t('status.deleted', { pos: p, notes }) : t('status.placed', { pos: p, notes });
      case 'selectValue': case 'selectTuplet':
        if (before.tool.splitMode === 'cell') return t('status.splitCell', { pos: `${before.cursor.bar + 1}.${posLabel(before.cursor)}`, value: t(`valuePlural.${after.tool.value.id}`) });
        if (a.type === 'selectTuplet') return after.tool.tuplet ? t('status.tupletOn', { n: after.tool.tuplet }) : t('status.tupletOff');
        return t('status.split', { pos: `${n}.${after.cursor.beat + 1}`, value: t(`valuePlural.${a.value.id}`) });
      case 'setSplitMode': return t('status.mode', { mode: t(`split.${after.tool.splitMode}`) }) + ' · ' + (after.tool.splitMode === 'cell' ? t('split.hintCell') : t('split.hintBeat'));
      case 'merge': return t('status.merged', { pos: p });
      case 'rest': return t('status.rest', { pos: p });
      case 'next': case 'prev':
        if (after.cursor === before.cursor) return a.type === 'next' ? t('status.end') : t('status.start');
        return t('status.position', { pos: p, notes });
      case 'goTo':
        return after.cursor.bar !== before.cursor.bar ? t('status.barOpened', { n }) : t('status.position', { pos: p, notes });
      case 'toggleDelete': return after.tool.delete ? t('status.deleteOn') : t('status.deleteOff');
      case 'toggleAccent': return after.tool.accent ? t('status.accentOn') : t('status.accentOff');
      case 'toggleGhost': return after.tool.ghost ? t('status.ghostOn') : t('status.ghostOff');
      case 'setSticking': return after.tool.sticking ? t('status.hand', { hand: after.tool.sticking }) : t('status.noHand');
      case 'addBar': return t('status.barAdded', { n: after.score.bars.length });
      case 'removeBar': return t('status.barRemoved', { n: after.score.bars.length });
      case 'setTimeSig': {
        const sig = barTimeSig(after.score, after.cursor.bar).join('/');
        return a.sig ? t('status.timeSigSet', { n, sig }) : t('status.timeSigInherit', { n, sig });
      }
      case 'toggleSimile': return b.simile ? t('status.simileOn', { n }) : t('status.simileOff', { n });
      case 'toggleRepeatStart': return b.repeatStart ? t('status.repeatStartOn', { n }) : t('status.repeatStartOff', { n });
      case 'toggleRepeatEnd': return b.repeatEnd ? t('status.repeatEndOn', { n }) : t('status.repeatEndOff', { n });
      case 'undo': return after.score === before.score ? t('status.nothingToUndo') : t('status.undone');
      case 'setHead': return after.tool.head ? t('status.techOn', { what: t(`tech.${after.tool.head}`) }) : t('status.techOff', { what: t(`tech.${before.tool.head}`) });
      case 'setMark': return after.tool.mark ? t('status.techOn', { what: t(`tech.${after.tool.mark}`) }) : t('status.techOff', { what: t(`tech.${before.tool.mark}`) });
      case 'setRoll': return after.tool.roll ? t('status.techOn', { what: t(`tech.${after.tool.roll}`) }) : t('status.techOff', { what: t(`tech.${before.tool.roll}`) });
      case 'setGrace': return after.tool.grace ? t('status.techOn', { what: t(`tech.${after.tool.grace}`) }) : t('status.techOff', { what: t(`tech.${before.tool.grace}`) });
      case 'setBarText': return b.text ? t('status.barTextSet', { n, text: b.text }) : t('status.barTextCleared', { n });
      case 'setTitle': return t('status.titleSet');
      case 'setBpm': return t('status.bpmSet', { bpm: after.score.defaultBpm });
      default: return status;
    }
  }

  /** A tap on the full score: in selection mode it marks the range to play, otherwise it opens the bar. */
  function openBar(i) {
    if (playMode === 'selection' && !playing) {
      range = !range || range[0] !== range[1] ? [i, i] : [Math.min(range[0], i), Math.max(range[0], i)];
      status = t('play.selected', { from: range[0] + 1, to: range[1] + 1 });
      return;
    }
    dispatch({ type: 'goTo', cursor: mkCursor(i, 0, 0) });
  }

  function setColour(valueId, colour) {
    colours = { ...colours, [valueId]: colour };
    store.saveSettings({ ...store.loadSettings(), colours: overridesOnly(colours) });
    status = colour === DEFAULT_COLOURS[valueId]
      ? t('status.colourReset', { value: t(`value.${valueId}`) })
      : t('status.colourSet', { value: t(`value.${valueId}`) });
  }

  function onKey(e) {
    if (background || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'ArrowRight') dispatch({ type: 'next' });
    else if (e.key === 'ArrowLeft') dispatch({ type: 'prev' });
    else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) dispatch({ type: 'undo' });
  }

  // staff spacing: big enough to tap, small enough that stage + controls fit a phone held sideways
  const sp = $derived(Math.max(12, Math.min(22, width / 36, (height - (landscape ? 150 : 300)) / 15)));
  const stageWidth = $derived(Math.max(300, width - (landscape ? 230 : 0) - 16));
</script>

<svelte:window onkeydown={onKey} bind:innerHeight={height} />

<div class="editor" bind:clientWidth={width}>
  <header class="no-print">
    <button onclick={onBack} aria-label={t('editor.backLong')}>‹ {t('editor.back')}</button>
    <input type="text" value={st.score.title} placeholder={t('editor.titleField')} aria-label={t('editor.titleField')} onchange={(e) => dispatch({ type: 'setTitle', title: e.target.value })} />
    <label class="bpm">{t('editor.bpm')} <input type="number" min="20" max="300" value={st.score.defaultBpm} onchange={(e) => dispatch({ type: 'setBpm', bpm: Number(e.target.value) || 80 })} /></label>
    <button onclick={onPrint} aria-label={t('editor.pdfLong')}>{t('editor.pdf')}</button>
    <Prefs onChange={(msg) => (status = msg)} />
  </header>

  <div class="body">
    <aside class="palette-area no-print" class:locked={playing} inert={playing}>
      <Palette tool={st.tool} canUndo={st.history.length > 0} canMerge={st.cursor.path.length > 1} onAction={dispatch} onLegend={() => (overlay = 'legend')} onHelp={() => (overlay = 'help')} />
    </aside>

      <div class="stage">
        <ScoreSvg
          {bar}
          {staff}
          width={stageWidth}
          staffSpacing={sp}
          focusedBeat={playing ? (playhead?.beat ?? null) : st.cursor.beat}
          focusedPath={playing ? (playhead?.path ?? null) : st.cursor.path}
          {colours}
          timeSig={barTimeSig(st.score, shownBar)}
          showGuides={true}
          cards={true}
          deleteMode={st.tool.delete}
          onTap={({ beat, path, staffPosition }) => dispatch({ type: 'tapAt', beat, path, staffPosition })}
        />
      </div>

      <div class="move no-print">
        <button onclick={() => dispatch({ type: 'goTo', cursor: mkCursor(st.cursor.bar - 1, 0, 0) })} disabled={st.cursor.bar === 0} aria-label={t('editor.prevBar')} title={t('editor.prevBar')}>«</button>
        <button class="big" onclick={() => dispatch({ type: 'prev' })} aria-label={t('editor.prevPos')}>‹</button>
        <div class="status" aria-live="polite">
          <div class="where">{t('editor.where', { bar: st.cursor.bar + 1, total: st.score.bars.length, beat: posLabel(st.cursor) })}</div>
          <div>{status}</div>
          <div class="saved">{savedAt ? t('editor.saved', { time: savedAt }) : t('editor.notSaved')}</div>
        </div>
        <button class="big" onclick={() => dispatch({ type: 'next' })} aria-label={t('editor.nextPos')}>›</button>
        <button onclick={() => dispatch({ type: 'goTo', cursor: mkCursor(st.cursor.bar + 1, 0, 0) })} disabled={st.cursor.bar >= st.score.bars.length - 1} aria-label={t('editor.nextBar')} title={t('editor.nextBar')}>»</button>
      </div>

      <div class="bars-area"><BarRow score={st.score} barIndex={st.cursor.bar} onAction={dispatch} /></div>

      <div class="transport-area"><Transport score={st.score} currentBar={st.cursor.bar} {range} {store} bind:mode={playMode}
        onPlayhead={(p) => (playhead = p)} onPlaying={(on) => { playing = on; if (!on) playhead = null; }} onStatus={(m) => (status = m)} /></div>

      <div class="full-area"><FullScore {range} playingBar={playing ? playhead?.bar : null} score={st.score} {staff} {colours} current={st.cursor.bar} onOpen={openBar} /></div>

      <details class="colours no-print">
        <summary>{t('editor.colours')}</summary>
        <div class="swatches">
          {#each NOTE_VALUES as v}
            <span class="swatch">
              <input type="color" value={colours[v.id] === INK ? '#808080' : colours[v.id]} oninput={(e) => setColour(v.id, e.target.value)} aria-label={`${t('editor.colours')}: ${t(`value.${v.id}`)}`} />
              {t(`value.${v.id}`)}
              {#if colours[v.id] !== DEFAULT_COLOURS[v.id]}<button class="reset" onclick={() => setColour(v.id, DEFAULT_COLOURS[v.id])}>{t('editor.colourReset')}</button>{/if}
            </span>
          {/each}
        </div>
      </details>
  </div>
</div>

{#if overlay === 'legend'}<Legend onClose={() => (overlay = null)} />{/if}
{#if overlay === 'help'}<Help {colours} onClose={() => (overlay = null)} />{/if}

<style>
  .editor { display: flex; flex-direction: column; min-height: 100vh; min-height: 100dvh; }
  header { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px; border-bottom: 1px solid var(--line); }
  header input[type='text'] { flex: 1; min-width: 80px; }
  .bpm { display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--muted); }
  .bpm input { width: 64px; }
  /* portrait: staff first, then arrows, palette, bar actions, full score */
  .body { display: grid; grid-template-columns: minmax(0, 1fr); grid-template-areas: 'stage' 'move' 'palette' 'bars' 'transport' 'full' 'colours'; gap: 8px; padding: 8px; }
  .stage { grid-area: stage; }
  .move { grid-area: move; }
  .palette-area { grid-area: palette; background: var(--toolbar); border: 1px solid var(--line); border-radius: var(--radius); padding: 8px; }
  .bars-area { grid-area: bars; }
  .full-area { grid-area: full; }
  .transport-area { grid-area: transport; }
  .locked { opacity: 0.4; }
  .colours { grid-area: colours; }
  .where { font-size: 13px; color: var(--muted); }
  .stage { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 4px; overflow-x: auto; }
  .move { display: flex; gap: 6px; align-items: stretch; }
  .big { font-size: 28px; min-width: 64px; }
  .status { flex: 1; font-size: 14px; display: flex; flex-direction: column; justify-content: center; padding: 0 4px; min-height: var(--tap); min-width: 0; line-height: 1.25; }
  .saved { font-size: 12px; color: var(--muted); }
  .colours summary { cursor: pointer; color: var(--muted); font-size: 14px; padding: 6px 0; }
  .swatches { display: flex; flex-wrap: wrap; gap: 10px; }
  .swatch { display: flex; align-items: center; gap: 6px; font-size: 14px; }
  .reset { min-height: 28px; font-size: 12px; padding: 0 8px; }
  @media (orientation: landscape) and (min-width: 640px) {
    header { padding: 4px 8px; }
    .body { grid-template-columns: 220px minmax(0, 1fr); grid-template-areas: 'palette stage' 'palette move' 'palette bars' 'palette transport' 'palette full' 'palette colours'; grid-template-rows: auto auto auto auto auto 1fr; padding: 6px; align-items: start; }
    .palette-area { position: sticky; top: 6px; }
    .stage { padding: 0; }
  }
</style>
