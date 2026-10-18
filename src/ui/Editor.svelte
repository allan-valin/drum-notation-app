<script>
  import ScoreSvg from './ScoreSvg.svelte';
  import Palette from './Palette.svelte';
  import { initialState, reduce } from '../core/editorState.js';
  import { profileById } from '../core/profile.js';
  import { DEFAULT_COLOURS, INK, normaliseColours, overridesOnly } from '../core/colours.js';
  import { t } from '../app/prefs.svelte.js';
  import Prefs from './Prefs.svelte';
  import { cursor as mkCursor, leafAt, posLabel } from '../core/cursor.js';
  import { barTimeSig, showsTimeSig } from '../core/score.js';
  import { NOTE_VALUES } from '../core/noteValue.js';
  import { newScore } from '../core/score.js';

  let { store, id, onBack, onPrint } = $props();

  const loaded = store.load(id);
  let st = $state.raw(initialState(loaded ?? newScore({ id, title: t('app.untitled') })));
  let status = $state(loaded ? t('status.opened', { title: loaded.title || t('app.untitled') }) : t('status.newScore'));
  let savedAt = $state('');
  let width = $state(360);
  let height = $state(640);
  const landscape = $derived(width >= 640 && width > height);
  let showHint = $state(true);
  const settings = store.loadSettings();
  let colours = $state(normaliseColours(settings.colours));
  let showColours = $state(false);

  const staff = $derived(profileById(st.score.profileId).staves[0]);
  const bar = $derived(st.score.bars[st.cursor.bar]);
  const slotName = (id) => t(`slot.${id}`);
  const pos = () => `${st.cursor.bar + 1}.${posLabel(st.cursor)}`;

  function dispatch(action) {
    const before = st;
    st = reduce(st, action);
    status = st.refused ? t(`refused.${st.refused}`) : describe(action, before, st);
    if (st.score !== before.score) {
      store.save(st.score);
      savedAt = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }

  function describe(a, before, after) {
    const cell = leafAt(after.score, after.cursor);
    const notes = cell.notes.map((n) => slotName(n.slotId)).join(' + ') || t('status.empty');
    const p = pos();
    switch (a.type) {
      case 'tap': case 'tapAt':
        if (after.score === before.score) return t('status.nothingToDelete', { pos: p });
        return before.tool.delete ? t('status.deleted', { pos: p, notes }) : t('status.placed', { pos: p, notes });
      case 'selectValue': return t('status.split', { pos: `${after.cursor.bar + 1}.${after.cursor.beat + 1}`, value: t(`valuePlural.${a.value.id}`) });
      case 'selectTuplet': return after.tool.tuplet ? t('status.tupletOn', { n: after.tool.tuplet }) : t('status.tupletOff');
      case 'rest': return t('status.rest', { pos: p });
      case 'next': case 'prev':
        if (after.cursor === before.cursor) return a.type === 'next' ? t('status.end') : t('status.start');
        return t('status.position', { pos: p, notes });
      case 'toggleDelete': return after.tool.delete ? t('status.deleteOn') : t('status.deleteOff');
      case 'toggleAccent': return after.tool.accent ? t('status.accentOn') : t('status.accentOff');
      case 'toggleGhost': return after.tool.ghost ? t('status.ghostOn') : t('status.ghostOff');
      case 'setSticking': return after.tool.sticking ? t('status.hand', { hand: after.tool.sticking }) : t('status.noHand');
      case 'addBar': return t('status.barAdded', { n: after.score.bars.length });
      case 'removeBar': return after.score === before.score ? t('status.barMinimum') : t('status.barRemoved', { n: after.score.bars.length });
      case 'undo': return after.score === before.score ? t('status.nothingToUndo') : t('status.undone');
      case 'goTo': return t('status.position', { pos: p, notes });
      case 'setTitle': return t('status.titleSet');
      case 'setBpm': return t('status.bpmSet', { bpm: after.score.defaultBpm });
      default: return status;
    }
  }

  function onTap({ beat, path, staffPosition }) {
    dispatch({ type: 'tapAt', beat, path, staffPosition });
  }

  function setColour(valueId, colour) {
    colours = { ...colours, [valueId]: colour };
    store.saveSettings({ ...store.loadSettings(), colours: overridesOnly(colours) });
    status = colour === DEFAULT_COLOURS[valueId]
      ? t('status.colourReset', { value: t(`value.${valueId}`) })
      : t('status.colourSet', { value: t(`value.${valueId}`) });
  }

  function onKey(e) {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') dispatch({ type: 'next' });
    else if (e.key === 'ArrowLeft') dispatch({ type: 'prev' });
    else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) dispatch({ type: 'undo' });
  }

  // staff spacing: wide enough to tap, but the whole stage must fit a phone held sideways
  const sp = $derived(Math.max(12, Math.min(26, width / 34, (height - (landscape ? 150 : 300)) / 15)));
</script>

