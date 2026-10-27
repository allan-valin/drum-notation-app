import { NoteValue, NOTE_VALUES } from './noteValue.js';
import { note, Articulation, Mark, Roll, Grace, barKey, barTimeSig } from './score.js';
import { parseSlot, keyAlter, partKey } from './pitch.js';
import { cursor as mkCursor, next, prev, leafAt, clamp } from './cursor.js';
import { parentOf, leafPaths, getAt } from './tree.js';
import {
  placeNote, deleteNote, clearLeaf, splitBeat, splitCell, resizeCell, mergeCell, addBar, removeBar,
  setTimeSig, toggleSimile, toggleRepeatStart, toggleRepeatEnd, setBarText, moveBars, setKey, setLength, toggleTie, setDynamic, setWedge, setLyric, setSlur, setChord, distributeLyrics, setPedal,
} from './edit.js';
import { barLeaves } from './edit.js';
import { profileById, slotNearest, slotFor } from './profile.js';
import { toFull, partView, zipPart, applyAll, addPart, removePart, setInstrument, toggleMute, movePartBars } from './parts.js';
import { voiceView, zipVoice, normVoices, withStem } from './voices.js';
import { autofill } from './autofill.js';
import { moveNotes, moveBeats, absTick, cellAt, beatList } from './move.js';

const HISTORY = 50;

/**
 * Every interaction rule lives here, as a pure reducer; the Svelte component only dispatches.
 * `refused` is set when an action did nothing on purpose, so the status line can say why.
 */
export function initialState(score) {
  const full = toFull(score);
  const part = full.parts[0].id;
  const st = {
    full,
    part,
    // drums: `split` edits the two voices apart, `voice` says which one (0 stems up, 1 down)
    split: false,
    voice: 0,
    score: viewOf(full, part, false, 0),
    cursor: mkCursor(0, 0, 0),
    tool: { value: NoteValue.QUARTER, tuplet: null, stem: null, delete: false, accent: false, ghost: false, sticking: null, splitMode: 'beat', head: null, tech: null, withNote: true, accidental: null, arts: [], dot: false, dyn: null, wedge: null },
    history: [],
    refused: null,
  };
  return syncTool(clampCursor(st));
}

/** The score the rules edit: one part, and with voices split, one voice of it. */
function viewOf(full, part, split, voice) {
  const p = partView(full, part);
  const staff = profileById(p.profileId).staves[0];
  return split && staff.voices ? voiceView(p, voice, staff) : p;
}

/** Write an edited view back into the full score (drum bars normalised, see voices.js). */
function writeBack(full, part, split, voice, view) {
  const staff = profileById(view.profileId).staves[0];
  if (!staff.voices) return zipPart(full, part, view);
  const merged = split
    ? zipVoice(partView(full, part), voice, view, staff)
    : { ...view, bars: view.bars.map((b) => normVoices(b, staff)) };
  return zipPart(full, part, merged);
}

const view = (st, full = st.full, part = st.part) => viewOf(full, part, st.split, st.voice);

/**
 * Drums whose bar has two voices in their own rhythms (or with voices split): a click must
 * reach the note it is on whichever voice holds it. Each entry: the note, its voice, and the
 * cell of that voice that starts where `c` (a cell of the edited view) starts.
 */
export function notesAt(st, c) {
  const staff = profileById(st.score.profileId).staves[0];
  const real = partView(st.full, st.part);
  const routed = staff.voices && (st.split || !!real.bars[c.bar]?.lower);
  const here = getAt(st.score.bars[c.bar]?.beats[c.beat], c.path)?.notes ?? [];
  if (!routed) return here.map((n) => ({ note: n, voice: undefined, cell: c }));
  const tick = absTick(st.score, c);
  return [0, 1].flatMap((v) => {
    const vs = viewOf(st.full, st.part, true, v);
    const cell = cellAt(vs, tick);
    if (cell.refused) return [];
    return (getAt(vs.bars[cell.bar].beats[cell.beat], cell.path)?.notes ?? []).map((n) => ({ note: n, voice: v, cell }));
  });
}

