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
    const st = reduce(start(), { type: 'tapAt', beat: 2, path: [0], staffPosition: 5 });
    expect(st.cursor).toEqual(cursor(0, 2, 0));
    expect(leafAt(st.score, st.cursor).notes).toEqual([]);
    expect(st.history.length).toBe(0);
  });
  it('a tap on the selected cell places the note', () => {
    let st = reduce(start(), { type: 'tapAt', beat: 2, path: [0], staffPosition: 5 });
    st = reduce(st, { type: 'tapAt', beat: 2, path: [0], staffPosition: 5 });
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

import { Mark, Roll, Grace, Articulation, Sticking } from '../src/core/score.js';
import { Notehead } from '../src/core/profile.js';

describe('symbol-only mode', () => {
  const start = () => initialState(s0());
  const notes = (st) => leafAt(st.score, st.cursor).notes;
  const run = (st, ...a) => a.reduce(reduce, st);
  it('starts in note + symbol mode', () => {
    expect(start().tool.withNote).toBe(true);
  });
  it('adds the accent to the note already there, without a new note', () => {
    const st = run(start(), { type: 'tap', staffPosition: 5 }, { type: 'setWithNote', on: false }, { type: 'toggleAccent' }, { type: 'tap', staffPosition: 5 });
    expect(notes(st).length).toBe(1);
    expect(notes(st)[0].articulations).toEqual([Articulation.ACCENT]);
  });
  it('a second tap with the same symbol removes it again', () => {
    const st = run(start(), { type: 'tap', staffPosition: 5 }, { type: 'setWithNote', on: false }, { type: 'toggleAccent' }, { type: 'tap', staffPosition: 5 }, { type: 'tap', staffPosition: 5 });
    expect(notes(st)[0].articulations).toEqual([]);
  });
  it('applies hand, head and technique the same way, and keeps the rest of the note', () => {
    let st = run(start(), { type: 'tap', staffPosition: 8 }, { type: 'setWithNote', on: false });
    st = run(st, { type: 'setSticking', sticking: Sticking.L }, { type: 'setHead', head: Notehead.DIAMOND }, { type: 'setTech', tech: Mark.OPEN }, { type: 'tap', staffPosition: 8 });
    expect(notes(st)[0]).toMatchObject({ slotId: 'hihat', sticking: 'L', head: 'diamond', marks: ['open'] });
  });
  it('in an empty cell it does nothing and says so', () => {
    const st = run(start(), { type: 'setWithNote', on: false }, { type: 'toggleAccent' }, { type: 'tap', staffPosition: 5 });
    expect(notes(st)).toEqual([]);
    expect(st.refused).toBe('noNoteThere');
  });
  it('a tap anywhere in the cell reaches its note, whatever the height', () => {
    const st = run(start(), { type: 'tap', staffPosition: 5 }, { type: 'setWithNote', on: false }, { type: 'toggleAccent' }, { type: 'tap', staffPosition: 11 });
    expect(notes(st).length).toBe(1);
    expect(notes(st)[0]).toMatchObject({ slotId: 'snare', articulations: [Articulation.ACCENT] });
  });
  it('with several notes in the cell it picks the one nearest the tap', () => {
    let st = run(start(), { type: 'tap', staffPosition: 1 }, { type: 'tap', staffPosition: 8 }, { type: 'setWithNote', on: false }, { type: 'setTech', tech: Mark.OPEN });
    st = reduce(st, { type: 'tap', staffPosition: 7 });
    const byId = Object.fromEntries(notes(st).map((n) => [n.slotId, n]));
    expect(byId.hihat.marks).toEqual([Mark.OPEN]);
    expect(byId.kick.marks).toEqual([]);
  });
  it('with nothing chosen it says so', () => {
    const st = run(start(), { type: 'tap', staffPosition: 5 }, { type: 'setWithNote', on: false }, { type: 'tap', staffPosition: 5 });
    expect(st.refused).toBe('nothingToApply');
  });
});

describe('one technique at a time', () => {
  const start = () => initialState(s0());
  it('choosing a technique replaces the previous one', () => {
    let st = reduce(start(), { type: 'setTech', tech: Mark.OPEN });
    st = reduce(st, { type: 'setTech', tech: Roll.BUZZ });
    expect(st.tool.tech).toBe(Roll.BUZZ);
    st = reduce(st, { type: 'setTech', tech: Grace.FLAM });
    expect(st.tool.tech).toBe(Grace.FLAM);
    expect(reduce(st, { type: 'setTech', tech: Grace.FLAM }).tool.tech).toBe(null);
  });
  it('the placed note carries it in the right field', () => {
    for (const [tech, field, value] of [[Mark.CHOKE, 'marks', [Mark.CHOKE]], [Roll.TREMOLO, 'roll', Roll.TREMOLO], [Grace.DRAG, 'grace', Grace.DRAG]]) {
      const st = [{ type: 'setTech', tech }, { type: 'tap', staffPosition: 5 }].reduce(reduce, start());
      expect(leafAt(st.score, st.cursor).notes[0][field]).toEqual(value);
    }
  });
});