<svelte:window onkeydown={onKey} bind:innerHeight={height} />

<div class="editor" bind:clientWidth={width}>
  <header class="no-print">
    <button onclick={onBack} aria-label={t('editor.backLong')}>‹ {t('editor.back')}</button>
    <input type="text" value={st.score.title} placeholder={t('editor.titleField')} aria-label={t('editor.titleField')} onchange={(e) => dispatch({ type: 'setTitle', title: e.target.value })} />
    <label class="bpm">{t('editor.bpm')} <input type="number" min="20" max="300" value={st.score.defaultBpm} onchange={(e) => dispatch({ type: 'setBpm', bpm: Number(e.target.value) || 80 })} /></label>
    <button onclick={() => dispatch({ type: 'addBar' })} aria-label={t('editor.addBar')} title={t('editor.addBar')}>+</button>
    <button onclick={() => { if (confirm(t('editor.confirmRemoveBar', { n: st.cursor.bar + 1 }))) dispatch({ type: 'removeBar' }); }} disabled={st.score.bars.length <= 1} aria-label={t('editor.removeBar')} title={t('editor.removeBar')}>−</button>
    <button onclick={onPrint} aria-label={t('editor.pdfLong')}>{t('editor.pdf')}</button>
    <Prefs onChange={(msg) => (status = msg)} />
  </header>

  <div class="body">
    <aside class="no-print">
      <Palette tool={st.tool} canUndo={st.history.length > 0} onAction={dispatch} />
    </aside>

    <main>
      <div class="stage">
        <ScoreSvg
          {bar}
          {staff}
          width={Math.max(300, width - (landscape ? 210 : 0) - 8)}
          staffSpacing={sp}
          focusedBeat={st.cursor.beat}
          focusedPath={st.cursor.path}
          {colours}
          timeSig={barTimeSig(st.score, st.cursor.bar)}
          showGuides={true}
          deleteMode={st.tool.delete}
          {onTap}
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

      <details class="overview no-print" open={!landscape}>
        <summary>{t('editor.wholeScore')}</summary>
        <div class="bars">
          {#each st.score.bars as b, i}
            <button class="barthumb" class:current={i === st.cursor.bar} onclick={() => dispatch({ type: 'goTo', cursor: mkCursor(i, 0, 0) })} aria-label={t('editor.goToBar', { n: i + 1 })}>
              <span class="n">{i + 1}</span>
              <ScoreSvg bar={b} {staff} width={220} staffSpacing={6} showClef={i === 0} timeSig={showsTimeSig(st.score, i) ? barTimeSig(st.score, i) : null} {colours} fixedRange={[8, 10]} />
            </button>
          {/each}
        </div>
      </details>

      <details class="colours no-print" bind:open={showColours}>
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

      {#if showHint && width < 640}
        <p class="hint no-print">{t('editor.landscapeHint')} <button onclick={() => (showHint = false)}>{t('editor.ok')}</button></p>
      {/if}
    </main>
  </div>
</div>

<style>
  .editor { display: flex; flex-direction: column; min-height: 100vh; min-height: 100dvh; }
  header { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px; border-bottom: 1px solid var(--line); }
  header input[type='text'] { flex: 1; min-width: 80px; }
  .bpm { display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--muted); }
  .bpm input { width: 64px; }
  .body { display: flex; flex-direction: column; gap: 8px; padding: 8px; }
  main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .where { font-size: 13px; color: var(--muted); }
  .stage { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 4px; overflow-x: auto; }
  .move { display: flex; gap: 6px; align-items: stretch; }
  .big { font-size: 28px; min-width: 64px; }
  .status { flex: 1; font-size: 14px; display: flex; flex-direction: column; justify-content: center; padding: 0 4px; min-height: var(--tap); min-width: 0; line-height: 1.25; }
  .saved { font-size: 12px; color: var(--muted); }
  .overview summary, .colours summary { cursor: pointer; color: var(--muted); font-size: 14px; padding: 6px 0; }
  .bars { display: flex; flex-wrap: wrap; gap: 6px; }
  .barthumb { padding: 2px 4px; display: flex; align-items: center; gap: 4px; min-height: 0; background: var(--panel); }
  .barthumb.current { border-color: var(--focus-ring); background: var(--focus); }
  .barthumb .n { font-size: 11px; color: var(--muted); }
  .swatches { display: flex; flex-wrap: wrap; gap: 10px; }
  .swatch { display: flex; align-items: center; gap: 6px; font-size: 14px; }
  .reset { min-height: 28px; font-size: 12px; padding: 0 8px; }
  .hint { font-size: 13px; color: var(--muted); display: flex; gap: 8px; align-items: center; margin: 0; }
  @media (orientation: landscape) and (min-width: 640px) {
    header { padding: 4px 8px; }
    .body { flex-direction: row; padding: 6px; }
    aside { width: 200px; flex: none; }
    .stage { padding: 0; }
  }
</style>