/** Run an edit on one voice of the part (whatever is being edited) and write it back. */
function inVoice(state, v, f) {
  const vs = viewOf(state.full, state.part, true, v);
  const out = f(vs);
  if (out.refused) return out;
  if (out === vs) return state.full;
  return writeBack(state.full, state.part, true, v, out);
}

/**
 * Parts: the rules below edit `st.score`, a one-part view of `st.full`. This layer writes each
 * change back into the full score, runs bar operations on every part so they stay aligned,
 * keeps whole full scores in the undo history, and handles the part actions themselves.
 */
const BAR_OPS = {
  addBar: () => (v) => addBar(v),
  removeBar: (st) => (v) => removeBar(v, st.cursor.bar),
  setTimeSig: (st, a) => (v) => setTimeSig(v, st.cursor.bar, a.sig),
  moveBars: (st, a) => (v) => moveBars(v, a.from, a.to, a.gap).score,
};

export function reduce(state, action) {
  switch (action.type) {
    case 'setPart': return switchPart(state, action.part);
    case 'addPart': {
      const full = addPart(state.full, action.instrument);
      return switchPart({ ...pushFull(state), full }, full.parts[full.parts.length - 1].id);
    }
    case 'removePart': {
      const full = removePart(state.full, action.part);
      if (full === state.full) return { ...state, refused: 'lastPart' };
      const part = full.parts.some((p) => p.id === state.part) ? state.part : full.parts[0].id;
      return switchPart({ ...pushFull(state), full }, part, true);
    }
    case 'setInstrument': {
      const full = setInstrument(state.full, action.part, action.instrument);
      if (full === state.full) return state;
      return switchPart({ ...pushFull(state), full }, state.part, true);
    }
    case 'toggleMute': return { ...state, full: toggleMute(state.full, action.part) };
    case 'moveBars': {
      if (!action.onlyPart) break;
      const r = movePartBars(state.full, state.part, action.from, action.to, action.gap);
      if (r.refused) return { ...state, refused: r.refused };
      if (r.full === state.full) return state;
      const score = view(state, r.full);
      return { ...pushFull(state), full: r.full, score, range: r.range, refused: null, cursor: clamp(score, { ...state.cursor, bar: r.range[0] }) };
    }
    case 'setSplit': {
      const split = !!action.on;
      const st = { ...state, split, voice: split ? state.voice : 0, refused: null };
      const score = view(st);
      return syncTool({ ...st, score, cursor: clamp(score, state.cursor) });
    }
    case 'setVoice': {
      if (!state.split) return { ...state, refused: 'splitOff' };
      const st = { ...state, voice: action.voice === 1 ? 1 : 0, refused: null };
      const score = view(st);
      return syncTool({ ...st, score, cursor: clamp(score, state.cursor) });
    }
    case 'selectCell': {
      // the strips above and below the staff: pick a voice and a cell of it, write nothing.
      // Here, not in reduceView: changing voice changes what `score` is a view of.
      const voiced = action.voice !== undefined && state.split && action.voice !== state.voice ? reduce(state, { type: 'setVoice', voice: action.voice }) : state;
      return { ...syncTool({ ...voiced, cursor: clamp(voiced.score, { bar: state.cursor.bar, beat: action.beat, path: action.path }) }), selectedOnly: true, refused: null };
    }
    case 'eraseAt': {
      // right click: the note nearest the click in that cell, in either voice
      const c = clamp(state.score, { bar: state.cursor.bar, beat: action.beat, path: action.path });
      const staff = profileById(state.score.profileId).staves[0];
      const pos = (n) => staff.slots.find((x) => x.id === n.slotId)?.staffPosition ?? 0;
      const found = notesAt(state, c).reduce((best, x) => (!best || Math.abs(pos(x.note) - action.staffPosition) < Math.abs(pos(best.note) - action.staffPosition) ? x : best), null);
      const st = syncTool({ ...state, cursor: c, refused: null, selectedOnly: false });
      if (!found) return { ...st, refused: 'noNoteThere' };
      const full = found.voice === undefined
        ? writeBack(state.full, state.part, state.split, state.voice, deleteNote(state.score, c, found.note.slotId))
        : inVoice(state, found.voice, (vs) => deleteNote(vs, found.cell, found.note.slotId));
      const score = view(st, full);
      return { ...pushFull(st), full, score, cursor: clamp(score, c) };
    }
    case 'moveNotes': {
      if (action.voice === undefined) break;
      // a note of a given voice: moved inside that voice's tree
      const staff = profileById(state.score.profileId).staves[0];
      const from = clamp(state.score, action.from);
      const to = clamp(state.score, action.to);
      const was = staff.slots.find((x) => x.id === action.slotId);
      const dPos = was && action.staffPosition !== undefined ? action.staffPosition - was.staffPosition : 0;
      const tick = absTick(state.score, from);
      const delta = absTick(state.score, to) - tick;
      const full = inVoice(state, action.voice, (vs) => {
        const at = cellAt(vs, tick);
        return at.refused ? at : moveNotes(vs, [{ ...at, slotIds: [action.slotId] }], delta, dPos, staff);
      });
      if (full.refused) return { ...state, refused: full.refused };
      const score = view(state, full);
      return { ...syncTool({ ...pushFull(state), full, score, cursor: clamp(score, to), refused: null }), moved: { items: [to], count: 1 } };
    }
    case 'undo': {
      if (state.history.length === 0) return state;
      const [full, ...history] = state.history;
      const part = full.parts.some((p) => p.id === state.part) ? state.part : full.parts[0].id;
      const score = view(state, full, part);
      return syncTool({ ...state, full, part, score, history, refused: null, cursor: clamp(score, state.cursor) });
    }
    default: break;
  }
  const next = reduceView(state, action);
  if (next.score === state.score) return next;
  const op = BAR_OPS[action.type];
  const full = op ? applyAll(state.full, op(state, action)) : writeBack(state.full, state.part, state.split, state.voice, next.score);
  // read back through the full score: a voice that folded into one tree shows as it now is
  const score = view(next, full);
  return { ...next, full, score, cursor: clamp(score, next.cursor) };
}

