import { NoteValue, NOTE_VALUES } from './noteValue.js';
import { note, Articulation, Mark, Roll, Grace } from './score.js';
import { cursor as mkCursor, next, prev, leafAt, clamp } from './cursor.js';
import { parentOf, leafPaths, getAt } from './tree.js';
import {
  placeNote, deleteNote, clearLeaf, splitBeat, splitCell, resizeCell, mergeCell, addBar, removeBar,
  setTimeSig, toggleSimile, toggleRepeatStart, toggleRepeatEnd, setBarText, moveBars,
} from './edit.js';
import { profileById, slotNearest } from './profile.js';

const HISTORY = 50;

/**
 * Every interaction rule lives here, as a pure reducer; the Svelte component only dispatches.
 * `refused` is set when an action did nothing on purpose, so the status line can say why.
 */
export function initialState(score) {
  const st = {
    score,
    cursor: mkCursor(0, 0, 0),
    tool: { value: NoteValue.QUARTER, tuplet: null, delete: false, accent: false, ghost: false, sticking: null, splitMode: 'beat', head: null, tech: null, withNote: true },
    history: [],
    refused: null,
  };
  return syncTool(clampCursor(st));
}

export function reduce(state, action) {
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
    case 'undo': {
      if (st.history.length === 0) return st;
      const [score, ...history] = st.history;
      return syncTool({ ...st, score, history, cursor: clamp(score, st.cursor) });
    }
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
  if (!st.tool.withNote) return applySymbols(st, slot.id, techFields);
  const articulations = [];
  if (accent) articulations.push(Articulation.ACCENT);
  if (ghost) articulations.push(Articulation.GHOST);
  return edit(st, (s) => placeNote(s, st.cursor, note(slot.id, { articulations, sticking, head, ...techFields })));
}

/**
 * "Só símbolo": add the chosen symbols to the note already at that height, no new note. If the
 * note already carries all of them, they come off again, so a second tap undoes the first.
 */
function applySymbols(st, slotId, techFields) {
  const { head, tech, sticking, accent, ghost } = st.tool;
  if (!accent && !ghost && !sticking && !head && !tech) return { ...st, refused: 'nothingToApply' };
  const existing = leafAt(st.score, st.cursor).notes.find((n) => n.slotId === slotId);
  if (!existing) return { ...st, refused: 'noNoteThere' };
  const arts = [accent && Articulation.ACCENT, ghost && Articulation.GHOST].filter(Boolean);
  const has = arts.every((a) => existing.articulations.includes(a))
    && (!sticking || existing.sticking === sticking)
    && (!head || existing.head === head)
    && (!techFields.marks.length || (existing.marks ?? []).includes(techFields.marks[0]))
    && (!techFields.roll || existing.roll === techFields.roll)
    && (!techFields.grace || existing.grace === techFields.grace);
  const next = has
    ? {
      ...existing,
      articulations: existing.articulations.filter((a) => !arts.includes(a)),
      sticking: sticking ? null : existing.sticking,
      head: head ? null : existing.head,
      marks: techFields.marks.length ? [] : existing.marks,
      roll: techFields.roll ? null : existing.roll,
      grace: techFields.grace ? null : existing.grace,
    }
    : {
      ...existing,
      articulations: [...new Set([...existing.articulations, ...arts])],
      sticking: sticking ?? existing.sticking,
      head: head ?? existing.head,
      marks: techFields.marks.length ? techFields.marks : existing.marks,
      roll: techFields.roll ?? existing.roll,
      grace: techFields.grace ?? existing.grace,
    };
  return { ...edit(st, (s) => placeNote(s, st.cursor, next)), symbolsRemoved: has };
}

function split(st, value, tuplet) {
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
  return { ...st, history: [st.score, ...st.history].slice(0, HISTORY) };
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
