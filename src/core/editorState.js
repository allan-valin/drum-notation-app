import { NoteValue } from './noteValue.js';
import { note, cell as mkCell, Articulation } from './score.js';
import { cursor as mkCursor, next, prev, beatAt, clamp } from './cursor.js';
import { placeNote, deleteNote, subdivide, addBar, removeBar } from './edit.js';
import { profileById, slotNearest } from './profile.js';

const HISTORY = 50;

/**
 * Every interaction rule from the spec lives here, as a pure reducer, so the Svelte
 * component only dispatches. The cursor never auto-advances: only next/prev/goTo move it.
 */
export function initialState(score) {
  const st = {
    score,
    cursor: mkCursor(0, 0, 0),
    tool: { value: NoteValue.QUARTER, tuplet: null, delete: false, accent: false, ghost: false, sticking: null },
    history: [],
  };
  return syncTool(st);
}

export function reduce(st, action) {
  switch (action.type) {
    case 'tap': return tap(st, action.staffPosition);
    case 'selectValue': return resplit(st, action.value, st.tool.tuplet);
    case 'selectTuplet': return resplit(st, st.tool.value, st.tool.tuplet === action.n ? null : action.n);
    case 'rest': return edit(st, (s) => clearCell(s, st.cursor));
    case 'next': return syncTool({ ...st, cursor: next(st.score, st.cursor) });
    case 'prev': return syncTool({ ...st, cursor: prev(st.score, st.cursor) });
    case 'goTo': return syncTool({ ...st, cursor: clamp(st.score, action.cursor) });
    case 'toggleDelete': return tool(st, { delete: !st.tool.delete });
    case 'toggleAccent': return tool(st, { accent: !st.tool.accent });
    case 'toggleGhost': return tool(st, { ghost: !st.tool.ghost });
    case 'setSticking': return tool(st, { sticking: st.tool.sticking === action.sticking ? null : action.sticking });
    case 'addBar': {
      const s = addBar(st.score);
      return syncTool({ ...push(st), score: s, cursor: mkCursor(s.bars.length - 1, 0, 0) });
    }
    case 'removeBar': {
      const s = removeBar(st.score, st.cursor.bar);
      if (s === st.score) return st;
      return syncTool({ ...push(st), score: s, cursor: clamp(s, mkCursor(st.cursor.bar, 0, 0)) });
    }
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
  if (st.tool.delete) return edit(st, (s) => deleteNote(s, st.cursor, slot.id));
  const articulations = [];
  if (st.tool.accent) articulations.push(Articulation.ACCENT);
  if (st.tool.ghost) articulations.push(Articulation.GHOST);
  return edit(st, (s) => placeNote(s, st.cursor, note(slot.id, { articulations, sticking: st.tool.sticking })));
}

function resplit(st, value, tuplet) {
  const out = edit(st, (s) => subdivide(s, st.cursor, value, tuplet));
  return { ...out, cursor: clamp(out.score, out.cursor), tool: { ...out.tool, value, tuplet } };
}

function clearCell(score, c) {
  return {
    ...score,
    bars: score.bars.map((bar, bi) =>
      bi !== c.bar ? bar : {
        ...bar,
        beats: bar.beats.map((b, i) =>
          i !== c.beat ? b : { ...b, cells: b.cells.map((x, ci) => (ci === c.cell ? mkCell() : x)) },
        ),
      }),
  };
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

/** The palette shows the focused beat's own subdivision, so what you see is what a tap gets. */
function syncTool(st) {
  const b = beatAt(st.score, st.cursor);
  return { ...st, tool: { ...st.tool, value: b.division, tuplet: b.tuplet } };
}