function switchPart(st, part, force = false) {
  if (!force && part === st.part) return st;
  const score = viewOf(st.full, part, st.split, st.voice);
  const profile = profileById(score.profileId);
  const t = st.tool;
  const tool = {
    ...t,
    head: profile.heads.includes(t.head) ? t.head : null,
    tech: profile.techniques.includes(t.tech) ? t.tech : null,
    sticking: profile.hands ? t.sticking : null,
    accent: profile.articulations.includes('accent') && t.accent,
    ghost: profile.articulations.includes('ghost') && t.ghost,
    accidental: profile.palette.includes('accidental') ? t.accidental : null,
    dot: profile.palette.includes('length') ? t.dot : false,
    arts: t.arts.filter((a) => profile.articulations.includes(a)),
  };
  return syncTool({ ...st, part, score, tool, refused: null, cursor: clamp(score, st.cursor) });
}

function pushFull(st) {
  return { ...st, history: [st.full, ...st.history].slice(0, HISTORY) };
}

function reduceView(state, action) {
  const st = state.refused || state.selectedOnly || state.symbolsRemoved !== undefined || state.lyricsResult || state.autofilled || state.moved ? { ...state, refused: null, selectedOnly: false, symbolsRemoved: undefined, lyricsResult: undefined, autofilled: undefined, moved: undefined } : state;
  switch (action.type) {
    case 'tap': return tap(st, action.staffPosition);
    case 'tapAt': {
      // first tap on a cell selects it; a tap on the selected cell writes
      const target = clamp(st.score, { bar: st.cursor.bar, beat: action.beat, path: action.path });
      const same = target.beat === st.cursor.beat && target.path.join('.') === st.cursor.path.join('.');
      if (!same) return { ...syncTool({ ...st, cursor: target }), selectedOnly: true };
      return tap(st, action.staffPosition);
    }
    case 'selectValue': return split(st, action.value, st.tool.splitMode === 'cell' ? null : st.tool.tuplet);
    case 'selectTuplet': {
      if (st.tool.splitMode === 'cell') return split(st, shorter(currentValue(st)), action.n);
      return split(st, st.tool.value, st.tool.tuplet === action.n ? null : action.n);
    }
    case 'setSplitMode': return tool(st, { splitMode: ['cell', 'bar'].includes(action.mode) ? action.mode : 'beat' });
    case 'setStem': return tool(st, { stem: st.tool.stem === action.stem ? null : action.stem });
    case 'moveNotes': {
      const staff = profileById(st.score.profileId).staves[0];
      const from = clamp(st.score, action.from);
      const to = clamp(st.score, action.to);
      const was = staff.slots.find((x) => x.id === action.slotId);
      const dPos = was && action.staffPosition !== undefined ? action.staffPosition - was.staffPosition : 0;
      const s = moveNotes(st.score, [{ ...from, slotIds: [action.slotId] }], absTick(st.score, to) - absTick(st.score, from), dPos, staff);
      if (s.refused) return { ...st, refused: s.refused };
      return { ...syncTool({ ...push(st), score: s, cursor: to }), moved: { items: [to], count: 1 } };
    }
    case 'moveSelection': {
      const staff = profileById(st.score.profileId).staves[0];
      if (!action.items?.length) return { ...st, refused: 'nothingSelected' };
      if (action.mode === 'beats') {
        const list = beatList(st.score);
        const idx = (x) => list.findIndex((y) => y.bar === x.bar && y.beat === x.beat);
        const delta = idx(action.to) - idx(action.from);
        const s = moveBeats(st.score, action.items, delta);
        if (s.refused) return { ...st, refused: s.refused };
        const items = action.items.map((x) => { const y = list[idx(x) + delta]; return { bar: y.bar, beat: y.beat, path: [0] }; });
        return { ...syncTool({ ...push(st), score: s, cursor: clamp(s, items[0]) }), moved: { items, count: items.length } };
      }
      const delta = absTick(st.score, action.to) - absTick(st.score, action.from);
      const items = action.items.map((c) => cellAt(st.score, absTick(st.score, c) + delta));
      const s = moveNotes(st.score, action.items, delta, 0, staff);
      if (s.refused) return { ...st, refused: s.refused };
      return { ...syncTool({ ...push(st), score: s, cursor: clamp(s, items[0]) }), moved: { items, count: items.length } };
    }
    case 'autofill': {
      const staff = profileById(st.score.profileId).staves[0];
      // split voices: the voice being edited decides the stems
      const s = autofill(st.score, st.cursor.bar, action.slotId, action.pattern, staff, st.split && staff.voices ? null : st.tool.stem);
      if (s.refused) return { ...st, refused: s.refused };
      if (s === st.score) return st;
      return { ...push(st), score: s, autofilled: action };
    }
    case 'merge': {
      const s = mergeCell(st.score, st.cursor);
      if (s === st.score) return { ...st, refused: 'nothingToMerge' };
      return syncTool({ ...push(st), score: s, cursor: clamp(s, { ...st.cursor, path: st.cursor.path.slice(0, -1) }) });
    }
    case 'rest': return edit(st, (s) => clearLeaf(s, st.cursor));
    case 'next': return syncTool({ ...st, cursor: next(st.score, st.cursor) });
    case 'prev': return syncTool({ ...st, cursor: prev(st.score, st.cursor) });
    case 'goTo': return syncTool({ ...st, cursor: clamp(st.score, action.cursor) });
    case 'toggleDelete': return tool(st, { delete: !st.tool.delete });
    case 'toggleAccent': return tool(st, { accent: !st.tool.accent });
    case 'toggleGhost': return tool(st, { ghost: !st.tool.ghost });
    case 'setSticking': return tool(st, { sticking: st.tool.sticking === action.sticking ? null : action.sticking });
    case 'setHead': return tool(st, { head: st.tool.head === action.head ? null : action.head });
    case 'setTech': return tool(st, { tech: st.tool.tech === action.tech ? null : action.tech });
    case 'setWithNote': return tool(st, { withNote: action.on !== false });
    case 'setAccidental': return tool(st, { accidental: st.tool.accidental === action.alter ? null : action.alter });
    case 'toggleArt': return tool(st, { arts: st.tool.arts.includes(action.art) ? st.tool.arts.filter((a) => a !== action.art) : [...st.tool.arts, action.art] });
    case 'setKey': return edit(st, (s) => setKey(s, st.cursor.bar, action.key));
    case 'toggleDot': return tool(st, { dot: !st.tool.dot });
    case 'setDyn': return tool(st, { dyn: st.tool.dyn === action.dyn ? null : action.dyn });
    case 'setSlur': return edit(st, (s) => setSlur(s, st.cursor, action.kind));
    case 'setPedal': return edit(st, (s) => setPedal(s, st.cursor, action.kind));
    case 'pasteLyrics': {
      const r = distributeLyrics(st.score, st.cursor, action.text);
      const out = r.score === st.score ? st : { ...push(st), score: r.score };
      return { ...out, lyricsResult: { placed: r.placed, left: r.left } };
    }
    case 'setLyricAt': {
      const c = clamp(st.score, { bar: st.cursor.bar, beat: action.beat, path: action.path });
      const moved = syncTool({ ...st, cursor: c });
      return edit(moved, (s) => setLyric(s, c, action.text));
    }
    case 'setSwing': return edit(st, (s) => (!!s.swing === !!action.on ? s : { ...s, swing: !!action.on }));
    case 'setChord': {
      const s = setChord(st.score, st.cursor, action.text);
      if (s.refused) return { ...st, refused: s.refused };
      const out = s === st.score ? st : { ...push(st), score: s };
      if (!action.advance) return out;
      // chord symbols go by beat: Enter moves to the first cell of the next beat
      let c = out.cursor;
      for (let guard = 0; guard < 512; guard++) {
        const n = next(out.score, c);
        if (n === c) break;
        c = n;
        if (c.beat !== out.cursor.beat || c.bar !== out.cursor.bar) return syncTool({ ...out, cursor: c });
      }
      return out;
    }
    case 'setLyric': {
      // the one place the cursor may move on its own: typing lyrics, Enter goes to the next note
      const out = edit(st, (s) => setLyric(s, st.cursor, action.text));
      if (!action.advance) return out;
      let c = out.cursor;
      for (let guard = 0; guard < 512; guard++) {
        const n = next(out.score, c);
        if (n === c) break;
        c = n;
        const l = leafAt(out.score, c);
        if (l.notes.length && !l.cont) return syncTool({ ...out, cursor: c });
      }
      return out;
    }
    case 'setWedge': return tool(st, { wedge: st.tool.wedge === action.wedge ? null : action.wedge });
    case 'toggleTie': {
      const s = toggleTie(st.score, st.cursor);
      if (s.refused) return { ...st, refused: s.refused };
      return { ...push(st), score: s };
    }
    case 'moveBars': {
      const { score, range } = moveBars(st.score, action.from, action.to, action.gap);
      if (score === st.score) return st;
      // the cursor stays on the bar it was on, wherever that bar went
      const order = st.score.bars.map((_, i) => i);
      const block = order.slice(action.from, action.to + 1);
      const rest = [...order.slice(0, action.from), ...order.slice(action.to + 1)];
      const at = action.gap > action.to ? action.gap - block.length : action.gap;
      const moved = [...rest.slice(0, at), ...block, ...rest.slice(at)];
      const bar = moved.indexOf(st.cursor.bar);
      return { ...push(st), score, range, cursor: clamp(score, { ...st.cursor, bar }) };
    }
    case 'setBarText': return edit(st, (s) => setBarText(s, st.cursor.bar, action.text));
    case 'addBar': {
      const s = addBar(st.score);
      return syncTool({ ...push(st), score: s, cursor: mkCursor(s.bars.length - 1, 0, 0) });
    }
    case 'removeBar': {
      const s = removeBar(st.score, st.cursor.bar);
      if (s === st.score) return { ...st, refused: 'lastBar' };
      return syncTool({ ...push(st), score: s, cursor: clamp(s, mkCursor(st.cursor.bar, 0, 0)) });
    }
    case 'setTimeSig': return syncTool(clampCursor(edit(st, (s) => setTimeSig(s, st.cursor.bar, action.sig))));
    case 'toggleSimile': {
      const s = toggleSimile(st.score, st.cursor.bar);
      if (s === st.score) return { ...st, refused: 'simileFirstBar' };
      return { ...push(st), score: s };
    }
    case 'toggleRepeatStart': return edit(st, (s) => toggleRepeatStart(s, st.cursor.bar));
    case 'toggleRepeatEnd': return edit(st, (s) => toggleRepeatEnd(s, st.cursor.bar));
    case 'setTitle': return edit(st, (s) => ({ ...s, title: action.title }));
    case 'setBpm': return edit(st, (s) => ({ ...s, defaultBpm: action.bpm }));
    case 'setScore': return initialState(action.score);
    default: return st;
  }
}

