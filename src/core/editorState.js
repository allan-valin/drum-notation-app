import { NoteValue, NOTE_VALUES } from './noteValue.js';
import { note, Articulation } from './score.js';
import { cursor as mkCursor, next, prev, leafAt, clamp } from './cursor.js';
import { parentOf } from './tree.js';
import {
  placeNote, deleteNote, clearLeaf, splitBeat, splitCell, mergeCell, addBar, removeBar,
  setTimeSig, toggleSimile, toggleRepeatStart, toggleRepeatEnd, setBarText,
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
    tool: { value: NoteValue.QUARTER, tuplet: null, delete: false, accent: false, ghost: false, sticking: null, splitMode: 'beat', head: null, mark: null, roll: null, grace: null },
    history: [],
    refused: null,
  };
  return syncTool(clampCursor(st));
}

export function reduce(state, action) {
  const st = state.refused ? { ...state, refused: null } : state;
  switch (action.type) {
    case 'tap': return tap(st, action.staffPosition);
    case 'tapAt': {
      const moved = syncTool({ ...st, cursor: clamp(st.score, { bar: st.cursor.bar, beat: action.beat, path: action.path }) });
      return tap(moved, action.staffPosition);
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
    case 'setMark': return tool(st, { mark: st.tool.mark === action.mark ? null : action.mark });
    case 'setRoll': return tool(st, { roll: st.tool.roll === action.roll ? null : action.roll });
    case 'setGrace': return tool(st, { grace: st.tool.grace === action.grace ? null : action.grace });
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
  const articulations = [];
  if (st.tool.accent) articulations.push(Articulation.ACCENT);
  if (st.tool.ghost) articulations.push(Articulation.GHOST);
  const { head, mark, roll, grace, sticking } = st.tool;
  return edit(st, (s) => placeNote(s, st.cursor, note(slot.id, { articulations, sticking, head, marks: mark ? [mark] : [], roll, grace })));
}

function split(st, value, tuplet) {
  if (st.tool.splitMode === 'cell') {
    const s = splitCell(st.score, st.cursor, value, tuplet);
    if (s === st.score) return { ...st, refused: 'notShorter' };
    const deeper = clamp(s, { ...st.cursor, path: [...st.cursor.path, 0] });
    return syncTool({ ...push(st), score: s, cursor: deeper });
  }
  const out = edit(st, (s) => splitBeat(s, st.cursor, value, tuplet));
  return syncTool(clampCursor({ ...out, cursor: { ...out.cursor, path: [Math.min(out.cursor.path[0], 99)] } }));
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
