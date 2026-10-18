import { describe, it, expect } from 'vitest';
import { initialState, reduce } from '../src/core/editorState.js';
import { newScore, Articulation, Sticking } from '../src/core/score.js';
import { NoteValue } from '../src/core/noteValue.js';
import { cursor, beatAt } from '../src/core/cursor.js';

const snarePos = 4;
const kickPos = -2;
const start = () => initialState(newScore({ id: 'a', title: 't' }));
const notes = (st) => beatAt(st.score, st.cursor).cells[st.cursor.cell].notes;
const run = (st, ...actions) => actions.reduce((s, a) => reduce(s, a), st);

describe('editor state', () => {
  it('starts at the first cell with the quarter selected and nothing toggled', () => {
    const st = start();
    expect(st.cursor).toEqual(cursor(0, 0, 0));
    expect(st.tool.value).toBe(NoteValue.QUARTER);
    expect(st.tool.delete).toBe(false);
  });
  it('tapping the staff places a note at the nearest slot', () => {
    const st = run(start(), { type: 'tap', staffPosition: snarePos });
    expect(notes(st).map((n) => n.slotId)).toEqual(['snare']);
  });
  it('tapping a different height adds a simultaneous note; the cursor stays', () => {
    const st = run(start(), { type: 'tap', staffPosition: kickPos }, { type: 'tap', staffPosition: snarePos });
    expect(notes(st).map((n) => n.slotId).sort()).toEqual(['kick', 'snare']);
    expect(st.cursor).toEqual(cursor(0, 0, 0));
  });
  it('selecting a value subdivides the focused beat and becomes the tool', () => {
    const st = run(start(), { type: 'selectValue', value: NoteValue.SIXTEENTH });
    expect(beatAt(st.score, st.cursor).cells.length).toBe(4);
    expect(st.tool.value).toBe(NoteValue.SIXTEENTH);
  });
  it('a tuplet re-subdivides with the current value', () => {
    const st = run(start(), { type: 'selectValue', value: NoteValue.EIGHTH }, { type: 'selectTuplet', n: 3 });
    expect(beatAt(st.score, st.cursor).cells.length).toBe(3);
    expect(st.tool.tuplet).toBe(3);
    const off = reduce(st, { type: 'selectTuplet', n: 3 });
    expect(off.tool.tuplet).toBe(null);
    expect(beatAt(off.score, off.cursor).cells.length).toBe(2);
  });
  it('next and prev move through sub-positions and sync the palette to the beat', () => {
    let st = run(start(), { type: 'selectValue', value: NoteValue.EIGHTH }, { type: 'next' });
    expect(st.cursor).toEqual(cursor(0, 0, 1));
    st = reduce(st, { type: 'next' });
    expect(st.cursor).toEqual(cursor(0, 1, 0));
    expect(st.tool.value).toBe(NoteValue.QUARTER);
    st = reduce(st, { type: 'prev' });
    expect(st.tool.value).toBe(NoteValue.EIGHTH);
  });
  it('the delete toggle makes a tap remove the nearest slot and latches', () => {
    let st = run(start(), { type: 'tap', staffPosition: snarePos }, { type: 'tap', staffPosition: kickPos }, { type: 'toggleDelete' });
    expect(st.tool.delete).toBe(true);
    st = reduce(st, { type: 'tap', staffPosition: snarePos });
    expect(notes(st).map((n) => n.slotId)).toEqual(['kick']);
    expect(st.tool.delete).toBe(true);
  });
  it('accent, ghost and sticking toggles ride along on the next placed note', () => {
    const st = run(start(), { type: 'toggleAccent' }, { type: 'toggleGhost' }, { type: 'setSticking', sticking: Sticking.L }, { type: 'tap', staffPosition: snarePos });
    expect(notes(st)[0].articulations.sort()).toEqual([Articulation.ACCENT, Articulation.GHOST].sort());
    expect(notes(st)[0].sticking).toBe(Sticking.L);
  });
  it('tapping the same height with a different accent overwrites', () => {
    const st = run(start(), { type: 'tap', staffPosition: snarePos }, { type: 'toggleAccent' }, { type: 'tap', staffPosition: snarePos });
    expect(notes(st).length).toBe(1);
    expect(notes(st)[0].articulations).toEqual([Articulation.ACCENT]);
  });
  it('rest clears the current cell', () => {
    const st = run(start(), { type: 'tap', staffPosition: snarePos }, { type: 'rest' });
    expect(notes(st)).toEqual([]);
  });
  it('addBar appends and moves the cursor to it; removeBar drops the current bar', () => {
    let st = run(start(), { type: 'addBar' });
    expect(st.score.bars.length).toBe(2);
    expect(st.cursor).toEqual(cursor(1, 0, 0));
    st = reduce(st, { type: 'removeBar' });
    expect(st.score.bars.length).toBe(1);
    expect(st.cursor).toEqual(cursor(0, 0, 0));
  });
  it('undo restores the previous score', () => {
    let st = run(start(), { type: 'tap', staffPosition: snarePos }, { type: 'tap', staffPosition: kickPos });
    st = reduce(st, { type: 'undo' });
    expect(notes(st).map((n) => n.slotId)).toEqual(['snare']);
    st = reduce(st, { type: 'undo' });
    expect(notes(st)).toEqual([]);
    expect(reduce(st, { type: 'undo' }).score).toBe(st.score);
  });
  it('setTitle and setBpm edit the score header', () => {
    const st = run(start(), { type: 'setTitle', title: 'Paradiddle' }, { type: 'setBpm', bpm: 100 });
    expect(st.score.title).toBe('Paradiddle');
    expect(st.score.defaultBpm).toBe(100);
  });
  it('goTo jumps to a beat and syncs the palette', () => {
    let st = run(start(), { type: 'next' }, { type: 'selectValue', value: NoteValue.EIGHTH });
    st = reduce(st, { type: 'goTo', cursor: cursor(0, 0, 0) });
    expect(st.tool.value).toBe(NoteValue.QUARTER);
    st = reduce(st, { type: 'goTo', cursor: cursor(0, 1, 1) });
    expect(st.tool.value).toBe(NoteValue.EIGHTH);
  });
});