function tap(st, staffPosition) {
  const profile = profileById(st.score.profileId);
  const staff = profile.staves[0];
  // a rhythm slash sits on the middle line, wherever the tap was
  const slot = staff.pitched && st.tool.head === 'slash' && st.tool.withNote
    ? staff.slots.find((x) => x.staffPosition === 4) ?? slotNearest(staff, 4)
    : slotFor(staff, staffPosition, st.tool.head);
  // a head that names the instrument there (triangle: cowbell) is that instrument's own head
  const ownHead = slot.notehead === st.tool.head;
  const writtenKey = partKey(barKey(st.score, st.cursor.bar), profile);
  if (st.score.bars[st.cursor.bar].simile) return { ...st, refused: 'simileBar' };
  if (st.tool.delete) return edit(st, (s) => deleteNote(s, st.cursor, slot.id));
  const { head, tech, sticking, accent, ghost } = st.tool;
  const techFields = {
    marks: Object.values(Mark).includes(tech) ? [tech] : [],
    roll: Object.values(Roll).includes(tech) ? tech : null,
    grace: Object.values(Grace).includes(tech) ? tech : null,
  };
  if (!st.tool.withNote) {
    // dynamics belong to the cell: they go on even when it is empty
    const onlyCell = (st.tool.dyn || st.tool.wedge) && !st.tool.accent && !st.tool.ghost && !st.tool.sticking && !st.tool.head && !st.tool.tech && st.tool.accidental === null && st.tool.arts.length === 0;
    const marked = cellMarks(st);
    if (onlyCell) return marked;
    const out = applySymbols(marked, staffPosition, techFields);
    return out.refused && marked !== st ? marked : out;
  }
  const articulations = [];
  if (accent) articulations.push(Articulation.ACCENT);
  if (ghost) articulations.push(Articulation.GHOST);
  articulations.push(...st.tool.arts);
  // pitched: the chosen accidental, else what the key signature gives that letter
  const alter = staff.pitched
    ? (head === 'slash' ? 0 : st.tool.accidental ?? keyAlter(writtenKey, parseSlot(slot.id).step))
    : undefined;
  const written = note(slot.id, { articulations, sticking, head: ownHead ? null : head, ...techFields, alter });
  const placed = edit(st, (s) => placeNote(s, st.cursor, st.tool.stem && staff.voices ? withStem(written, st.tool.stem, staff) : written));
  return cellMarks(placed, placed !== st);
}

