<script>
  import { tick } from 'svelte';
  import ScoreSvg from './ScoreSvg.svelte';
  import Palette from './Palette.svelte';
  import BarRow from './BarRow.svelte';
  import FullScore from './FullScore.svelte';
  import Prefs from './Prefs.svelte';
  import Legend from './Legend.svelte';
  import Help from './Help.svelte';
  import Transport from './Transport.svelte';
  import { initialState, reduce, notesAt } from '../core/editorState.js';
  import { slotFor } from '../core/profile.js';
  import { Glyphs } from '../core/glyphs.js';
  import { NoteValue } from '../core/noteValue.js';
  import { profileById } from '../core/profile.js';
  import { DEFAULT_COLOURS, INK, normaliseColours, overridesOnly } from '../core/colours.js';
  import { cursor as mkCursor, leafAt, posLabel } from '../core/cursor.js';
  import { NOTE_VALUES } from '../core/noteValue.js';
  import { newScore, barTimeSig, barKey } from '../core/score.js';
  import { noteName, keyNames } from '../app/noteName.js';
  import { partKey } from '../core/pitch.js';
  import { prettyChord } from '../core/chords.js';
  import { STRINGS } from '../app/strings.js';
  import { prefs } from '../app/prefs.svelte.js';
  import { t } from '../app/prefs.svelte.js';
  import { partLabelIndex, isEmptyPart, bandRows, groupOf } from '../core/parts.js';
  import { carryInto, tiesOut, slurOpenAt } from '../core/edit.js';
  import { partView } from '../core/parts.js';
  import { samePath } from '../core/tree.js';
  import { patternCells } from '../core/autofill.js';

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
  // landscape sidebar folds to a strip; display: none forgets the scroll, so it is kept here
  let paletteOpen = $state(true);
  let paletteScroll = $state(null);
  let paletteTop = 0;
  async function togglePalette() {
    if (paletteOpen) paletteTop = paletteScroll.scrollTop;
    paletteOpen = !paletteOpen;
    if (paletteOpen) { await tick(); paletteScroll.scrollTop = paletteTop; }
  }
  let range = $state(null);
  let selecting = $state(false);
  let onlyPart = $state(false);
  let lyricsInfo = $state('');
  if (!background && loaded) store.saveSettings({ ...store.loadSettings(), lastId: id });

  const profile = $derived(profileById(st.score.profileId));
  /** The part as written, both drum voices included; `st.score` is what is being edited (one voice when split). */
  const realScore = $derived(partView(st.full, st.part));
  const voiceName = (v) => t(v === 1 ? 'voices.lower' : 'voices.upper');
  // moving notes: marked cells ({ bar, beat, path }) or beats ({ bar, beat }), in the edited voice
  let selectMode = $state(null);
  let selection = $state([]);
  let dragFrom = null;
  const staff = $derived(profile.staves[0]);
  /** "Bateria", or "Bateria 2" when the instrument appears twice. */
  const partName = (full, id) => {
    const p = full.parts.find((x) => x.id === id);
    if (!p) return '';
    const n = partLabelIndex(full, id);
    return t(`instrument.${p.instrument}`) + (n ? ` ${n}` : '');
  };
  const partList = $derived(st.full.parts.map((p) => ({ id: p.id, instrument: p.instrument, muted: p.muted, label: partName(st.full, p.id) })));
  /** The band list: one row per instrument (a piano's two hands are one row). */
  const bandList = $derived(bandRows(st.full).map((r) => ({ ...r, label: t(`instrument.${r.instrument}`) })));
  const groupEmpty = (id) => groupOf(st.full, id).every((p) => isEmptyPart(st.full, p.id));
  const shownBar = $derived(playing && playhead ? playhead.bar : st.cursor.bar);
  const bar = $derived(realScore.bars[shownBar]);
  /** A drum's name, or a pitch spelled in the reader's language ("Fá♯4"). */
  const noteLabel = (n) => (staff.pitched ? noteName(n.slotId, n.alter ?? 0, prefs.lang, STRINGS[prefs.lang].noteNames) : t(`slot.${n.slotId}`));
  const pos = () => `${st.cursor.bar + 1}.${posLabel(st.cursor)}`;

  function dispatch(action) {
    if (background) return;
    if (playing) { status = t('play.editLocked'); return; }
    const before = st;
    st = reduce(st, action);
    status = st.refused ? t(`refused.${st.refused}`) : describe(action, before, st);
    if (st.full !== before.full) {
      store.save(st.full);
      store.saveSettings({ ...store.loadSettings(), lastId: st.full.id });
      savedAt = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
  }

  function describe(a, before, after) {
    const notes = leafAt(after.score, after.cursor).notes.map(noteLabel).join(' + ') || t('status.empty');
    const p = pos();
    const n = after.cursor.bar + 1;
    const b = after.score.bars[after.cursor.bar];
    switch (a.type) {
      case 'tap': case 'tapAt':
        if (after.selectedOnly) return t('status.selected', { pos: p });
        if (after.symbolsRemoved !== undefined) return t(after.symbolsRemoved ? 'status.symbolsRemoved' : 'status.symbolsAdded', { pos: p, notes });
        if (after.score === before.score) return t('status.nothingToDelete', { pos: p });
        return before.tool.delete ? t('status.deleted', { pos: p, notes }) : t('status.placed', { pos: p, notes });
      case 'selectValue': case 'selectTuplet':
        if (before.tool.splitMode === 'cell' && leafAt(after.score, after.cursor) && after.cursor.path.length < before.cursor.path.length) return t('status.merged2', { pos: p, value: t(`value.${after.tool.value.id}`) });
        if (before.tool.splitMode === 'cell') return t('status.splitCell', { pos: `${before.cursor.bar + 1}.${posLabel(before.cursor)}`, value: t(`valuePlural.${after.tool.value.id}`) });
        if (a.type === 'selectTuplet') return after.tool.tuplet ? t('status.tupletOn', { n: after.tool.tuplet }) : t('status.tupletOff');
        return t('status.split', { pos: `${n}.${after.cursor.beat + 1}`, value: t(`valuePlural.${a.value.id}`) });
      case 'setSplitMode': return t('status.mode', { mode: t(`split.${after.tool.splitMode}`) }) + ' · ' + t({ beat: 'split.hintBeat', cell: 'split.hintCell', bar: 'split.hintBar' }[after.tool.splitMode]);
      case 'setStem': return after.tool.stem ? t('voices.stemOn', { dir: t(`voices.${after.tool.stem}`) }) : t('voices.stemOff');
      case 'setSplit': return after.split ? t('voices.splitOn', { voice: voiceName(after.voice) }) : t('voices.splitOff');
      case 'setVoice': return t('voices.voiceSet', { voice: voiceName(after.voice) });
      case 'selectCell': return t('voices.cellSelected', { voice: voiceName(after.voice), pos: p });
      case 'autofill': return t('autofill.done', { n, piece: t(`slot.${a.slotId}`), count: patternCells(after.score, after.cursor.bar, a.pattern).length, pattern: a.label ?? a.pattern });
      case 'eraseAt': return after.score === before.score ? t('status.nothingToDelete', { pos: p }) : t('status.deleted', { pos: p, notes });
      case 'moveNotes': case 'moveSelection': return t('drag.moved', { n: after.moved?.count ?? 0 });
      case 'merge': return t('status.merged', { pos: p });
      case 'rest': return t('status.rest', { pos: p });
      case 'next': case 'prev':
        if (after.cursor === before.cursor) return a.type === 'next' ? t('status.end') : t('status.start');
        return t('status.position', { pos: p, notes });
      case 'goTo':
        return after.cursor.bar !== before.cursor.bar ? t('status.barOpened', { n }) : t('status.position', { pos: p, notes });
      case 'toggleDelete': return after.tool.delete ? t('status.deleteOn') : t('status.deleteOff');
      case 'toggleAccent': return after.tool.accent ? (after.tool.withNote ? t('status.accentOn') : t('status.techOnSymbol', { what: t('palette.accent') })) : t('status.accentOff');
      case 'toggleGhost': return after.tool.ghost ? (after.tool.withNote ? t('status.ghostOn') : t('status.techOnSymbol', { what: t('palette.ghost') })) : t('status.ghostOff');
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
      case 'setHead': return after.tool.head ? t(after.tool.withNote ? 'status.techOn' : 'status.techOnSymbol', { what: t(`tech.${after.tool.head}`) }) : t('status.techOff', { what: t(`tech.${before.tool.head}`) });
      case 'setTech': return after.tool.tech ? t(after.tool.withNote ? 'status.techOn' : 'status.techOnSymbol', { what: t(`tech.${after.tool.tech}`) }) : t('status.techOff', { what: t(`tech.${before.tool.tech}`) });
      case 'setWithNote': return after.tool.withNote ? t('tech.withNoteHint') : t('tech.symbolOnlyHint');
      case 'setBarText': return b.text ? t('status.barTextSet', { n, text: b.text }) : t('status.barTextCleared', { n });
      case 'setPart': return t('status.partSwitched', { name: partName(after.full, after.part) });
      case 'addPart': return t('status.partAdded', { name: partName(after.full, after.part) });
      case 'removePart': return t('status.partRemoved', { name: partName(before.full, a.part) });
      case 'setInstrument': return t('status.instrumentSet', { name: partName(after.full, a.part) });
      case 'toggleMute': {
        const p = after.full.parts.find((x) => x.id === a.part);
        return t(p.muted ? 'status.muted' : 'status.unmuted', { name: partName(after.full, a.part) });
      }
      case 'setAccidental': {
        const a = { 1: 'sharp', '-1': 'flat', 0: 'natural', 2: 'doubleSharp', '-2': 'doubleFlat' }[String(after.tool.accidental)];
        return after.tool.accidental === null ? t('status.accidentalOff') : t('status.accidentalOn', { what: t(`palette.${a}`) });
      }
      case 'toggleArt': return after.tool.arts.includes(a.art) ? t('status.artOn', { what: t(`palette.${a.art}`) }) : t('status.artOff', { what: t(`palette.${a.art}`) });
      case 'setKey': {
        const k = barKey(after.score, after.cursor.bar);
        // a percussion staff has no key signature: say where it shows instead of looking broken
        const note = staff.pitched ? '' : ` · ${t('bars.keyNotOnDrums')}`;
        if (typeof k === 'string') return t('status.keySet', { n, key: t(`maqam.${k}`) }) + note;
        const [maj] = keyNames(k, prefs.lang, STRINGS[prefs.lang].noteNames);
        return t('status.keySet', { n, key: `${maj} ${t('bars.major')}` }) + note;
      }
      case 'setDyn': return after.tool.dyn ? t('status.dynOn', { what: after.tool.dyn }) : t('status.dynOff');
      case 'setWedge': return after.tool.wedge ? t('status.dynOn', { what: after.tool.wedge === 'cresc' ? 'cresc.' : 'dim.' }) : t('status.dynOff');
      case 'setPedal': return leafAt(after.score, after.cursor).ped ? t(`status.ped_${a.kind}`, { pos: p }) : t('status.pedRemoved', { pos: p });
      case 'setChord': return a.text ? t('status.chordSet', { text: prettyChord(a.text), pos: `${before.cursor.bar + 1}.${posLabel(before.cursor)}` }) : t('status.chordCleared');
      case 'setSwing': return after.score.swing ? t('status.swingOn') : t('status.swingOff');
      case 'setLyricAt': return a.text ? t('status.lyricSet', { text: a.text, pos: `${n}.${posLabel(after.cursor)}` }) : t('status.lyricCleared');
      case 'pasteLyrics': {
        const r = after.lyricsResult ?? { placed: 0, left: 0 };
        lyricsInfo = t(r.left ? 'status.lyricsPastedLeft' : 'status.lyricsPasted', { n: r.placed, left: r.left });
        return lyricsInfo;
      }
      case 'setLyric': return a.text ? t('status.lyricSet', { text: a.text, pos: `${before.cursor.bar + 1}.${posLabel(before.cursor)}` }) : t('status.lyricCleared');
      case 'setSlur': return leafAt(after.score, after.cursor).slur ? t(`status.slur_${a.kind}`, { pos: p }) : t('status.slurRemoved', { pos: p });
      case 'toggleDot': return after.tool.dot ? t('status.dotOn') : t('status.dotOff');
      case 'toggleTie': return leafAt(after.score, after.cursor).cont ? t('status.tieOn', { pos: p }) : t('status.tieOff', { pos: p });
      case 'setTitle': return t('status.titleSet');
      case 'setBpm': return t('status.bpmSet', { bpm: after.score.defaultBpm });
      default: return status;
    }
  }

  /** A tap on the full score: in selection mode it marks the range to play, otherwise it opens the bar. */
  function openBar(i) {
    if (selecting && !playing) {
      // contiguous block: a tap outside it stretches it to the tapped bar, a tap inside starts over there
      if (!range) range = [i, i];
      else if (i < range[0]) range = [i, range[1]];
      else if (i > range[1]) range = [range[0], i];
      else range = [i, i];
      status = t('play.selected', { from: range[0] + 1, to: range[1] + 1 });
      return;
    }
    dispatch({ type: 'goTo', cursor: mkCursor(i, 0, 0) });
  }

  /** The band list next to BPM: add, remove, re-instrument and mute parts. */
  function band(action) {
    if (action.type === 'setInstrument' && !groupEmpty(action.part)) {
      if (!confirm(t('instrument.confirmChange'))) return;
    }
    if (action.type === 'removePart' && !groupEmpty(action.part)) {
      if (!confirm(t('instrument.confirmRemove', { name: bandList.find((r) => r.id === action.part)?.label ?? partName(st.full, action.part) }))) return;
    }
    dispatch(action);
  }

  function moveBlock(dir) {
    if (!range) { status = t('play.dragHint'); return; }
    const [a, b] = range;
    if ((dir < 0 && a === 0) || (dir > 0 && b === st.score.bars.length - 1)) { status = t('play.cantMove'); return; }
    dropBlock(a, b, dir < 0 ? a - 1 : b + 2);
  }
  function dropBlock(a, b, gap) {
    const before = st;
    dispatch({ type: 'moveBars', from: a, to: b, gap, onlyPart });
    if (st.full !== before.full) {
      range = st.range;
      status = t('play.moved', { from: range[0] + 1, to: range[1] + 1 });
    }
  }

  function setColour(valueId, colour) {
    colours = { ...colours, [valueId]: colour };
    store.saveSettings({ ...store.loadSettings(), colours: overridesOnly(colours) });
    status = colour === DEFAULT_COLOURS[valueId]
      ? t('status.colourReset', { value: t(`value.${valueId}`) })
      : t('status.colourSet', { value: t(`value.${valueId}`) });
  }

  /** Select mode: a tap marks or unmarks a cell (or its whole beat) instead of writing. */
  function mark({ beat, path }) {
    const item = selectMode === 'beats' ? { bar: st.cursor.bar, beat } : { bar: st.cursor.bar, beat, path };
    const same = (x) => x.bar === item.bar && x.beat === item.beat && (!item.path || samePath(x.path, item.path));
    selection = selection.some(same) ? selection.filter((x) => !same(x)) : [...selection, item];
    status = t('drag.selected', { n: selection.length });
  }
  function setSelectMode(mode, clear = false) {
    if (clear || mode !== selectMode) selection = [];
    selectMode = mode;
    status = mode ? `${t('drag.selected', { n: selection.length })} · ${t('drag.hint')}` : t('drag.off');
  }
  const isMarked = (c) => selection.some((x) => x.bar === c.bar && x.beat === c.beat && (!x.path || samePath(x.path, c.path)));

  /** Press and hold: a marked cell picks up the whole selection, else the note nearest the finger. */
  function dragStart({ beat, path, staffPosition }) {
    if (playing || background) return null;
    const c = { bar: st.cursor.bar, beat, path };
    if (selectMode && isMarked(c)) {
      dragFrom = { kind: 'selection', c };
      status = t('drag.picked');
      return 'selection';
    }
    // the note nearest the finger, in either voice of a split bar
    const pos = (n) => staff.slots.find((x) => x.id === n.slotId)?.staffPosition ?? 0;
    const n = notesAt(st, c).reduce((best, x) => (!best || Math.abs(pos(x.note) - staffPosition) < Math.abs(pos(best.note) - staffPosition) ? x : best), null);
    if (!n) return null;
    dragFrom = { kind: 'note', c, slotId: n.note.slotId, voice: n.voice };
    status = t('drag.picked');
    return 'note';
  }
  function dragEdge(dir) {
    const b = st.cursor.bar + dir;
    if (b >= 0 && b < st.score.bars.length) dispatch({ type: 'goTo', cursor: mkCursor(b, 0, 0) });
  }
  function dragEnd(target) {
    const from = dragFrom;
    dragFrom = null;
    if (!target || !from) { status = t('drag.cancelled'); return; }
    const to = { bar: st.cursor.bar, beat: target.beat, path: target.path };
    if (from.kind === 'note') dispatch({ type: 'moveNotes', from: from.c, slotId: from.slotId, voice: from.voice, to, staffPosition: target.staffPosition });
    else dispatch({ type: 'moveSelection', mode: selectMode, items: selection, from: from.c, to });
    if (st.moved && from.kind === 'selection') selection = st.moved.items.map((x) => (selectMode === 'beats' ? { bar: x.bar, beat: x.beat } : x));
  }

  /** What a tap at this height would write (same choice as the reducer's tap), for the see-through preview. */
  function previewFor(pos) {
    if (playing || background || selectMode || st.tool.delete || !st.tool.withNote) return null;
    const slash = staff.pitched && st.tool.head === 'slash';
    const slot = slash ? (staff.slots.find((x) => x.staffPosition === 4) ?? slotFor(staff, 4)) : slotFor(staff, pos, st.tool.head);
    const head = slot.notehead === st.tool.head ? slot.notehead : (st.tool.head ?? slot.notehead);
    return { staffPosition: slot.staffPosition, glyph: Glyphs.notehead(head, NoteValue.QUARTER), label: noteLabel({ slotId: slot.id, alter: st.tool.accidental ?? 0 }) };
  }

  function onKey(e) {
    if (background || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'ArrowRight') dispatch({ type: 'next' });
    else if (e.key === 'ArrowLeft') dispatch({ type: 'prev' });
    else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) dispatch({ type: 'undo' });
  }

  // staff spacing: big enough to tap, small enough that stage + controls fit a phone held sideways
  const sp = $derived(Math.max(12, Math.min(22, width / 36, (height - (landscape ? 150 : 300)) / 15)));
  const stageWidth = $derived(Math.max(300, width - (landscape ? (paletteOpen ? 230 : 58) : 0) - 16));
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
    <aside class="palette-area no-print" class:collapsed={!paletteOpen}>
      <button class="palette-toggle" onclick={togglePalette} aria-expanded={paletteOpen} aria-label={t(paletteOpen ? 'editor.paletteHide' : 'editor.paletteShow')} title={t(paletteOpen ? 'editor.paletteHide' : 'editor.paletteShow')}>{paletteOpen ? '«' : '»'}</button>
      <div class="palette-scroll" class:locked={playing} inert={playing} bind:this={paletteScroll}>
      <Palette split={st.split} voice={st.voice} beatsInBar={barTimeSig(realScore, st.cursor.bar)[0]} {selectMode} selectedCount={selection.length} onSelectMode={setSelectMode} tool={st.tool} canUndo={st.history.length > 0} canMerge={st.cursor.path.length > 1} onAction={dispatch} onLegend={() => (overlay = 'legend')} onHelp={() => (overlay = 'help')} {profile} parts={partList} part={st.part} lyric={leafAt(st.score, st.cursor).lyric ?? ''} chord={leafAt(st.score, st.cursor).chord ?? ''} {lyricsInfo} />
      </div>
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
          timeSig={barTimeSig(realScore, shownBar)}
          keyFifths={partKey(barKey(realScore, shownBar), profile)}
          den={barTimeSig(realScore, shownBar)[1]}
          carry={carryInto(realScore, shownBar)}
          tieOut={tiesOut(realScore, shownBar)}
          dynamicsAbove={!!profile.dynamicsAbove}
          slurIn={slurOpenAt(realScore, shownBar)}
          voice={st.split && staff.voices && !playing ? st.voice : null}
          onStrip={({ voice, beat, path }) => dispatch({ type: 'selectCell', voice, beat, path })}
          onErase={({ beat, path, staffPosition }) => dispatch({ type: 'eraseAt', beat, path, staffPosition })}
          preview={previewFor}
          onPreview={(what) => (status = t('drag.preview', { what }))}
          onDragStart={dragStart}
          onDragEnd={dragEnd}
          onDragEdge={dragEdge}
          marked={selection.filter((x) => x.bar === shownBar).map((x) => ({ beat: x.beat, path: x.path }))}
          onLyric={profile.palette.includes('lyrics') && !playing ? ({ beat, path, text }) => dispatch({ type: 'setLyricAt', beat, path, text }) : null}
          showGuides={true}
          cards={true}
          deleteMode={st.tool.delete}
          onTap={({ beat, path, staffPosition }) => (selectMode ? mark({ beat, path }) : dispatch({ type: 'tapAt', beat, path, staffPosition }))}
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

      <div class="bars-area"><BarRow score={realScore} barIndex={st.cursor.bar} onAction={dispatch} pitched={st.full.parts.some((p) => profileById(p.instrument).staves[0].pitched)} keyHere={staff.pitched} /></div>

      <div class="transport-area"><Transport full={st.full} parts={bandList} onBand={band} onSwing={(on) => dispatch({ type: 'setSwing', on })} currentBar={st.cursor.bar} {range} {store} bind:mode={playMode} bind:selecting bind:onlyPart onMove={moveBlock}
        onPlayhead={(p) => (playhead = p)} onPlaying={(on) => { playing = on; if (!on) playhead = null; }} onStatus={(m) => (status = m)} /></div>

      <div class="full-area"><FullScore full={st.full} parts={partList} part={st.part} {onlyPart} range={selecting || playMode === 'selection' ? range : null} {selecting} onDrop={dropBlock} playingBar={playing ? playhead?.bar : null} {colours} current={st.cursor.bar} onOpen={openBar} /></div>

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

{#if overlay === 'legend'}<Legend {profile} onClose={() => (overlay = null)} />{/if}
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
  .palette-toggle { display: none; }
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
    /* its own scroll: the palette is long, the page is as long as the score */
    .palette-area { position: sticky; top: 6px; max-height: calc(100vh - 70px); max-height: calc(100dvh - 70px); display: flex; flex-direction: column; padding: 0; }
    .palette-scroll { overflow-y: auto; overscroll-behavior: contain; padding: 0 8px 8px; min-height: 0; }
    /* outside the scroll, so it never scrolls away */
    .palette-toggle { display: block; flex: none; align-self: flex-end; margin: 4px; min-width: var(--tap); font-size: 20px; }
    .body:has(.collapsed) { grid-template-columns: 52px minmax(0, 1fr); }
    .collapsed .palette-scroll { display: none; }
    .collapsed .palette-toggle { align-self: center; }
    .stage { padding: 0; }
  }
</style>
