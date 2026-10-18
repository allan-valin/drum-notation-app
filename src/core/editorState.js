import { NoteValue, NOTE_VALUES } from './noteValue.js';
import { note, Articulation, Mark, Roll, Grace, barKey, barTimeSig } from './score.js';
import { parseSlot, keyAlter } from './pitch.js';
import { cursor as mkCursor, next, prev, leafAt, clamp } from './cursor.js';
import { parentOf, leafPaths, getAt } from './tree.js';
import {
  placeNote, deleteNote, clearLeaf, splitBeat, splitCell, resizeCell, mergeCell, addBar, removeBar,
  setTimeSig, toggleSimile, toggleRepeatStart, toggleRepeatEnd, setBarText, moveBars, setKey, setLength, toggleTie, setDynamic, setWedge, setLyric, setSlur,
} from './edit.js';
import { barLeaves } from './edit.js';
import { profileById, slotNearest } from './profile.js';
import { toFull, partView, zipPart, applyAll, addPart, removePart, setInstrument, toggleMute } from './parts.js';

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
    score: partView(full, part),
    cursor: mkCursor(0, 0, 0),
    tool: { value: NoteValue.QUARTER, tuplet: null, delete: false, accent: false, ghost: false, sticking: null, splitMode: 'beat', head: null, tech: null, withNote: true, accidental: null, arts: [], dot: false, dyn: null, wedge: null },
    history: [],
    refused: null,
  };
  return syncTool(clampCursor(st));
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
    case 'undo': {
      if (state.history.length === 0) return state;
      const [full, ...history] = state.history;
      const part = full.parts.some((p) => p.id === state.part) ? state.part : full.parts[0].id;
      const score = partView(full, part);
      return syncTool({ ...state, full, part, score, history, refused: null, cursor: clamp(score, state.cursor) });
    }
    default: break;
  }
  const next = reduceView(state, action);
  if (next.score === state.score) return next;
  const op = BAR_OPS[action.type];
  const full = op ? applyAll(state.full, op(state, action)) : zipPart(state.full, state.part, next.score);
  const score = op ? partView(full, state.part) : next.score;
  return { ...next, full, score, cursor: clamp(score, next.cursor) };
}

function switchPart(st, part, force = false) {
  if (!force && part === st.part) return st;
  const score = partView(st.full, part);
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
    dot: profile.staves[0].pitched ? t.dot : false,
    arts: t.arts.filter((a) => profile.articulations.includes(a)),
  };
  return syncTool({ ...st, part, score, tool, refused: null, cursor: clamp(score, st.cursor) });
}

function pushFull(st) {
  return { ...st, history: [st.full, ...st.history].slice(0, HISTORY) };
}

function reduceView(state, action) {
  const st = state.refused || state.selectedOnly || state.symbolsRemoved !== undefined ? { ...state, refused: null, selectedOnly: false, symbolsRemoved: undefined } : state;
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
    case 'setSplitMode': return tool(st, { splitMode: action.mode === 'cell' ? 'cell' : 'beat' });
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
  const staff = profileById(st.score.profileId).staves[0];
  const slot = slotNearest(staff, staffPosition);
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
    ? st.tool.accidental ?? keyAlter(barKey(st.score, st.cursor.bar), parseSlot(slot.id).step)
    : undefined;
  const placed = edit(st, (s) => placeNote(s, st.cursor, note(slot.id, { articulations, sticking, head, ...techFields, alter })));
  return cellMarks(placed, placed !== st);
}

/**
 * "Só símbolo": add the chosen symbols to the note already at that height, no new note. If the
 * note already carries all of them, they come off again, so a second tap undoes the first.
 */
function applySymbols(st, staffPosition, techFields) {
  const { head, tech, sticking, accent, ghost, accidental } = st.tool;
  const extraArts = st.tool.arts;
  if (!accent && !ghost && !sticking && !head && !tech && accidental === null && extraArts.length === 0) return { ...st, refused: 'nothingToApply' };
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
    && (accidental === null || existing.alter === accidental);
  const next = has
    ? {
      ...existing,
      articulations: existing.articulations.filter((a) => !arts.includes(a)),
      sticking: sticking ? null : existing.sticking,
      head: head ? null : existing.head,
      marks: techFields.marks.length ? [] : existing.marks,
      roll: techFields.roll ? null : existing.roll,
      grace: techFields.grace ? null : existing.grace,
      ...(accidental !== null ? { alter: keyAlter(barKey(st.score, st.cursor.bar), parseSlot(existing.slotId).step) } : {}),
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
  return { ...edit(st, (s) => placeNote(s, st.cursor, next)), symbolsRemoved: has };
}

function split(st, value, tuplet) {
  // pitched, Tempo mode: a value longer than the beat, or dotted, is a note length, not a split
  const pitched = profileById(st.score.profileId).staves[0].pitched;
  const [, den] = barTimeSig(st.score, st.cursor.bar);
  if (pitched && st.tool.splitMode !== 'cell' && !tuplet && (st.tool.dot || value.divisionsPerWhole < den)) {
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