/**
 * "Só símbolo": add the chosen symbols to the note already at that height, no new note. If the
 * note already carries all of them, they come off again, so a second tap undoes the first.
 */
function applySymbols(st, staffPosition, techFields) {
  const { head, tech, sticking, accent, ghost, accidental } = st.tool;
  const extraArts = st.tool.arts;
  const staffV = profileById(st.score.profileId).staves[0];
  const stem = staffV.voices ? st.tool.stem : null;
  if (!accent && !ghost && !sticking && !head && !tech && accidental === null && extraArts.length === 0 && !stem) return { ...st, refused: 'nothingToApply' };
  // anywhere in the cell counts; with several notes, the one nearest the tap height
  const staff = profileById(st.score.profileId).staves[0];
  const pos = (n) => staff.slots.find((x) => x.id === n.slotId)?.staffPosition ?? 0;
  const existing = leafAt(st.score, st.cursor).notes
    .reduce((best, n) => (!best || Math.abs(pos(n) - staffPosition) < Math.abs(pos(best) - staffPosition) ? n : best), null);
  if (!existing) return { ...st, refused: 'noNoteThere' };
  const arts = [accent && Articulation.ACCENT, ghost && Articulation.GHOST, ...extraArts].filter(Boolean);
  const has = arts.every((a) => existing.articulations.includes(a))
    && (!sticking || existing.sticking === sticking)
    && (!head || existing.head === head)
    && (!techFields.marks.length || (existing.marks ?? []).includes(techFields.marks[0]))
    && (!techFields.roll || existing.roll === techFields.roll)
    && (!techFields.grace || existing.grace === techFields.grace)
    && (accidental === null || existing.alter === accidental)
    && (!stem || existing.stem === stem);
  const next = has
    ? {
      ...existing,
      articulations: existing.articulations.filter((a) => !arts.includes(a)),
      sticking: sticking ? null : existing.sticking,
      head: head ? null : existing.head,
      marks: techFields.marks.length ? [] : existing.marks,
      roll: techFields.roll ? null : existing.roll,
      grace: techFields.grace ? null : existing.grace,
      ...(accidental !== null ? { alter: keyAlter(partKey(barKey(st.score, st.cursor.bar), profileById(st.score.profileId)), parseSlot(existing.slotId).step) } : {}),
    }
    : {
      ...existing,
      articulations: [...new Set([...existing.articulations, ...arts])],
      sticking: sticking ?? existing.sticking,
      head: head ?? existing.head,
      marks: techFields.marks.length ? techFields.marks : existing.marks,
      roll: techFields.roll ?? existing.roll,
      grace: techFields.grace ?? existing.grace,
      ...(accidental !== null ? { alter: accidental } : {}),
    };
  // the stem: set flips the note, a second tap gives it back its instrument's direction
  const flipped = stem ? (has ? (({ stem: _, ...r }) => r)(next) : withStem(next, stem, staffV)) : next;
  return { ...edit(st, (s) => placeNote(s, st.cursor, flipped)), symbolsRemoved: has };
}

