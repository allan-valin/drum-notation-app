import { describe, it, expect } from 'vitest';
import { NoteValue } from '../src/core/noteValue.js';
import { newScore, note } from '../src/core/score.js';
import { cursor, leafAt } from '../src/core/cursor.js';
import { splitBeat, splitCell, placeNote, resizeCell } from '../src/core/edit.js';
import { leafPaths } from '../src/core/tree.js';
import { initialState, reduce } from '../src/core/editorState.js';

const s0 = () => newScore({ title: 't' });
const nested = () => splitCell(splitBeat(s0(), cursor(0, 0, 0), NoteValue.EIGHTH, null), cursor(0, 0, 1), NoteValue.SIXTEENTH, null);

describe('resizeCell: Célula mode in both directions', () => {
  it('a shorter value splits the cell, as before', () => {
    const s = resizeCell(splitBeat(s0(), cursor(0, 0, 0), NoteValue.EIGHTH, null), cursor(0, 0, 1), NoteValue.SIXTEENTH, null);
    expect(leafPaths(s.bars[0].beats[0])).toEqual([[0], [1, 0], [1, 1]]);
  });
  it('a longer value merges the split back when nothing is lost', () => {
    const r = resizeCell(nested(), cursor(0, 0, 1, 1), NoteValue.EIGHTH, null);
    expect(leafPaths(r.bars[0].beats[0])).toEqual([[0], [1]]);
  });
  it('two levels up in one step', () => {
    const deep = splitCell(nested(), cursor(0, 0, 1, 1), NoteValue.THIRTY_SECOND, null);
    const r = resizeCell(deep, cursor(0, 0, 1, 1, 0), NoteValue.EIGHTH, null);
    expect(leafPaths(r.bars[0].beats[0])).toEqual([[0], [1]]);
  });
  it('a value as long as the beat makes the beat one cell', () => {
    const r = resizeCell(nested(), cursor(0, 0, 1, 0), NoteValue.QUARTER, null);
    expect(leafPaths(r.bars[0].beats[0])).toEqual([[0]]);
    expect(r.bars[0].beats[0].division).toBe(NoteValue.QUARTER);
  });
  it('keeps the first notes of the merged part', () => {
    const s = placeNote(nested(), cursor(0, 0, 1, 0), note('snare'));
    const r = resizeCell(s, cursor(0, 0, 1, 1), NoteValue.EIGHTH, null);
    expect(leafAt(r, cursor(0, 0, 1)).notes.map((n) => n.slotId)).toEqual(['snare']);
  });
  it('refuses when merging would delete notes, and says why', () => {
    const s = placeNote(nested(), cursor(0, 0, 1, 1), note('snare'));
    const r = resizeCell(s, cursor(0, 0, 1, 0), NoteValue.EIGHTH, null);
    expect(r).toEqual({ refused: 'wouldLoseNotes' });
  });
  it('the same value changes nothing', () => {
    const s = nested();
    expect(resizeCell(s, cursor(0, 0, 1, 0), NoteValue.SIXTEENTH, null)).toBe(s);
  });
});

describe('tap rules', () => {
  const start = () => initialState(s0());
  it('a tap on another cell only selects it', () => {
    const st = reduce(start(), { type: 'tapAt', beat: 2, path: [0], staffPosition: 4 });
    expect(st.cursor).toEqual(cursor(0, 2, 0));
    expect(leafAt(st.score, st.cursor).notes).toEqual([]);
    expect(st.history.length).toBe(0);
  });
  it('a tap on the selected cell places the note', () => {
    let st = reduce(start(), { type: 'tapAt', beat: 2, path: [0], staffPosition: 4 });
    st = reduce(st, { type: 'tapAt', beat: 2, path: [0], staffPosition: 4 });
    expect(leafAt(st.score, st.cursor).notes.map((n) => n.slotId)).toEqual(['snare']);
  });
  it('in Célula mode a longer value merges up through the reducer', () => {
    let st = initialState(nested());
    st = reduce(st, { type: 'goTo', cursor: cursor(0, 0, 1, 1) });
    st = reduce(st, { type: 'setSplitMode', mode: 'cell' });
    st = reduce(st, { type: 'selectValue', value: NoteValue.EIGHTH });
    expect(leafPaths(st.score.bars[0].beats[0])).toEqual([[0], [1]]);
    expect(st.cursor).toEqual(cursor(0, 0, 1));
    expect(st.tool.value).toBe(NoteValue.EIGHTH);
  });
  it('a refused merge leaves the score and reports the reason', () => {
    let st = initialState(placeNote(nested(), cursor(0, 0, 1, 1), note('snare')));
    st = reduce(reduce(reduce(st, { type: 'goTo', cursor: cursor(0, 0, 1, 0) }), { type: 'setSplitMode', mode: 'cell' }), { type: 'selectValue', value: NoteValue.EIGHTH });
    expect(st.refused).toBe('wouldLoseNotes');
    expect(leafPaths(st.score.bars[0].beats[0]).length).toBe(3);
  });
});