function split(st, value, tuplet) {
  // pitched, Tempo mode: a value longer than the beat, or dotted, is a note length, not a split
  const pitched = profileById(st.score.profileId).palette.includes('length');
  const [, den] = barTimeSig(st.score, st.cursor.bar);
  if (pitched && st.tool.splitMode === 'beat' && !tuplet && (st.tool.dot || value.divisionsPerWhole < den)) {
    const s = setLength(st.score, st.cursor, value, st.tool.dot);
    if (s.refused) return { ...st, refused: s.refused };
    const head = barLeaves(s, st.cursor.bar).find((l) => l.leaf.notes.length && l.start <= startTick(st) && !l.leaf.cont) ?? null;
    const cur = head && value.divisionsPerWhole < den ? { bar: st.cursor.bar, beat: head.beat, path: head.path } : clamp(s, st.cursor);
    return { ...syncTool({ ...push(st), score: s, cursor: cur }), tool: { ...st.tool, value, dotted: st.tool.dot } };
  }
  if (st.tool.splitMode === 'cell') {
    const s = resizeCell(st.score, st.cursor, value, tuplet);
    if (s.refused) return { ...st, refused: s.refused };
    if (s === st.score) return { ...st, refused: 'sameValue' };
    const before = leafCount(st.score, st.cursor);
    const after = leafCount(s, st.cursor);
    // split: go into the first new cell; merge: land on the merged cell
    const path = after > before ? [...st.cursor.path, 0] : st.cursor.path;
    return syncTool({ ...push(st), score: s, cursor: clamp(s, { ...st.cursor, path: after > before ? path : shrinkTo(s, st.cursor) }) });
  }
  if (st.tool.splitMode === 'bar') {
    // the whole bar: every beat split the same way
    const out = edit(st, (s) => s.bars[st.cursor.bar].beats.reduce((acc, _, b) => splitBeat(acc, { ...st.cursor, beat: b }, value, tuplet), s));
    return syncTool(clampCursor({ ...out, cursor: { ...out.cursor, path: [Math.min(out.cursor.path[0], 99)] } }));
  }
  const out = edit(st, (s) => splitBeat(s, st.cursor, value, tuplet));
  return syncTool(clampCursor({ ...out, cursor: { ...out.cursor, path: [Math.min(out.cursor.path[0], 99)] } }));
}

/**
 * Put the chosen dynamic and cresc./dim. on the selected cell (if not already there).
 * `pushed`: the note write before this already saved an undo step; otherwise save one here.
 */
function cellMarks(st, pushed = false) {
  const l = leafAt(st.score, st.cursor);
  let s = st.score;
  if (st.tool.dyn && l.dyn !== st.tool.dyn) s = setDynamic(s, st.cursor, st.tool.dyn);
  if (st.tool.wedge && l.wedge !== st.tool.wedge) s = setWedge(s, st.cursor, st.tool.wedge);
  if (s === st.score) return st;
  return pushed ? { ...st, score: s } : { ...push(st), score: s };
}

function startTick(st) {
  const l = barLeaves(st.score, st.cursor.bar).find((x) => x.beat === st.cursor.beat && x.path.join('.') === st.cursor.path.join('.'));
  return l ? l.start : 0;
}

function leafCount(score, c) {
  return leafPaths(score.bars[c.bar].beats[c.beat]).length;
}

/** After a merge, the deepest prefix of the old path that is now a leaf. */
function shrinkTo(score, c) {
  const beat = score.bars[c.bar].beats[c.beat];
  for (let k = c.path.length; k >= 1; k--) {
    const node = getAt(beat, c.path.slice(0, k));
    if (node && !node.cells) return c.path.slice(0, k);
  }
  return [0];
}

function currentValue(st) {
  return parentOf(st.score.bars[st.cursor.bar].beats[st.cursor.beat], st.cursor.path).division;
}

function shorter(value) {
  const i = NOTE_VALUES.indexOf(value);
  return NOTE_VALUES[Math.min(i + 1, NOTE_VALUES.length - 1)];
}

function edit(st, f) {
  const score = f(st.score);
  if (score === st.score) return st;
  return { ...push(st), score };
}

function push(st) {
  return pushFull(st);
}

function tool(st, patch) {
  return { ...st, tool: { ...st.tool, ...patch } };
}

function clampCursor(st) {
  return { ...st, cursor: clamp(st.score, st.cursor) };
}

/** The palette shows the value of the cell under the cursor, so what you see is what a tap gets. */
function syncTool(st) {
  const g = parentOf(st.score.bars[st.cursor.bar].beats[st.cursor.beat], st.cursor.path);
  return { ...st, tool: { ...st.tool, value: g.division, tuplet: g.tuplet } };
}

export { leafAt };
